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
 *
 * Champion hooks (VexHooks):
 * - W (Shroud) does not break stealth when cast
 * - R (Ninja Mode) halves Q and E cooldowns while active
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { VexDashHandler } from './VexDashHandler';
import { VexNinjaModeHandler } from './VexNinjaModeHandler';
import { vexHooks } from './VexHooks';

export { VexDashHandler } from './VexDashHandler';
export { VexNinjaModeHandler } from './VexNinjaModeHandler';
export { vexHooks } from './VexHooks';

/**
 * Register Vex ability handlers and champion hooks.
 */
export function registerVexHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new VexDashHandler(),
    new VexNinjaModeHandler(),
  ]);
  championHooksRegistry.register(vexHooks);
}
