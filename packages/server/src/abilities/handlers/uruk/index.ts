/**
 * Urûk Ability Handlers
 *
 * Urûk - The Silver Dragonborn
 * Spear fighter: pokes, pierces armor, shields in silver scales, executes.
 *
 * - Q (Spear Thrust): generic line ground target
 * - W (Spear Charge): custom handler (reach and attack reset); the charged
 *   attack and the armor penetration live in UrukHooks
 * - E (Silver Scales): custom handler (the shield alone); the frost burst
 *   lives in UrukHooks
 * - R (Fatal Strike): generic targeted leap with an execute bonus
 *
 * Champion hooks (UrukHooks): Hunter's Instinct, the charged attack, armor
 * penetration, the scales' burst.
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { UrukWHandler } from './UrukWHandler';
import { UrukEHandler } from './UrukEHandler';
import { urukHooks } from './UrukHooks';

export { UrukWHandler } from './UrukWHandler';
export { UrukEHandler } from './UrukEHandler';
export { urukHooks } from './UrukHooks';

/**
 * Register Urûk's ability handlers and champion hooks.
 */
export function registerUrukHandlers(): void {
  abilityHandlerRegistry.registerAll([new UrukWHandler(), new UrukEHandler()]);
  championHooksRegistry.register(urukHooks);
}
