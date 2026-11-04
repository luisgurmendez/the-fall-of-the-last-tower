/**
 * Kip Ability Handlers
 *
 * Kip - The Would-Be Legend
 * A ranged top laner who marks enemy champions and pops the marks with his
 * arrows, harder the bigger the target.
 *
 * - Q (Target Practice): an arrow that stops at the first enemy; a champion is marked
 * - W (Run Them Down): slows the marked enemies in reach (its passive part is in KipHooks)
 * - E (Grand Entrance): a leap, and a burst where he lands that marks champions
 * - R (Show Them All): X arrows at each of the X marked enemies in reach
 *
 * Champion hooks (KipHooks): the pop (The Bigger They Are), speed from crit
 * chance (W), the passive's count of marked enemies. marks.ts: who holds his
 * mark. The mark's sight and the speed attacks on it give are the effect's
 * own (data/effects.ts).
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { KipQHandler } from './KipQHandler';
import { KipWHandler } from './KipWHandler';
import { KipEHandler } from './KipEHandler';
import { KipRHandler } from './KipRHandler';
import { kipHooks } from './KipHooks';

export { KipQHandler } from './KipQHandler';
export { KipWHandler } from './KipWHandler';
export { KipEHandler } from './KipEHandler';
export { KipRHandler } from './KipRHandler';
export { kipHooks } from './KipHooks';

/**
 * Register Kip's ability handlers and champion hooks.
 */
export function registerKipHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new KipQHandler(),
    new KipWHandler(),
    new KipEHandler(),
    new KipRHandler(),
  ]);
  championHooksRegistry.register(kipHooks);
}
