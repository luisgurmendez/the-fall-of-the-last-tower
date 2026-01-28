/**
 * Lume Ability Handlers
 *
 * Lume - The Wandering Light
 * Utility mage focused on positioning a persistent Light Orb.
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { LumeQHandler } from './LumeQHandler';
import { LumeWHandler } from './LumeWHandler';
import { LumeEHandler } from './LumeEHandler';
import { LumeRHandler } from './LumeRHandler';

export { LumeQHandler } from './LumeQHandler';
export { LumeWHandler } from './LumeWHandler';
export { LumeEHandler } from './LumeEHandler';
export { LumeRHandler } from './LumeRHandler';

/**
 * Register all Lume ability handlers.
 */
export function registerLumeHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new LumeQHandler(),
    new LumeWHandler(),
    new LumeEHandler(),
    new LumeRHandler(),
  ]);
}
