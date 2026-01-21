/**
 * CollisionSystem - Handles unit collision detection and resolution.
 *
 * Features:
 * - Circle-circle collision detection using squared distance (optimization)
 * - Mass-based separation (heavier units push lighter units more)
 * - Spatial grid for O(n) performance instead of O(n²)
 *
 * @see docs/architecture/collision.md
 */

import { Vector } from '@siege/shared';
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
  spatialGridCellSize: 100,
  useSpatialGrid: true,
};

/**
 * Check if two entities are colliding (circles overlap).
 * Uses squared distance to avoid sqrt for performance.
 */
export function checkCollision(a: ServerEntity, b: ServerEntity): boolean {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const distSq = dx * dx + dy * dy;
  const minDist = a.getRadius() + b.getRadius();
  return distSq < minDist * minDist;
}

/**
 * Calculate the separation vector needed to push two entities apart.
 * Returns the vector from a to b, scaled by overlap amount.
 */
export function calculateSeparation(
  a: ServerEntity,
  b: ServerEntity,
  strength: number = 1.0
): Vector {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const distSq = dx * dx + dy * dy;
  const distance = Math.sqrt(distSq);

  const minDist = a.getRadius() + b.getRadius();
  const overlap = minDist - distance;

  if (overlap <= 0) {
    return new Vector(0, 0);
  }

  // If units are at exact same position, push in random direction
  if (distance < 0.001) {
    const angle = Math.random() * Math.PI * 2;
    return new Vector(
      Math.cos(angle) * overlap * strength,
      Math.sin(angle) * overlap * strength
    );
  }

  // Normal case: push along the line between centers
  const nx = dx / distance;
  const ny = dy / distance;

  return new Vector(
    nx * overlap * strength,
    ny * overlap * strength
  );
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
      const maxRadius = this.getMaxCollisionRadius(entity, entities);
      const nearby = grid.getNearby(entity.position, entity.getRadius() + maxRadius);

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
   * Get maximum collision radius among entities (for spatial query range).
   */
  private getMaxCollisionRadius(exclude: ServerEntity, entities: ServerEntity[]): number {
    let maxRadius = 0;
    for (const entity of entities) {
      if (entity !== exclude) {
        maxRadius = Math.max(maxRadius, entity.getRadius());
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

    // Cap separation distance
    const sepLength = separation.length();
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
