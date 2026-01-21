/**
 * JungleCreature - Base class for jungle camp monsters.
 *
 * Jungle creatures:
 * - Stay at their camp position when not in combat
 * - Attack nearby enemies that approach
 * - Return to camp if pulled too far (leash)
 * - Award gold and experience when killed
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { WorldEntity } from '@/core/GameObject';
import RenderElement from '@/render/renderElement';
import { IGameUnit, UnitType, UnitSide, DamageType, UnitBaseStats, UnitReward, TeamId } from '@/units/types';
import { ActiveEffect, CrowdControlStatus, computeCCStatus } from '@/effects/types';
import { JungleCamp } from './JungleCamp';
import { Champion } from '@/champions/Champion';

/**
 * AI state for jungle creatures.
 */
type JungleCreatureState = 'idle' | 'aggro' | 'returning';

/**
 * Base class for jungle creatures.
 */
export abstract class JungleCreature extends WorldEntity implements IGameUnit {
  // ===================
  // IGameUnit Properties
  // ===================

  readonly unitType: UnitType = 'creature';

  // ===================
  // Stats
  // ===================

  protected health: number;
  protected maxHealth: number;
  protected armor: number;
  protected magicResist: number;
  protected attackDamage: number;
  protected attackRange: number;
  protected attackCooldown: number;
  protected movementSpeed: number;
  protected sightRange: number;
  protected leashRange: number;

  // ===================
  // Rewards
  // ===================

  protected goldReward: number;
  protected expReward: number;

  // ===================
  // State
  // ===================

  /** Home position (camp location) */
  protected homePosition: Vector;

  /** Reference to owning camp */
  protected camp: JungleCamp | null = null;

  /** Current AI state */
  protected state: JungleCreatureState = 'idle';

  /** Current attack target */
  protected target: IGameUnit | null = null;

  /** Attack cooldown timer */
  protected attackTimer: number = 0;

  /** Whether currently in attack animation (prevents movement) */
  protected _isAttacking: boolean = false;

  /** Whether the creature is dead */
  protected _isDead: boolean = false;

  /** Active effects */
  protected activeEffects: ActiveEffect[] = [];

  /** Movement velocity */
  protected velocity: Vector = new Vector();

  /** Current path for pathfinding */
  protected currentPath: Vector[] = [];

  /** Current index in the path */
  protected currentPathIndex: number = 0;

  /** Last target position used for path calculation */
  protected lastPathTarget: Vector | null = null;

  /**
   * Create a jungle creature.
   */
  constructor(
    position: Vector,
    stats: {
      health: number;
      damage: number;
      attackRange: number;
      attackCooldown: number;
      movementSpeed: number;
      sightRange: number;
      leashRange: number;
      goldReward: number;
      expReward: number;
    }
  ) {
    super(position.clone());

    this.homePosition = position.clone();

    // Set stats
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.armor = 10;
    this.magicResist = 10;
    this.attackDamage = stats.damage;
    this.attackRange = stats.attackRange;
    this.attackCooldown = stats.attackCooldown;
    this.movementSpeed = stats.movementSpeed;
    this.sightRange = stats.sightRange;
    this.leashRange = stats.leashRange;
    this.goldReward = stats.goldReward;
    this.expReward = stats.expReward;
  }

  /**
   * Set the owning camp.
   */
  setCamp(camp: JungleCamp): void {
    this.camp = camp;
  }

  /**
   * Get the creature's visual radius for rendering.
   */
  abstract getRadius(): number;

  /**
   * Get the creature's display name.
   */
  abstract getName(): string;

  // ===================
  // IGameUnit Implementation
  // ===================

  getTeamId(): TeamId {
    return 2; // Neutral team (not 0 or 1)
  }

  getSide(): UnitSide {
    return 2 as UnitSide; // Neutral
  }

  getSightRange(): number {
    return this.sightRange;
  }

  getPosition(): Vector {
    return this.position.clone();
  }

  setPosition(pos: Vector): void {
    this.position = pos.clone();
  }

  getDirection(): Vector {
    if (this.velocity.length() > 0) {
      return this.velocity.clone().normalize();
    }
    return new Vector(1, 0);
  }

  isDead(): boolean {
    return this._isDead;
  }

  getCurrentHealth(): number {
    return this.health;
  }

  getBaseStats(): UnitBaseStats {
    return {
      health: this.health,
      maxHealth: this.maxHealth,
      armor: this.armor,
      magicResist: this.magicResist,
      movementSpeed: this.movementSpeed,
    };
  }

