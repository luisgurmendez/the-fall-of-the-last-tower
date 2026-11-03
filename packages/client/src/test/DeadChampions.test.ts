/**
 * Dead champions and the scoreboard's kills.
 *
 * The client takes a champion out of its entity map when it dies, but a dead
 * champion still changes until it respawns (its gold ticks up, an ally's kill
 * pays it an assist, its cooldowns run): OnlineStateManager keeps it aside and
 * merges those deltas, so the HUD and the Tab scoreboard don't freeze. Kill
 * events carry the new kills, deaths and assists of everyone in the kill.
 */

import { describe, it, expect } from 'bun:test';
import { OnlineStateManager } from '@/core/OnlineStateManager';
import { EntityChangeMask, EntityType, GameEventType, type ChampionSnapshot, type StateUpdate } from '@siege/shared';

const LOCAL = 'champ-local';

function manager(): OnlineStateManager {
  return new OnlineStateManager({
    gameId: 'game',
    yourSide: 0,
    yourPlayerId: 'player-local',
    players: [
      { playerId: 'player-local', championId: 'warrior', side: 0, entityId: LOCAL },
      { playerId: 'player-enemy', championId: 'magnus', side: 1, entityId: 'champ-enemy' },
    ],
  });
}

function update(tick: number, deltas: StateUpdate['deltas'], events: StateUpdate['events'] = []): StateUpdate {
  return { tick, timestamp: Date.now(), gameTime: tick / 30, deltas, events } as StateUpdate;
}

const champion = {
  entityId: LOCAL,
  entityType: EntityType.CHAMPION,
  championId: 'warrior',
  side: 0,
  x: 100,
  y: 100,
  health: 600,
  maxHealth: 600,
  gold: 500,
  kills: 0,
  deaths: 0,
  assists: 0,
  isDead: false,
} as unknown as ChampionSnapshot;

describe('Dead champions', () => {
  it('keeps a dead champion aside: its gold and assists keep changing until it respawns', () => {
    const state = manager();
    state.processStateUpdate(update(1, [{ entityId: LOCAL, changeMask: 0xFFFF, data: champion }]));
    expect(state.getLocalPlayerEntity()).toBeDefined();

    // Dies: out of the entity map, but still known
    state.processStateUpdate(update(2, [{
      entityId: LOCAL, changeMask: EntityChangeMask.STATE, data: { isDead: true, respawnTimer: 10 } as Partial<ChampionSnapshot>,
    }]));
    expect(state.getLocalPlayerEntity()).toBeUndefined();
    expect(state.getChampionSnapshot(LOCAL)?.isDead).toBe(true);

    // Its gold ticks and an ally's kill pays it an assist while it waits
    state.processStateUpdate(update(3, [{
      entityId: LOCAL, changeMask: EntityChangeMask.GOLD | EntityChangeMask.SCORE, data: { gold: 650, assists: 1 } as Partial<ChampionSnapshot>,
    }]));
    expect(state.getChampionSnapshot(LOCAL)?.gold).toBe(650);
    expect(state.getChampionSnapshot(LOCAL)?.assists).toBe(1);
    expect(state.getDeadChampions()).toHaveLength(1);

    // Respawns: back in the entity map from its full snapshot
    state.processStateUpdate(update(4, [{
      entityId: LOCAL, changeMask: 0xFFFF, data: { ...champion, gold: 660, assists: 1, x: -1440, y: 1440 },
    }]));
    expect(state.getLocalPlayerEntity()?.snapshot).toMatchObject({ gold: 660, assists: 1 });
    expect(state.getDeadChampions()).toHaveLength(0);
  });

  it('takes kills, deaths and assists from kill events, for champions out of sight', () => {
    const state = manager();
    state.processStateUpdate(update(1, [], [{
      type: GameEventType.CHAMPION_KILL,
      timestamp: 0,
      data: {
        victimId: LOCAL, victimSide: 0, victimChampionId: 'warrior',
        killerId: 'champ-enemy', killerSide: 1, killerType: EntityType.CHAMPION, killerChampionId: 'magnus',
        scores: [
          { entityId: LOCAL, kills: 0, deaths: 1, assists: 0 },
          { entityId: 'champ-enemy', kills: 1, deaths: 0, assists: 0 },
        ],
      },
    }]));
    expect(state.getScore('champ-enemy')).toEqual({ kills: 1, deaths: 0, assists: 0 });
    expect(state.getScore(LOCAL)?.deaths).toBe(1);
  });
});
