/**
 * Client-side entity record: the latest server snapshot, the positions used to
 * interpolate between server updates, and the attack/ability animation state
 * set by game events.
 */

import Vector from '@/physics/vector';
import type { EntitySnapshot } from '@siege/shared';

/**
 * Animation state for an entity.
 */
export interface EntityAnimationState {
  /** True if currently playing attack animation */
  isAttacking: boolean;
  /** When the attack animation started (ms) */
  attackStartTime: number;
  /** Duration of attack animation (ms) */
  attackDuration: number;
  /** True if currently playing ability animation */
  isCastingAbility: boolean;
  /** ID of ability being cast */
  abilityId?: string;
  /** When the ability cast started (ms) */
  abilityStartTime: number;
  /** Duration of ability animation (ms) */
  abilityDuration: number;
  /** When the entity last took damage (ms, performance.now), for the hit flash */
  hitTime: number;
}

/**
 * Interpolated entity state for rendering.
 */
export interface InterpolatedEntity {
  snapshot: EntitySnapshot;
  position: Vector;
  previousPosition: Vector;
  lastUpdateTime: number;
  /** Animation state from events */
  animation: EntityAnimationState;
}

/**
 * Create default animation state.
 */
export function createDefaultAnimationState(): EntityAnimationState {
  return {
    isAttacking: false,
    attackStartTime: 0,
    attackDuration: 0,
    isCastingAbility: false,
    abilityId: undefined,
    abilityStartTime: 0,
    abilityDuration: 0,
    hitTime: -Infinity,
  };
}

/** How long a unit flashes after taking damage (ms) */
const HIT_FLASH_MS = 120;

/**
 * How strongly an entity is flashing from a hit: 1 right after it, fading to 0.
 */
export function getHitFlash(entity: InterpolatedEntity | undefined): number {
  if (!entity) return 0;
  const elapsed = performance.now() - entity.animation.hitTime;
  return elapsed >= HIT_FLASH_MS ? 0 : 1 - elapsed / HIT_FLASH_MS;
}

/**
 * Interpolated position for an entity.
 */
export function interpolatePosition(entity: InterpolatedEntity, interpolationDelay: number): Vector {
  // Simple linear interpolation based on time since last update
  const timeSinceUpdate = Date.now() - entity.lastUpdateTime;
  const t = Math.min(1, timeSinceUpdate / interpolationDelay);

  return Vector.lerp(entity.previousPosition, entity.position, t);
}

/**
 * Check if an entity is currently in attack animation.
 */
export function isAttackAnimationPlaying(entity: InterpolatedEntity | undefined): boolean {
  if (!entity || !entity.animation.isAttacking) return false;

  const elapsed = Date.now() - entity.animation.attackStartTime;
  if (elapsed >= entity.animation.attackDuration) {
    // Animation finished, clear the flag
    entity.animation.isAttacking = false;
    return false;
  }
  return true;
}

/**
 * Check if an entity is currently casting an ability.
 */
export function getAbilityCastState(entity: InterpolatedEntity | undefined): { casting: boolean; abilityId?: string } {
  if (!entity || !entity.animation.isCastingAbility) {
    return { casting: false };
  }

  const elapsed = Date.now() - entity.animation.abilityStartTime;
  if (elapsed >= entity.animation.abilityDuration) {
    // Animation finished, clear the flag
    entity.animation.isCastingAbility = false;
    entity.animation.abilityId = undefined;
    return { casting: false };
  }
  return { casting: true, abilityId: entity.animation.abilityId };
}

/**
 * Get animation progress (0-1) for attack animation.
 */
export function getAttackAnimationProgress(entity: InterpolatedEntity | undefined): number {
  if (!entity || !entity.animation.isAttacking) return 0;

  const elapsed = Date.now() - entity.animation.attackStartTime;
  return Math.min(1, elapsed / entity.animation.attackDuration);
}

/**
 * Get animation progress (0-1) for ability animation.
 */
export function getAbilityAnimationProgress(entity: InterpolatedEntity | undefined): number {
  if (!entity || !entity.animation.isCastingAbility) return 0;

  const elapsed = Date.now() - entity.animation.abilityStartTime;
  return Math.min(1, elapsed / entity.animation.abilityDuration);
}
