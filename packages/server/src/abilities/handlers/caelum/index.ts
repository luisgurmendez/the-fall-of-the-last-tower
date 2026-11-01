/**
 * Caelum Ability Handlers
 *
 * Caelum Lightbranch - Of the Whispering Woods
 * Enchanter: heals around him, emboldens, roots, gives his own life.
 *
 * - Q (Ray of Light): generic skillshot that slows
 * - W (Embolden): generic ally target with effects
 * - E (Whispering Roots): generic ground target, after a delay, that roots
 * - R (Martyr): custom handler (his health for an ally's)
 *
 * Champion hooks (CaelumHooks): Lightweaving.
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { CaelumRHandler } from './CaelumRHandler';
import { caelumHooks } from './CaelumHooks';

export { CaelumRHandler } from './CaelumRHandler';
export { caelumHooks } from './CaelumHooks';

/**
 * Register Caelum's ability handlers and champion hooks.
 */
export function registerCaelumHandlers(): void {
  abilityHandlerRegistry.registerAll([new CaelumRHandler()]);
  championHooksRegistry.register(caelumHooks);
}
