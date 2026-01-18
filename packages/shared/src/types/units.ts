/**
 * Common type definitions for game units.
 * Shared between client and server.
 */

import type { Vector } from '../math/Vector';
import type { Shape } from '../math/shapes';

/**
 * Team/side identifier.
 * 0 = Blue team (ally from blue perspective)
 * 1 = Red team (enemy from blue perspective)
 */
export type Side = 0 | 1;

/**
 * Team identifiers for clarity.
 */
export const TEAM_BLUE: Side = 0;
export const TEAM_RED: Side = 1;

/**
 * Unit type identifiers.
 */
export type UnitType =
  | 'champion'
  | 'minion_melee'
  | 'minion_caster'
  | 'minion_siege'
  | 'minion_super'
  | 'tower'
  | 'inhibitor'
  | 'nexus'
  | 'jungle_camp'
  | 'dragon'
  | 'baron';

/**
 * Damage types in the game.
 */
export type DamageType = 'physical' | 'magic' | 'true' | 'pure';

/**
 * Interface for objects that can be targeted.
 */
export interface Targetable {
  readonly id: string;
  readonly position: Vector;
  readonly collisionMask: Shape;
}

/**
 * Interface for objects that can take damage.
 */
export interface Damageable {
  health: number;
  maxHealth: number;
  takeDamage(damage: number, type: DamageType): void;
}

/**
 * Interface for objects that belong to a team.
 */
export interface Sided {
  readonly side: Side;
}

/**
 * Combined interface for something that can be attacked.
 */
export interface AttackTarget extends Targetable, Damageable, Sided {}

/**
 * Point in 2D space.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Rectangle dimensions.
 */
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Bounding box.
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Type guard to check if an object has a side property.
 */
export function isSided(obj: unknown): obj is Sided {
  return typeof obj === 'object' && obj !== null && 'side' in obj;
}

/**
 * Type guard to check if an object is targetable.
 */
export function isTargetable(obj: unknown): obj is Targetable {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'position' in obj &&
    'collisionMask' in obj
  );
}

/**
 * Type guard to check if an object is damageable.
 */
export function isDamageable(obj: unknown): obj is Damageable {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'health' in obj &&
    'takeDamage' in obj &&
    typeof (obj as Damageable).takeDamage === 'function'
  );
}

/**
 * Get the opposite side.
 */
export function oppositeSide(side: Side): Side {
  return side === 0 ? 1 : 0;
}
