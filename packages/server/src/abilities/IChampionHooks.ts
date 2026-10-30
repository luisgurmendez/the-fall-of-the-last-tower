/**
 * IChampionHooks - Interface for per-champion cast rules.
 *
 * Some cast-time rules belong to a champion rather than to a single ability:
 * a passive that empowers the next ability, an ultimate that shortens other
 * cooldowns, an ability that must not break stealth. Champions implement the
 * hooks they need instead of the AbilityExecutor checking champion IDs.
 *
 * DESIGN PRINCIPLES:
 * - Every hook is optional: champions without hooks get the generic defaults
 * - Hooks are stateless: state lives in the champion (passiveState, effects)
 * - Hooks are registered next to the champion's ability handlers,
 *   from handlers/<championId>/index.ts
 */

import type { AbilitySlot } from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';

// =============================================================================
// Interface
// =============================================================================

/**
 * Interface for champion hooks.
 *
 * The AbilityExecutor looks up the caster's hooks by champion ID and calls
 * them at fixed points of every cast.
 */
export interface IChampionHooks {
  /**
   * The champion ID these hooks apply to (e.g., 'magnus').
   */
  readonly championId: string;

  /**
   * Damage multiplier for the ability about to be cast.
   * Called after validation, before the ability executes.
   *
   * Return 1.0 for no change (e.g., 1.3 while Magnus's Arcane Surge is active).
   */
  getAbilityDamageMultiplier?(champion: ServerChampion): number;

  /**
   * Called after an ability executed with a damage multiplier above 1.0,
   * to consume whatever granted it (e.g., Arcane Surge stacks).
   */
  consumeAbilityDamageMultiplier?(champion: ServerChampion): void;

  /**
   * Whether casting this ability breaks the caster's stealth.
   * Not called for recasts, which always break stealth.
   *
   * Default: true (e.g., false for Vex's Shadow Shroud, which grants stealth).
   */
  breaksStealthOnCast?(abilityId: string): boolean;

  /**
   * Adjust the cooldown an ability goes on, after ability haste is applied.
   *
   * Return the cooldown unchanged for no change (e.g., Vex's Ninja Mode halves Q and E).
   */
  modifyAbilityCooldown?(champion: ServerChampion, slot: AbilitySlot, cooldown: number): number;
}
