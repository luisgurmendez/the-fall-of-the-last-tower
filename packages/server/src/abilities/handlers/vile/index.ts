/**
 * Vile Ability Handlers
 *
 * Vile - The Soul Herder
 * Ranged fighter/assassin jungler with soul-based mechanics.
 *
 * - Q (Black Arrows): the generic skillshot (charge range, stops at walls)
 *   and its generic recast dash
 * - W (Veil of Darkness): Self effects + post-effects after duration
 * - E (Roots of Vilix): trap placement (its ammo is tracked by the executor)
 * - R (Restoration): Stat transform + trap explosion + aura
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { VileWHandler } from './VileWHandler';
import { VileEHandler } from './VileEHandler';
import { VileRHandler } from './VileRHandler';

export { VileWHandler } from './VileWHandler';
export { VileEHandler } from './VileEHandler';
export { VileRHandler } from './VileRHandler';

/**
 * Register all Vile ability handlers.
 */
export function registerVileHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new VileWHandler(),
    new VileEHandler(),
    new VileRHandler(),
  ]);
}
