/**
 * Vile Ability Handlers
 *
 * Vile - The Soul Herder
 * Ranged fighter/assassin jungler with soul-based mechanics.
 *
 * ALL Vile abilities have special mechanics requiring custom handlers:
 * - Q (Black Arrows): Charge + skillshot + recast dash
 * - W (Veil of Darkness): Self effects + post-effects after duration
 * - E (Roots of Vilix): Ammo-based trap placement
 * - R (Restoration): Stat transform + trap explosion + aura
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { VileQHandler } from './VileQHandler';
import { VileWHandler } from './VileWHandler';
import { VileEHandler } from './VileEHandler';
import { VileRHandler } from './VileRHandler';

export { VileQHandler } from './VileQHandler';
export { VileWHandler } from './VileWHandler';
export { VileEHandler } from './VileEHandler';
export { VileRHandler } from './VileRHandler';

/**
 * Register all Vile ability handlers.
 */
export function registerVileHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new VileQHandler(),
    new VileWHandler(),
    new VileEHandler(),
    new VileRHandler(),
  ]);
}
