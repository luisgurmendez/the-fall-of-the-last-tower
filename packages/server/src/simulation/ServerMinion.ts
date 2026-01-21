/**
 * ServerMinion - Server-side minion entity.
 *
 * Handles:
 * - Lane waypoint following
 * - Target acquisition (towers, enemy minions, champions)
 * - Combat behavior
 * - Death and reward distribution
 */

import {
  Vector,
  Side,
  EntityType,
  MinionSnapshot,
} from '@siege/shared';
import type { MinionType, LaneId, MinionStats, DamageType } from '@siege/shared';
import { DEFAULT_MINION_STATS } from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

/**
 * Configuration for creating a minion.
 */
export interface ServerMinionConfig extends Omit<ServerEntityConfig, 'entityType'> {
  minionType: MinionType;
  lane: LaneId;
  waypoints: Vector[];
}

/**
 * Server-side minion entity.
 */
export class ServerMinion extends ServerEntity {
  readonly minionType: MinionType;
  readonly lane: LaneId;
  readonly stats: MinionStats;

  // Movement
  private waypoints: Vector[] = [];
  private currentWaypointIndex: number = 0;
  private moveTarget: Vector | null = null;

  // Combat
  private attackTarget: string | null = null;
  private attackCooldown: number = 0;
  private attackAnimationTimer: number = 0;  // Time remaining in attack animation
  private static readonly ATTACK_ANIMATION_DURATION = 0.4;  // Duration of attack animation in seconds

  // Rewards
  readonly goldReward: number;
  readonly experienceReward: number;

  constructor(config: ServerMinionConfig) {
    super({
      ...config,
      entityType: EntityType.MINION,
    });

    this.minionType = config.minionType;
    this.lane = config.lane;
    this.stats = { ...DEFAULT_MINION_STATS[config.minionType] };

    // Initialize from stats
    this.health = this.stats.health;
    this.maxHealth = this.stats.maxHealth;
    this.goldReward = this.stats.goldReward;
    this.experienceReward = this.stats.experienceReward;

    // Set waypoints
    this.waypoints = config.waypoints.map(w => w.clone());
    if (this.waypoints.length > 0) {
      this.currentWaypointIndex = 0;
      this.moveTarget = this.waypoints[0].clone();
    }
  }

  // =====================
  // Collision Interface
  // =====================

  /**
   * Minions participate in collision.
   */
  override isCollidable(): boolean {
    return !this.isDead;
  }

  /**
   * Get minion radius for collision.
   */
  override getRadius(): number {
    return 20; // Standard minion collision radius
  }

  /**
   * Get minion collision mass.
   * Melee minions are heavier than caster minions.
   * All minions are lighter than champions.
   */
  override getMass(): number {
    return this.minionType === 'melee' ? 50 : 30;
  }

  /**
   * Update minion each tick.
   */
  update(dt: number, context: ServerGameContext): void {
    if (this.isDead) return;

    // Update cooldowns
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    // Update attack animation timer
    if (this.attackAnimationTimer > 0) {
      this.attackAnimationTimer -= dt;
    }

    // Find and attack targets
    this.updateCombat(dt, context);

    // Move toward target
    this.updateMovement(dt, context);
  }

  /**
   * Handle combat behavior.
   */
  private updateCombat(dt: number, context: ServerGameContext): void {
    // Validate current target
    if (this.attackTarget) {
      const target = context.getEntity(this.attackTarget);
      if (!target || target.isDead || !this.isInRange(target, this.stats.attackRange)) {
        this.attackTarget = null;
      }
    }

    // Find new target if needed
    if (!this.attackTarget) {
      this.attackTarget = this.findTarget(context);
    }

    // Attack if possible
    if (this.attackTarget && this.attackCooldown <= 0) {
      const target = context.getEntity(this.attackTarget);
      if (target && this.isInRange(target, this.stats.attackRange)) {
        this.attack(target, context);
      }
    }
  }

