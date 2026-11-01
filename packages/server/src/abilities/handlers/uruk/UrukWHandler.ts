/**
 * UrukWHandler - Spear Charge
 *
 * Readies the spear: the next basic attack within 4 seconds reaches 40
 * further and is ready at once (an attack reset), and its bonus damage and
 * the armor penetration come from UrukHooks while the effects last.
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';

/** How much further the charged attack reaches */
export const SPEAR_CHARGE_REACH = 40;

export class UrukWHandler extends BaseAbilityHandler {
  readonly abilityId = 'uruk_w';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition } = params;
    const duration = definition.effectDuration ?? 4;

    for (const effectId of definition.appliesEffects ?? []) {
      champion.applyEffect(effectId, duration, champion.id);
    }
    champion.setTransformAttackRange(champion.getStats().attackRange + SPEAR_CHARGE_REACH, duration);
    champion.basicAttacks.resetCooldown();

    return { success: true };
  }
}
