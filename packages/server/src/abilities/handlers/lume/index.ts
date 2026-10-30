/**
 * Lume Ability Handlers
 *
 * Lume - The Wandering Light
 * Utility mage focused on positioning a persistent Light Orb.
 *
 * Champion hooks (LumeHooks):
 * - Passive (Guiding Glow) and Q/W/E follow the Light Orb's state
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { LumeQHandler } from './LumeQHandler';
import { LumeWHandler } from './LumeWHandler';
import { LumeEHandler } from './LumeEHandler';
import { LumeRHandler } from './LumeRHandler';
import { lumeHooks } from './LumeHooks';

export { LumeQHandler } from './LumeQHandler';
export { LumeWHandler } from './LumeWHandler';
export { LumeEHandler } from './LumeEHandler';
export { LumeRHandler } from './LumeRHandler';
export { lumeHooks } from './LumeHooks';

/**
 * Register all Lume ability handlers and champion hooks.
 */
export function registerLumeHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new LumeQHandler(),
    new LumeWHandler(),
    new LumeEHandler(),
    new LumeRHandler(),
  ]);
  championHooksRegistry.register(lumeHooks);
}
