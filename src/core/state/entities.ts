/**
 * Client-side entity record: the latest server snapshot, the positions used to
 * interpolate between server updates, and the attack/ability animation state
 * set by game events.
 */

import Vector from '@/physics/vector';
import { GameConfig, type EntitySnapshot } from '@siege/shared';

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
  /** The cast time it started with (ms; 0 when it started as the ability went off) */
  abilityLead: number;
  /** Where the ability being cast is aimed: a point, or a unit (null when it isn't aimed) */
  abilityTargetX: number | null;
  abilityTargetY: number | null;
  abilityTargetId: string | null;
  /**
   * The ability in its cast time (ABILITY_WINDUP), and when that ends (ms):
   * its animation started then, so ABILITY_CAST carries it on
   */
  windupAbilityId: string | null;
  windupEndTime: number;
  /** When the entity last took damage (ms, performance.now), for the hit flash */
  hitTime: number;
  /** Which way that hit pushed it (a unit vector away from what hit it; 0, 0 if unknown) */
  hitDirX: number;
  hitDirY: number;
}

/**
 * Interpolated entity state for rendering.
 */
export interface InterpolatedEntity {
  snapshot: EntitySnapshot;
  /**
   * Where it's drawn: eased from previousPosition to serverPosition over a
   * server tick, every frame (advanceEntity)
   */
  position: Vector;
  /** Where it was drawn when the server's latest position arrived */
  previousPosition: Vector;
  /** The server's latest position */
  serverPosition: Vector;
  /** When the easing toward serverPosition started (ms, Date.now) */
  positionTime: number;
  /** When position was last eased (ms, Date.now) */
  drawnAt: number;
  /** When the server's latest update for it arrived (ms, Date.now) */
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
    abilityLead: 0,
    abilityTargetX: null,
    abilityTargetY: null,
    abilityTargetId: null,
    windupAbilityId: null,
    windupEndTime: 0,
    hitTime: -Infinity,
    hitDirX: 0,
    hitDirY: 0,
  };
}

/** How long a unit flashes after taking damage (ms) */
const HIT_FLASH_MS = 120;
/** How far a hit knocks a unit's body back before it springs back (world units) */
const HIT_RECOIL = 3;

/**
 * How strongly an entity is flashing from a hit: 1 right after it, fading to 0.
 */
export function getHitFlash(entity: InterpolatedEntity | undefined): number {
  if (!entity) return 0;
  const elapsed = performance.now() - entity.animation.hitTime;
  return elapsed >= HIT_FLASH_MS ? 0 : 1 - elapsed / HIT_FLASH_MS;
}

/**
 * Where a hit has knocked an entity's body to, away from what hit it: out at
 * once, then springing back as the flash fades.
 */
export function getHitRecoil(entity: InterpolatedEntity | undefined): { x: number; y: number } {
  const flash = getHitFlash(entity);
  if (!entity || flash <= 0) return { x: 0, y: 0 };
  const push = HIT_RECOIL * flash * flash;
  return { x: entity.animation.hitDirX * push, y: entity.animation.hitDirY * push };
}

/**
 * Each new position is eased in over a little more than a server tick, so an
 * update arriving a few milliseconds late doesn't stall the unit for a frame
 */
const EASE_MS = (1000 / GameConfig.TICK.SERVER_TICK_RATE) * 1.2;
/** A step longer than this in one tick is a teleport (blink, recall, respawn): no easing */
const SNAP_DISTANCE = 120;

/**
 * A new position from the server: the entity eases there from where it's
 * drawn now, over a tick (drawn straight at the server's positions, units
 * and projectiles moved in steps 30 times a second on a 120 Hz screen).
 */
export function setServerPosition(entity: InterpolatedEntity, x: number, y: number, now: number): void {
  const next = new Vector(x, y);
  const teleported = Math.hypot(next.x - entity.position.x, next.y - entity.position.y) > SNAP_DISTANCE;
  if (teleported) {
    entity.position.x = next.x;
    entity.position.y = next.y;
  }
  // From where it was last drawn, as of then: starting the easing now would
  // hold it still for the frame the update arrived in
  entity.previousPosition = entity.position.clone();
  entity.serverPosition = next;
  entity.positionTime = teleported ? now : Math.min(entity.drawnAt, now);
}

/**
 * Move an entity's drawn position along its easing, once a frame.
 */
export function advanceEntity(entity: InterpolatedEntity, now: number): void {
  const t = Math.min(1, (now - entity.positionTime) / EASE_MS);
  const { previousPosition: from, serverPosition: to } = entity;
  entity.position.x = from.x + (to.x - from.x) * t;
  entity.position.y = from.y + (to.y - from.y) * t;
  entity.drawnAt = now;
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
export interface AbilityCastState {
  casting: boolean;
  abilityId?: string;
  /** How long its cast animation lasts (seconds) */
  duration?: number;
  /** The cast time it played through before the ability went off (seconds) */
  lead?: number;
  /** Where it's aimed: a point, or a unit */
  target?: { x: number; y: number } | { entityId: string };
}

export function getAbilityCastState(entity: InterpolatedEntity | undefined): AbilityCastState {
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
  const { abilityTargetX: x, abilityTargetY: y, abilityTargetId } = entity.animation;
  const target = x !== null && y !== null ? { x, y } : abilityTargetId !== null ? { entityId: abilityTargetId } : undefined;
  return {
    casting: true, abilityId: entity.animation.abilityId, duration: entity.animation.abilityDuration / 1000,
    lead: entity.animation.abilityLead / 1000, target,
  };
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
