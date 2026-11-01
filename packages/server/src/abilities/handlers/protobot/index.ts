/**
 * Protobot 45 Ability Handlers
 *
 * Protobot 45 - The Sentient Machine
 * Tank: reels enemies in, knocks them up, shorts out their abilities.
 *
 * - Q (Magnetism): custom handler (the claw, and the pull on a champion)
 * - W (Hypercharge): generic self shield and speed
 * - E (Rocket Punch): custom handler (damage, knock-up, a shield on him)
 * - R (Overload): custom handler (the delayed pulse that breaks shields)
 *
 * Champion hooks (ProtobotHooks): Machine Learning.
 */

import { abilityHandlerRegistry } from '../../AbilityHandlerRegistry';
import { championHooksRegistry } from '../../ChampionHooksRegistry';
import { ProtobotQHandler } from './ProtobotQHandler';
import { ProtobotEHandler } from './ProtobotEHandler';
import { ProtobotRHandler } from './ProtobotRHandler';
import { protobotHooks } from './ProtobotHooks';

export { ProtobotQHandler } from './ProtobotQHandler';
export { ProtobotEHandler } from './ProtobotEHandler';
export { ProtobotRHandler } from './ProtobotRHandler';
export { protobotHooks } from './ProtobotHooks';

/**
 * Register Protobot's ability handlers and champion hooks.
 */
export function registerProtobotHandlers(): void {
  abilityHandlerRegistry.registerAll([
    new ProtobotQHandler(),
    new ProtobotEHandler(),
    new ProtobotRHandler(),
  ]);
  championHooksRegistry.register(protobotHooks);
}
