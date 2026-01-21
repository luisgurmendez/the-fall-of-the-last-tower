/**
 * CollisionSystem tests.
 * Tests collision detection, resolution, and spatial grid.
 *
 * @see docs/architecture/collision.md
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Vector, EntityType, Side } from '@siege/shared';
import {
  CollisionSystem,
  checkCollision,
  calculateSeparation,
  DEFAULT_COLLISION_CONFIG,
} from '../systems/CollisionSystem';
import { SpatialGrid } from '../systems/SpatialGrid';
import { ServerEntity, type ServerEntityConfig } from '../simulation/ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

/**
 * Test entity that implements collision interface.
 */
class TestEntity extends ServerEntity {
  private _radius: number;
  private _mass: number;
  private _collidable: boolean;

  constructor(
    config: ServerEntityConfig & {
      radius?: number;
      mass?: number;
      collidable?: boolean;
    }
  ) {
    super(config);
    this._radius = config.radius ?? 25;
    this._mass = config.mass ?? 100;
    this._collidable = config.collidable ?? true;
  }

  update(dt: number, context: ServerGameContext): void {
    // No-op for tests
  }

  toSnapshot() {
    return {
      entityId: this.id,
      entityType: this.entityType,
      side: this.side,
      x: this.position.x,
      y: this.position.y,
      health: this.health,
      maxHealth: this.maxHealth,
      isDead: this.isDead,
    } as any;
  }

  override isCollidable(): boolean {
    return this._collidable && !this.isDead;
  }

  override getRadius(): number {
    return this._radius;
  }

  override getMass(): number {
    return this._mass;
  }
}

/**
 * Helper to create a test entity.
 */
function createTestEntity(options: {
  id?: string;
  x?: number;
  y?: number;
  radius?: number;
  mass?: number;
  side?: Side;
  collidable?: boolean;
}): TestEntity {
  return new TestEntity({
    id: options.id ?? `entity-${Math.random().toString(36).substr(2, 9)}`,
    entityType: EntityType.CHAMPION,
    position: new Vector(options.x ?? 0, options.y ?? 0),
    side: options.side ?? 0,
    radius: options.radius,
    mass: options.mass,
    collidable: options.collidable,
  });
}

