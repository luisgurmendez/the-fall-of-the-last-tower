/**
 * IChampionHooks - Interface for per-champion rules.
 *
 * Some rules belong to a champion rather than to a single ability: a passive
 * that empowers the next ability, an ultimate that shortens other cooldowns,
 * an ability that must not break stealth, a passive tied to a summoned
 * entity. Champions implement the hooks they need instead of the
 * AbilityExecutor and ServerChampion checking champion IDs.
 *
 * DESIGN PRINCIPLES:
 * - Every hook is optional: champions without hooks get the generic defaults
 * - Hooks are stateless: state lives in the champion (passiveState, effects)
 * - Hooks are registered next to the champion's ability handlers,
 *   from handlers/<championId>/index.ts
 */

import type { AbilitySlot } from '@siege/shared';
import type { ServerChampion } from '../simulation/ServerChampion';
import type { ServerEntity } from '../simulation/ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

// =============================================================================
// Interface
// =============================================================================

/**
 * Interface for champion hooks.
 *
 * The AbilityExecutor and ServerChampion look up a champion's hooks by
 * champion ID and call them at fixed points of casting and simulation.
 */
export interface IChampionHooks {
  /**
   * The champion ID these hooks apply to (e.g., 'magnus').
   */
  readonly championId: string;

  // ===================
  // Ability casting (ServerAbilityExecutor)
  // ===================

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

  /**
   * Called after an ability was cast and paid for (not for recasts), e.g.
   * Oitboil's abilities heating him up.
   */
  onAbilityCast?(champion: ServerChampion, abilityId: string, context: ServerGameContext): void;

  // ===================
  // Champion simulation (ServerChampion)
  // ===================

  /**
   * Called every tick after the passive system updates the champion's
   * passive state (e.g., Lume's passive follows the Light Orb).
   */
  updatePassiveState?(champion: ServerChampion, context: ServerGameContext): void;

  /**
   * Flat armor penetration the champion's physical damage has from its own
   * rules (e.g., 10-26 for a few seconds after Urûk's Spear Charge).
   */
  getArmorPenetration?(champion: ServerChampion): number;

  /**
   * Called after a melee basic attack damages its target, before on_hit
   * passives trigger (e.g., Vex's empowered attack after Shadow Step).
   */
  onMeleeAttackHit?(
    champion: ServerChampion,
    target: ServerEntity,
    attack: { attackDamage: number; abilityPower: number },
    context: ServerGameContext
  ): void;
}
