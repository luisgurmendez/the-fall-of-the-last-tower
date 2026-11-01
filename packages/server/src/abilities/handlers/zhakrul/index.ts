/**
 * Zhak'rul Ability Handlers
 *
 * Zhak'rul - The Ancient Scorpion
 * Bruiser (ability power): poisons, wears enemies down, ambushes from underground.
 *
 * - Q (Deadly Pincers): generic cone, harder on the poisoned
 * - W (Toxic Cloud): custom handler (a cloud that hurts more the longer enemies stay)
 * - E (Burrowed Ambush): custom handler (underground, under walls, then the burst)
 * - R (Death Stinger): custom handler (a stun and the venom's ticks)
 *
 * Champion hooks (ZhakrulHooks): Ancient Venom on basic attacks; the venom
 * itself lives in venom.ts.
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { ZhakrulQHandler } from './ZhakrulQHandler';
import { ZhakrulWHandler } from './ZhakrulWHandler';
import { ZhakrulEHandler } from './ZhakrulEHandler';
import { ZhakrulRHandler } from './ZhakrulRHandler';
import { zhakrulHooks } from './ZhakrulHooks';

export { ZhakrulQHandler } from './ZhakrulQHandler';
export { ZhakrulWHandler } from './ZhakrulWHandler';
export { ZhakrulEHandler } from './ZhakrulEHandler';
export { ZhakrulRHandler } from './ZhakrulRHandler';
export { zhakrulHooks } from './ZhakrulHooks';

/**
 * Register Zhak'rul's ability handlers and champion hooks.
 */
export function registerZhakrulHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new ZhakrulQHandler(),
    new ZhakrulWHandler(),
    new ZhakrulEHandler(),
    new ZhakrulRHandler(),
  ]);
  championHooksRegistry.register(zhakrulHooks);
}
