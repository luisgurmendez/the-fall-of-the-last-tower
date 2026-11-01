/**
 * ZhakrulRHandler - Death Stinger
 *
 * His stinger stuns an enemy champion and injects a deadly dose: magic
 * damage in ticks over a few seconds, more for each dose of Ancient Venom
 * it had; then it has every dose, so the venom turns ancient.
 */

import { ZHAKRUL_KIT, ZHAKRUL_VENOM } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { applyEffectsToEntity } from '../../generic/AbilityHelpers';
import { poison, venomStacks } from './venom';

export class ZhakrulRHandler extends BaseAbilityHandler {
  readonly abilityId = 'zhakrul_r';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, targetEntityId, damageMultiplier } = params;
    const target = targetEntityId ? context.getEntity(targetEntityId) : undefined;
    if (!target || target.isDead || !definition.damage) return { success: false };

    this.faceToward(champion, target.position);
    applyEffectsToEntity(target, definition.appliesEffects ?? [], definition.effectDuration ?? 1, champion.id);

    const doses = venomStacks(champion, target, context);
    const total = this.calculateDamage(definition, rank, champion, damageMultiplier)
      * (1 + ZHAKRUL_KIT.stingBonusPerStack * doses);
    const perTick = total / ZHAKRUL_KIT.stingTicks;
    const interval = ZHAKRUL_KIT.stingDuration / ZHAKRUL_KIT.stingTicks;
    const damageType = definition.damage.type;
    for (let i = 1; i <= ZHAKRUL_KIT.stingTicks; i++) {
      context.schedule(interval * i, () => {
        if (target.isDead) return;
        this.dealDamage(target, perTick, damageType, champion.id, context);
      });
    }
    poison(champion, target, ZHAKRUL_VENOM.maxStacks, context);
    return { success: true };
  }
}
