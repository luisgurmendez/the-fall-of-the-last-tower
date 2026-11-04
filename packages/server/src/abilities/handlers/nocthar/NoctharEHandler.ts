/**
 * NoctharEHandler - Heed Me
 *
 * Orders to his Hollows (orderFrom): at the ground, go there; at an enemy,
 * hunt it; at himself or right next to him, come back. Rising ones get it
 * too. With no Hollows it fails (it's free either way). The first order
 * after its charge cooldown (by rank) is a charge: they run faster and hit
 * harder for 3 s (an ABILITY_CAST nocthar_e_charge from each, for the VFX and sound).
 */

import { GameEventType, NOCTHAR_KIT } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult, AbilityValidationResult } from '../../IAbilityHandler';
import { hollowsOf, orderFrom } from './army';
import { noctharState } from './state';

export class NoctharEHandler extends BaseAbilityHandler {
  readonly abilityId = 'nocthar_e';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    return hollowsOf(params.champion, params.context).length > 0
      ? { valid: true }
      : { valid: false, reason: 'invalid_target' };
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, rank, targetPosition, targetEntityId } = params;
    const army = hollowsOf(champion, context);
    const order = orderFrom(champion, targetPosition, targetEntityId, context);
    if (army.length === 0 || !order) return { success: false };
    for (const hollow of army) hollow.command(order, context);

    const state = noctharState(champion);
    if (state.chargeCooldown <= 0) {
      const index = Math.min(rank, NOCTHAR_KIT.eChargeCooldown.length) - 1;
      for (const hollow of army) {
        hollow.chargeFor(NOCTHAR_KIT.eChargeSpeed, NOCTHAR_KIT.eChargeDamage[index], NOCTHAR_KIT.eChargeDuration);
        context.addEvent(GameEventType.ABILITY_CAST, {
          entityId: hollow.id,
          abilityId: 'nocthar_e_charge',
          x: hollow.position.x,
          y: hollow.position.y,
        });
      }
      state.chargeCooldown = NOCTHAR_KIT.eChargeCooldown[index];
    }
    return { success: true };
  }
}
