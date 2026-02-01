/**
 * Vex Ability Handlers
 *
 * Vex - The Shadow Blade
 * Melee assassin with high burst and mobility.
 *
 * NOTE: Only abilities with special logic need handlers.
 * - Q (Shuriken): Uses generic skillshot execution
 * - W (Shroud): Uses generic self-target execution
 * - E (Dash): Custom handler for cooldown reset mechanic
 * - R (Ninja Mode): Custom handler for stat transform and CDR mechanic
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { VexDashHandler } from './VexDashHandler';
import { VexNinjaModeHandler } from './VexNinjaModeHandler';

export { VexDashHandler } from './VexDashHandler';
export { VexNinjaModeHandler } from './VexNinjaModeHandler';

/**
 * Register Vex ability handlers.
 */
export function registerVexHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new VexDashHandler(),
    new VexNinjaModeHandler(),
  ]);
}
