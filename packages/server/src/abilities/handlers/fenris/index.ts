/**
 * Fenris Ability Handlers
 *
 * Fenris - The Cursed Howler
 * Jungle bruiser: feral when hurt, bites to heal, rakes, pounces, feasts.
 *
 * - Q (Vicious Bite): custom handler (damage and a heal on himself)
 * - W (Savage Claw): generic cone, after the swipe
 * - E (Pounce): generic targeted leap
 * - R (Bloodthirst): generic self effect; the life steal and the kill's
 *   heal live in FenrisHooks
 *
 * Champion hooks (FenrisHooks): Adrenaline Rush, Bloodthirst.
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { FenrisQHandler } from './FenrisQHandler';
import { fenrisHooks } from './FenrisHooks';

export { FenrisQHandler } from './FenrisQHandler';
export { fenrisHooks } from './FenrisHooks';

/**
 * Register Fenris's ability handlers and champion hooks.
 */
export function registerFenrisHandlers(): void {
  abilityHandlerRegistry.registerAll([new FenrisQHandler()]);
  championHooksRegistry.register(fenrisHooks);
}
