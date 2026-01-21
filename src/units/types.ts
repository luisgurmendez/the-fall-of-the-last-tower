/**
 * Shared types for all game units (Champions, Troops, Creatures).
 *
 * GameUnit is the base type for anything that can:
 * - Be targeted by abilities
 * - Take damage and be healed
 * - Have effects applied to it
 * - Have stats (health, armor, etc.)
 */

import type Vector from '@/physics/vector';
import type { ActiveEffect } from '@/effects/types';
import type { TeamId } from '@/core/Team';

/**
 * Unit types for ability targeting.
 */
export type UnitType = 'champion' | 'troop' | 'creature';

/**
 * @deprecated Use TeamId from '@/core/Team' instead.
 * Side/team of the unit.
 */
export type UnitSide = TeamId;

/**
 * Damage types.
 */
export type DamageType = 'physical' | 'magic' | 'true';

/**
 * Base stats that all units share.
 */
export interface UnitBaseStats {
  health: number;
  maxHealth: number;
  armor: number;
  magicResist: number;
  movementSpeed: number;
}

/**
 * Reward given when a unit is killed.
 */
export interface UnitReward {
  gold: number;
  experience: number;
}

/**
 * Interface for anything that can be targeted by abilities.
 * This is the core contract that Champions, Troops, and Creatures share.
 */
export interface IGameUnit {
  /** Unique identifier */
  readonly id: string;

  /** Unit type for ability targeting */
  readonly unitType: UnitType;

  /** Get the team this unit belongs to */
  getTeamId(): TeamId;

  /**
   * @deprecated Use getTeamId() instead.
   * Which side this unit is on
   */
  getSide(): UnitSide;

  /** Get the unit's sight range (for fog of war) */
  getSightRange(): number;

  /** Current position in world space */
  getPosition(): Vector;

  /** Set position (for teleports/forced movements) */
  setPosition(pos: Vector): void;

  /** Current facing direction */
  getDirection(): Vector;

  /** Check if unit is dead */
  isDead(): boolean;

  /** Get current health */
  getCurrentHealth(): number;

  /** Get base stats */
  getBaseStats(): UnitBaseStats;

  /**
   * Apply damage to the unit.
   * @param rawDamage - Raw damage before resistances
   * @param damageType - Type of damage (physical/magic/true)
   * @param source - The unit that dealt the damage (optional)
   * @returns The actual damage dealt after resistances
   */
  takeDamage(rawDamage: number, damageType: DamageType, source?: IGameUnit): number;

  /**
   * Heal the unit.
   * @param amount - Amount to heal
   * @param source - The unit that healed (optional)
   * @returns The actual amount healed
   */
  heal(amount: number, source?: IGameUnit): number;

  /**
   * Add a shield to the unit.
   * @param amount - Shield amount
   * @param duration - Duration in seconds
   * @param source - Source identifier
   */
  addShield(amount: number, duration: number, source?: string): void;

  /** Get total shield amount */
  getTotalShield(): number;

  /** Add an immunity (e.g., 'poison', 'stun') */
  addImmunity(type: string): void;

  /** Remove an immunity */
  removeImmunity(type: string): void;

  /** Check if unit has an immunity */
  hasImmunity(type: string): boolean;

  /**
   * Apply an effect to this unit.
   */
  applyEffect(effect: ActiveEffect): void;

  /**
   * Remove an effect by ID.
   */
  removeEffect(effectId: string): void;

  /**
   * Apply a knockback to the unit.
   */
  applyKnockback(direction: Vector, distance: number, duration: number): void;

  /** Check if in forced movement */
  isInForcedMovement(): boolean;
}

/**
 * Extended stats for Champions (more complex than troops/creatures).
 */
export interface ChampionExtendedStats extends UnitBaseStats {
  healthRegen: number;
  resource: number;
  maxResource: number;
  resourceRegen: number;
  attackDamage: number;
  abilityPower: number;
  attackSpeed: number;
  attackRange: number;
  critChance: number;
  critDamage: number;
  level: number;
}

/**
 * Result of checking if a unit can be targeted.
 */
export interface TargetCheckResult {
  canTarget: boolean;
  reason?: 'dead' | 'immune' | 'untargetable' | 'wrong_type' | 'wrong_side';
}

/**
 * Check if something implements IGameUnit.
 */
export function isGameUnit(obj: unknown): obj is IGameUnit {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'unitType' in obj &&
    'takeDamage' in obj &&
    'heal' in obj &&
    'getTeamId' in obj &&
    'getPosition' in obj
  );
}

/**
 * Check if a unit is a champion.
 */
export function isChampion(unit: IGameUnit): boolean {
  return unit.unitType === 'champion';
}

/**
 * Check if a unit is a troop (soldier/archer).
 */
export function isTroop(unit: IGameUnit): boolean {
  return unit.unitType === 'troop';
}

/**
 * Check if a unit is a creature (jungle monster).
 */
export function isCreature(unit: IGameUnit): boolean {
  return unit.unitType === 'creature';
}

// Re-export TeamId for convenience
export type { TeamId } from '@/core/Team';
