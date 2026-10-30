/**
 * VexHooks - Stealth and Ninja Mode cast rules
 *
 * STEALTH:
 * - Casting an ability breaks stealth, except Shadow Shroud (W),
 *   which is what grants it
 *
 * NINJA MODE (R):
 * - While the vex_ninja_mode effect is active, Shadow Shuriken (Q) and
 *   Shadow Step (E) go on 50% shorter cooldowns
 */

import type { AbilitySlot } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';

/** Cooldown multiplier for Q and E cast during Ninja Mode */
const NINJA_MODE_COOLDOWN_MULTIPLIER = 0.5;

export const vexHooks: IChampionHooks = {
  championId: 'vex',

  breaksStealthOnCast(abilityId: string): boolean {
    return abilityId !== 'vex_shroud';
  },

  modifyAbilityCooldown(champion: ServerChampion, slot: AbilitySlot, cooldown: number): number {
    if ((slot === 'Q' || slot === 'E') && champion.hasEffect('vex_ninja_mode')) {
      return cooldown * NINJA_MODE_COOLDOWN_MULTIPLIER;
    }
    return cooldown;
  },
};
