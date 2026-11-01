/**
 * HopQHandler - Rodent Fangs
 *
 * The bite goes through armor: the target loses armor first
 * (armor_reduction), then takes the damage.
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { applyEffectsToEntity } from '../../generic/AbilityHelpers';

export class HopQHandler extends BaseAbilityHandler {
  readonly abilityId = 'hop_q';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, targetEntityId, damageMultiplier } = params;
    const target = targetEntityId ? context.getEntity(targetEntityId) : undefined;
    if (!target || target.isDead) return { success: false };

    this.faceToward(champion, target.position);
    applyEffectsToEntity(target, definition.appliesEffects ?? [], definition.effectDuration ?? 4, champion.id);
    if (definition.damage) {
      this.dealDamage(target, this.calculateDamage(definition, rank, champion, damageMultiplier), definition.damage.type, champion.id, context);
    }
    return { success: true };
  }
}
