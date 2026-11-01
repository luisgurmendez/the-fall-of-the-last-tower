/**
 * Elora Ability Handlers
 *
 * Elora - The Master Hunter
 * Marksman: the longest bow, weak points every third arrow, poison, a pin.
 *
 * - Q (Poison Arrow): custom handler (the attack reset); the poisoned arrow
 *   lives in EloraHooks
 * - W (Pinning Arrow): generic skillshot that roots
 * - E (Dexterity): generic dash with an attack speed self-buff
 * - R (Arrow Barrage): generic line ground target, after a delay
 *
 * Champion hooks (EloraHooks): Proficient Archer, the poisoned arrow.
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { EloraQHandler } from './EloraQHandler';
import { eloraHooks } from './EloraHooks';

export { EloraQHandler } from './EloraQHandler';
export { eloraHooks } from './EloraHooks';

/**
 * Register Elora's ability handlers and champion hooks.
 */
export function registerEloraHandlers(): void {
  abilityHandlerRegistry.registerAll([new EloraQHandler()]);
  championHooksRegistry.register(eloraHooks);
}
