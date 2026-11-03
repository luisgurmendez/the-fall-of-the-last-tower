/**
 * Pings and emotes on the client (src/core/state/signals.ts): PING and EMOTE
 * events go into the state manager's Signals, a champion's new emote
 * replaces its last, and both go away when their time is up. Their pixel
 * art grids are square.
 */
import { describe, it, expect } from 'bun:test';
import { EMOTES, GameEventType, PING_TYPES } from '@siege/shared';
import { OnlineStateManager } from '@/core/OnlineStateManager';
import { EMOTE_DURATION, PING_DURATION, Signals } from '@/core/state/signals';
import { ART_FOR_TESTS } from '@/ui/signalIcons';

function manager(): OnlineStateManager {
  return new OnlineStateManager({
    gameId: 'game',
    yourSide: 0,
    yourPlayerId: 'player-local',
    players: [{ playerId: 'player-local', championId: 'warrior', side: 0, entityId: 'champ-local' }],
  });
}

describe('Signals', () => {
  it('takes pings and emotes from game events', () => {
    const state = manager();
    state.processStateUpdate({
      tick: 1, timestamp: Date.now(), gameTime: 1, deltas: [],
      events: [
        { type: GameEventType.PING, timestamp: 1, data: { entityId: 'champ-local', side: 0, championId: 'warrior', pingType: 'danger', x: 120, y: -40 } },
        { type: GameEventType.EMOTE, timestamp: 1, data: { entityId: 'champ-local', side: 0, emote: 'gg' } },
      ],
    } as never);
    const signals = state.getSignals();
    expect(signals.getPings()).toHaveLength(1);
    expect(signals.getPings()[0]).toMatchObject({ pingType: 'danger', x: 120, y: -40, championId: 'warrior' });
    expect(signals.getEmote('champ-local')?.emote).toBe('gg');
  });

  it('drops pings and emotes when their time is up; a new emote replaces the last', () => {
    const signals = new Signals();
    signals.addPing({ pingType: 'look', x: 0, y: 0, entityId: 'a', championId: 'warrior', time: 1000 });
    signals.addEmote('a', 'laugh', 1000);
    signals.addEmote('a', 'cry', 1500);
    expect(signals.getEmote('a', 1600)?.emote).toBe('cry');
    expect(signals.getPings(1000 + PING_DURATION - 1)).toHaveLength(1);
    expect(signals.getPings(1000 + PING_DURATION)).toHaveLength(0);
    expect(signals.getEmote('a', 1500 + EMOTE_DURATION)).toBeUndefined();
  });

  it('has square art for every ping and emote', () => {
    for (const type of PING_TYPES) {
      const art = ART_FOR_TESTS.PING_ART[type];
      expect(art.every(row => row.length === art.length)).toBe(true);
    }
    for (const emote of EMOTES) {
      const art = ART_FOR_TESTS.EMOTE_ART[emote];
      expect(art.every(row => row.length === art.length)).toBe(true);
    }
  });
});
