/**
 * Key bindings (src/core/input/keyBindings.ts): every bindable action has
 * a default key (the ones the game always used), no two actions share a
 * key, a rebind onto a key another action has swaps them, keys the game
 * keeps for itself can't be bound, and keys are matched however the
 * browser spells them (Shift+Q is still Q).
 */
import { describe, it, expect } from 'bun:test';
import {
  CONTROL_ACTIONS,
  DEFAULT_KEYS,
  abilityAction,
  actionForKey,
  isReservedKey,
  itemAction,
  keyLabel,
  normalizeKey,
  rebind,
  summonerAction,
  type ControlAction,
} from '@/core/input/keyBindings';

describe('Default keys', () => {
  it('are the keys the game always used', () => {
    expect(DEFAULT_KEYS.ability_q).toBe('q');
    expect(DEFAULT_KEYS.ability_w).toBe('w');
    expect(DEFAULT_KEYS.ability_e).toBe('e');
    expect(DEFAULT_KEYS.ability_r).toBe('r');
    expect(DEFAULT_KEYS.summoner_1).toBe('d');
    expect(DEFAULT_KEYS.summoner_2).toBe('f');
    expect([1, 2, 3, 4, 5, 6].map(slot => DEFAULT_KEYS[`item_${slot}` as ControlAction])).toEqual(['1', '2', '3', '6', '7', '8']);
    expect(DEFAULT_KEYS.ward).toBe('4');
    expect(DEFAULT_KEYS.control_ward).toBe('5');
    expect(DEFAULT_KEYS.attack_move).toBe('a');
    expect(DEFAULT_KEYS.stop).toBe('s');
    expect(DEFAULT_KEYS.recall).toBe('b');
    expect(DEFAULT_KEYS.shop).toBe('p');
    expect(DEFAULT_KEYS.scoreboard).toBe('Tab');
    expect(DEFAULT_KEYS.ping).toBe('g');
    expect(DEFAULT_KEYS.emotes).toBe('t');
    expect(DEFAULT_KEYS.camera_center).toBe(' ');
    expect(DEFAULT_KEYS.camera_lock).toBe('y');
    expect(DEFAULT_KEYS.zoom_in).toBe('.');
    expect(DEFAULT_KEYS.zoom_out).toBe(',');
  });

  it('no two actions share a key', () => {
    const keys = Object.values(DEFAULT_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every action listed has a default, and every default is listed', () => {
    const listed = CONTROL_ACTIONS.map(info => info.action).sort();
    expect(listed).toEqual((Object.keys(DEFAULT_KEYS) as ControlAction[]).sort());
    expect(new Set(listed).size).toBe(listed.length);
  });

  it('every action has a label and a group, for the controls panel', () => {
    for (const info of CONTROL_ACTIONS) {
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.group.length).toBeGreaterThan(0);
    }
  });

  it('no default is a reserved key', () => {
    for (const key of Object.values(DEFAULT_KEYS)) expect(isReservedKey(key)).toBe(false);
  });
});

describe('Slot actions', () => {
  it('ability slots map to their actions', () => {
    expect(abilityAction('Q')).toBe('ability_q');
    expect(abilityAction('W')).toBe('ability_w');
    expect(abilityAction('E')).toBe('ability_e');
    expect(abilityAction('R')).toBe('ability_r');
  });

  it('summoner slots 0 and 1 are D and F', () => {
    expect(summonerAction(0)).toBe('summoner_1');
    expect(summonerAction(1)).toBe('summoner_2');
  });

  it('item slots 0 to 5 map to item_1 to item_6', () => {
    expect([0, 1, 2, 3, 4, 5].map(itemAction)).toEqual(['item_1', 'item_2', 'item_3', 'item_4', 'item_5', 'item_6']);
  });
});

describe('normalizeKey', () => {
  it('lowercases letters (Shift or Caps Lock held)', () => {
    expect(normalizeKey('Q')).toBe('q');
    expect(normalizeKey('q')).toBe('q');
    expect(normalizeKey('Ñ')).toBe('ñ');
  });

  it('leaves named keys, digits, symbols and space alone', () => {
    expect(normalizeKey('Tab')).toBe('Tab');
    expect(normalizeKey('ArrowUp')).toBe('ArrowUp');
    expect(normalizeKey('F3')).toBe('F3');
    expect(normalizeKey('4')).toBe('4');
    expect(normalizeKey('.')).toBe('.');
    expect(normalizeKey(' ')).toBe(' ');
  });
});

