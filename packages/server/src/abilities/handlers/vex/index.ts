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
 * - R (Execute): Uses generic targeted execution
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { VexDashHandler } from './VexDashHandler';

export { VexDashHandler } from './VexDashHandler';

/**
 * Register Vex ability handlers.
 */
export function registerVexHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new VexDashHandler(),
    // Q, W, R use generic execution - no custom handlers needed
  ]);
}
