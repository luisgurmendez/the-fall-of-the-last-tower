/**
 * Elara Ability Handlers
 *
 * Elara - The Radiant Healer
 * Ranged support with healing and utility.
 *
 * NOTE: Only abilities with special logic need handlers.
 * - Q (Radiant Blessing): Uses generic targeted ally execution
 * - W (Sacred Shield): Uses generic targeted ally execution
 * - E (Swift Grace): Uses generic no-target execution
 * - R (Divine Intervention): Custom handler for cleanse mechanic
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { ElaraRHandler } from './ElaraRHandler';

export { ElaraRHandler } from './ElaraRHandler';

/**
 * Register Elara ability handlers.
 */
export function registerElaraHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new ElaraRHandler(),
    // Q, W, E use generic execution - no custom handlers needed
  ]);
}