describe('CollisionSystem', () => {
  describe('checkCollision', () => {
    it('should detect overlapping circles', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 30, y: 0, radius: 25 });

      // Distance is 30, combined radii is 50, so they overlap by 20
      expect(checkCollision(a, b)).toBe(true);
    });

    it('should not detect collision when circles are apart', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 60, y: 0, radius: 25 });

      // Distance is 60, combined radii is 50, so no overlap
      expect(checkCollision(a, b)).toBe(false);
    });

    it('should not detect collision when circles are exactly touching', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 50, y: 0, radius: 25 });

      // Distance is 50, combined radii is 50, exactly touching = no overlap
      expect(checkCollision(a, b)).toBe(false);
    });

    it('should detect collision with different radii', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 20 });
      const b = createTestEntity({ x: 35, y: 0, radius: 25 });

      // Distance is 35, combined radii is 45, so they overlap by 10
      expect(checkCollision(a, b)).toBe(true);
    });

    it('should detect collision on diagonal', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 20, y: 20, radius: 25 });

      // Distance is sqrt(800) = 28.28, combined radii is 50, so overlap
      expect(checkCollision(a, b)).toBe(true);
    });
  });

  describe('calculateSeparation', () => {
    it('should calculate correct separation for overlapping circles', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 30, y: 0, radius: 25 });

      const separation = calculateSeparation(a, b);

      // Overlap is 20, direction is (1, 0)
      expect(separation.x).toBeCloseTo(20, 2);
      expect(separation.y).toBeCloseTo(0, 2);
    });

    it('should return zero vector for non-overlapping circles', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 60, y: 0, radius: 25 });

      const separation = calculateSeparation(a, b);

      expect(separation.x).toBe(0);
      expect(separation.y).toBe(0);
    });

    it('should handle circles at same position', () => {
      const a = createTestEntity({ x: 50, y: 50, radius: 25 });
      const b = createTestEntity({ x: 50, y: 50, radius: 25 });

      const separation = calculateSeparation(a, b);

      // Should produce a non-zero vector (random direction)
      expect(separation.length()).toBeGreaterThan(0);
    });

    it('should scale separation by strength parameter', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 30, y: 0, radius: 25 });

      const fullSeparation = calculateSeparation(a, b, 1.0);
      const halfSeparation = calculateSeparation(a, b, 0.5);

      expect(halfSeparation.x).toBeCloseTo(fullSeparation.x * 0.5, 2);
    });
  });

  describe('CollisionSystem.resolveCollisions', () => {
    let system: CollisionSystem;

    beforeEach(() => {
      system = new CollisionSystem({ useSpatialGrid: false });
    });

    it('should separate overlapping units', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 20, y: 0, radius: 25 });

      system.resolveCollisions([a, b]);

      // After resolution, distance should be >= combined radii (50)
      const distance = a.position.distanceTo(b.position);
      expect(distance).toBeGreaterThanOrEqual(49.9); // Allow small tolerance
    });

    it('should not move non-overlapping units', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 100, y: 0, radius: 25 });

      const originalAPos = a.position.clone();
      const originalBPos = b.position.clone();

      system.resolveCollisions([a, b]);

      expect(a.position.x).toBeCloseTo(originalAPos.x, 5);
      expect(a.position.y).toBeCloseTo(originalAPos.y, 5);
      expect(b.position.x).toBeCloseTo(originalBPos.x, 5);
      expect(b.position.y).toBeCloseTo(originalBPos.y, 5);
    });

    it('should move lighter units more than heavier units', () => {
      const heavy = createTestEntity({ x: 0, y: 0, radius: 25, mass: 100 });
      const light = createTestEntity({ x: 20, y: 0, radius: 25, mass: 50 });

      const originalHeavyX = heavy.position.x;
      const originalLightX = light.position.x;

      system.resolveCollisions([heavy, light]);

      const heavyMoved = Math.abs(heavy.position.x - originalHeavyX);
      const lightMoved = Math.abs(light.position.x - originalLightX);

      // Light unit should move more
      expect(lightMoved).toBeGreaterThan(heavyMoved);
    });

    it('should handle equal mass units symmetrically', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25, mass: 100 });
      const b = createTestEntity({ x: 20, y: 0, radius: 25, mass: 100 });

      system.resolveCollisions([a, b]);

      // Both should move equal amounts in opposite directions
      const aMoved = Math.abs(a.position.x - 0);
      const bMoved = Math.abs(b.position.x - 20);

      expect(aMoved).toBeCloseTo(bMoved, 1);
    });

    it('should not move infinite mass units', () => {
      const tower = createTestEntity({ x: 0, y: 0, radius: 50, mass: Infinity });
      const champion = createTestEntity({ x: 30, y: 0, radius: 25, mass: 100 });

      const originalTowerPos = tower.position.clone();

      system.resolveCollisions([tower, champion]);

      // Tower should not move
      expect(tower.position.x).toBe(originalTowerPos.x);
      expect(tower.position.y).toBe(originalTowerPos.y);

      // Champion should move fully
      const distance = tower.position.distanceTo(champion.position);
      expect(distance).toBeGreaterThanOrEqual(74.9); // 50 + 25
    });

    it('should skip non-collidable entities', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25, collidable: true });
      const b = createTestEntity({ x: 20, y: 0, radius: 25, collidable: false });

      const originalAPos = a.position.clone();
      const originalBPos = b.position.clone();

      system.resolveCollisions([a, b]);

      // Neither should move
      expect(a.position.x).toBe(originalAPos.x);
      expect(b.position.x).toBe(originalBPos.x);
    });

    it('should skip dead entities', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 20, y: 0, radius: 25 });
      (b as any).isDead = true;

      const originalAPos = a.position.clone();

      system.resolveCollisions([a, b]);

      // A should not move (no collision with dead entity)
      expect(a.position.x).toBe(originalAPos.x);
    });

    it('should handle multiple collisions', () => {
      // Create a cluster of overlapping entities
      const entities = [
        createTestEntity({ x: 0, y: 0, radius: 25 }),
        createTestEntity({ x: 20, y: 0, radius: 25 }),
        createTestEntity({ x: 10, y: 17, radius: 25 }),
      ];

      system.resolveCollisions(entities);

      // After resolution, no pair should overlap
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const distance = entities[i].position.distanceTo(entities[j].position);
          const minDist = entities[i].getRadius() + entities[j].getRadius();
          expect(distance).toBeGreaterThanOrEqual(minDist * 0.95); // Allow small tolerance
        }
      }
    });
  });

  describe('CollisionSystem with SpatialGrid', () => {
    let system: CollisionSystem;

    beforeEach(() => {
      system = new CollisionSystem({ useSpatialGrid: true, spatialGridCellSize: 100 });
    });

    it('should separate overlapping units using spatial grid', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 20, y: 0, radius: 25 });

      system.resolveCollisions([a, b]);

      const distance = a.position.distanceTo(b.position);
      expect(distance).toBeGreaterThanOrEqual(49.9);
    });

    it('should handle entities in different cells', () => {
      const a = createTestEntity({ x: 0, y: 0, radius: 25 });
      const b = createTestEntity({ x: 500, y: 500, radius: 25 });

      const originalAPos = a.position.clone();
      const originalBPos = b.position.clone();

      system.resolveCollisions([a, b]);

      // Should not affect each other (far apart)
      expect(a.position.x).toBe(originalAPos.x);
      expect(b.position.x).toBe(originalBPos.x);
    });
  });

  describe('SpatialGrid', () => {
    let grid: SpatialGrid;

    beforeEach(() => {
      grid = new SpatialGrid(100);
    });

    it('should insert and find entities', () => {
      const entity = createTestEntity({ x: 50, y: 50, radius: 25 });
      grid.insert(entity);

      const nearby = grid.getNearby(new Vector(50, 50), 100);
      expect(nearby).toContain(entity);
    });

    it('should find entities within radius', () => {
      const close = createTestEntity({ id: 'close', x: 50, y: 50, radius: 25 });
      const far = createTestEntity({ id: 'far', x: 500, y: 500, radius: 25 });

      grid.insert(close);
      grid.insert(far);

      const nearby = grid.getNearby(new Vector(50, 50), 100);

      expect(nearby).toContain(close);
      expect(nearby).not.toContain(far);
    });

    it('should clear entities', () => {
      const entity = createTestEntity({ x: 50, y: 50, radius: 25 });
      grid.insert(entity);
      grid.clear();

      const nearby = grid.getNearby(new Vector(50, 50), 100);
      expect(nearby).toHaveLength(0);
    });

    it('should get entities in adjacent cells', () => {
      // Entity in cell (0,0)
      const entity1 = createTestEntity({ id: 'e1', x: 50, y: 50, radius: 25 });
      // Entity in cell (1,0) - adjacent
      const entity2 = createTestEntity({ id: 'e2', x: 150, y: 50, radius: 25 });
      // Entity in cell (2,0) - not adjacent
      const entity3 = createTestEntity({ id: 'e3', x: 250, y: 50, radius: 25 });

      grid.insert(entity1);
      grid.insert(entity2);
      grid.insert(entity3);

      const adjacent = grid.getInCellAndAdjacent(new Vector(50, 50));

      expect(adjacent).toContain(entity1);
      expect(adjacent).toContain(entity2);
      expect(adjacent).not.toContain(entity3);
    });

    it('should provide accurate stats', () => {
      for (let i = 0; i < 10; i++) {
        grid.insert(createTestEntity({ id: `e${i}`, x: i * 50, y: 0, radius: 25 }));
      }

      const stats = grid.getStats();

      expect(stats.entityCount).toBe(10);
      expect(stats.cellSize).toBe(100);
      expect(stats.cellCount).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const system = new CollisionSystem();
      const config = system.getConfig();

      expect(config.separationStrength).toBe(DEFAULT_COLLISION_CONFIG.separationStrength);
      expect(config.maxSeparationDistance).toBe(DEFAULT_COLLISION_CONFIG.maxSeparationDistance);
      expect(config.useSpatialGrid).toBe(DEFAULT_COLLISION_CONFIG.useSpatialGrid);
    });

    it('should allow custom configuration', () => {
      const system = new CollisionSystem({
        separationStrength: 0.5,
        maxSeparationDistance: 100,
        useSpatialGrid: false,
      });

      const config = system.getConfig();

      expect(config.separationStrength).toBe(0.5);
      expect(config.maxSeparationDistance).toBe(100);
      expect(config.useSpatialGrid).toBe(false);
    });

    it('should update configuration at runtime', () => {
      const system = new CollisionSystem();
      system.setConfig({ separationStrength: 0.8 });

      expect(system.getConfig().separationStrength).toBe(0.8);
    });
  });
});
