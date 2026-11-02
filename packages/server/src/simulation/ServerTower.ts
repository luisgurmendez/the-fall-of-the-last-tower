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
import { isStructureVulnerable } from '../systems/StructureRules';
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
  /** Larger than any unit's collision radius, for the target search */
  private static readonly MAX_UNIT_RADIUS = 60;

  // Destroyed state
  private _isDestroyed: boolean = false;

  /** Can't be damaged yet (see StructureRules); refreshed every tick */
  isProtected = false;

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
   * Attack range for this tower's tier.
   */
  get attackRange(): number {
    return this.stats.attackRange;
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

    this.isProtected = !isStructureVulnerable(this, context);

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

    // Re-evaluate every tick, but keep the current target unless something of
    // higher priority shows up (a champion that hit an ally under the tower);
    // switching to whichever minion is closest spread the damage around
    const bestTarget = this.findTarget(context);
    const current = this.attackTarget ? context.getEntity(this.attackTarget) : undefined;
    const best = bestTarget ? context.getEntity(bestTarget) : undefined;
    const keepCurrent = !!current && !!best &&
      this.getTargetPriority(best) <= this.getTargetPriority(current);
    if (!keepCurrent && bestTarget !== this.attackTarget) {
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
    // Wide enough for the biggest unit; isInAttackRange below is the real check
    const nearbyEntities = context.getEntitiesInRadius(
      this.position,
      this.stats.attackRange + this.getRadius() + ServerTower.MAX_UNIT_RADIUS,
    );

    let bestTarget: ServerEntity | null = null;
    let bestPriority = TowerTargetPriority.NONE;
    let bestDistance = Infinity;

    for (const entity of nearbyEntities) {
      if (entity.side === this.side || entity.isDead) continue;
      // Only champions and minions: never structures, jungle creatures,
      // wards, traps, zones, projectiles, Lume's orb or blossoms (shots at
      // those flew at nothing, often at things its own side can't see)
      const priority = this.getTargetPriority(entity);
      if (priority === TowerTargetPriority.NONE) continue;

      if (!this.isInAttackRange(entity, this.stats.attackRange)) continue;
      const distance = this.position.distanceTo(entity.position);


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

  /**
   * How much the tower wants to shoot an entity: champions that hit an
   * allied champion under it, then minions, then other champions; NONE for
   * everything it doesn't shoot.
   */
  private getTargetPriority(entity: ServerEntity): TowerTargetPriority {
    if (entity.entityType === EntityType.CHAMPION) {
      // Champions with aggro (damaged an allied champion) come first; others
      // only when there are no minions
      return this.hasAggro(entity.id)
        ? TowerTargetPriority.CHAMPION_WITH_AGGRO
        : TowerTargetPriority.CHAMPION;
    }
    if (entity.entityType === EntityType.MINION) return TowerTargetPriority.MINION;
    return TowerTargetPriority.NONE;
  }

  /**
   * Tower projectile speed: the classic MOBA's at our scale, so a shot
   * takes a moment to land and can be seen (at 900 it hit within 0.15s)
   */
  private static readonly PROJECTILE_SPEED = 500;
  /** Tower projectile radius */
  private static readonly PROJECTILE_RADIUS = 12;

  /**
   * The unit this tower is shooting, or null.
   */
  getAttackTargetId(): string | null {
    return this.attackTarget;
  }

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
   * Check if target is in range (edge to edge, see ServerEntity.isInAttackRange).
   */
  isInRange(target: ServerEntity): boolean {
    return this.isInAttackRange(target, this.stats.attackRange);
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
   * Structures fall in lane order: damage is ignored while this one is protected
   * (see StructureRules).
   */
  override takeDamage(amount: number, type: DamageType, sourceId?: string, context?: ServerGameContext): number {
    if (context && !isStructureVulnerable(this, context)) return 0;
    return super.takeDamage(amount, type, sourceId, context);
  }

  /** Its armor and magic resist */
  protected override getResists(): { armor: number; magicResist: number } {
    return { armor: this.stats.armor, magicResist: this.stats.magicResist };
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
      isProtected: this.isProtected,
    };
  }
}
