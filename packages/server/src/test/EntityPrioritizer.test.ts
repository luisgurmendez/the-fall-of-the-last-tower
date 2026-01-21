/**
 * EntityPrioritizer Unit Tests
 *
 * Tests priority-based entity filtering for bandwidth optimization.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { EntityPrioritizer, UpdatePriority } from '../network/EntityPrioritizer';
import { EntityType, Vector } from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerChampion } from '../simulation/ServerChampion';

// Mock entity factory
function createMockEntity(
  id: string,
  type: EntityType,
  x: number,
  y: number
): ServerEntity {
  return {
    id,
    entityType: type,
    position: new Vector(x, y),
    toSnapshot: () => ({
      entityId: id,
      entityType: type,
      x,
      y,
    }),
  } as unknown as ServerEntity;
}

function createMockChampion(id: string, x: number, y: number): ServerChampion {
  return createMockEntity(id, EntityType.CHAMPION, x, y) as unknown as ServerChampion;
}

describe('EntityPrioritizer', () => {
  let prioritizer: EntityPrioritizer;

  beforeEach(() => {
    prioritizer = new EntityPrioritizer({
      criticalDistance: 500,
      highDistance: 1000,
      mediumDistance: 1500,
      maxTicksWithoutUpdate: 30,
    });
  });

  describe('calculatePriority', () => {
    it('should return CRITICAL for champions', () => {
      const entity = createMockEntity('champ-1', EntityType.CHAMPION, 5000, 5000);
      const playerChamp = createMockChampion('player', 0, 0);

      const priority = prioritizer.calculatePriority(entity, playerChamp);

      expect(priority).toBe(UpdatePriority.CRITICAL);
    });

    it('should return CRITICAL for towers', () => {
      // Towers are always critical priority regardless of distance
      const entity = createMockEntity('tower-1', EntityType.TOWER, 5000, 5000);
      const playerChamp = createMockChampion('player', 0, 0);

      const priority = prioritizer.calculatePriority(entity, playerChamp);

      expect(priority).toBe(UpdatePriority.CRITICAL);
    });

    it('should return CRITICAL for nearby minions', () => {
      const entity = createMockEntity('minion-1', EntityType.MINION, 100, 100);
      const playerChamp = createMockChampion('player', 0, 0);

      const priority = prioritizer.calculatePriority(entity, playerChamp);

      expect(priority).toBe(UpdatePriority.CRITICAL);
    });

    it('should return HIGH for medium distance minions', () => {
      const entity = createMockEntity('minion-1', EntityType.MINION, 700, 0);
      const playerChamp = createMockChampion('player', 0, 0);

      const priority = prioritizer.calculatePriority(entity, playerChamp);

      expect(priority).toBe(UpdatePriority.HIGH);
    });

    it('should return MEDIUM for far minions', () => {
      const entity = createMockEntity('minion-1', EntityType.MINION, 1200, 0);
      const playerChamp = createMockChampion('player', 0, 0);

      const priority = prioritizer.calculatePriority(entity, playerChamp);

      expect(priority).toBe(UpdatePriority.MEDIUM);
    });

    it('should return LOW for very far minions', () => {
      const entity = createMockEntity('minion-1', EntityType.MINION, 2000, 0);
      const playerChamp = createMockChampion('player', 0, 0);

      const priority = prioritizer.calculatePriority(entity, playerChamp);

      expect(priority).toBe(UpdatePriority.LOW);
    });
  });

  describe('prioritizeEntities', () => {
    it('should always include critical priority entities', () => {
      const playerChamp = createMockChampion('player', 0, 0);
      const nearbyMinion = createMockEntity('minion-1', EntityType.MINION, 100, 100);
      const entities = [nearbyMinion];

      // First tick - should include
      const result1 = prioritizer.prioritizeEntities(entities, playerChamp, 'player-1', 1);
      expect(result1.length).toBe(1);

      // Second tick - should still include (critical always updates)
      const result2 = prioritizer.prioritizeEntities(entities, playerChamp, 'player-1', 2);
      expect(result2.length).toBe(1);
    });

    it('should skip low priority entities on consecutive ticks', () => {
      const playerChamp = createMockChampion('player', 0, 0);
      const farMinion = createMockEntity('minion-1', EntityType.MINION, 2000, 0);
      const entities = [farMinion];

      // First tick - should include
      const result1 = prioritizer.prioritizeEntities(entities, playerChamp, 'player-1', 1);
      expect(result1.length).toBe(1);

      // Second tick - should skip (LOW priority, interval not reached)
      const result2 = prioritizer.prioritizeEntities(entities, playerChamp, 'player-1', 2);
      expect(result2.length).toBe(0);

      // After 15 ticks - should include again
      const result3 = prioritizer.prioritizeEntities(entities, playerChamp, 'player-1', 16);
      expect(result3.length).toBe(1);
    });

    it('should force update after maxTicksWithoutUpdate', () => {
      const playerChamp = createMockChampion('player', 0, 0);
      const farMinion = createMockEntity('minion-1', EntityType.MINION, 2000, 0);
      const entities = [farMinion];

      // First tick
      prioritizer.prioritizeEntities(entities, playerChamp, 'player-1', 1);

      // After max ticks - should force update
      const result = prioritizer.prioritizeEntities(entities, playerChamp, 'player-1', 32);
      expect(result.length).toBe(1);
    });

    it('should return all entities when no player champion', () => {
      const minion1 = createMockEntity('minion-1', EntityType.MINION, 100, 100);
      const minion2 = createMockEntity('minion-2', EntityType.MINION, 2000, 2000);
      const entities = [minion1, minion2];

      const result = prioritizer.prioritizeEntities(entities, null, 'player-1', 1);

      expect(result.length).toBe(2);
    });

    it('should track state per player independently', () => {
      const playerChamp1 = createMockChampion('player1', 0, 0);
      const playerChamp2 = createMockChampion('player2', 0, 0);
      const farMinion = createMockEntity('minion-1', EntityType.MINION, 2000, 0);
      const entities = [farMinion];

      // Player 1 sees entity
      prioritizer.prioritizeEntities(entities, playerChamp1, 'player-1', 1);

      // Player 2 sees entity for first time (should include)
      const result = prioritizer.prioritizeEntities(entities, playerChamp2, 'player-2', 2);
      expect(result.length).toBe(1);
    });
  });

  describe('clearPlayer', () => {
    it('should clear tracking for a player', () => {
      const playerChamp = createMockChampion('player', 0, 0);
      const farMinion = createMockEntity('minion-1', EntityType.MINION, 2000, 0);
      const entities = [farMinion];

      // First tick
      prioritizer.prioritizeEntities(entities, playerChamp, 'player-1', 1);

      // Clear player state
      prioritizer.clearPlayer('player-1');

      // Should now include again (like first time)
      const result = prioritizer.prioritizeEntities(entities, playerChamp, 'player-1', 2);
      expect(result.length).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const playerChamp = createMockChampion('player', 0, 0);
      const nearMinion = createMockEntity('minion-1', EntityType.MINION, 100, 0);
      const farMinion = createMockEntity('minion-2', EntityType.MINION, 2000, 0);
      const entities = [nearMinion, farMinion];

      prioritizer.prioritizeEntities(entities, playerChamp, 'player-1', 1);

      const stats = prioritizer.getStats('player-1', 1);

      expect(stats.critical).toBe(1);
      expect(stats.low).toBe(1);
    });
  });
});
