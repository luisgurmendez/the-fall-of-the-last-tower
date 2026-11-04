/**
 * The player's control settings (src/core/input/controls.ts): the cast mode
 * and the key bindings, kept in the browser's storage. Anything wrong in
 * what was stored (an old version, a hand edit, a broken write) falls back
 * to the defaults for just that part; listeners hear every change.
 */
import { describe, it, expect } from 'bun:test';
import { DEFAULT_KEYS } from '@/core/input/keyBindings';
import { CONTROLS_STORAGE_KEY, Controls, DEFAULT_CAST_MODE, parseControlSettings, type SettingsStorage } from '@/core/input/controls';

function memoryStorage(initial: Record<string, string> = {}): SettingsStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => { data[key] = value; },
  };
}

const stored = (value: unknown) => memoryStorage({ [CONTROLS_STORAGE_KEY]: JSON.stringify(value) });

describe('parseControlSettings', () => {
  it('nothing stored: the defaults (quick cast, the usual keys)', () => {
    expect(DEFAULT_CAST_MODE).toBe('quick');
    expect(parseControlSettings(null)).toEqual({ castMode: 'quick', keys: DEFAULT_KEYS });
    expect(parseControlSettings(undefined)).toEqual({ castMode: 'quick', keys: DEFAULT_KEYS });
  });

  it('not an object: the defaults', () => {
    for (const raw of [42, 'quick', true, [], [1, 2]]) {
      expect(parseControlSettings(raw)).toEqual({ castMode: 'quick', keys: DEFAULT_KEYS });
    }
  });

  it('keeps a valid cast mode', () => {
    expect(parseControlSettings({ castMode: 'normal' }).castMode).toBe('normal');
    expect(parseControlSettings({ castMode: 'quick_indicator' }).castMode).toBe('quick_indicator');
  });

  it('an unknown cast mode falls back to quick cast, keeping the keys', () => {
    const settings = parseControlSettings({ castMode: 'smart', keys: { recall: 'h' } });
    expect(settings.castMode).toBe('quick');
    expect(settings.keys.recall).toBe('h');
  });

  it('keeps the keys it can and the defaults for the rest', () => {
    const settings = parseControlSettings({ keys: { ability_q: 'z', recall: 'h' } });
    expect(settings.keys.ability_q).toBe('z');
    expect(settings.keys.recall).toBe('h');
    expect(settings.keys.ability_w).toBe('w');
  });

  it('drops unknown actions, keys that aren\'t strings, and reserved keys', () => {
    const settings = parseControlSettings({ keys: { fly: 'k', ability_q: 7, ability_w: 'Escape', ability_e: '', ability_r: null } });
    expect(settings.keys).toEqual(DEFAULT_KEYS);
    expect('fly' in settings.keys).toBe(false);
  });

  it('keys stored in capitals are read as the same key', () => {
    expect(parseControlSettings({ keys: { recall: 'H' } }).keys.recall).toBe('h');
  });

  it('two actions stored on one key: still one key each', () => {
    const settings = parseControlSettings({ keys: { ability_q: 'x', ability_w: 'x' } });
    const all = Object.values(settings.keys);
    expect(new Set(all).size).toBe(all.length);
    expect(settings.keys.ability_w).toBe('x');
  });

  it('a key stored on another action that kept its default swaps them', () => {
    const settings = parseControlSettings({ keys: { recall: 's' } });
    expect(settings.keys.recall).toBe('s');
    expect(settings.keys.stop).toBe('b');
  });
});

describe('Controls', () => {
  it('starts from what was stored', () => {
    const controls = new Controls(stored({ castMode: 'normal', keys: { recall: 'h' } }));
    expect(controls.get().castMode).toBe('normal');
    expect(controls.keyFor('recall')).toBe('h');
  });

  it('broken JSON in storage: the defaults', () => {
    const controls = new Controls(memoryStorage({ [CONTROLS_STORAGE_KEY]: '{not json' }));
    expect(controls.get()).toEqual({ castMode: 'quick', keys: DEFAULT_KEYS });
  });

  it('no storage at all (blocked): the defaults, and changes still work for the session', () => {
    const controls = new Controls(null);
    expect(controls.get().castMode).toBe('quick');
    controls.setCastMode('normal');
    expect(controls.get().castMode).toBe('normal');
  });

  it('storage that throws: the defaults, and changes still work for the session', () => {
    const throwing: SettingsStorage = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    };
    const controls = new Controls(throwing);
    expect(controls.get().keys).toEqual(DEFAULT_KEYS);
    expect(() => controls.setKey('recall', 'h')).not.toThrow();
    expect(controls.keyFor('recall')).toBe('h');
  });

  it('a cast mode change is saved', () => {
    const storage = memoryStorage();
    new Controls(storage).setCastMode('quick_indicator');
    expect(new Controls(storage).get().castMode).toBe('quick_indicator');
  });

  it('a key change is saved, and a swap saves both', () => {
    const storage = memoryStorage();
    const controls = new Controls(storage);
    const result = controls.setKey('ability_q', 'w');
    expect(result).toEqual({ swappedWith: 'ability_w' });
    const reloaded = new Controls(storage);
    expect(reloaded.keyFor('ability_q')).toBe('w');
    expect(reloaded.keyFor('ability_w')).toBe('q');
  });

  it('a reserved key is refused and nothing is saved', () => {
    const storage = memoryStorage();
    const controls = new Controls(storage);
    expect(controls.setKey('ability_q', 'Escape')).toEqual({ error: 'reserved' });
    expect(controls.keyFor('ability_q')).toBe('q');
    expect(storage.data[CONTROLS_STORAGE_KEY]).toBeUndefined();
  });

  it('reset goes back to the defaults and saves it', () => {
    const storage = stored({ castMode: 'normal', keys: { recall: 'h' } });
    const controls = new Controls(storage);
    controls.reset();
    expect(controls.get()).toEqual({ castMode: 'quick', keys: DEFAULT_KEYS });
    expect(new Controls(storage).get()).toEqual({ castMode: 'quick', keys: DEFAULT_KEYS });
  });

  it('listeners hear every change until they unsubscribe', () => {
    const controls = new Controls(memoryStorage());
    const heard: string[] = [];
    const unsubscribe = controls.subscribe(settings => heard.push(`${settings.castMode}:${settings.keys.recall}`));
    controls.setCastMode('normal');
    controls.setKey('recall', 'h');
    controls.reset();
    unsubscribe();
    controls.setCastMode('normal');
    expect(heard).toEqual(['normal:b', 'normal:h', 'quick:b']);
  });

  it("a refused key isn't a change: listeners hear nothing", () => {
    const controls = new Controls(memoryStorage());
    let calls = 0;
    controls.subscribe(() => calls++);
    controls.setKey('ability_q', 'Enter');
    expect(calls).toBe(0);
  });

  it('get() hands out a copy: changing it changes nothing', () => {
    const controls = new Controls(memoryStorage());
    const settings = controls.get() as { keys: Record<string, string> };
    settings.keys.recall = 'z';
    expect(controls.keyFor('recall')).toBe('b');
  });
});
