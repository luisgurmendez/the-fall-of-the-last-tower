/**
 * ServerEntity - Base class for all server-side game entities.
 *
 * Unlike client entities, these have no rendering logic.
 * They are purely simulation objects.
 */

import {
  Vector,
  EntityType,
  EntitySnapshot,
  Side,
  DamageType,
} from '@siege/shared';
import type { ServerGameContext } from '../game/ServerGameContext';

export interface ServerEntityConfig {
  id: string;
  entityType: EntityType;
  position: Vector;
  side: Side;
}

export abstract class ServerEntity {
  readonly id: string;
  readonly entityType: EntityType;
  readonly side: Side;

  // Position and movement
  position: Vector;
  targetPosition: Vector | null = null;
  targetEntityId: string | null = null;
  velocity: Vector = new Vector(0, 0);
  movementSpeed = 0;

  // State
  health = 0;
  maxHealth = 0;
  isDead = false;

  // Tracking
  private markedForRemoval = false;
  private lastChangeTick = 0;

  constructor(config: ServerEntityConfig) {
    this.id = config.id;
    this.entityType = config.entityType;
    this.position = config.position.clone();
    this.side = config.side;
  }

  /**
   * Update entity for one tick.
   */
  abstract update(dt: number, context: ServerGameContext): void;

  /**
   * Convert entity state to a network snapshot.
   */
  abstract toSnapshot(): EntitySnapshot;

  /**
   * Take damage from a source.
   */
  takeDamage(amount: number, type: DamageType, sourceId?: string): number {
    if (this.isDead) return 0;

    // Calculate actual damage based on resistances
    const actualDamage = this.calculateDamage(amount, type);

    this.health = Math.max(0, this.health - actualDamage);

    if (this.health <= 0) {
      this.onDeath(sourceId);
    }

    return actualDamage;
  }

  /**
   * Calculate damage after resistances.
   */
  protected calculateDamage(amount: number, type: DamageType): number {
    if (type === 'true' || type === 'pure') {
      return amount;
    }
    // Override in subclasses for armor/magic resist
    return amount;
  }

  /**
   * Called when entity dies.
   */
  protected onDeath(killerId?: string): void {
    this.isDead = true;
    this.health = 0;
  }

  /**
   * Heal the entity.
   */
  heal(amount: number): number {
    if (this.isDead) return 0;

    const previousHealth = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - previousHealth;
  }

  /**
   * Move toward target position.
   */
  protected moveToward(target: Vector, dt: number): void {
    if (this.movementSpeed <= 0) return;

    const direction = target.subtracted(this.position);
    const distance = direction.length();

    if (distance < 1) {
      this.position.setFrom(target);
      this.targetPosition = null;
      return;
    }

    const moveDistance = this.movementSpeed * dt;

    if (moveDistance >= distance) {
      this.position.setFrom(target);
      this.targetPosition = null;
    } else {
      direction.normalize().scalar(moveDistance);
      this.position.add(direction);
    }
  }

  /**
   * Check if entity can see target (basic vision check).
   */
  canSee(target: ServerEntity, sightRange: number): boolean {
    return this.position.distanceTo(target.position) <= sightRange;
  }

  /**
   * Mark entity for removal at end of tick.
   */
  markForRemoval(): void {
    this.markedForRemoval = true;
  }

  /**
   * Check if entity should be removed.
   */
  shouldRemove(): boolean {
    return this.markedForRemoval;
  }

  /**
   * Mark entity as changed (for delta updates).
   */
  markChanged(tick: number): void {
    this.lastChangeTick = tick;
  }

  /**
   * Check if entity changed since a given tick.
   */
  hasChangedSince(tick: number): boolean {
    return this.lastChangeTick > tick;
  }

  /**
   * Get distance to another entity.
   */
  distanceTo(other: ServerEntity): number {
    return this.position.distanceTo(other.position);
  }

  /**
   * Check if entity is in range of another.
   */
  isInRange(other: ServerEntity, range: number): boolean {
    return this.distanceTo(other) <= range;
  }

  /**
   * Check if entity is an enemy.
   */
  isEnemy(other: ServerEntity): boolean {
    return this.side !== other.side;
  }

  /**
   * Check if entity is an ally.
   */
  isAlly(other: ServerEntity): boolean {
    return this.side === other.side;
  }

  // =====================
  // Collision Interface
  // =====================

  /**
   * Whether this entity participates in collision detection.
   * Override in subclasses to enable collision.
   */
  isCollidable(): boolean {
    return false;
  }

  /**
   * Get collision radius. Override in subclasses.
   */
  getRadius(): number {
    return 0;
  }

  /**
   * Get collision mass. Heavier units push lighter units more.
   * Override in subclasses.
   */
  getMass(): number {
    return 100; // Default mass
  }
}
