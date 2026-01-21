/**
 * Abstract base class for all game units.
 *
 * GameUnit provides the shared combat functionality for:
 * - Champions (player-controlled heroes)
 * - Troops (soldiers, archers - army units)
 * - Creatures (jungle monsters)
 *
 * All units can:
 * - Take damage and be healed
 * - Have shields and immunities
 * - Have effects applied to them
 * - Be knocked back
 */

import Vector from '@/physics/vector';
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

/**
 * Represents an active shield on a unit.
 */
export interface ActiveShield {
  amount: number;
  remainingDuration: number;
  source?: string;
}

/**
 * Represents a forced movement (dash/knockback).
 */
export interface ForcedMovement {
  direction: Vector;
  distance: number;
  duration: number;
  elapsed: number;
  type: 'dash' | 'knockback';
}

/**
 * Abstract base class for all game units.
 */
export abstract class GameUnit implements IGameUnit {
  // ===================
  // Identity
  // ===================

  /** Unique identifier */
  readonly id: string;

  /** Unit type for ability targeting */
  abstract readonly unitType: UnitType;

  // ===================
  // Position & Physics
  // ===================

  /** Current position in world space */
  position: Vector;

  /** Current velocity */
  velocity: Vector = new Vector();

  /** Current facing direction (normalized) */
  direction: Vector = new Vector(1, 0);

  // ===================
  // Combat State
  // ===================

  /** Which side this unit is on */
  protected side: UnitSide;

  /** Current health */
  protected health: number = 0;

  /** Is the unit dead */
  protected _isDead: boolean = false;

  /** Active shields */
  protected shields: ActiveShield[] = [];

  /** Active immunities */
  protected immunities: Set<string> = new Set();

  /** Active effects */
  protected activeEffects: ActiveEffect[] = [];

  /** Current forced movement */
  protected forcedMovement: ForcedMovement | null = null;

  // ===================
  // Constructor
  // ===================

  constructor(position: Vector, side: UnitSide) {
    this.id = RandomUtils.generateId();
    this.position = position.clone();
    this.side = side;
    this.direction = new Vector(side === 0 ? 1 : -1, 0);
  }

  // ===================
  // Abstract Methods
  // ===================

  /** Get base stats for this unit */
  abstract getBaseStats(): UnitBaseStats;

  /** Get reward for killing this unit */
  abstract getReward(): UnitReward;

  /** Called when the unit dies */
  protected abstract onDeath(killer?: IGameUnit): void;

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

  /**
   * Get the unit's sight range (for fog of war).
   * Subclasses should override this to provide their actual sight range.
   */
  getSightRange(): number {
    return 300; // Default sight range
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
    return this._isDead;
  }

  getCurrentHealth(): number {
    return this.health;
  }

  /**
   * Apply damage to the unit.
   * Calculates damage reduction based on armor/magic resist.
   */
  takeDamage(rawDamage: number, damageType: DamageType, source?: IGameUnit): number {
    if (this._isDead) return 0;

    const stats = this.getBaseStats();
    let finalDamage = rawDamage;

    // Apply resistances
    switch (damageType) {
      case 'physical':
        finalDamage = rawDamage * (100 / (100 + stats.armor));
        break;
      case 'magic':
        finalDamage = rawDamage * (100 / (100 + stats.magicResist));
        break;
      case 'true':
        // True damage ignores resistances
        break;
    }

    // Apply shields first
    finalDamage = this.consumeShields(finalDamage);

    // Apply damage to health
    this.health = Math.max(0, this.health - finalDamage);

    // Trigger on-damage effects
    this.onTakeDamage(finalDamage, damageType, source);

    // Check death
    if (this.health <= 0) {
      this.die(source);
    }

    return finalDamage;
  }

  /**
   * Heal the unit.
   */
  heal(amount: number, source?: IGameUnit): number {
    if (this._isDead) return 0;

    const stats = this.getBaseStats();
    const oldHealth = this.health;
    this.health = Math.min(stats.maxHealth, this.health + amount);

    return this.health - oldHealth;
  }

  /**
   * Add a shield.
   */
  addShield(amount: number, duration: number, source?: string): void {
    this.shields.push({
      amount,
      remainingDuration: duration,
      source,
    });
  }

  /**
   * Get total shield amount.
   */
  getTotalShield(): number {
    return this.shields.reduce((total, s) => total + s.amount, 0);
  }

  /**
   * Add an immunity.
   */
  addImmunity(type: string): void {
    this.immunities.add(type);
  }

  /**
   * Remove an immunity.
   */
  removeImmunity(type: string): void {
    this.immunities.delete(type);
  }

  /**
   * Check if unit has immunity.
   */
  hasImmunity(type: string): boolean {
    return this.immunities.has(type);
  }

  /**
   * Apply an effect.
   */
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

  /**
   * Remove an effect.
   */
  removeEffect(effectId: string): void {
    this.activeEffects = this.activeEffects.filter(
      e => e.definition.id !== effectId
    );
  }

  /**
   * Apply knockback.
   */
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

  /**
   * Check if in forced movement.
   */
  isInForcedMovement(): boolean {
    return this.forcedMovement !== null;
  }

  // ===================
  // Protected Methods
  // ===================

  /**
   * Consume shields when taking damage.
   * @returns Remaining damage after shields
   */
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

    // Remove depleted shields
    this.shields = this.shields.filter(s => s.amount > 0);

    return remainingDamage;
  }

  /**
   * Called when taking damage (for subclass hooks).
   */
  protected onTakeDamage(damage: number, type: DamageType, source?: IGameUnit): void {
    // Subclasses can override for visual effects, etc.
  }

  /**
   * Handle death.
   */
  protected die(killer?: IGameUnit): void {
    this._isDead = true;
    this.onDeath(killer);
  }

  /**
   * Get crowd control status from effects.
   */
  getCrowdControlStatus(): CrowdControlStatus {
    return computeCCStatus(this.activeEffects);
  }

  /**
   * Update shields (reduce duration).
   */
  protected updateShields(dt: number): void {
    for (const shield of this.shields) {
      shield.remainingDuration -= dt;
    }
    this.shields = this.shields.filter(s => s.remainingDuration > 0 && s.amount > 0);
  }

  /**
   * Update effects (reduce duration).
   */
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

  /**
   * Update forced movement.
   */
  protected updateForcedMovement(dt: number): void {
    if (!this.forcedMovement) return;

    this.forcedMovement.elapsed += dt;

    if (this.forcedMovement.elapsed >= this.forcedMovement.duration) {
      this.forcedMovement = null;
      return;
    }

    // Calculate movement for this frame
    const speed = this.forcedMovement.distance / this.forcedMovement.duration;
    const movement = this.forcedMovement.direction.clone().scalar(speed * dt);
    this.position.add(movement);
  }

  /**
   * Remove cleansable debuffs.
   */
  cleanse(): void {
    this.activeEffects = this.activeEffects.filter(
      e => e.definition.category !== 'debuff' || !e.definition.cleansable
    );
  }
}

export default GameUnit;
