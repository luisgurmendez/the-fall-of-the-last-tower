/**
 * ServerTower - Server-side tower entity.
 *
 * Handles:
 * - Target acquisition with priority (minions > champions, unless champion has aggro)
 * - Tower aggro: champions that damage allied champions under tower get targeted
 * - Warmup damage (increasing damage on consecutive hits)
 * - Tower-specific attack behavior
 */

import {
  EntityType,
  TowerSnapshot,
  GameEventType,
  getEffectiveRadius,
  EntityCollision,
  DEFAULT_TOWER_COLLISION,
} from "@siege/shared";
import type {
  TowerTier,
  TowerLane,
  TowerStats,
  TowerReward,
  DamageType,
} from "@siege/shared";
import {
  DEFAULT_TOWER_STATS,
  DEFAULT_TOWER_REWARDS,
  TowerTargetPriority,
} from "@siege/shared";
import { ServerEntity, type ServerEntityConfig } from "./ServerEntity";
import type { ServerGameContext } from "../game/ServerGameContext";
import { RewardSystem } from "../systems/RewardSystem";
import { ServerTargetedProjectile } from "./ServerTargetedProjectile";

/**
 * Configuration for creating a tower.
 */
export interface ServerTowerConfig extends Omit<
  ServerEntityConfig,
  "entityType"
