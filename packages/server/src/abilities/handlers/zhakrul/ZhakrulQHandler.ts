/**
 * ZhakrulQHandler - Deadly Pincers
 *
 * The generic cone (the snap lands after aoeDelay), hitting harder each
 * dose of Ancient Venom on an enemy.
 */

import { ZHAKRUL_KIT } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { executeConeAbility } from '../../generic/Cone';
import { venomStacks } from './venom';

export class ZhakrulQHandler extends BaseAbilityHandler {
  readonly abilityId = 'zhakrul_q';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, damageMultiplier, targetPosition } = params;
    if (!targetPosition) return { success: false };
    this.faceToward(champion, targetPosition);
    executeConeAbility(params, definition, rank, damageMultiplier, (entity, damage) =>
      damage * (1 + ZHAKRUL_KIT.pincerBonusPerStack * venomStacks(champion, entity, context)));
    return { success: true };
  }
}
