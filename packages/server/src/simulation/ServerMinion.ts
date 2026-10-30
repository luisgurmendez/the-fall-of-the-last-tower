/**
 * ServerMinion - Server-side minion entity.
 *
 * Handles:
 * - Lane following: steers toward a point a little ahead on the lane path,
 *   so after a fight it rejoins the lane without walking backwards
 * - Target acquisition within sight range, with "call for help": an enemy
 *   champion that hits an allied champion nearby becomes the top target
 * - Chasing (up to a leash from the lane) and combat
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
import { LanePath } from '../navigation/LanePath';
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
  /** Sideways offset from the lane center, so a wave walks side by side (default 0) */
  laneOffset?: number;
  /** Stat multipliers for waves later in the game (default 1) */
  statScale?: { health: number; damage: number };
}

/**
 * Target priorities (higher wins; ties go to the closest).
 */
const enum MinionTargetPriority {
  STRUCTURE = 10,
  CHAMPION = 30,
  MINION = 50,
  /** Enemy champion that just damaged an allied champion near this minion */
  CALL_FOR_HELP = 100,
}

/**
 * Server-side minion entity.
 */
export class ServerMinion extends ServerEntity {
  readonly minionType: MinionType;
  readonly lane: LaneId;
  readonly stats: MinionStats;

  // Movement
  private lanePath: LanePath | null = null;
  private readonly laneOffset: number;
  private moveTarget: Vector | null = null;

  /** How far ahead on the lane the minion steers (world units) */
  private static readonly LANE_LOOKAHEAD = 120;
  /** Stop chasing a target once this far from the lane */
  private static readonly LANE_LEASH = 350;
  /** Allied champions this close can call for help */
  private static readonly CALL_FOR_HELP_RANGE = 500;
  /** How recent a champion's attack must be to call for help (seconds) */
  private static readonly CALL_FOR_HELP_WINDOW = 2;
  /** How often a minion with a target looks for a better one (seconds) */
  private static readonly RETARGET_INTERVAL = 0.5;
  private retargetTimer = 0;

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
    if (config.statScale) {
      this.stats.health = Math.round(this.stats.health * config.statScale.health);
      this.stats.maxHealth = Math.round(this.stats.maxHealth * config.statScale.health);
      this.stats.attackDamage = Math.round(this.stats.attackDamage * config.statScale.damage);
    }
    this.laneOffset = config.laneOffset ?? 0;

    // Initialize from stats
    this.health = this.stats.health;
    this.maxHealth = this.stats.maxHealth;
    this.goldReward = this.stats.goldReward;
    this.experienceReward = this.stats.experienceReward;

