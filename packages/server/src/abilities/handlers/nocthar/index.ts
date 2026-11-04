/**
 * Nocthar Ability Handlers
 *
 * Nocthar - The Unburied
 * A mage who commands an army of the dead: enemies dying near him rise as
 * Hollows that fight for him, and his ultimate fuses them into a colossus.
 *
 * - Q (Grasping Hands): hands burst out of a circle: damage, a drag, a slow
 * - W (Lament): enemies near him flee; his Hollows near him frenzy
 * - E (Heed Me): orders to the Hollows; the first after a while is a charge
 * - R (Colossus of Bones): the Hollows become a colossus; while it lives his
 *   W, E and R are its own (NoctharColossusHandlers)
 *
 * Champion hooks (NoctharHooks): the passive (Nobody Leaves), the colossus
 * healing, the R's cast and interruption. army.ts: his summons. state.ts:
 * his waits and his colossus.
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { NoctharQHandler } from './NoctharQHandler';
import { NoctharWHandler } from './NoctharWHandler';
import { NoctharEHandler } from './NoctharEHandler';
import { NoctharRHandler } from './NoctharRHandler';
import { NoctharColossusWHandler, NoctharColossusEHandler, NoctharColossusRHandler } from './NoctharColossusHandlers';
import { noctharHooks } from './NoctharHooks';

export { noctharHooks } from './NoctharHooks';

/**
 * Register Nocthar's ability handlers and champion hooks.
 */
export function registerNoctharHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new NoctharQHandler(),
    new NoctharWHandler(),
    new NoctharEHandler(),
    new NoctharRHandler(),
    new NoctharColossusWHandler(),
    new NoctharColossusEHandler(),
    new NoctharColossusRHandler(),
  ]);
  championHooksRegistry.register(noctharHooks);
}
