/**
 * The practice tools on the client (src/core/state/practiceTools.ts): each
 * tool has a key (Shift + a letter, in practice matches), and the server's
 * PRACTICE_TOOLS events about the local champion say which toggles are on
 * (no cooldowns, invulnerable, frozen bots) for the practice panel.
 */
import { describe, it, expect } from 'bun:test';
import { GameEventType, PRACTICE_TOOLS, type PracticeToggles } from '@siege/shared';
import { OnlineStateManager } from '@/core/OnlineStateManager';
import { PRACTICE_TOOL_INFO, PracticeTogglesStore, practiceToolForKey } from '@/core/state/practiceTools';

function manager(): OnlineStateManager {
  return new OnlineStateManager({
    gameId: 'game',
    yourSide: 0,
    yourPlayerId: 'player-local',
    practice: true,
    players: [{ playerId: 'player-local', championId: 'warrior', side: 0, entityId: 'champ-local' }],
  });
}

const practiceEvent = (data: Record<string, unknown>) => ({ type: GameEventType.PRACTICE_TOOLS, timestamp: 1, data });

function after(state: OnlineStateManager, ...events: unknown[]): PracticeToggles {
  state.processStateUpdate({ tick: 1, timestamp: Date.now(), gameTime: 1, deltas: [], events } as never);
  return state.getPracticeToggles().get();
}

describe('Practice tool keys', () => {
  it('every tool has a label and its own letter', () => {
    const keys = PRACTICE_TOOLS.map(tool => PRACTICE_TOOL_INFO[tool].key);
    expect(new Set(keys).size).toBe(PRACTICE_TOOLS.length);
    for (const tool of PRACTICE_TOOLS) {
      expect(PRACTICE_TOOL_INFO[tool].label.length).toBeGreaterThan(0);
      expect(PRACTICE_TOOL_INFO[tool].key).toMatch(/^[a-z]$/);
    }
  });

  it('Shift + its letter is the tool, whatever the case', () => {
    expect(practiceToolForKey({ key: 'L', shiftKey: true })).toBe('level_up');
    // Caps Lock on: Shift gives the lowercase letter
    expect(practiceToolForKey({ key: 'l', shiftKey: true })).toBe('level_up');
    for (const tool of PRACTICE_TOOLS) {
      expect(practiceToolForKey({ key: PRACTICE_TOOL_INFO[tool].key.toUpperCase(), shiftKey: true })).toBe(tool);
    }
  });

  it('the letter alone, with Ctrl, Alt or Cmd, or another key is not a tool', () => {
    expect(practiceToolForKey({ key: 'l', shiftKey: false })).toBeNull();
    expect(practiceToolForKey({ key: 'L', shiftKey: false })).toBeNull();
    expect(practiceToolForKey({ key: 'L', shiftKey: true, ctrlKey: true })).toBeNull();
    expect(practiceToolForKey({ key: 'L', shiftKey: true, altKey: true })).toBeNull();
    expect(practiceToolForKey({ key: 'L', shiftKey: true, metaKey: true })).toBeNull();
    expect(practiceToolForKey({ key: 'Q', shiftKey: true })).toBeNull();
    expect(practiceToolForKey({ key: 'Enter', shiftKey: true })).toBeNull();
    expect(practiceToolForKey({ key: 'Shift', shiftKey: true })).toBeNull();
  });
});

describe('Practice toggles', () => {
  it('start off', () => {
    expect(new PracticeTogglesStore().get()).toEqual({ noCooldowns: false, invulnerable: false, freezeBots: false });
    expect(manager().getPracticeToggles().get()).toEqual({ noCooldowns: false, invulnerable: false, freezeBots: false });
  });

  it('follow the events about the local champion', () => {
    const state = manager();
    expect(after(state, practiceEvent({ entityId: 'champ-local', tool: 'toggle_invulnerable', noCooldowns: false, invulnerable: true, freezeBots: false })))
      .toEqual({ noCooldowns: false, invulnerable: true, freezeBots: false });
    expect(after(state, practiceEvent({ entityId: 'champ-local', tool: null, noCooldowns: true, invulnerable: false, freezeBots: true })))
      .toEqual({ noCooldowns: true, invulnerable: false, freezeBots: true });
  });

  it('ignore events about other champions, and anything but true is off', () => {
    const state = manager();
    expect(after(state, practiceEvent({ entityId: 'champ-other', tool: 'gold', noCooldowns: true, invulnerable: true, freezeBots: true })))
      .toEqual({ noCooldowns: false, invulnerable: false, freezeBots: false });
    expect(after(state, practiceEvent({ entityId: 'champ-local', tool: 'gold', noCooldowns: 'yes', invulnerable: 1 })))
      .toEqual({ noCooldowns: false, invulnerable: false, freezeBots: false });
  });

  it('tell who listens, until they stop', () => {
    const store = new PracticeTogglesStore();
    const heard: PracticeToggles[] = [];
    const stop = store.subscribe(toggles => heard.push(toggles));
    store.set({ noCooldowns: true, invulnerable: false, freezeBots: false });
    stop();
    store.set({ noCooldowns: false, invulnerable: false, freezeBots: false });
    expect(heard).toEqual([{ noCooldowns: true, invulnerable: false, freezeBots: false }]);
  });

  it('a copy is handed out: changing it changes nothing', () => {
    const store = new PracticeTogglesStore();
    const toggles = store.get();
    toggles.invulnerable = true;
    expect(store.get().invulnerable).toBe(false);
  });
});
