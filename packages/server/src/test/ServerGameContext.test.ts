/**
 * ServerGameContext tests.
 * Tests entity management, game state, and updates.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ServerGameContext } from '../game/ServerGameContext';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerTower } from '../simulation/ServerTower';
import { Vector, GameEventType } from '@siege/shared';

describe('ServerGameContext', () => {
  let context: ServerGameContext;

  beforeEach(() => {
    context = new ServerGameContext({ gameId: 'test-game' });
  });

  describe('Entity Management', () => {
    it('should generate unique entity IDs', () => {
      const id1 = context.generateEntityId();
      const id2 = context.generateEntityId();
      const id3 = context.generateEntityId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).toContain('test-game');
    });

    it('should add and retrieve entities', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(minion);
      const retrieved = context.getEntity('minion-1');

      expect(retrieved).toBe(minion);
    });

    it('should remove entities', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(minion);
      context.removeEntity('minion-1');
      const retrieved = context.getEntity('minion-1');

      expect(retrieved).toBeUndefined();
    });

    it('should get all entities', () => {
      const minion1 = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      const minion2 = new ServerMinion({
        id: 'minion-2',
        position: new Vector(100, 0),
        side: 1,
        minionType: 'caster',
        lane: 'top',
        waypoints: [],
      });

      context.addEntity(minion1);
      context.addEntity(minion2);

      const all = context.getAllEntities();
      expect(all.length).toBe(2);
    });
  });

  describe('Game Time', () => {
    it('should track game time', () => {
      expect(context.getGameTime()).toBe(0);

      context.update(0.1);
      expect(context.getGameTime()).toBeCloseTo(0.1, 5);

      context.update(0.5);
      expect(context.getGameTime()).toBeCloseTo(0.6, 5);
    });

    it('should track tick count', () => {
      expect(context.getTick()).toBe(0);

      context.update(0.033);
      expect(context.getTick()).toBe(1);

      context.update(0.033);
      expect(context.getTick()).toBe(2);
    });
  });

  describe('Spatial Queries', () => {
    it('should find entities in radius', () => {
      const minion1 = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      const minion2 = new ServerMinion({
        id: 'minion-2',
        position: new Vector(100, 0),
        side: 1,
        minionType: 'caster',
        lane: 'mid',
        waypoints: [],
      });

      const minion3 = new ServerMinion({
        id: 'minion-3',
        position: new Vector(1000, 0),
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(minion1);
      context.addEntity(minion2);
      context.addEntity(minion3);

      const nearby = context.getEntitiesInRadius(new Vector(0, 0), 200);
      expect(nearby.length).toBe(2);
      expect(nearby.some(e => e.id === 'minion-1')).toBe(true);
      expect(nearby.some(e => e.id === 'minion-2')).toBe(true);
    });

    it('should find enemies in radius', () => {
      const blueMinion = new ServerMinion({
        id: 'blue-minion',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      const redMinion = new ServerMinion({
        id: 'red-minion',
        position: new Vector(100, 0),
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(blueMinion);
      context.addEntity(redMinion);

      const enemies = context.getEnemiesInRadius(new Vector(0, 0), 200, 0);
      expect(enemies.length).toBe(1);
      expect(enemies[0].id).toBe('red-minion');
    });
  });

  describe('Events', () => {
    it('should add and flush events', () => {
      context.addEvent(GameEventType.CHAMPION_KILL, { killerId: 'a', victimId: 'b' });
      context.addEvent(GameEventType.TOWER_DESTROYED, { towerId: 't1' });

      const events = context.flushEvents();
      expect(events.length).toBe(2);
      expect(events[0].type).toBe(GameEventType.CHAMPION_KILL);
      expect(events[1].type).toBe(GameEventType.TOWER_DESTROYED);

      // Should be empty after flush
      const empty = context.flushEvents();
      expect(empty.length).toBe(0);
    });
  });

  describe('Snapshots', () => {
    it('should create snapshots for entities', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(100, 200),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(minion);
      context.update(0.1); // Update to register fog of war

      const snapshots = context.createSnapshot('player-1');
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].entityId).toBe('minion-1');
    });
  });

  describe('Visibility', () => {
    it('should filter entities by visibility', () => {
      const blueMinion = new ServerMinion({
        id: 'blue-minion',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      const redMinion = new ServerMinion({
        id: 'red-minion',
        position: new Vector(2000, 0), // Far from blue vision
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(blueMinion);
      context.addEntity(redMinion);
      context.update(0.1); // Update to set up fog of war

      // Blue team should see blue minion but not far red minion
      const visibleToBlue = context.getVisibleEntities(0);

      // Blue minion always visible
      expect(visibleToBlue.some(e => e.id === 'blue-minion')).toBe(true);
      // Red minion too far
      expect(visibleToBlue.some(e => e.id === 'red-minion')).toBe(false);
    });
  });
});
