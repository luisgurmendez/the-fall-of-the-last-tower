/**
 * IAbilityHandler - Interface for ability execution handlers.
 *
 * Each ability can implement this interface to provide self-contained
 * execution logic, decoupling champion-specific behavior from the
 * generic ability executor.
 *
 * DESIGN PRINCIPLES:
 * - Abilities are self-contained: all logic lives in the handler
 * - Handlers are stateless: state lives in champion/entities
 * - Common patterns use base classes (SkillshotHandler, etc.)
 * - AbilityExecutor dispatches to handlers, doesn't know specifics
 */

import type { Vector, AbilityDefinition, AbilitySlot, DamageType } from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters passed to ability handlers.
 */
export interface AbilityHandlerParams {
  /** The champion casting the ability */
  champion: ServerChampion;
  /** The ability slot being cast */
  slot: AbilitySlot;
  /** The ability definition */
  definition: AbilityDefinition;
  /** Current rank of the ability (1-5) */
  rank: number;
  /** Target position (for ground target/skillshot) */
  targetPosition?: Vector;
  /** Target entity ID (for targeted abilities) */
  targetEntityId?: string;
  /** Game context */
  context: ServerGameContext;
  /** Charge time in seconds (for charge abilities) */
  chargeTime?: number;
  /** Damage multiplier from passives (e.g., 1.3 for Arcane Surge) */
  damageMultiplier: number;
}

/**
 * Result of validating an ability cast.
 */
export interface AbilityValidationResult {
  valid: boolean;
  reason?: 'not_learned' | 'on_cooldown' | 'not_enough_mana' | 'invalid_target' | 'out_of_range' | 'silenced' | 'stunned' | 'orb_destroyed' | 'no_ammo' | 'custom';
  customMessage?: string;
}

/**
 * Result of executing an ability.
 */
export interface AbilityExecutionResult {
  success: boolean;
  /** Set to true to skip standard cooldown handling */
  skipCooldown?: boolean;
  /** Set to true to skip standard mana deduction */
  skipManaCost?: boolean;
  /** Custom cooldown override */
  cooldownOverride?: number;
}

/**
 * Context for projectile hit callbacks.
 */
export interface ProjectileHitContext {
  target: ServerEntity;
  projectilePosition: Vector;
  /** Position where the projectile hit (for recast abilities) */
  hitPosition: Vector;
  context: ServerGameContext;
  damage: number;
  damageType: DamageType;
}

/**
 * Context for dash collision callbacks.
 */
export interface DashCollisionContext {
  target: ServerEntity;
  championPosition: Vector;
  context: ServerGameContext;
}

// =============================================================================
// Interface
// =============================================================================

/**
 * Interface for ability handlers.
 *
 * Abilities can implement this interface to provide custom execution logic.
 * The AbilityExecutor will dispatch to the handler if one is registered.
 */
export interface IAbilityHandler {
  /**
   * The ability ID this handler handles (e.g., 'lume_q', 'vex_dash').
   */
  readonly abilityId: string;

  /**
   * Validate if the ability can be cast.
   * Called before mana/cooldown checks for ability-specific validation.
   *
   * Return { valid: true } to proceed with standard validation.
   * Return { valid: false, reason } to block the cast.
   */
  validate?(params: AbilityHandlerParams): AbilityValidationResult;

  /**
   * Execute the ability effect.
   * This is the main entry point for ability logic.
   *
   * @returns Result indicating success and any special handling needed
   */
  execute(params: AbilityHandlerParams): AbilityExecutionResult;

  /**
   * Handle recast of the ability (if applicable).
   * Called when the player recasts during the recast window.
   */
  executeRecast?(params: AbilityHandlerParams): AbilityExecutionResult;

  /**
   * Check if recast is available.
   * Return true to allow recast, false to proceed with normal cast.
   */
  canRecast?(params: AbilityHandlerParams): boolean;

  /**
   * Called when a projectile spawned by this ability hits a target.
   * Allows custom on-hit logic beyond standard damage.
   */
  onProjectileHit?(hitContext: ProjectileHitContext, params: AbilityHandlerParams): void;

  /**
   * Called when the champion collides with an entity during a dash.
   * Allows custom collision logic beyond standard damage.
   */
  onDashCollision?(collisionContext: DashCollisionContext, params: AbilityHandlerParams): void;

  /**
   * Called when the ability completes (e.g., dash ends, channel finishes).
   * Useful for cleanup or follow-up effects.
   */
  onComplete?(params: AbilityHandlerParams): void;
}

// =============================================================================
// Type Guards
// =============================================================================

export function hasValidate(handler: IAbilityHandler): handler is IAbilityHandler & { validate: NonNullable<IAbilityHandler['validate']> } {
  return typeof handler.validate === 'function';
}

export function hasRecast(handler: IAbilityHandler): handler is IAbilityHandler & { executeRecast: NonNullable<IAbilityHandler['executeRecast']>; canRecast: NonNullable<IAbilityHandler['canRecast']> } {
  return typeof handler.executeRecast === 'function' && typeof handler.canRecast === 'function';
}

export function hasProjectileHit(handler: IAbilityHandler): handler is IAbilityHandler & { onProjectileHit: NonNullable<IAbilityHandler['onProjectileHit']> } {
  return typeof handler.onProjectileHit === 'function';
}

export function hasDashCollision(handler: IAbilityHandler): handler is IAbilityHandler & { onDashCollision: NonNullable<IAbilityHandler['onDashCollision']> } {
  return typeof handler.onDashCollision === 'function';
}

export function hasComplete(handler: IAbilityHandler): handler is IAbilityHandler & { onComplete: NonNullable<IAbilityHandler['onComplete']> } {
  return typeof handler.onComplete === 'function';
}
