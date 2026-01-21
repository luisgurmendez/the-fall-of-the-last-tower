/**
 * ServerTower tests.
 * Tests tower targeting, damage, and warmup mechanics.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ServerTower } from '../simulation/ServerTower';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerGameContext } from '../game/ServerGameContext';
import { Vector, EntityType, Side } from '@siege/shared';
import { DEFAULT_TOWER_STATS } from '@siege/shared';

describe('ServerTower', () => {
  let context: ServerGameContext;

  beforeEach(() => {
    context = new ServerGameContext({ gameId: 'test-game' });
  });

  describe('Construction', () => {
    it('should create a tier 1 tower with correct stats', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      expect(tower.id).toBe('tower-1');
      expect(tower.entityType).toBe(EntityType.TOWER);
      expect(tower.side).toBe(0);
      expect(tower.lane).toBe('mid');
      expect(tower.tier).toBe(1);
      expect(tower.health).toBe(DEFAULT_TOWER_STATS[1].health);
      expect(tower.maxHealth).toBe(DEFAULT_TOWER_STATS[1].maxHealth);
    });

    it('should create towers with tier-specific stats', () => {
      const tower1 = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const tower2 = new ServerTower({
        id: 'tower-2',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 2,
      });

      const tower3 = new ServerTower({
        id: 'tower-3',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 3,
      });

      expect(tower1.health).toBe(DEFAULT_TOWER_STATS[1].health);
      expect(tower2.health).toBe(DEFAULT_TOWER_STATS[2].health);
      expect(tower3.health).toBe(DEFAULT_TOWER_STATS[3].health);
    });
  });

  describe('Combat', () => {
    it('should take damage', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const initialHealth = tower.health;
      tower.takeDamage(500, 'physical');

      expect(tower.health).toBeLessThan(initialHealth);
    });

    it('should reduce physical damage with armor', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const initialHealth = tower.health;
      const armor = DEFAULT_TOWER_STATS[1].armor;
      tower.takeDamage(100, 'physical');

      const expectedDamage = 100 * (1 - armor / (100 + armor));
      expect(tower.health).toBeCloseTo(initialHealth - expectedDamage, 1);
    });

    it('should be destroyed when health reaches 0', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      tower.takeDamage(100000, 'true');

      expect(tower.isDead).toBe(true);
      expect(tower.isDestroyed).toBe(true);
      expect(tower.health).toBe(0);
    });
  });

  describe('Targeting', () => {
    it('should not attack allies', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const allyMinion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(100, 0),
        side: 0, // Same side as tower
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(tower);
      context.addEntity(allyMinion);

      // Update tower
      tower.update(0.1, context);

      // Tower should not target ally
      const snapshot = tower.toSnapshot();
      expect(snapshot.targetEntityId).toBeUndefined();
    });

    it('should attack enemy in range', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(0, 0),
        side: 0,
        lane: 'mid',
        tier: 1,
      });

      const enemyMinion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(100, 0), // Within attack range
        side: 1, // Different side
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(tower);
      context.addEntity(enemyMinion);

      // Need to update context first to register fog of war
      context.update(0.1);

      // Tower should find and target enemy
      tower.update(0.1, context);

      const snapshot = tower.toSnapshot();
      expect(snapshot.targetEntityId).toBe('minion-1');
    });
  });

  describe('Snapshot', () => {
    it('should create correct snapshot', () => {
      const tower = new ServerTower({
        id: 'tower-1',
        position: new Vector(500, -600),
        side: 1,
        lane: 'bot',
        tier: 2,
      });

      const snapshot = tower.toSnapshot();

      expect(snapshot.entityId).toBe('tower-1');
      expect(snapshot.entityType).toBe(EntityType.TOWER);
      expect(snapshot.side).toBe(1);
      expect(snapshot.lane).toBe('bot');
      expect(snapshot.tier).toBe(2);
      expect(snapshot.x).toBe(500);
      expect(snapshot.y).toBe(-600);
      expect(snapshot.health).toBe(DEFAULT_TOWER_STATS[2].health);
      expect(snapshot.isDestroyed).toBe(false);
    });
  });
});
