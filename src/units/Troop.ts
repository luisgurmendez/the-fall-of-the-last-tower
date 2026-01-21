/**
 * Abstract base class for Troops (army units like soldiers and archers).
 *
 * Troops are army units that:
 * - Are spawned by the player or enemy
 * - Fight in lanes toward objectives
 * - Give small gold rewards when killed
 * - Can be targeted by abilities
 *
 * This class provides the IGameUnit interface for the existing
 * ArmyUnit functionality.
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { Shape, Square, Rectangle } from '@/objects/shapes';
import RenderElement from '@/render/renderElement';
import Disposable from '@/behaviors/disposable';
import Renderable from '@/behaviors/renderable';
import Stepable from '@/behaviors/stepable';
import BaseObject from '@/objects/baseObject';
import { PhysicableMixin } from '@/mixins/physics';
import { CollisionableMixin } from '@/mixins/collisionable';
import Cooldown from '@/objects/cooldown';
import PixelArtSpriteAnimator from '@/sprites/PixelArtSpriteAnimator';
import Background from '@/objects/background';
import Particle from '@/objects/particle/particle';
import { GameConfig } from '@/config';
import RandomUtils from '@/utils/random';
import {
  IGameUnit,
  UnitType,
  UnitSide,
  DamageType,
  UnitBaseStats,
  UnitReward,
  TeamId,
} from './types';
import { ActiveEffect, computeCCStatus, CrowdControlStatus } from '@/effects/types';

// Animation IDs
export const ATTACK_ANIMATION_ID = 'a';
export const WALK_ANIMATION_ID = 'w';

/**
 * Target type for troops.
 */
export type TroopTarget = {
  id: string;
  position: Vector;
} | null;

/**
 * Active shield on a troop.
 */
interface TroopShield {
  amount: number;
  remainingDuration: number;
  source?: string;
}

/**
 * Forced movement for troops.
 */
interface TroopForcedMovement {
  direction: Vector;
  distance: number;
  duration: number;
  elapsed: number;
  type: 'dash' | 'knockback';
}

/**
 * Base class with physics and collision.
 */
const BaseTroop = PhysicableMixin(
  CollisionableMixin<Square>()(BaseObject)
);

/**
 * Abstract base class for army troops.
 *
 * Extends the physics/collision base and implements IGameUnit
 * for ability targeting compatibility.
 */
export abstract class Troop extends BaseTroop implements IGameUnit, Disposable, Renderable, Stepable {
  // ===================
  // IGameUnit Properties
  // ===================

  readonly unitType: UnitType = 'troop';

  // ===================
  // Disposable
  // ===================

  shouldDispose: boolean = false;
  dispose?: () => void;

  // ===================
  // Army Unit Properties
  // ===================

  abstract side: UnitSide;
  abstract target: TroopTarget;
  protected abstract outOfSightRange: number;
  protected abstract health: number;
  protected abstract maxHealth: number;
  protected abstract maxArmor: number;
  protected abstract armor: number;
  protected abstract magicResist: number;
  protected abstract attackCooldown: Cooldown;
  protected abstract attackRange: number;
  protected abstract accelerationRate: number;
  protected abstract triggerAttackAnimationFrame: number;
  protected abstract spriteAnimator: PixelArtSpriteAnimator;

  // ===================
  // GameUnit Properties
  // ===================

  /** Active shields */
  protected shields: TroopShield[] = [];

  /** Active immunities */
  protected immunities: Set<string> = new Set();

  /** Active effects */
  protected activeEffects: ActiveEffect[] = [];

  /** Current forced movement */
  protected forcedMovement: TroopForcedMovement | null = null;

  /** Is the unit dead */
  protected _isDead: boolean = false;

  // ===================
  // Player Interaction
  // ===================

  targetHasBeenSetByPlayer = false;
  isBeingHovered = false;
  isSelected = false;
  targetPosition: Vector | null = null;

  // ===================
  // Pathfinding
  // ===================

  protected currentPath: Vector[] = [];
  protected currentPathIndex: number = 0;
  protected pathGridVersion: number = -1;

  // ===================
  // Internal State
  // ===================