  /**
   * Find a target to attack.
   * Priority: Nearby enemies attacking allies > Champions > Minions > Towers
   * Note: Minions do NOT attack jungle creatures - they only fight lane units.
   */
  private findTarget(context: ServerGameContext): string | null {
    const nearbyEntities = context.getEntitiesInRadius(this.position, this.stats.sightRange);

    let bestTarget: ServerEntity | null = null;
    let bestPriority = -1;

    for (const entity of nearbyEntities) {
      // Skip allies and self
      if (entity.side === this.side || entity.id === this.id) continue;
      if (entity.isDead) continue;

      // Skip jungle creatures - minions only fight lane units
      if (entity.entityType === EntityType.JUNGLE_CAMP) continue;

      // Calculate priority
      let priority = 0;
      const distance = this.position.distanceTo(entity.position);

      // Prefer closer targets
      priority += (this.stats.sightRange - distance) / this.stats.sightRange * 10;

      // Entity type priorities
      if (entity.entityType === EntityType.CHAMPION) {
        priority += 100; // Champions high priority
      } else if (entity.entityType === EntityType.MINION) {
        priority += 50; // Other minions
      } else if (entity.entityType === EntityType.TOWER) {
        priority += 20; // Towers lower priority
      }

      if (priority > bestPriority && this.isInRange(entity, this.stats.attackRange + 50)) {
        bestPriority = priority;
        bestTarget = entity;
      }
    }

    return bestTarget?.id ?? null;
  }

  /**
   * Attack a target.
   */
  private attack(target: ServerEntity, context: ServerGameContext): void {
    // Deal damage
    target.takeDamage(this.stats.attackDamage, 'physical', this.id);

    // Reset cooldown
    this.attackCooldown = this.stats.attackCooldown;

    // Start attack animation
    this.attackAnimationTimer = ServerMinion.ATTACK_ANIMATION_DURATION;

    // Stop moving while attacking
    this.moveTarget = null;
  }

  /**
   * Handle movement along waypoints.
   */
  private updateMovement(dt: number, context: ServerGameContext): void {
    // If attacking, move toward attack target
    if (this.attackTarget) {
      const target = context.getEntity(this.attackTarget);
      if (target && !this.isInRange(target, this.stats.attackRange)) {
        this.moveTarget = target.position.clone();
      } else {
        return; // In range, don't move
      }
    } else if (!this.moveTarget && this.currentWaypointIndex < this.waypoints.length) {
      // Resume waypoint following
      this.moveTarget = this.waypoints[this.currentWaypointIndex].clone();
    }

    if (!this.moveTarget) return;

    // Move toward target
    const distance = this.position.distanceTo(this.moveTarget);
    const speed = this.stats.movementSpeed * dt;

    if (distance <= speed) {
      // Reached target
      this.position = this.moveTarget.clone();

      // If following waypoints, advance to next
      if (!this.attackTarget && this.currentWaypointIndex < this.waypoints.length - 1) {
        this.currentWaypointIndex++;
        this.moveTarget = this.waypoints[this.currentWaypointIndex].clone();
      } else {
        this.moveTarget = null;
      }
    } else {
      // Move toward target
      const direction = Vector.direction(this.position, this.moveTarget);
      this.position.add(direction.scalar(speed));
    }
  }

  /**
   * Check if target is in range.
   */
  isInRange(target: ServerEntity, range: number): boolean {
    const targetRadius = typeof (target as any).getRadius === 'function'
      ? (target as any).getRadius()
      : 0;
    return this.position.distanceTo(target.position) <= range + this.getRadius() + targetRadius;
  }

  /**
   * Called when the minion dies - overrides base implementation.
   */
  protected onDeath(killerId?: string): void {
    super.onDeath(killerId);
    // Clear attack target
    this.attackTarget = null;
    this.moveTarget = null;
    // Mark for removal so dead minion is cleaned up
    this.markForRemoval();
  }

  /**
   * Override damage calculation for armor/magic resist.
   */
  protected calculateDamage(amount: number, type: DamageType): number {
    if (type === 'true' || type === 'pure') {
      return amount;
    }

    let reduction = 0;
    if (type === 'physical') {
      reduction = this.stats.armor / (100 + this.stats.armor);
    } else if (type === 'magic') {
      reduction = this.stats.magicResist / (100 + this.stats.magicResist);
    }

    return amount * (1 - reduction);
  }

  /**
   * Create snapshot for network sync.
   */
  toSnapshot(): MinionSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.MINION,
      side: this.side,
      minionType: this.minionType,
      x: this.position.x,
      y: this.position.y,
      targetX: this.moveTarget?.x,
      targetY: this.moveTarget?.y,
      targetEntityId: this.attackTarget ?? undefined,
      health: this.health,
      maxHealth: this.maxHealth,
      isDead: this.isDead,
      isAttacking: this.attackAnimationTimer > 0,
    };
  }
}
