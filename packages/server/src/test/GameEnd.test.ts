/**
 * A match ends when a nexus is destroyed, and the other side wins.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { CHAMPION_DEFINITIONS, EntityType, InputType, type ChampionDefinition } from '@siege/shared';
import { GameRoom } from '../game/GameRoom';
import type { ServerGameContext } from '../game/ServerGameContext';

describe('Game end', () => {
  test('destroying the red nexus ends the game with blue winning', async () => {
    let resolveEnd: (side: number) => void = () => {};
    const ended = new Promise<number>(resolve => { resolveEnd = resolve; });

    const room = new GameRoom({
      gameId: 'end-test',
      players: [
        { playerId: 'a', side: 0, championId: 'vex', connected: true },
        { playerId: 'b', side: 1, championId: 'vile', connected: true },
      ],
      championDefinitions: new Map<string, ChampionDefinition>(Object.entries(CHAMPION_DEFINITIONS)),
      onGameEnd: side => resolveEnd(side),
    });

    room.start();
    try {
      const context = (room as unknown as { context: ServerGameContext }).context;
      const redNexus = context.getAllEntities().find(e => e.entityType === EntityType.NEXUS && e.side === 1)!;

      // The nexus is protected until an inhibitor is down, and that takes its lane's towers first
      expect(redNexus.takeDamage(1000, 'true', undefined, context)).toBe(0);
      const redMidTowers = context.getAllEntities()
        .filter(e => e.entityType === EntityType.TOWER && e.side === 1 && (e as unknown as { lane: string }).lane === 'mid')
        .sort((a, b) => (a as unknown as { tier: number }).tier - (b as unknown as { tier: number }).tier);
      for (const tower of redMidTowers) tower.takeDamage(tower.health + 1, 'true', undefined, context);
      expect(redNexus.takeDamage(1000, 'true', undefined, context)).toBe(0);

      const redMidInhibitor = context.getAllEntities()
        .find(e => e.entityType === EntityType.INHIBITOR && e.side === 1 && (e as unknown as { lane: string }).lane === 'mid')!;
      redMidInhibitor.takeDamage(redMidInhibitor.health + 1, 'true', undefined, context);

      redNexus.takeDamage(redNexus.health + 1, 'true', undefined, context);

      const winner = await Promise.race([ended, new Promise<number>((_, reject) => setTimeout(() => reject(new Error('game did not end')), 2000))]);
      expect(winner).toBe(0);
      expect(room.getState()).toBe('ended');

      // Everyone's final line, for the end-of-match scoreboard
      const stats = room.getFinalStats();
      expect(stats.map(line => [line.playerId, line.championId, line.side])).toEqual([['a', 'vex', 0], ['b', 'vile', 1]]);
      expect(stats[0]).toMatchObject({ level: 1, kills: 0, deaths: 0, assists: 0, cs: 0 });
      expect(stats[0].items).toHaveLength(6);
    } finally {
      room.stop();
    }
  });
});

describe('Surrender', () => {
  function practiceRoom(onGameEnd: (side: number) => void) {
    return new GameRoom({
      gameId: 'surrender-test',
      players: [
        { playerId: 'human', side: 0, championId: 'vex', connected: true },
        { playerId: 'bot', side: 1, championId: 'vile', connected: true, isBot: true },
      ],
      championDefinitions: new Map<string, ChampionDefinition>(Object.entries(CHAMPION_DEFINITIONS)),
      onGameEnd,
    });
  }

  test('a player who surrenders loses the match', () => {
    let winner = null as number | null;
    const room = practiceRoom(side => { winner = side; });
    room.start();
    try {
      room.handleInput('human', { type: InputType.SURRENDER, seq: 1, clientTime: 0 });
      expect(winner).toBe(1);
      expect(room.getState()).toBe('ended');
    } finally {
      room.stop();
    }
  });

  test('a bot can\'t surrender', () => {
    let winner = null as number | null;
    const room = practiceRoom(side => { winner = side; });
    room.start();
    try {
      room.handleInput('bot', { type: InputType.SURRENDER, seq: 1, clientTime: 0 });
      expect(winner).toBeNull();
      expect(room.getState()).toBe('playing');
    } finally {
      room.stop();
    }
  });
});

describe('Structure order', () => {
  test('an inner tower takes no damage while its outer tower stands', async () => {
    const { Simulation } = await import('../sim');
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false });
    try {
      const towers = sim.context.getAllEntities()
        .filter(e => e.entityType === EntityType.TOWER && e.side === 1 && (e as unknown as { lane: string }).lane === 'top') as unknown as
          { tier: number; health: number; takeDamage: (amount: number, type: 'true', source: undefined, context: unknown) => number }[];
      const outer = towers.find(t => t.tier === 1)!;
      const inner = towers.find(t => t.tier === 2)!;

      expect(inner.takeDamage(500, 'true', undefined, sim.context)).toBe(0);
      outer.takeDamage(outer.health + 1, 'true', undefined, sim.context);
      expect(inner.takeDamage(500, 'true', undefined, sim.context)).toBeGreaterThan(0);
    } finally {
      sim.dispose();
    }
  });
});

describe('Kill announcements', () => {
  test('champion kills send CHAMPION_KILL, the first one marked first blood', async () => {
    const { Simulation } = await import('../sim');
    const { GameEventType } = await import('@siege/shared');
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    try {
      const killer = sim.addChampion({ playerId: 'blue', championId: 'vex', side: 'blue', at: { x: 0, y: 0 } });
      const first = sim.addChampion({ playerId: 'red1', championId: 'vile', side: 'red', at: { x: 100, y: 0 } });
      const second = sim.addChampion({ playerId: 'red2', championId: 'lume', side: 'red', at: { x: -100, y: 0 } });

      first.takeDamage(first.health + 1000, 'true', killer.id, sim.context);
      second.takeDamage(second.health + 1000, 'true', killer.id, sim.context);
      sim.run(0.1);

      const kills = sim.recorder.events.filter(e => e.type === GameEventType.CHAMPION_KILL);
      expect(kills.map(k => [k.data.victimId, k.data.firstBlood])).toEqual([[first.id, true], [second.id, false]]);
      expect(killer.kills).toBe(2);
    } finally {
      sim.dispose();
    }
  });
});
