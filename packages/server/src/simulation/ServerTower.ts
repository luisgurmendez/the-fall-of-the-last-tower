/**
 * ServerTower - Server-side tower entity.
 *
 * Handles:
 * - Target acquisition with priority (champions attacking allies > champions > minions)
 * - Warmup damage (increasing damage on consecutive hits)
 * - Tower-specific attack behavior
 */

import {
  Vector,
  Side,
  EntityType,
  TowerSnapshot,
} from '@siege/shared';
import type { TowerTier, TowerLane, TowerStats, TowerReward, DamageType } from '@siege/shared';
import { DEFAULT_TOWER_STATS, DEFAULT_TOWER_REWARDS, TowerTargetPriority } from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

/**
 * Configuration for creating a tower.
 */
export interface ServerTowerConfig extends Omit<ServerEntityConfig, 'entityType'> {
  lane: TowerLane;
  tier: TowerTier;
}

/**
 * Server-side tower entity.
 */
export class ServerTower extends ServerEntity {
  readonly lane: TowerLane;
  readonly tier: TowerTier;
  readonly stats: TowerStats;
  readonly reward: TowerReward;

  // Combat
  private attackTarget: string | null = null;
  private attackCooldown: number = 0;

  // Warmup stacks - damage increases per consecutive hit on same target
  private warmupTarget: string | null = null;
  private warmupStacks: number = 0;

  // Destroyed state
  private _isDestroyed: boolean = false;

  constructor(config: ServerTowerConfig) {
    super({
      ...config,
      entityType: EntityType.TOWER,
    });

    this.lane = config.lane;
    this.tier = config.tier;
    this.stats = { ...DEFAULT_TOWER_STATS[config.tier] };
    this.reward = { ...DEFAULT_TOWER_REWARDS[config.tier] };

    // Initialize from stats
    this.health = this.stats.health;
    this.maxHealth = this.stats.maxHealth;
  }

  /**
   * Check if tower is destroyed.
   */
  get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  /**
   * Get tower radius for collision.
   */
  getRadius(): number {
    return 50; // Tower collision radius
  }

  /**
   * Update tower each tick.
   */
  update(dt: number, context: ServerGameContext): void {
    if (this.isDead || this._isDestroyed) return;

    // Update cooldowns
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    // Find and attack targets
    this.updateCombat(dt, context);
  }

  /**
   * Handle combat behavior.
   */
  private updateCombat(dt: number, context: ServerGameContext): void {
    // Validate current target
    if (this.attackTarget) {
      const target = context.getEntity(this.attackTarget);
      if (!target || target.isDead || !this.isInRange(target)) {
        // Target lost, reset warmup
        this.attackTarget = null;
        this.resetWarmup();
      }
    }

    // Find new target if needed
    if (!this.attackTarget) {
      this.attackTarget = this.findTarget(context);
      if (this.attackTarget !== this.warmupTarget) {
        this.resetWarmup();
        this.warmupTarget = this.attackTarget;
      }
    }

    // Attack if possible
    if (this.attackTarget && this.attackCooldown <= 0) {
      const target = context.getEntity(this.attackTarget);
      if (target && this.isInRange(target)) {
        this.attack(target, context);
      }
    }
  }

  /**
   * Find a target to attack.
   * Priority: Champions attacking allied champions > Champions > Minions
   */
  private findTarget(context: ServerGameContext): string | null {
    const nearbyEntities = context.getEntitiesInRadius(this.position, this.stats.attackRange);

    let bestTarget: ServerEntity | null = null;
    let bestPriority = TowerTargetPriority.NONE;
    let bestDistance = Infinity;

    for (const entity of nearbyEntities) {
      // Skip allies, self, and structures
      if (entity.side === this.side) continue;
      if (entity.isDead) continue;
      if (entity.entityType === EntityType.TOWER ||
          entity.entityType === EntityType.INHIBITOR ||
          entity.entityType === EntityType.NEXUS) continue;

      const distance = this.position.distanceTo(entity.position);
      if (distance > this.stats.attackRange) continue;

      // Calculate priority
      let priority = TowerTargetPriority.NONE;

      if (entity.entityType === EntityType.CHAMPION) {
        // Check if this champion is attacking an allied champion
        const championTarget = (entity as any).attackTarget;
        if (championTarget) {
          const targetEntity = context.getEntity(championTarget);
          if (targetEntity &&
              targetEntity.side === this.side &&
              targetEntity.entityType === EntityType.CHAMPION) {
            priority = TowerTargetPriority.CHAMPION_ATTACKING_ALLY;
          } else {
            priority = TowerTargetPriority.CHAMPION;
          }
        } else {
          priority = TowerTargetPriority.CHAMPION;
        }
      } else if (entity.entityType === EntityType.MINION) {
        priority = TowerTargetPriority.MINION;
      }

      // Prefer higher priority, then closer distance
      if (priority > bestPriority || (priority === bestPriority && distance < bestDistance)) {
        bestPriority = priority;
        bestDistance = distance;
        bestTarget = entity;
      }
    }

    return bestTarget?.id ?? null;
  }

  /**
   * Attack a target.
   */
  private attack(target: ServerEntity, context: ServerGameContext): void {
    // Calculate damage with warmup
    const baseDamage = this.stats.attackDamage;
    const warmupBonus = this.warmupStacks * this.stats.warmupDamagePerStack;
    const totalDamage = baseDamage + warmupBonus;

    // Deal damage
    target.takeDamage(totalDamage, 'physical', this.id);

    // Increment warmup stacks
    if (this.warmupStacks < this.stats.maxWarmupStacks) {
      this.warmupStacks++;
    }

    // Reset cooldown
    this.attackCooldown = this.stats.attackCooldown;
  }

  /**
   * Reset warmup stacks.
   */
  private resetWarmup(): void {
    this.warmupStacks = 0;
    this.warmupTarget = null;
  }

  /**
   * Check if target is in range.
   */
  isInRange(target: ServerEntity): boolean {
    const targetRadius = typeof (target as any).getRadius === 'function'
      ? (target as any).getRadius()
      : 0;
    return this.position.distanceTo(target.position) <= this.stats.attackRange + targetRadius;
  }

  /**
   * Called when the tower is destroyed - overrides base implementation.
   */
  protected onDeath(killerId?: string): void {
    super.onDeath(killerId);
    this._isDestroyed = true;
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
  toSnapshot(): TowerSnapshot {
    return {
      entityId: this.id,
      entityType: EntityType.TOWER,
      side: this.side,
      lane: this.lane,
      tier: this.tier,
      x: this.position.x,
      y: this.position.y,
      targetEntityId: this.attackTarget ?? undefined,
      health: this.health,
      maxHealth: this.maxHealth,
      isDestroyed: this._isDestroyed,
    };
  }
}