  getReward(): UnitReward {
    return {
      gold: this.goldReward,
      experience: this.expReward,
    };
  }

  takeDamage(rawDamage: number, damageType: DamageType, source?: IGameUnit): number {
    if (this._isDead) return 0;

    let finalDamage = rawDamage;

    // Apply resistances
    switch (damageType) {
      case 'physical':
        finalDamage = rawDamage * (100 / (100 + this.armor));
        break;
      case 'magic':
        finalDamage = rawDamage * (100 / (100 + this.magicResist));
        break;
      case 'true':
        break;
    }

    this.health = Math.max(0, this.health - finalDamage);

    // Aggro onto attacker
    if (source && !this._isDead) {
      this.target = source;
      this.state = 'aggro';
    }

    return finalDamage;
  }

  heal(amount: number, _source?: IGameUnit): number {
    if (this._isDead) return 0;

    const oldHealth = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - oldHealth;
  }

  // Jungle creatures don't have shields
  addShield(_amount: number, _duration: number, _source?: string): void {}
  getTotalShield(): number { return 0; }

  // Jungle creatures don't have immunities
  addImmunity(_type: string): void {}
  removeImmunity(_type: string): void {}
  hasImmunity(_type: string): boolean { return false; }

  applyEffect(effect: ActiveEffect): void {
    this.activeEffects.push(effect);
  }

  removeEffect(effectId: string): void {
    this.activeEffects = this.activeEffects.filter(e => e.definition.id !== effectId);
  }

  applyKnockback(_direction: Vector, _distance: number, _duration: number): void {
    // Jungle creatures ignore knockback
  }

  isInForcedMovement(): boolean {
    return false;
  }

  getCrowdControlStatus(): CrowdControlStatus {
    return computeCCStatus(this.activeEffects);
  }

  // ===================
  // Update Logic
  // ===================

  override step(gctx: GameContext): void {
    if (this._isDead) return;

    const dt = gctx.dt;

    // Update effects
    this.updateEffects(dt);

    // Update attack cooldown
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
    }

    // Check death
    if (this.health <= 0) {
      this.die(gctx);
      return;
    }

    // AI state machine
    switch (this.state) {
      case 'idle':
        this.updateIdle(gctx);
        break;
      case 'aggro':
        this.updateAggro(gctx);
        break;
      case 'returning':
        this.updateReturning(gctx);
        break;
    }

