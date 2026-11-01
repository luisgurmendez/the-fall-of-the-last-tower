/**
 * Oitboil Ability Handlers
 *
 * Oitboil - The Pyromancer
 * Short-ranged mage who heats up as he casts: sparks, blue fire, a rocket
 * dash on a trail of fire and a flamethrower.
 *
 * - Q (Spark Spray): generic no-target area
 * - W (Blue Fire): custom handler (the heal)
 * - E (Afterburner): custom handler (the dash and the trail of fire)
 * - R (Flamethrower): custom handler (the stream and the exhaustion)
 *
 * Champion hooks (OitboilHooks): heat, the overheat and its damage.
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { OitboilWHandler } from './OitboilWHandler';
import { OitboilEHandler } from './OitboilEHandler';
import { OitboilRHandler } from './OitboilRHandler';
import { oitboilHooks } from './OitboilHooks';

export { OitboilWHandler } from './OitboilWHandler';
export { OitboilEHandler } from './OitboilEHandler';
export { OitboilRHandler } from './OitboilRHandler';
export { oitboilHooks } from './OitboilHooks';

/**
 * Register Oitboil's ability handlers and champion hooks.
 */
export function registerOitboilHandlers(): void {
  abilityHandlerRegistry.registerAll([new OitboilWHandler(), new OitboilEHandler(), new OitboilRHandler()]);
  championHooksRegistry.register(oitboilHooks);
}
