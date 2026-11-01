/**
 * Calamitus Ability Handlers
 *
 * Calamitus - The Flowing Magma
 * Tank: floods the ground with lava, hardens in it, makes it erupt.
 *
 * - Q (Lava Flow): custom handler (the burst and a pool of lava)
 * - W (Magma Landslide): the generic line, plus a stream of lava
 * - E (Obsidian Skin): custom handler (the shield, stronger on his lava)
 * - R (Eruption): custom handler (every pool erupts)
 *
 * Champion hooks (CalamitusHooks): Lavaborn. The lava itself: lava.ts.
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { CalamitusQHandler } from './CalamitusQHandler';
import { CalamitusWHandler } from './CalamitusWHandler';
import { CalamitusEHandler } from './CalamitusEHandler';
import { CalamitusRHandler } from './CalamitusRHandler';
import { calamitusHooks } from './CalamitusHooks';

export { CalamitusQHandler } from './CalamitusQHandler';
export { CalamitusWHandler } from './CalamitusWHandler';
export { CalamitusEHandler } from './CalamitusEHandler';
export { CalamitusRHandler } from './CalamitusRHandler';
export { calamitusHooks } from './CalamitusHooks';

/**
 * Register Calamitus's ability handlers and champion hooks.
 */
export function registerCalamitusHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new CalamitusQHandler(),
    new CalamitusWHandler(),
    new CalamitusEHandler(),
    new CalamitusRHandler(),
  ]);
  championHooksRegistry.register(calamitusHooks);
}
