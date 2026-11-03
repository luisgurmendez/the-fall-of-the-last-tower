/**
 * VileEHandler - Roots of Vilix
 *
 * Place an invisible trap that triggers on enemy champions.
 *
 * TRAP MECHANICS:
 * - Uses charge system (the definition's ammo, tracked by the executor)
 * - Traps are invisible to enemies
 * - Triggers on enemy champions (roots for 1s)
 * - Grants Vile soul stacks on trigger
 * - Can be detonated early by R
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityExecutionResult,
} from '../../IAbilityHandler';
import { ServerTrap } from '../../../simulation/ServerTrap';
import { Logger } from '../../../utils/Logger';

export class VileEHandler extends BaseAbilityHandler {
  readonly abilityId = 'vile_roots_of_vilix';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, targetPosition, context, definition } = params;

    if (!targetPosition || !definition.trap) {
      return { success: false };
    }

    // Create the trap (its blast is for the rank R has when it's cast)
    const trap = new ServerTrap({
      id: context.generateEntityId(),
      position: targetPosition.clone(),
      side: champion.side,
      ownerId: champion.id,
      abilityId: definition.id,
      triggerRadius: definition.trap.triggerRadius,
      duration: definition.trap.duration,
      isStealthed: definition.trap.isStealthed,
      rootDuration: definition.trap.rootDuration,
      soulStacksOnTrigger: definition.trap.soulStacksOnTrigger ?? 0,
      explosionRadius: definition.trap.explosionRadius ?? 300,
      explosionRootDuration: definition.trap.explosionRootDuration ?? 1,
    });

    // Type assertion needed due to ServerTrap inheritance issue
    context.addEntity(trap as unknown as import('../../../simulation/ServerEntity').ServerEntity);

    Logger.champion.debug(
      `${champion.playerId} placed trap at (${targetPosition.x.toFixed(0)}, ${targetPosition.y.toFixed(0)})`
    );

    return { success: true };
  }
}
