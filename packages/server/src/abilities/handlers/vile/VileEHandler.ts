/**
 * VileEHandler - Roots of Vilix
 *
 * Place an invisible trap that triggers on enemy champions.
 *
 * TRAP MECHANICS:
 * - Uses charge system (max 5 charges)
 * - Traps are invisible to enemies
 * - Triggers on enemy champions (roots for 1s)
 * - Grants Vile soul stacks on trigger
 * - Can be detonated early by R
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityValidationResult,
  AbilityExecutionResult,
} from '../../IAbilityHandler';
import { ServerTrap } from '../../../simulation/ServerTrap';
import { Logger } from '../../../utils/Logger';

export class VileEHandler extends BaseAbilityHandler {
  readonly abilityId = 'vile_roots_of_vilix';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    const { champion } = params;
    const state = champion.abilityStates.E;

    // Check ammo (charges)
    if (state.charges !== undefined && state.charges <= 0) {
      return { valid: false, reason: 'no_ammo', customMessage: 'No trap charges available' };
    }

    return { valid: true };
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, targetPosition, context, definition, rank } = params;

    if (!targetPosition || !definition.trap) {
      return { success: false };
    }

    // Get R rank for explosion damage scaling
    const rState = champion.abilityStates.R;
    const rRank = Math.max(1, rState.rank);
    const explosionDamage = definition.trap.explosionDamage?.[rRank - 1] ?? 0;

    // Create the trap
    const trap = new ServerTrap({
      id: context.generateEntityId(),
      position: targetPosition.clone(),
      side: champion.side,
      ownerId: champion.id,
      triggerRadius: definition.trap.triggerRadius,
      duration: definition.trap.duration,
      isStealthed: definition.trap.isStealthed,
      rootDuration: definition.trap.rootDuration,
      soulStacksOnTrigger: definition.trap.soulStacksOnTrigger ?? 0,
      explosionDamage: explosionDamage,
      explosionRadius: definition.trap.explosionRadius ?? 300,
      explosionRootDuration: definition.trap.explosionRootDuration ?? 1,
    });

    // Type assertion needed due to ServerTrap inheritance issue
    context.addEntity(trap as unknown as import('../../../simulation/ServerEntity').ServerEntity);

    // Consume ammo
    const state = champion.abilityStates.E;
    if (state.charges !== undefined) {
      state.charges--;
    }

    Logger.champion.debug(
      `${champion.playerId} placed trap at (${targetPosition.x.toFixed(0)}, ${targetPosition.y.toFixed(0)}) ` +
      `[${state.charges ?? 0} charges remaining]`
    );

    return { success: true };
  }
}
