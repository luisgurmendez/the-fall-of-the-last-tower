/**
 * ServerMinion tests.
 * Tests minion combat, movement, and waypoint following.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerGameContext } from '../game/ServerGameContext';
import { Vector, EntityType, Side } from '@siege/shared';

describe('ServerMinion', () => {
  let context: ServerGameContext;

  beforeEach(() => {
    context = new ServerGameContext({ gameId: 'test-game' });
  });

  describe('Construction', () => {
    it('should create a melee minion with correct stats', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      expect(minion.id).toBe('minion-1');
      expect(minion.entityType).toBe(EntityType.MINION);
      expect(minion.side).toBe(0);
      expect(minion.minionType).toBe('melee');
      expect(minion.lane).toBe('mid');
      expect(minion.health).toBe(477); // Default melee health
    });

    it('should create a caster minion with correct stats', () => {
      const minion = new ServerMinion({
        id: 'minion-2',
        position: new Vector(0, 0),
        side: 1,
        minionType: 'caster',
        lane: 'top',
        waypoints: [],
      });

      expect(minion.minionType).toBe('caster');
      expect(minion.health).toBe(296); // Default caster health
    });

    it('should set waypoints', () => {
      const waypoints = [
        new Vector(0, 0),
        new Vector(100, 0),
        new Vector(200, 0),
      ];

      const minion = new ServerMinion({
        id: 'minion-3',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints,
      });

      expect(minion).toBeDefined();
    });
  });

  describe('Movement', () => {
    it('should move toward waypoint', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [new Vector(1000, 0)],
      });

      context.addEntity(minion);

      const initialX = minion.position.x;
      minion.update(0.1, context);

      // Minion should have moved toward waypoint
      expect(minion.position.x).toBeGreaterThan(initialX);
    });
  });

  describe('Combat', () => {
    it('should take damage', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      const initialHealth = minion.health;
      minion.takeDamage(100, 'physical');

      expect(minion.health).toBeLessThan(initialHealth);
    });

    it('should die when health reaches 0', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      minion.takeDamage(10000, 'true');

      expect(minion.isDead).toBe(true);
      expect(minion.health).toBe(0);
    });

    it('should reduce physical damage with armor', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'siege', // Has 30 armor
        lane: 'mid',
        waypoints: [],
      });

      const initialHealth = minion.health;
      minion.takeDamage(100, 'physical');

      // With 30 armor: reduction = 30/(100+30) = 23.08%
      // Expected damage = 100 * (1 - 0.2308) = 76.92
      const expectedDamage = 100 * (1 - 30 / (100 + 30));
      expect(minion.health).toBeCloseTo(initialHealth - expectedDamage, 1);
    });

    it('should not reduce true damage', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'siege', // Has armor
        lane: 'mid',
        waypoints: [],
      });

      const initialHealth = minion.health;
      minion.takeDamage(100, 'true');

      expect(minion.health).toBe(initialHealth - 100);
    });
  });

  describe('Snapshot', () => {
    it('should create correct snapshot', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(100, 200),
        side: 1,
        minionType: 'caster',
        lane: 'bot',
        waypoints: [],
      });

      const snapshot = minion.toSnapshot();

      expect(snapshot.entityId).toBe('minion-1');
      expect(snapshot.entityType).toBe(EntityType.MINION);
      expect(snapshot.side).toBe(1);
      expect(snapshot.minionType).toBe('caster');
      expect(snapshot.x).toBe(100);
      expect(snapshot.y).toBe(200);
      expect(snapshot.health).toBe(296);
      expect(snapshot.isDead).toBe(false);
    });
  });
});