describe('Reserved keys', () => {
  it('the menu, chat, modifiers and function keys are kept by the game', () => {
    for (const key of ['Escape', 'Enter', 'Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'F1', 'F3', 'F4', 'F5', 'F11', 'F12', 'Dead', 'Unidentified', 'Process', '']) {
      expect(isReservedKey(key)).toBe(true);
    }
  });

  it('letters, digits, symbols, Space, Tab and arrows can be bound', () => {
    for (const key of ['q', 'z', '0', '9', '-', '`', ' ', 'Tab', 'ArrowLeft', 'Backspace', 'Delete', 'Home']) {
      expect(isReservedKey(key)).toBe(false);
    }
  });
});

describe('keyLabel', () => {
  it('shows letters in capitals', () => {
    expect(keyLabel('q')).toBe('Q');
    expect(keyLabel('ñ')).toBe('Ñ');
  });

  it('names the keys that print nothing', () => {
    expect(keyLabel(' ')).toBe('Space');
    expect(keyLabel('Tab')).toBe('Tab');
    expect(keyLabel('ArrowUp')).toBe('Up');
    expect(keyLabel('ArrowDown')).toBe('Down');
    expect(keyLabel('ArrowLeft')).toBe('Left');
    expect(keyLabel('ArrowRight')).toBe('Right');
    expect(keyLabel('Backspace')).toBe('Backspace');
  });

  it('digits and symbols show as they are', () => {
    expect(keyLabel('4')).toBe('4');
    expect(keyLabel('.')).toBe('.');
    expect(keyLabel(',')).toBe(',');
  });
});

describe('rebind', () => {
  it('moves an action to a free key', () => {
    const result = rebind(DEFAULT_KEYS, 'recall', 'h');
    if ('error' in result) throw new Error('unexpected error');
    expect(result.bindings.recall).toBe('h');
    expect(result.swappedWith).toBeNull();
    // Nothing else moved
    for (const action of Object.keys(DEFAULT_KEYS) as ControlAction[]) {
      if (action !== 'recall') expect(result.bindings[action]).toBe(DEFAULT_KEYS[action]);
    }
  });

  it('onto a key another action has, swaps the two', () => {
    const result = rebind(DEFAULT_KEYS, 'ability_q', 'w');
    if ('error' in result) throw new Error('unexpected error');
    expect(result.bindings.ability_q).toBe('w');
    expect(result.bindings.ability_w).toBe('q');
    expect(result.swappedWith).toBe('ability_w');
  });

  it('onto its own key, changes nothing', () => {
    const result = rebind(DEFAULT_KEYS, 'stop', 's');
    if ('error' in result) throw new Error('unexpected error');
    expect(result.bindings).toEqual(DEFAULT_KEYS);
    expect(result.swappedWith).toBeNull();
  });

  it('takes the key however it was spelled', () => {
    const result = rebind(DEFAULT_KEYS, 'shop', 'O');
    if ('error' in result) throw new Error('unexpected error');
    expect(result.bindings.shop).toBe('o');
  });

  it('a capital onto a key another action has still swaps', () => {
    const result = rebind(DEFAULT_KEYS, 'recall', 'S');
    if ('error' in result) throw new Error('unexpected error');
    expect(result.bindings.recall).toBe('s');
    expect(result.bindings.stop).toBe('b');
  });

  it('refuses a reserved key and changes nothing', () => {
    for (const key of ['Escape', 'Enter', 'Control', 'F5']) {
      const result = rebind(DEFAULT_KEYS, 'ability_q', key);
      expect(result).toEqual({ error: 'reserved' });
    }
    expect(DEFAULT_KEYS.ability_q).toBe('q');
  });

  it("doesn't change the bindings it was given", () => {
    const before = { ...DEFAULT_KEYS };
    rebind(DEFAULT_KEYS, 'ability_q', 'w');
    expect(DEFAULT_KEYS).toEqual(before);
  });

  it('keeps every key unique after many rebinds', () => {
    let bindings = DEFAULT_KEYS;
    const keys = ['w', 'q', 'a', '1', 'Tab', ' ', 'z', 'x', 'r', '8'];
    const actions = CONTROL_ACTIONS.map(info => info.action);
    for (let i = 0; i < 60; i++) {
      const result = rebind(bindings, actions[(i * 7) % actions.length], keys[i % keys.length]);
      if ('error' in result) throw new Error('unexpected error');
      bindings = result.bindings;
      const all = Object.values(bindings);
      expect(new Set(all).size).toBe(all.length);
    }
  });
});

describe('actionForKey', () => {
  it('finds the action a key is bound to', () => {
    expect(actionForKey(DEFAULT_KEYS, 'q')).toBe('ability_q');
    expect(actionForKey(DEFAULT_KEYS, 'Q')).toBe('ability_q');
    expect(actionForKey(DEFAULT_KEYS, 'Tab')).toBe('scoreboard');
    expect(actionForKey(DEFAULT_KEYS, ' ')).toBe('camera_center');
  });

  it('null for an unbound key', () => {
    expect(actionForKey(DEFAULT_KEYS, 'z')).toBeNull();
    expect(actionForKey(DEFAULT_KEYS, 'Escape')).toBeNull();
  });
});
