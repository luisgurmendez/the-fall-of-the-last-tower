/**
 * A match ends when a nexus is destroyed, and the other side wins.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { CHAMPION_DEFINITIONS, EntityType, type ChampionDefinition } from '@siege/shared';
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
      redNexus.takeDamage(redNexus.health + 1, 'true', undefined, context);

      const winner = await Promise.race([ended, new Promise<number>((_, reject) => setTimeout(() => reject(new Error('game did not end')), 2000))]);
      expect(winner).toBe(0);
      expect(room.getState()).toBe('ended');
    } finally {
      room.stop();
    }
  });
});
