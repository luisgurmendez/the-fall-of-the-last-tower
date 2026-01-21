/**
 * Types for ability projectiles and area effects.
 *
 * These are game objects spawned by abilities that:
 * - Travel through the map (projectiles)
 * - Occupy an area (zones)
 * - Apply effects to units they hit
 */

import Vector from '@/physics/vector';
import { IGameUnit, UnitSide, UnitType } from '@/units/types';
import { IEffect } from '@/effects/EffectDescriptor';

/**
 * Shape types for area effects.
 */
export type AreaShape = 'circle' | 'rectangle' | 'cone';

/**
 * Target filter for projectiles and areas.
 */
export interface TargetFilter {
  /** Only hit enemies of this side */
  side: UnitSide;
  /** Unit types to affect (default: all) */
  unitTypes?: UnitType[];
  /** Maximum number of targets to hit (undefined = unlimited) */
  maxTargets?: number;
  /** Can hit the same target multiple times? */
  canHitSameTarget?: boolean;
}

/**
 * Configuration for an ability projectile.
 */
export interface ProjectileConfig {
  /** Projectile speed in units per second */
  speed: number;
  /** Time to live in seconds */
  ttl: number;
  /** Collision radius */
  radius: number;
  /** Does the projectile stop on first hit or pierce through? */
  piercing: boolean;
  /** Target filter */
  filter: TargetFilter;
  /** Effects to apply on hit */
  effects: IEffect[];
  /** Visual width for rendering */
  width?: number;
  /** Visual color */
  color?: string;
}

/**
 * Configuration for an area of effect zone.
 */
export interface AreaConfig {
  /** Shape of the area */
  shape: AreaShape;
  /** Radius for circle, or half-width for rectangle */
  radius: number;
  /** Half-height for rectangle, or undefined for circle */
  height?: number;
  /** Angle in radians for cone shape */
  coneAngle?: number;
  /** Duration in seconds (0 = instant one-shot) */
  duration: number;
  /** How often to apply effects (for duration > 0) */
  tickRate?: number;
  /** Target filter */
  filter: TargetFilter;
  /** Effects to apply to units in the area */
  effects: IEffect[];
  /** Delay before first application */
  delay?: number;
  /** Visual color */
  color?: string;
  /** Does the area follow the caster? */
  followCaster?: boolean;
}

/**
 * Hit result from a projectile or area.
 */
export interface HitResult {
  target: IGameUnit;
  position: Vector;
  timestamp: number;
}