    // Lane path from the spawn point through the waypoints
    if (config.waypoints.length > 0) {
      this.lanePath = new LanePath([this.position.clone(), ...config.waypoints]);
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
   * Uses the collision shape from minion stats, defaulting to 20.
   */
  override getRadius(): number {
    const collision = this.stats.collision;
    if (collision && collision.type === 'circle') {
      return collision.radius;
    }
    return 20; // Default if no collision defined
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
      if (!target || !this.canKeepTarget(target, context)) {
        this.attackTarget = null;
      }
    }

    // Find a target, or periodically check for a better one: more important
    // (call for help), or closer when the current one can't be reached
    this.retargetTimer -= dt;
    if (!this.attackTarget || this.retargetTimer <= 0) {
      this.retargetTimer = ServerMinion.RETARGET_INTERVAL;
      const best = this.findTarget(context);
      if (best && best.id !== this.attackTarget && this.shouldSwitchTo(best, context)) {
        this.attackTarget = best.id;
      }
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
   * Whether a newly found target beats the current one.
   */
  private shouldSwitchTo(best: { id: string; priority: number; distance: number }, context: ServerGameContext): boolean {
    if (!this.attackTarget) return true;
    const current = context.getEntity(this.attackTarget);
    if (!current) return true;

    const currentPriority = this.getPriority(current, context) ?? 0;
    if (best.priority !== currentPriority) return best.priority > currentPriority;

    // Same priority: stay on a target in range; otherwise take a clearly closer one
    // (the current one may be walled off by other units)
    if (this.isInRange(current, this.stats.attackRange)) return false;
    return best.distance < this.position.distanceTo(current.position) - 50;
  }

  /**
   * Whether to keep chasing a target: alive, visible, within reach and not
   * dragging the minion too far from its lane.
   */
  private canKeepTarget(target: ServerEntity, context: ServerGameContext): boolean {
    if (target.isDead || !context.isVisibleTo(target, this.side)) return false;
    if (this.isInRange(target, this.stats.attackRange)) return true;
    if (this.position.distanceTo(target.position) > this.getAcquisitionRange() + 100) return false;
    return !this.lanePath || this.lanePath.project(this.position).offset <= ServerMinion.LANE_LEASH;
  }

  /**
   * How far away a minion notices enemies.
   */
  private getAcquisitionRange(): number {
    return Math.max(this.stats.sightRange, this.stats.attackRange + 100);
  }

  /**
   * Find the best target in acquisition range.
   * Priority: champion calling for help > minions > champions > structures,
   * closest first within a priority.
   * Note: Minions do NOT attack jungle creatures - they only fight lane units.
   */
  private findTarget(context: ServerGameContext): { id: string; priority: number; distance: number } | null {
    const nearbyEntities = context.getEntitiesInRadius(this.position, this.getAcquisitionRange());

    let best: { id: string; priority: number; distance: number } | null = null;
    let bestDistance = Infinity;

    for (const entity of nearbyEntities) {
      if (entity.side === this.side || entity.id === this.id || entity.isDead) continue;
      if (!context.isVisibleTo(entity, this.side)) continue;

      const priority = this.getPriority(entity, context);
      if (priority === null) continue;

      const distance = this.position.distanceTo(entity.position);
      if (!best || priority > best.priority || (priority === best.priority && distance < bestDistance)) {
        best = { id: entity.id, priority, distance };
        bestDistance = distance;
      }
    }

    return best;
  }

  /**
   * Priority for an enemy entity, or null if minions don't fight it
   * (jungle creatures, projectiles, zones, wards).
   */
  private getPriority(entity: ServerEntity, context: ServerGameContext): number | null {
    switch (entity.entityType) {
      case EntityType.CHAMPION: {
        const victim = context.getRecentChampionVictim(entity.id, ServerMinion.CALL_FOR_HELP_WINDOW);
        if (victim && victim.side === this.side &&
            victim.position.distanceTo(this.position) <= ServerMinion.CALL_FOR_HELP_RANGE) {
          return MinionTargetPriority.CALL_FOR_HELP;
        }
        return MinionTargetPriority.CHAMPION;
      }
      case EntityType.MINION:
        return MinionTargetPriority.MINION;
      case EntityType.TOWER:
      case EntityType.INHIBITOR:
      case EntityType.NEXUS:
        return MinionTargetPriority.STRUCTURE;
      default:
        return null;
    }
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

    // Caster and siege minions fire projectiles, melee minions deal instant damage
    if (this.minionType === 'caster' || this.minionType === 'siege') {
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
      projectileType: this.minionType === 'siege' ? 'minion_siege' : 'minion_caster',
      damage: this.stats.attackDamage,
      damageType: 'physical',
    });

    context.addEntity(projectile);
  }

  /**
   * Handle movement: chase the attack target, otherwise follow the lane.
   */
  private updateMovement(dt: number, context: ServerGameContext): void {
    if (this.attackTarget) {
      const target = context.getEntity(this.attackTarget);
      if (target && !this.isInRange(target, this.stats.attackRange)) {
        this.moveTarget = target.position.clone();
      } else {
        // In range - stop moving and clear move target
        this.moveTarget = null;
        return;
      }
    } else {
      this.moveTarget = this.getLaneSteeringPoint();
    }

    if (!this.moveTarget) return;

    // Move toward target (using effective speed with slows applied)
    const distance = this.position.distanceTo(this.moveTarget);
    const speed = this.getEffectiveMovementSpeed() * dt;

    if (distance <= speed) {
      this.position = this.moveTarget.clone();
      this.moveTarget = null;
    } else {
      const direction = Vector.direction(this.position, this.moveTarget);
      this.position.add(direction.scalar(speed));
    }
  }

  /**
   * A point a little ahead on the lane (shifted by this minion's lane offset).
   * Steering toward it follows the lane, rounds corners, and after a fight
   * leads back onto the lane further along instead of to an old waypoint.
   */
  private getLaneSteeringPoint(): Vector | null {
    if (!this.lanePath) return null;

    const path = this.lanePath;
    const along = path.project(this.position).distance;
    if (along >= path.length - 1) return null; // Reached the end of the lane

    const ahead = Math.min(path.length, along + ServerMinion.LANE_LOOKAHEAD);
    const point = path.pointAt(ahead);
    if (this.laneOffset !== 0) {
      const direction = Vector.direction(path.pointAt(ahead - 10), point);
      point.add(new Vector(-direction.y, direction.x).scalar(this.laneOffset));
    }
    return point;
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
      // Use null for cleared values (not undefined) for proper delta updates
      targetX: this.moveTarget?.x ?? null,
      targetY: this.moveTarget?.y ?? null,
      targetEntityId: this.attackTarget,
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
