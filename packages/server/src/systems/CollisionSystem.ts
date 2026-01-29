/**
 * CollisionSystem - Handles unit collision detection and resolution.
 *
 * Features:
 * - Shape-based collision detection (circles, rectangles, capsules)
 * - Mass-based separation (heavier units push lighter units more)
 * - Spatial grid for O(n) performance instead of O(n²)
 *
 * @see docs/architecture/collision.md
 */

import {
  Vector,
  collisionShapesOverlap,
  calculateCollisionSeparation,
  getEffectiveRadius,
} from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';
import { SpatialGrid } from './SpatialGrid';

/**
 * Collision system configuration.
 */
export interface CollisionConfig {
  /** How strongly to separate overlapping units (0-1). Default: 1.0 (full separation) */
  separationStrength: number;
  /** Maximum distance a unit can be pushed in one tick. Default: 50 */
  maxSeparationDistance: number;
  /** Minimum overlap required to trigger separation. Default: 2.0 (prevents vibration) */
  minOverlapThreshold: number;
  /** Cell size for spatial grid. Default: 100 */
  spatialGridCellSize: number;
  /** Whether to use spatial grid optimization. Default: true */
  useSpatialGrid: boolean;
}

/**
 * Default collision configuration.
 */
export const DEFAULT_COLLISION_CONFIG: CollisionConfig = {
  separationStrength: 1.0,
  maxSeparationDistance: 50,
  minOverlapThreshold: 2.0,  // Ignore overlaps smaller than 2 pixels to prevent vibration
  spatialGridCellSize: 100,
  useSpatialGrid: true,
};

/**
 * Check if two entities are colliding using their collision shapes.
 * Supports circles, rectangles, and capsules.
 */
export function checkCollision(a: ServerEntity, b: ServerEntity): boolean {
  const shapeA = a.getCollisionShape();
  const shapeB = b.getCollisionShape();
  return collisionShapesOverlap(shapeA, a.position, shapeB, b.position);
}

/**
 * Calculate the separation vector needed to push two entities apart.
 * Uses shape-based separation calculation.
 * Returns the vector that entity A should move to separate from entity B.
 */
export function calculateSeparation(
  a: ServerEntity,
  b: ServerEntity,
  strength: number = 1.0
): Vector {
  const shapeA = a.getCollisionShape();
  const shapeB = b.getCollisionShape();

  const separation = calculateCollisionSeparation(shapeA, a.position, shapeB, b.position);

  // No overlap
  if (separation.x === 0 && separation.y === 0) {
    return new Vector(0, 0);
  }

  // Apply strength multiplier
  return new Vector(separation.x * strength, separation.y * strength);
}

/**
 * Collision detection and resolution system.
 */
export class CollisionSystem {
  private config: CollisionConfig;
  private spatialGrid: SpatialGrid | null = null;

  constructor(config: Partial<CollisionConfig> = {}) {
    this.config = { ...DEFAULT_COLLISION_CONFIG, ...config };

    if (this.config.useSpatialGrid) {
      this.spatialGrid = new SpatialGrid(this.config.spatialGridCellSize);
    }
  }

  /**
   * Resolve collisions between all collidable entities.
   * Call this once per tick after position updates.
   */
  resolveCollisions(entities: ServerEntity[]): void {
    // Filter to only collidable entities
    const collidables = entities.filter(e => e.isCollidable() && !e.isDead);

    if (collidables.length < 2) {
      return;
    }

    if (this.config.useSpatialGrid && this.spatialGrid) {
      this.resolveWithSpatialGrid(collidables);
    } else {
      this.resolveNaive(collidables);
    }
  }

  /**
   * Naive O(n²) collision resolution. Used when spatial grid is disabled.
   */
  private resolveNaive(entities: ServerEntity[]): void {
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        this.resolveCollisionPair(entities[i], entities[j]);
      }
    }
  }

  /**
   * Spatial grid optimized collision resolution.
   */
  private resolveWithSpatialGrid(entities: ServerEntity[]): void {
    const grid = this.spatialGrid!;
    grid.clear();

    // Insert all entities into grid
    for (const entity of entities) {
      grid.insert(entity);
    }

    // Track processed pairs to avoid duplicate resolution
    const processedPairs = new Set<string>();

    // For each entity, check only nearby entities
    for (const entity of entities) {
      const entityRadius = getEffectiveRadius(entity.getCollisionShape());
      const maxRadius = this.getMaxCollisionRadius(entity, entities);
      const nearby = grid.getNearby(entity.position, entityRadius + maxRadius);

      for (const other of nearby) {
        if (entity === other) continue;

        // Create unique pair key (smaller id first)
        const pairKey = entity.id < other.id
          ? `${entity.id}:${other.id}`
          : `${other.id}:${entity.id}`;

        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        this.resolveCollisionPair(entity, other);
      }
    }
  }

  /**
   * Get maximum effective collision radius among entities (for spatial query range).
   * Uses getEffectiveRadius to get bounding circle for any collision shape.
   */
  private getMaxCollisionRadius(exclude: ServerEntity, entities: ServerEntity[]): number {
    let maxRadius = 0;
    for (const entity of entities) {
      if (entity !== exclude) {
        const radius = getEffectiveRadius(entity.getCollisionShape());
        maxRadius = Math.max(maxRadius, radius);
      }
    }
    return maxRadius;
  }

  /**
   * Resolve collision between two entities.
   */
  private resolveCollisionPair(a: ServerEntity, b: ServerEntity): void {
    if (!checkCollision(a, b)) {
      return;
    }

    const separation = calculateSeparation(a, b, this.config.separationStrength);

    // Check separation magnitude
    const sepLength = separation.length();

    // Skip tiny overlaps to prevent vibration when units are barely touching
    if (sepLength < this.config.minOverlapThreshold) {
      return;
    }

    // Cap separation distance
    if (sepLength > this.config.maxSeparationDistance) {
      separation.normalize().scalar(this.config.maxSeparationDistance);
    }

    // Calculate mass ratios (heavier units move less)
    const massA = a.getMass();
    const massB = b.getMass();
    const totalMass = massA + massB;

    // Handle infinite mass (immovable objects like towers)
    if (!isFinite(massA) && !isFinite(massB)) {
      // Both infinite mass - neither moves
      return;
    } else if (!isFinite(massA)) {
      // A is immovable, B moves fully
      b.position.add(separation);
      return;
    } else if (!isFinite(massB)) {
      // B is immovable, A moves fully (negative direction)
      a.position.add(separation.scaled(-1));
      return;
    }

    // Normal case: distribute based on mass
    const ratioA = massB / totalMass;  // Heavier B means A moves more
    const ratioB = massA / totalMass;  // Heavier A means B moves more

    // A moves in negative direction (away from B)
    a.position.add(separation.scaled(-ratioA));
    // B moves in positive direction (away from A)
    b.position.add(separation.scaled(ratioB));
  }

  /**
   * Update configuration.
   */
  setConfig(config: Partial<CollisionConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.useSpatialGrid && !this.spatialGrid) {
      this.spatialGrid = new SpatialGrid(this.config.spatialGridCellSize);
    } else if (!this.config.useSpatialGrid) {
      this.spatialGrid = null;
    }
  }

  /**
   * Get current configuration.
   */
  getConfig(): Readonly<CollisionConfig> {
    return this.config;
  }
}