    // Apply movement
    this.position.add(this.velocity.clone().scalar(dt));
  }

  /**
   * Update in idle state - look for nearby enemies.
   */
  private updateIdle(gctx: GameContext): void {
    this.velocity = new Vector();

    // Look for nearby enemies
    const nearbyObjects = gctx.spatialHashing.queryInRange(this.position, this.sightRange);

    for (const obj of nearbyObjects) {
      if (this.isValidTarget(obj)) {
        this.target = obj;
        this.state = 'aggro';
        return;
      }
    }
  }

  /**
   * Update in aggro state - chase and attack target.
   */
  private updateAggro(gctx: GameContext): void {
    // Don't move or change state while attacking
    if (this._isAttacking) {
      this.velocity = new Vector();
      return;
    }

    // Check leash distance
    const distFromHome = this.position.distanceTo(this.homePosition);
    if (distFromHome > this.leashRange) {
      this.state = 'returning';
      this.target = null;
      this.currentPath = [];
      this.currentPathIndex = 0;
      this.lastPathTarget = null;
      return;
    }

    // Check if target is still valid
    if (!this.target || this.target.isDead()) {
      this.target = null;
      this.state = 'idle';
      this.currentPath = [];
      this.currentPathIndex = 0;
      this.lastPathTarget = null;
      return;
    }

    const targetPos = this.target.getPosition();
    const distToTarget = this.position.distanceTo(targetPos);

    // Attack if in range
    if (distToTarget <= this.attackRange) {
      this.velocity = new Vector();
      this.currentPath = [];
      this.currentPathIndex = 0;

      if (this.attackTimer <= 0) {
        this.performAttack(this.target);
        this.attackTimer = this.attackCooldown;
      }
    } else {
      // Chase target using pathfinding if available
      this.moveToward(gctx, targetPos);
    }
  }

  /**
   * Update in returning state - go back to home position.
   */
  private updateReturning(gctx: GameContext): void {
    const distFromHome = this.position.distanceTo(this.homePosition);

    if (distFromHome < 20) {
      // Reached home
      this.position = this.homePosition.clone();
      this.velocity = new Vector();
      this.state = 'idle';
      this.currentPath = [];
      this.currentPathIndex = 0;
      this.lastPathTarget = null;

      // Heal to full when returning
      this.health = this.maxHealth;
      return;
    }

    // Move toward home using pathfinding - move faster when returning
    this.moveToward(gctx, this.homePosition, 1.5);
  }

  /**
   * Move toward a target position using pathfinding if available.
   * @param gctx - Game context
   * @param target - Target position to move to
   * @param speedMultiplier - Optional speed multiplier (default 1.0)
   */
  private moveToward(gctx: GameContext, target: Vector, speedMultiplier: number = 1.0): void {
    const speed = this.movementSpeed * speedMultiplier;

    // Check if we need to recalculate path
    const needsNewPath = this.currentPath.length === 0 ||
      !this.lastPathTarget ||
      this.lastPathTarget.distanceTo(target) > 50;

    // Use pathfinding if available
    if (gctx.navigationGrid && needsNewPath) {
      const path = gctx.navigationGrid.findPath(this.position, target);
      if (path && path.length > 0) {
        this.currentPath = path;
        this.currentPathIndex = 0;
        this.lastPathTarget = target.clone();
      } else {
        // No path found, clear path
        this.currentPath = [];
        this.currentPathIndex = 0;
      }
    }

    // Follow path if we have one
    if (this.currentPath.length > 0 && this.currentPathIndex < this.currentPath.length) {
      const nextWaypoint = this.currentPath[this.currentPathIndex];
      const distToWaypoint = this.position.distanceTo(nextWaypoint);

      // Check if we reached current waypoint
      if (distToWaypoint < 15) {
        this.currentPathIndex++;
        // Check if path complete
        if (this.currentPathIndex >= this.currentPath.length) {
          this.velocity = new Vector();
          this.currentPath = [];
          this.currentPathIndex = 0;
          this.lastPathTarget = null;
          return;
        }
      }

      // Move toward current waypoint
      const waypointTarget = this.currentPath[this.currentPathIndex];
      const direction = waypointTarget.clone().sub(this.position).normalize();
      this.velocity = direction.scalar(speed);
    } else {
      // No path or no navigation grid - use direct movement (fallback)
      const direction = target.clone().sub(this.position).normalize();
      this.velocity = direction.scalar(speed);
    }
  }

  /**
   * Check if an object is a valid target.
   */
  private isValidTarget(obj: unknown): obj is Champion {
    // Check if it's a champion
    return obj instanceof Champion && !obj.isDead();
  }

  /**
   * Perform an attack on the target.
   * Protected so subclasses can override to add animations.
   */
  protected performAttack(target: IGameUnit): void {
    target.takeDamage(this.attackDamage, 'physical', this);
  }

  /**
   * Handle death.
   */
  private die(gctx: GameContext): void {
    this._isDead = true;

    // Award gold to killer (last attacker)
    // For now, just notify the camp
    if (this.camp) {
      this.camp.onCreatureKilled(this);
    }

    // Award gold to nearby allied champions (player team = 0)
    const nearbyChampions = gctx.spatialHashing.queryInRange(this.position, 500)
      .filter((obj): obj is Champion =>
        obj instanceof Champion && !obj.isDead() && obj.getSide() === 0
      );

    if (nearbyChampions.length > 0) {
      // Award gold to player (via game context)
      gctx.setMoney(gctx.money + this.goldReward);
    }
  }

  /**
   * Update active effects.
   */
  private updateEffects(dt: number): void {
    for (const effect of this.activeEffects) {
      if (effect.timeRemaining !== undefined) {
        effect.timeRemaining -= dt;
      }
    }
    this.activeEffects = this.activeEffects.filter(
      e => e.timeRemaining === undefined || e.timeRemaining > 0
    );
  }

  /**
   * Render health bar above the creature.
   */
  protected renderHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = this.getRadius() * 2;
    const barHeight = 6;
    const barY = this.position.y - this.getRadius() - 15;
    const barX = this.position.x - barWidth / 2;

    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health fill
    const healthPercent = this.health / this.maxHealth;
    ctx.fillStyle = '#44FF44';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }

  abstract override render(): RenderElement;
}

export default JungleCreature;
