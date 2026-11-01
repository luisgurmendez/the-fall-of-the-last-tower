/**
 * FenrisQHandler - Vicious Bite
 *
 * Bites the target for physical damage and heals him; feral (FenrisHooks),
 * the bite hits harder (the damage multiplier) and heals twice as much.
 */

import { FENRIS_FERAL } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';

export class FenrisQHandler extends BaseAbilityHandler {
  readonly abilityId = 'fenris_q';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, targetEntityId, damageMultiplier } = params;
    const target = targetEntityId ? context.getEntity(targetEntityId) : undefined;
    if (!target || target.isDead) return { success: false };

    if (definition.damage) {
      const damage = this.calculateDamage(definition, rank, champion) * (damageMultiplier ?? 1);
      this.dealDamage(target, damage, definition.damage.type, champion.id, context);
    }
    const feral = champion.hasEffect('fenris_feral');
    const heal = this.calculateHeal(definition, rank, champion) * (feral ? FENRIS_FERAL.biteHealMultiplier : 1);
    this.healEntity(champion, heal, context, champion.id);

    return { success: true };
  }
}
