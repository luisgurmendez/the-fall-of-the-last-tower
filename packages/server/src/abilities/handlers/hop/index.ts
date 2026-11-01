/**
 * Hop-To-Eat Ability Handlers
 *
 * Hop-To-Eat - Deadly Cuteness
 * Assassin: hops onto its prey, bites through armor, kicks champions away.
 *
 * - Q (Rodent Fangs): custom handler (armor shred, then the bite)
 * - W (Carrot Break): custom handler (a heal on missing health, rooted while eating)
 * - E (Bunny Hop): generic dash; readying the next hop lives in HopHooks
 * - R (Savage Kick): custom handler (the kick and the crashes)
 *
 * Champion hooks (HopHooks): Hop to It!, Bunny Hop's reset.
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { HopQHandler } from './HopQHandler';
import { HopWHandler } from './HopWHandler';
import { HopRHandler } from './HopRHandler';
import { hopHooks } from './HopHooks';

export { HopQHandler } from './HopQHandler';
export { HopWHandler } from './HopWHandler';
export { HopRHandler } from './HopRHandler';
export { hopHooks } from './HopHooks';

/**
 * Register Hop-To-Eat's ability handlers and champion hooks.
 */
export function registerHopHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new HopQHandler(),
    new HopWHandler(),
    new HopRHandler(),
  ]);
  championHooksRegistry.register(hopHooks);
}
