/**
 * Magnus Ability Handlers
 *
 * Magnus - The Battlemage
 * Ranged mage with burst damage.
 *
 * NOTE: All Magnus abilities use generic execution.
 * - Q (Fireball): Skillshot projectile
 * - W (Arcane Barrier): Self shield
 * - E (Quagmire): Ground target zone with slow
 * - R (Inferno Zone): Ground target zone with damage + slow
 *
 * Champion hooks (MagnusHooks):
 * - Passive (Arcane Surge): 30% bonus damage on the next ability
 */

import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { magnusHooks } from './MagnusHooks';

export { magnusHooks } from './MagnusHooks';

/**
 * Register Magnus ability handlers and champion hooks.
 * No ability handlers - all abilities use generic execution.
 */
export function registerMagnusHandlers(): void {
  championHooksRegistry.register(magnusHooks);
}
