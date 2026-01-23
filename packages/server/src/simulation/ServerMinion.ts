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
  GameEventType,
  ActiveEffectState,
} from '@siege/shared';
import type { MinionType, LaneId, MinionStats, DamageType } from '@siege/shared';
import { DEFAULT_MINION_STATS } from '@siege/shared';
import { ServerEntity, type ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
import { RewardSystem } from '../systems/RewardSystem';
import { ServerTargetedProjectile } from './ServerTargetedProjectile';
import {
  getServerEffectById,
  isCCEffect,
  isOverTimeEffect,
  isStatEffect,
  type ServerCCEffectDef,
  type ServerOverTimeEffectDef,
  type ServerStatEffectDef,
} from '../data/effects';

/**
 * Simplified CC status for minions.
 */
export interface MinionCCStatus {
  isStunned: boolean;
  isRooted: boolean;
  slowPercent: number;
  canMove: boolean;
  canAttack: boolean;
}

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

  // Effects system (simplified from champions)
  activeEffects: ActiveEffectState[] = [];
  ccStatus: MinionCCStatus = {
    isStunned: false,
    isRooted: false,
    slowPercent: 0,
    canMove: true,
    canAttack: true,
  };

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
  // Effects System
  // =====================

  /**
   * Apply an effect to this minion.
   * Simplified version of champion effect system.
   */
  applyEffect(effectId: string, duration: number, sourceId?: string, stacks = 1): void {
    const def = getServerEffectById(effectId);
    if (!def) return;

    // Check for existing effect
    const existing = this.activeEffects.find(e => e.definitionId === effectId);

    if (existing) {
      // Simple refresh behavior for minions - take max duration
      existing.timeRemaining = Math.max(existing.timeRemaining, duration);
      existing.stacks = Math.min((existing.stacks || 1) + stacks, def.maxStacks || 5);
    } else {
      // Add new effect with unique instance ID
      this.activeEffects.push({
        instanceId: `${this.id}_${effectId}_${Date.now()}`,
        definitionId: effectId,
        sourceId,
        timeRemaining: duration,
        totalDuration: duration,
        stacks,
      });
    }
  }

  /**
   * Update active effects - process timers and DoT ticks.
   */
  private updateEffects(dt: number, context: ServerGameContext): void {
    // Process effects and update timers
    this.activeEffects = this.activeEffects.filter(effect => {
      const def = getServerEffectById(effect.definitionId);

      // Handle DoT effects
      if (def && isOverTimeEffect(def)) {
        this.processOverTimeEffect(effect, def as ServerOverTimeEffectDef, dt, context);
      }

      // Update timer
      effect.timeRemaining -= dt;
      return effect.timeRemaining > 0;
    });

    // Recalculate CC status after processing effects
    this.ccStatus = this.calculateCCStatus();
  }

  /**
   * Process a damage/heal over time effect tick.
   */
  private processOverTimeEffect(
    effect: ActiveEffectState,
    def: ServerOverTimeEffectDef,
    dt: number,
    context: ServerGameContext
  ): void {
    if (effect.nextTickIn === undefined) {
      effect.nextTickIn = def.tickInterval;
    }

    effect.nextTickIn -= dt;

    while (effect.nextTickIn <= 0) {
      const tickValue = def.valuePerTick * (effect.stacks || 1);

      if (def.otType === 'damage') {
        this.takeDamage(tickValue, def.damageType || 'magic', effect.sourceId || '', context);
      } else if (def.otType === 'heal') {
        this.heal(tickValue);
      }

      effect.nextTickIn += def.tickInterval;
    }
  }

  /**
   * Calculate CC status from active effects.
   */
  private calculateCCStatus(): MinionCCStatus {
    const status: MinionCCStatus = {
      isStunned: false,
      isRooted: false,
      slowPercent: 0,
      canMove: true,
      canAttack: true,
    };

    for (const effect of this.activeEffects) {
      const def = getServerEffectById(effect.definitionId);
      if (!def) continue;

      // Handle CC effects
      if (isCCEffect(def)) {
        const ccDef = def as ServerCCEffectDef;
        switch (ccDef.ccType) {
          case 'stun':
          case 'knockup':
          case 'knockback':
          case 'suppress':
            status.isStunned = true;
            break;
          case 'root':
            status.isRooted = true;
            break;
          case 'slow':
            // CC slow - extract from effect ID if needed
            const match = effect.definitionId.match(/slow_(\d+)/);
            if (match) {
              const slowAmount = parseInt(match[1]) / 100;
              status.slowPercent = Math.max(status.slowPercent, slowAmount);
            }
            break;
          case 'taunt':
            // Taunt doesn't affect minions' CC status
            break;
        }
      }

      // Handle stat effects (slows are often stat effects that reduce movement speed)
      if (isStatEffect(def)) {
        const statDef = def as ServerStatEffectDef;
        if (statDef.stat === 'movement_speed' && statDef.percentValue !== undefined) {
          // Negative percentValue means slow (e.g., -0.3 means 30% slow)
          if (statDef.percentValue < 0) {
            const slowAmount = Math.abs(statDef.percentValue);
            status.slowPercent = Math.max(status.slowPercent, slowAmount);
          }
        }
      }
    }

    // Compute derived flags
    status.canMove = !status.isStunned && !status.isRooted;
    status.canAttack = !status.isStunned;

    return status;
  }

  /**
   * Get movement speed after applying slow effects.
   */
  getEffectiveMovementSpeed(): number {
    const baseSpeed = this.stats.movementSpeed;
    const slowReduction = 1 - this.ccStatus.slowPercent;
    return baseSpeed * slowReduction;
  }

  /**
   * Heal the minion (for heal over time effects).
   * Override to match base class signature.
   */
  override heal(amount: number): number {
    if (this.isDead) return 0;
    const previousHealth = this.health;
    this.health = Math.min(this.health + amount, this.maxHealth);
    return this.health - previousHealth;
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

    // Update effects first (processes CC, DoT, etc.)
    this.updateEffects(dt, context);

    // Update cooldowns
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt;
    }

    // Update attack animation timer
    if (this.attackAnimationTimer > 0) {
      this.attackAnimationTimer -= dt;
    }

    // Only do combat if not stunned
    if (this.ccStatus.canAttack) {
      this.updateCombat(dt, context);
    }

    // Only move if not stunned/rooted
    if (this.ccStatus.canMove) {
      this.updateMovement(dt, context);
    }
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

      // Skip projectiles, zones, and wards - minions only fight units
      if (entity.entityType === EntityType.PROJECTILE) continue;
      if (entity.entityType === EntityType.ZONE) continue;
      if (entity.entityType === EntityType.WARD) continue;

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

  /** Projectile speed for ranged minions (caster) */
  private static readonly PROJECTILE_SPEED = 650;
  /** Projectile radius for collision */
  private static readonly PROJECTILE_RADIUS = 8;

  /**
   * Attack a target.
   */
  private attack(target: ServerEntity, context: ServerGameContext): void {
    // Reset cooldown
    this.attackCooldown = this.stats.attackCooldown;

    // Start attack animation
    this.attackAnimationTimer = ServerMinion.ATTACK_ANIMATION_DURATION;

    // Emit attack event for client-side animation
    context.addEvent(GameEventType.BASIC_ATTACK, {
      entityId: this.id,
      targetId: target.id,
      animationDuration: ServerMinion.ATTACK_ANIMATION_DURATION,
    });

    // Stop moving while attacking
    this.moveTarget = null;

    // Caster minions fire projectiles, melee minions deal instant damage
    if (this.minionType === 'caster') {
      this.fireProjectile(target, context);
    } else {
      // Melee - deal damage instantly
      target.takeDamage(this.stats.attackDamage, 'physical', this.id, context);
    }
  }

  /**
   * Fire a projectile at a target (for caster minions).
   */
  private fireProjectile(target: ServerEntity, context: ServerGameContext): void {
    const projectile = new ServerTargetedProjectile({
      id: `proj_${this.id}_${Date.now()}`,
      position: this.position.clone(),
      side: this.side,
      targetId: target.id,
      speed: ServerMinion.PROJECTILE_SPEED,
      radius: ServerMinion.PROJECTILE_RADIUS,
      sourceId: this.id,
      projectileType: 'minion_caster',
      damage: this.stats.attackDamage,
      damageType: 'physical',
    });

    context.addEntity(projectile);
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
        // In range - stop moving and clear move target
        this.moveTarget = null;
        return;
      }
    } else if (!this.moveTarget && this.currentWaypointIndex < this.waypoints.length) {
      // Resume waypoint following
      this.moveTarget = this.waypoints[this.currentWaypointIndex].clone();
    }

    if (!this.moveTarget) return;

    // Move toward target (using effective speed with slows applied)
    const distance = this.position.distanceTo(this.moveTarget);
    const speed = this.getEffectiveMovementSpeed() * dt;

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
  protected onDeath(killerId?: string, context?: ServerGameContext): void {
    super.onDeath(killerId, context);

    // Award XP/gold to killer and nearby allies
    if (context) {
      RewardSystem.awardKillRewards(this, killerId, context);
    }

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
      // CC status for visual feedback
      isStunned: this.ccStatus.isStunned || undefined,
      isRooted: this.ccStatus.isRooted || undefined,
      slowPercent: this.ccStatus.slowPercent > 0 ? this.ccStatus.slowPercent : undefined,
    };
  }
}