> {
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

  // Tower aggro tracking - champions that damage allied champions under tower
  // Maps championId -> remaining aggro time in seconds
  private aggroMap: Map<string, number> = new Map();

  /** How long tower aggro lasts after a champion damages an allied champion (seconds) */
  private static readonly AGGRO_DURATION = 3.0;

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
   * Towers are collidable - minions and champions cannot pass through them.
   */
  isCollidable(): boolean {
    return !this.isDead && !this._isDestroyed;
  }

  /**
   * Get tower radius for collision (effective bounding radius).
   * Uses getEffectiveRadius to handle any collision shape type (circle, rectangle, capsule).
   * @deprecated Use getCollisionShape() for proper shape-based collision.
   */
  getRadius(): number {
    const collision = this.stats.collision;
    if (collision) {
      return getEffectiveRadius(collision);
    }
    return 50; // Default if no collision defined
  }

  /**
   * Get the tower's collision shape (rectangle).
   * Uses the collision shape from tower stats, defaulting to DEFAULT_TOWER_COLLISION.
   */
  getCollisionShape(): EntityCollision {
    return this.stats.collision ?? DEFAULT_TOWER_COLLISION;
  }

  /**
   * Towers have infinite mass - they are immovable and push other units away.
   */
  getMass(): number {
    return Infinity;
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

    // Decay aggro timers
    for (const [championId, remaining] of this.aggroMap) {
      const newRemaining = remaining - dt;
      if (newRemaining <= 0) {
        this.aggroMap.delete(championId);
      } else {
        this.aggroMap.set(championId, newRemaining);
      }
    }

    // Find and attack targets
    this.updateCombat(dt, context);
  }

  /**
   * Trigger tower aggro on a champion.
   * Called when an enemy champion damages an allied champion under this tower.
   */
  triggerAggro(championId: string): void {
    this.aggroMap.set(championId, ServerTower.AGGRO_DURATION);
  }

  /**
   * Check if a champion has tower aggro.
   */
  hasAggro(championId: string): boolean {
    return this.aggroMap.has(championId);
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

    // Always re-evaluate target to find highest priority
    // This allows switching to champions with aggro immediately
    const bestTarget = this.findTarget(context);
    if (bestTarget !== this.attackTarget) {
      this.attackTarget = bestTarget;
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
   * Priority: Champions with aggro > Minions > Champions without aggro
   *
   * Champions get aggro when they damage an allied champion under tower.
   *
   * Note: Towers have TRUE SIGHT - they can see and target enemies in bushes
   * and stealthed enemies. No visibility check is performed intentionally.
   */
  private findTarget(context: ServerGameContext): string | null {
    const nearbyEntities = context.getEntitiesInRadius(
      this.position,
      this.stats.attackRange,
    );

    let bestTarget: ServerEntity | null = null;
    let bestPriority = TowerTargetPriority.NONE;
    let bestDistance = Infinity;

    for (const entity of nearbyEntities) {
      // Skip allies, self, and structures
      if (entity.side === this.side) continue;
      if (entity.isDead) continue;
      if (
        entity.entityType === EntityType.TOWER ||
        entity.entityType === EntityType.INHIBITOR ||
        entity.entityType === EntityType.NEXUS
      )
        continue;

      const distance = this.position.distanceTo(entity.position);
      if (distance > this.stats.attackRange) continue;

      // Calculate priority
      let priority = TowerTargetPriority.NONE;

      if (entity.entityType === EntityType.CHAMPION) {
        // Check if this champion has tower aggro (damaged an allied champion)
        if (this.hasAggro(entity.id)) {
          priority = TowerTargetPriority.CHAMPION_WITH_AGGRO;
        } else {
          // Champions without aggro have lowest priority (only target if no minions)
          priority = TowerTargetPriority.CHAMPION;
        }
      } else if (entity.entityType === EntityType.MINION) {
        priority = TowerTargetPriority.MINION;
      }

      // Prefer higher priority, then closer distance
      if (
        priority > bestPriority ||
        (priority === bestPriority && distance < bestDistance)
      ) {
        bestPriority = priority;
        bestDistance = distance;
        bestTarget = entity;
      }
    }

    return bestTarget?.id ?? null;
  }

  /** Tower projectile speed */
  private static readonly PROJECTILE_SPEED = 900;
  /** Tower projectile radius */
  private static readonly PROJECTILE_RADIUS = 12;

  /**
   * Attack a target by firing a projectile.
   */
  private attack(target: ServerEntity, context: ServerGameContext): void {
    // Calculate damage with warmup (damage is locked in when projectile is fired)
    const baseDamage = this.stats.attackDamage;
    const warmupBonus = this.warmupStacks * this.stats.warmupDamagePerStack;
    const totalDamage = baseDamage + warmupBonus;

    // Fire projectile at target
    const projectile = new ServerTargetedProjectile({
      id: `proj_${this.id}_${Date.now()}`,
      position: this.position.clone(),
      side: this.side,
      targetId: target.id,
      speed: ServerTower.PROJECTILE_SPEED,
      radius: ServerTower.PROJECTILE_RADIUS,
      sourceId: this.id,
      projectileType: "tower",
      damage: totalDamage,
      damageType: "physical",
    });

    context.addEntity(projectile);

    // Emit attack event for client-side animation (tower firing animation)
    context.addEvent(GameEventType.BASIC_ATTACK, {
      entityId: this.id,
      targetId: target.id,
      animationDuration: 0.3,
    });

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
    const targetRadius =
      typeof (target as any).getRadius === "function"
        ? (target as any).getRadius()
        : 0;
    return (
      this.position.distanceTo(target.position) <=
      this.stats.attackRange + targetRadius
    );
  }

  /**
   * Called when the tower is destroyed - overrides base implementation.
   */
  protected onDeath(killerId?: string, context?: ServerGameContext): void {
    super.onDeath(killerId, context);
    this._isDestroyed = true;

    // Award XP/gold to killer and nearby allies
    if (context) {
      RewardSystem.awardKillRewards(this, killerId, context);
      // Also award global gold to all allied champions
      RewardSystem.awardGlobalTowerGold(this.side, context);
    }
  }

  /**
   * Override damage calculation for armor/magic resist.
   */
  protected calculateDamage(amount: number, type: DamageType): number {
    if (type === "true" || type === "pure") {
      return amount;
    }

    let reduction = 0;
    if (type === "physical") {
      reduction = this.stats.armor / (100 + this.stats.armor);
    } else if (type === "magic") {
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
      // Use null for cleared values (not undefined) for proper delta updates
      targetEntityId: this.attackTarget,
      health: this.health,
      maxHealth: this.maxHealth,
      isDestroyed: this._isDestroyed,
    };
  }
}
