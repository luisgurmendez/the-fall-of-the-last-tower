/**
 * Common type definitions used across the game.
 */

import Vector from "@/physics/vector";
import { Shape } from "@/objects/shapes";

// Side type for ally (0) vs enemy (1)
export type Side = 0 | 1;

// Unit types
export type UnitType = 'swordsman' | 'archer';

/**
 * Interface for objects that can be targeted (attacked or selected).
 */
export interface Targetable {
  readonly id: string;
  readonly position: Vector;
  readonly collisionMask: Shape;
}

/**
 * Interface for objects that can take damage.
 * Uses inline DamageType to avoid circular imports.
 */
export interface Damageable {
  health: number;
  maxHealth: number;
  takeDamage(damage: number, type: 'physical' | 'magic' | 'true'): void;
}

/**
 * Interface for objects that have a side (ally or enemy).
 */
export interface Sided {
  readonly side: Side;
}

/**
 * Combined interface for something that can be attacked.
 */
export interface AttackTarget extends Targetable, Damageable, Sided {}

/**
 * Interface for selectable objects (player can select).
 */
export interface Selectable {
  isSelected: boolean;
  isBeingHovered: boolean;
}

/**
 * Interface for objects that can be commanded by the player.
 */
export interface Commandable extends Selectable {
  target: AttackTarget | null;
  targetPosition: Vector | null;
  targetHasBeenSetByPlayer: boolean;
}

/**
 * Type guard to check if an object has a side property.
 */
export function isSided(obj: unknown): obj is Sided {
  return typeof obj === 'object' && obj !== null && 'side' in obj;
}

/**
 * Type guard to check if an object is selectable.
 */
export function isSelectable(obj: unknown): obj is Selectable {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'isSelected' in obj &&
    'isBeingHovered' in obj
  );
}

/**
 * Type guard to check if an object is commandable.
 */
export function isCommandable(obj: unknown): obj is Commandable {
  return (
    isSelectable(obj) &&
    'target' in obj &&
    'targetPosition' in obj &&
    'targetHasBeenSetByPlayer' in obj
  );
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
 * Utility type for making specific properties optional.
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for making specific properties required.
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

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
