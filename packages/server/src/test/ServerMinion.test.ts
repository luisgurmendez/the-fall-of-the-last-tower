/**
 * ServerMinion tests.
 * Tests minion combat, movement, and waypoint following.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerGameContext } from '../game/ServerGameContext';
import { ServerTower } from '../simulation/ServerTower';
import { Vector, EntityType, Side, CHAMPION_DEFINITIONS, TEAM_BLUE, TEAM_RED } from '@siege/shared';
import { TestChampion } from './ServerTestUtils';

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

  describe('Targeting structures', () => {
    /** A blue melee minion at a red tower, with a red champion standing by */
    function siege() {
      const tower = new ServerTower({ id: 'red-tower', position: new Vector(0, 0), side: 1, lane: 'mid', tier: 1 });
      const minion = new ServerMinion({ id: 'blue-minion', position: new Vector(0, 80), side: 0, minionType: 'melee', lane: 'mid', waypoints: [] });
      const enemy = new TestChampion({ id: 'red-champion', position: new Vector(90, 90), side: TEAM_RED, playerId: 'red', definition: CHAMPION_DEFINITIONS['warrior'] });
      const ally = new TestChampion({ id: 'blue-champion', position: new Vector(-60, 120), side: TEAM_BLUE, playerId: 'blue', definition: CHAMPION_DEFINITIONS['warrior'] });
      context.addEntity(tower);
      context.addEntity(minion);
      context.addChampion(enemy, 'red');
      context.addChampion(ally, 'blue');
      const think = () => {
        context.getFogOfWar().updateVision(context, 1);
        minion.update(0.6, context);
      };
      return { tower, minion, enemy, ally, think };
    }

    it('hits a tower rather than a champion standing by', () => {
      const { minion, think } = siege();
      think();
      expect(minion.getAttackTargetId()).toBe('red-tower');
    });

    it('keeps hitting the tower when an enemy minion walks up', () => {
      const { minion, think } = siege();
      think();
      context.addEntity(new ServerMinion({ id: 'red-minion', position: new Vector(-40, 80), side: 1, minionType: 'melee', lane: 'mid', waypoints: [] }));
      think();
      expect(minion.getAttackTargetId()).toBe('red-tower');
    });

    it('leaves the tower for a champion that hits an allied champion (call for help)', () => {
      const { minion, enemy, ally, think } = siege();
      think();
      ally.takeDamage(10, 'true', enemy.id, context);
      think();
      expect(minion.getAttackTargetId()).toBe('red-champion');
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
