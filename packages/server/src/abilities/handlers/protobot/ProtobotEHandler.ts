/**
 * ProtobotEHandler - Rocket Punch
 *
 * His fist flies at the target: damage, a knock-up, and a small shield on
 * him.
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { applyEffectsToEntity } from '../../generic/AbilityHelpers';

export class ProtobotEHandler extends BaseAbilityHandler {
  readonly abilityId = 'protobot_e';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, targetEntityId, damageMultiplier } = params;
    const target = targetEntityId ? context.getEntity(targetEntityId) : undefined;
    if (!target || target.isDead) return { success: false };

    this.faceToward(champion, target.position);
    if (definition.damage) {
      this.dealDamage(target, this.calculateDamage(definition, rank, champion, damageMultiplier), definition.damage.type, champion.id, context);
    }
    if (!target.isDead) {
      applyEffectsToEntity(target, definition.appliesEffects ?? [], definition.effectDuration ?? 0.75, champion.id);
    }
    this.applyShield(champion, this.calculateShield(definition, rank, champion), definition.shield?.duration ?? 2, definition.id);
    return { success: true };
  }
}
