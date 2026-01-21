/**
 * FogOfWarServer tests.
 * Tests visibility calculation and vision sources.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { FogOfWarServer } from '../systems/FogOfWarServer';
import { ServerMinion } from '../simulation/ServerMinion';
import { ServerTower } from '../simulation/ServerTower';
import { ServerGameContext } from '../game/ServerGameContext';
import { Vector, EntityType, Side } from '@siege/shared';

describe('FogOfWarServer', () => {
  let context: ServerGameContext;
  let fogOfWar: FogOfWarServer;

  beforeEach(() => {
    context = new ServerGameContext({ gameId: 'test-game' });
    fogOfWar = new FogOfWarServer();
  });

  describe('Vision Sources', () => {
    it('should collect vision sources from entities', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(minion);
      fogOfWar.updateVision(context, 1);

      const sources = fogOfWar.getVisionSourcesForTeam(0);
      expect(sources.length).toBe(1);
      expect(sources[0].entityId).toBe('minion-1');
    });

    it('should not collect vision from dead entities', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      minion.takeDamage(10000, 'true'); // Kill minion
      context.addEntity(minion);
      fogOfWar.updateVision(context, 1);

      const sources = fogOfWar.getVisionSourcesForTeam(0);
      expect(sources.length).toBe(0);
    });
  });

  describe('Visibility', () => {
    it('should make own entities always visible', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(minion);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.isVisibleTo(minion, 0)).toBe(true);
    });

    it('should reveal enemy in sight range', () => {
      // Use positions outside of any bush bounds
      // Blue minion provides vision (far from center bushes)
      const blueMinion = new ServerMinion({
        id: 'blue-minion',
        position: new Vector(1200, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      // Red minion nearby (within 800 sight range)
      const redMinion = new ServerMinion({
        id: 'red-minion',
        position: new Vector(1400, 0), // 200 units away, within sight range
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(blueMinion);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      // Red minion should be visible to blue team
      expect(fogOfWar.isVisibleTo(redMinion, 0)).toBe(true);
    });

    it('should hide enemy outside sight range', () => {
      // Blue minion provides vision
      const blueMinion = new ServerMinion({
        id: 'blue-minion',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      // Red minion far away
      const redMinion = new ServerMinion({
        id: 'red-minion',
        position: new Vector(2000, 0), // Outside sight range
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(blueMinion);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      // Red minion should not be visible to blue team
      expect(fogOfWar.isVisibleTo(redMinion, 0)).toBe(false);
    });
  });

  describe('Position Visibility', () => {
    it('should reveal position near vision source', () => {
      // Use position outside of bushes
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(1200, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(minion);
      fogOfWar.updateVision(context, 1);

      // Check position nearby (also outside bushes)
      expect(fogOfWar.isPositionVisibleTo(new Vector(1300, 0), 0)).toBe(true);
    });

    it('should hide position far from vision sources', () => {
      // Use position outside of bushes
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(1200, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(minion);
      fogOfWar.updateVision(context, 1);

      // Position far away should not be visible
      expect(fogOfWar.isPositionVisibleTo(new Vector(-1200, 0), 0)).toBe(false);
    });
  });

  describe('Targeting', () => {
    it('should allow targeting visible enemies', () => {
      // Use positions outside of bush bounds
      const blueMinion = new ServerMinion({
        id: 'blue-minion',
        position: new Vector(1200, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      const redMinion = new ServerMinion({
        id: 'red-minion',
        position: new Vector(1400, 0), // 200 units away, within sight range
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(blueMinion);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.canTarget(blueMinion, redMinion)).toBe(true);
    });

    it('should not allow targeting invisible enemies', () => {
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
        position: new Vector(2000, 0), // Far away
        side: 1,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(blueMinion);
      context.addEntity(redMinion);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.canTarget(blueMinion, redMinion)).toBe(false);
    });

    it('should always allow targeting allies', () => {
      const blueMinion1 = new ServerMinion({
        id: 'blue-minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      const blueMinion2 = new ServerMinion({
        id: 'blue-minion-2',
        position: new Vector(2000, 0), // Far away but same team
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(blueMinion1);
      context.addEntity(blueMinion2);
      fogOfWar.updateVision(context, 1);

      expect(fogOfWar.canTarget(blueMinion1, blueMinion2)).toBe(true);
    });
  });

  describe('Cache', () => {
    it('should clear cache on new tick', () => {
      const minion = new ServerMinion({
        id: 'minion-1',
        position: new Vector(0, 0),
        side: 0,
        minionType: 'melee',
        lane: 'mid',
        waypoints: [],
      });

      context.addEntity(minion);

      fogOfWar.updateVision(context, 1);
      const sources1 = fogOfWar.getVisionSourcesForTeam(0);

      fogOfWar.updateVision(context, 2);
      const sources2 = fogOfWar.getVisionSourcesForTeam(0);

      // Both should have the vision source
      expect(sources1.length).toBe(1);
      expect(sources2.length).toBe(1);
    });
  });
});