  protected bloodDropsToAddOnNextStep: Particle[] = [];
  protected queuedAttackWithAnimationFrame: ((gctx: GameContext) => void) | null = null;
  protected prevPosition: Vector = new Vector();

  // ===================
  // Abstract Methods
  // ===================

  abstract chooseTypeOfBloodstainWhenDying(background: Background): (inPosition: Vector) => void;
  protected abstract attackIfPossible(gctx: GameContext): void;

  // ===================
  // IGameUnit Implementation
  // ===================

  getTeamId(): TeamId {
    return this.side;
  }

  /**
   * @deprecated Use getTeamId() instead.
   */
  getSide(): UnitSide {
    return this.side;
  }

  getSightRange(): number {
    return this.outOfSightRange;
  }

  getPosition(): Vector {
    return this.position.clone();
  }

  setPosition(pos: Vector): void {
    this.position = pos.clone();
  }

  getDirection(): Vector {
    return this.direction.clone();
  }

  isDead(): boolean {
    return this._isDead || this.shouldDispose;
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
      movementSpeed: this.maxSpeed,
    };
  }

  getReward(): UnitReward {
    return {
      gold: GameConfig.ECONOMY.KILL_REWARD,
      experience: 10, // Small exp for troops
    };
  }

  /**
   * Take damage with resistance calculation.
   */
  takeDamage(rawDamage: number, damageType: DamageType, _source?: IGameUnit): number {
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
        // True damage ignores resistances
        break;
    }

    // Apply shields first
    finalDamage = this.consumeShields(finalDamage);

    // Apply to health
    this.health = Math.max(0, this.health - finalDamage);

    // Generate blood particles
    this.generateBloodDrops();

    return finalDamage;
  }

  heal(amount: number, source?: IGameUnit): number {
    if (this._isDead) return 0;

    const oldHealth = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health - oldHealth;
  }

  addShield(amount: number, duration: number, source?: string): void {
    this.shields.push({ amount, remainingDuration: duration, source });
  }

  getTotalShield(): number {
    return this.shields.reduce((total, s) => total + s.amount, 0);
  }

  addImmunity(type: string): void {
    this.immunities.add(type);
  }

  removeImmunity(type: string): void {
    this.immunities.delete(type);
  }

  hasImmunity(type: string): boolean {
    return this.immunities.has(type);
  }

  applyEffect(effect: ActiveEffect): void {
    const existing = this.activeEffects.find(
      e => e.definition.id === effect.definition.id
    );

    switch (effect.definition.stackBehavior) {
      case 'refresh':
        if (existing) {
          existing.timeRemaining = effect.timeRemaining;
        } else {
          this.activeEffects.push(effect);
        }
        break;
      case 'extend':
        if (existing) {
          existing.timeRemaining += effect.timeRemaining;
        } else {
          this.activeEffects.push(effect);
        }
        break;
      case 'stack':
        if (existing && effect.definition.maxStacks) {
          if (existing.stacks < effect.definition.maxStacks) {
            existing.stacks++;
            existing.timeRemaining = effect.timeRemaining;
          }
        } else {
          this.activeEffects.push(effect);
        }
        break;
      case 'replace':
        this.activeEffects = this.activeEffects.filter(
          e => e.definition.id !== effect.definition.id
        );
        this.activeEffects.push(effect);
        break;
      case 'ignore':
        if (!existing) {
          this.activeEffects.push(effect);
        }
        break;
    }
  }

  removeEffect(effectId: string): void {
    this.activeEffects = this.activeEffects.filter(
      e => e.definition.id !== effectId
    );
  }

  applyKnockback(direction: Vector, distance: number, duration: number): void {
    if (this.hasImmunity('knockback')) return;

    this.forcedMovement = {
      direction: direction.clone().normalize(),
      distance,
      duration,
      elapsed: 0,
      type: 'knockback',
    };
  }

  isInForcedMovement(): boolean {
    return this.forcedMovement !== null;
  }

  getCrowdControlStatus(): CrowdControlStatus {
    return computeCCStatus(this.activeEffects);
  }

  // ===================
  // Shield Management
  // ===================

  protected consumeShields(damage: number): number {
    let remainingDamage = damage;

    for (const shield of this.shields) {
      if (remainingDamage <= 0) break;

      if (shield.amount >= remainingDamage) {
        shield.amount -= remainingDamage;
        remainingDamage = 0;
      } else {
        remainingDamage -= shield.amount;
        shield.amount = 0;
      }
    }

    this.shields = this.shields.filter(s => s.amount > 0);
    return remainingDamage;
  }

  protected updateShields(dt: number): void {
    for (const shield of this.shields) {
      shield.remainingDuration -= dt;
    }
    this.shields = this.shields.filter(s => s.remainingDuration > 0 && s.amount > 0);
  }

  // ===================
  // Effect Management
  // ===================

  protected updateEffects(dt: number): void {
    for (const effect of this.activeEffects) {
      if (effect.timeRemaining !== undefined) {
        effect.timeRemaining -= dt;
      }
    }
    this.activeEffects = this.activeEffects.filter(
      e => e.timeRemaining === undefined || e.timeRemaining > 0
    );
  }

  // ===================
  // Forced Movement
  // ===================

  protected updateForcedMovement(dt: number): void {
    if (!this.forcedMovement) return;

    this.forcedMovement.elapsed += dt;

    if (this.forcedMovement.elapsed >= this.forcedMovement.duration) {
      this.forcedMovement = null;
      return;
    }

    const speed = this.forcedMovement.distance / this.forcedMovement.duration;
    const movement = this.forcedMovement.direction.clone().scalar(speed * dt);
    this.position.add(movement);
  }

  // ===================
  // Blood Effects
  // ===================

  protected generateBloodDrops(): void {
    // Import dynamically to avoid circular dependencies
    // Subclasses should override this with proper particle generation
  }

  // ===================
  // Combat
  // ===================

  protected attack(attackCb: (gctx: GameContext) => void): void {
    if (!this.isAttacking) {
      this.spriteAnimator.playAnimation(ATTACK_ANIMATION_ID, { interrupt: true });
      this.acceleration = new Vector(0, 0);
      this.velocity = new Vector(0, 0);
      this.attackCooldown.start();
      this.queuedAttackWithAnimationFrame = attackCb;
    }
  }

  protected canAttack(): boolean {
    return !this.attackCooldown.isCooling();
  }

  protected get isAttacking(): boolean {
    return (
      this.spriteAnimator.currentAnimation === ATTACK_ANIMATION_ID &&
      this.spriteAnimator.isPlayingAnimation
    );
  }

  // ===================
  // Death
  // ===================

  protected die(gameContext: GameContext): void {
    this._isDead = true;
    this.shouldDispose = true;

    // Award money for killing enemy units
    if (this.side === 1) {
      gameContext.setMoney(gameContext.money + GameConfig.ECONOMY.KILL_REWARD);
    }

    this.onDeath(gameContext);
  }

  protected onDeath(gameContext: GameContext): void {
    // Subclasses override for blood effects, etc.
  }

  protected checkDeath(gctx: GameContext): void {
    if (this.health <= 0 && !this._isDead) {
      this.die(gctx);
    }
  }

  // ===================
  // Pathfinding
  // ===================

  setTargetPositionWithPathfinding(
    targetPos: Vector,
    gameMap: {
      findPath: (from: Vector, to: Vector) => Vector[] | null;
      navigationGrid: { version: number };
    }
  ): void {
    const path = gameMap.findPath(this.position, targetPos);
    if (path && path.length > 0) {
      this.currentPath = path;
      this.currentPathIndex = 0;
      this.targetPosition = targetPos;
      this.targetHasBeenSetByPlayer = true;
      this.pathGridVersion = gameMap.navigationGrid.version;
    } else {
      this.currentPath = [];
      this.currentPathIndex = 0;
      this.targetPosition = targetPos;
      this.targetHasBeenSetByPlayer = true;
      this.pathGridVersion = gameMap.navigationGrid.version;
    }
  }

  clearPath(): void {
    this.currentPath = [];
    this.currentPathIndex = 0;
    this.targetPosition = null;
  }
}

export default Troop;
