/**
 * MagnusHooks - Arcane Surge
 *
 * Arcane Surge (passive) gains a stack per ability cast; stack gain is handled
 * by the PassiveTriggerSystem's stack_accumulation handler.
 *
 * At 4 stacks the passive is active:
 * - The next ability deals 30% bonus damage
 * - Casting it consumes all stacks, even if it deals no damage
 */

import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import { Logger } from '../../../utils/Logger';

/** Damage multiplier for the ability empowered by Arcane Surge */
const ARCANE_SURGE_DAMAGE_MULTIPLIER = 1.3;

export const magnusHooks: IChampionHooks = {
  championId: 'magnus',

  getAbilityDamageMultiplier(champion: ServerChampion): number {
    return champion.passiveState.isActive ? ARCANE_SURGE_DAMAGE_MULTIPLIER : 1.0;
  },

  consumeAbilityDamageMultiplier(champion: ServerChampion): void {
    champion.passiveState.stacks = 0;
    champion.passiveState.stackTimeRemaining = 0;
    champion.passiveState.isActive = false;
    Logger.champion.debug(`${champion.playerId} Arcane Surge consumed - bonus damage applied`);
  },
};
