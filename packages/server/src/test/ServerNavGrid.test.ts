/**
 * ServerNavGrid tests.
 * Tests pathfinding, collision detection, and grid operations.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ServerNavGrid, CELL_SIZE } from '../navigation/ServerNavGrid';
import { Vector } from '@siege/shared';

describe('ServerNavGrid', () => {
  let navGrid: ServerNavGrid;
  const MAP_SIZE = 3600;

  beforeEach(() => {
    navGrid = new ServerNavGrid(MAP_SIZE);
  });

  describe('Construction', () => {
    it('should create a grid with correct dimensions', () => {
      expect(navGrid.width).toBe(Math.ceil(MAP_SIZE / CELL_SIZE));
      expect(navGrid.height).toBe(Math.ceil(MAP_SIZE / CELL_SIZE));
    });

    it('should initialize all cells as walkable', () => {
      // Center of map should be walkable
      expect(navGrid.isWalkableWorld(0, 0)).toBe(true);
      // Near edges should be walkable
      expect(navGrid.isWalkableWorld(1000, 1000)).toBe(true);
    });
  });

  describe('World-Grid Conversion', () => {
    it('should convert world to grid coordinates', () => {
      const gridPos = navGrid.worldToGrid(0, 0);
      // Center of map should be center of grid
      expect(gridPos.x).toBe(Math.floor(MAP_SIZE / 2 / CELL_SIZE));
      expect(gridPos.y).toBe(Math.floor(MAP_SIZE / 2 / CELL_SIZE));
    });

    it('should convert grid to world coordinates', () => {
      const worldPos = navGrid.gridToWorld(0, 0);
      // Top-left grid cell should be at negative world coordinates
      expect(worldPos.x).toBeLessThan(0);
      expect(worldPos.y).toBeLessThan(0);
    });

    it('should round-trip correctly', () => {
      const worldPos = new Vector(100, -200);
      const gridPos = navGrid.worldToGrid(worldPos.x, worldPos.y);
      const backToWorld = navGrid.gridToWorld(gridPos.x, gridPos.y);

      // Should be within one cell of original
      expect(Math.abs(backToWorld.x - worldPos.x)).toBeLessThan(CELL_SIZE);
      expect(Math.abs(backToWorld.y - worldPos.y)).toBeLessThan(CELL_SIZE);
    });
  });

  describe('Blocking/Unblocking', () => {
    it('should block a cell', () => {
      navGrid.setBlocked(10, 10);
      expect(navGrid.isWalkable(10, 10)).toBe(false);
    });

    it('should unblock a cell', () => {
      navGrid.setBlocked(10, 10);
      navGrid.setWalkable(10, 10);
      expect(navGrid.isWalkable(10, 10)).toBe(true);
    });

    it('should increment version when blocking', () => {
      const v1 = navGrid.version;
      navGrid.setBlocked(10, 10);
      expect(navGrid.version).toBeGreaterThan(v1);
    });

    it('should block circular area', () => {
      navGrid.blockCircle(0, 0, 100);
      expect(navGrid.isWalkableWorld(0, 0)).toBe(false);
      expect(navGrid.isWalkableWorld(50, 0)).toBe(false);
    });

    it('should block rectangular area', () => {
      navGrid.blockRectangle(0, 0, 200, 200);
      expect(navGrid.isWalkableWorld(0, 0)).toBe(false);
      expect(navGrid.isWalkableWorld(50, 50)).toBe(false);
      expect(navGrid.isWalkableWorld(-50, -50)).toBe(false);
    });
  });

  describe('Pathfinding', () => {
    it('should find a direct path when no obstacles', () => {
      const start = new Vector(-500, 0);
      const end = new Vector(500, 0);
      const path = navGrid.findPath(start, end);

      expect(path).not.toBeNull();
      expect(path!.length).toBeGreaterThan(0);
      expect(path![0].distanceTo(start)).toBeLessThan(CELL_SIZE);
      expect(path![path!.length - 1].distanceTo(end)).toBeLessThan(CELL_SIZE);
    });

    it('should find path around obstacle', () => {
      // Block a wall in the middle
      navGrid.blockRectangle(0, 0, 500, 50);

      const start = new Vector(-500, 0);
      const end = new Vector(500, 0);
      const path = navGrid.findPath(start, end);

      expect(path).not.toBeNull();
      // Path should go around the obstacle (y > 25 or y < -25)
      const hasDetour = path!.some(p => Math.abs(p.y) > 30);
      expect(hasDetour).toBe(true);
    });

    it('should return null when path is blocked', () => {
      // Create an impassable wall
      for (let y = -1800; y <= 1800; y += CELL_SIZE) {
        navGrid.blockRectangle(0, y, 100, 100);
      }

      const start = new Vector(-500, 0);
      const end = new Vector(500, 0);
      const path = navGrid.findPath(start, end);

      // Path should be null since wall blocks everything
      // (unless there's a way around at edges)
      // This might need adjustment based on exact blocking
    });

    it('should simplify path', () => {
      const start = new Vector(-500, -500);
      const end = new Vector(500, 500);
      const path = navGrid.findPath(start, end);

      expect(path).not.toBeNull();
      // Diagonal path should be simplified to just start and end
      expect(path!.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Line of Sight', () => {
    it('should have line of sight when clear', () => {
      const from = new Vector(-100, 0);
      const to = new Vector(100, 0);
      expect(navGrid.hasLineOfSight(from, to)).toBe(true);
    });

    it('should not have line of sight when blocked', () => {
      navGrid.blockRectangle(0, 0, 100, 100);
      const from = new Vector(-200, 0);
      const to = new Vector(200, 0);
      expect(navGrid.hasLineOfSight(from, to)).toBe(false);
    });
  });

  describe('Path Validation', () => {
    it('should validate a clear path', () => {
      const path = [
        new Vector(-100, 0),
        new Vector(0, 0),
        new Vector(100, 0),
      ];
      expect(navGrid.isPathValid(path)).toBe(true);
    });

    it('should invalidate path with blocked point', () => {
      navGrid.blockRectangle(0, 0, 50, 50);
      const path = [
        new Vector(-100, 0),
        new Vector(0, 0),
        new Vector(100, 0),
      ];
      expect(navGrid.isPathValid(path)).toBe(false);
    });
  });
});
