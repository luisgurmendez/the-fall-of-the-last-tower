/**
 * ServerTargetedProjectile - A projectile that tracks and follows a target entity.
 *
 * Used for:
 * - Caster minion auto-attacks
 * - Tower shots
 * - Ranged champion auto-attacks
 * - Targeted abilities
 *
 * Unlike ServerProjectile (skillshots), this projectile:
 * - Follows its target until it hits
 * - Always hits (no dodging)
 * - Deals damage on impact
 */

import {
  Vector,
  EntityType,
  Side,
  DamageType,
  ProjectileSnapshot,
} from '@siege/shared';
import { ServerEntity, ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

export interface ServerTargetedProjectileConfig extends Omit<ServerEntityConfig, 'entityType'> {
  /** ID of the target entity to track */
  targetId: string;
  /** Speed in units per second */
  speed: number;
  /** Visual radius of the projectile */
  radius: number;
  /** ID of the caster (for ownership and damage attribution) */
  sourceId: string;
  /** Identifier for projectile type (for rendering) */
  projectileType: string;
  /** Damage to deal on hit */
  damage: number;
  /** Damage type */
  damageType: DamageType;
  /** Effect IDs to apply on hit */
  appliesEffects?: string[];
  /** Duration for applied effects */
  effectDuration?: number;
}

export class ServerTargetedProjectile extends ServerEntity {
  readonly targetId: string;
  readonly speed: number;
  readonly radius: number;
  readonly sourceId: string;
  readonly projectileType: string;
  readonly damage: number;
  readonly damageType: DamageType;
  readonly appliesEffects: string[];
  readonly effectDuration: number;

  // Current direction (updated each tick to track target)
  private direction: Vector = new Vector(1, 0);

  constructor(config: ServerTargetedProjectileConfig) {
    super({
      id: config.id,
      entityType: EntityType.PROJECTILE,
      position: config.position.clone(),
      side: config.side,
    });

    this.targetId = config.targetId;
    this.speed = config.speed;
    this.radius = config.radius;
    this.sourceId = config.sourceId;
    this.projectileType = config.projectileType;
    this.damage = config.damage;
    this.damageType = config.damageType;
    this.appliesEffects = config.appliesEffects ?? [];
    this.effectDuration = config.effectDuration ?? 0;

    // Set movement speed for visual interpolation
    this.movementSpeed = config.speed;
  }

  /**
   * Update projectile for one tick.
   */
  update(dt: number, context: ServerGameContext): void {
    if (this.isDead) return;

    // Get target entity
    const target = context.getEntity(this.targetId);

    // If target is dead or doesn't exist, remove projectile
    if (!target || target.isDead) {
      this.isDead = true;
      this.markForRemoval();
      return;
    }

    // Calculate direction to target
    const toTarget = target.position.subtracted(this.position);
    const distanceToTarget = toTarget.length();

    // Check if we've reached the target
    const moveDistance = this.speed * dt;
    if (distanceToTarget <= moveDistance + this.radius) {
      // Hit the target
      this.onHitTarget(target, context);
      this.isDead = true;
      this.markForRemoval();
      return;
    }

    // Move toward target
    this.direction = toTarget.normalized();
    const movement = this.direction.clone().scalar(moveDistance);
    this.position.add(movement);
  }

  /**
   * Handle hitting the target.
   */
  private onHitTarget(target: ServerEntity, context: ServerGameContext): void {
    // Deal damage (pass context for death handling/rewards)
    target.takeDamage(this.damage, this.damageType, this.sourceId, context);

    // Apply effects
    if (this.appliesEffects.length > 0 && 'applyEffect' in target) {
      const applyEffect = (target as { applyEffect: (id: string, duration: number, sourceId?: string) => void }).applyEffect;
      for (const effectId of this.appliesEffects) {
        applyEffect.call(target, effectId, this.effectDuration, this.sourceId);
      }
    }
  }

  /**
   * Projectiles don't participate in unit collision.
   */
  override isCollidable(): boolean {
    return false;
  }

  /**
   * Get projectile radius.
   */
  override getRadius(): number {
    return this.radius;
  }

  /**
   * Convert to network snapshot.
   */
  toSnapshot(): ProjectileSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.PROJECTILE,
      side: this.side,
      x: this.position.x,
      y: this.position.y,
      directionX: this.direction.x,
      directionY: this.direction.y,
      speed: this.speed,
      radius: this.radius,
      sourceId: this.sourceId,
      abilityId: this.projectileType, // Reuse abilityId field for projectile type
      isDead: this.isDead,
    };
  }
}
