/**
 * UrukEHandler - Silver Scales
 *
 * Shields Urûk in silver scales. The definition's damage, radius and slow
 * are the frost burst when the shield breaks or runs out, which UrukHooks
 * sets off; the generic self path would put the slow on Urûk himself.
 */

import { calculateAbilityValue } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { getScalingStats } from '../../generic/AbilityHelpers';

export class UrukEHandler extends BaseAbilityHandler {
  readonly abilityId = 'uruk_e';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank } = params;
    if (!definition.shield) return { success: false };

    champion.shields.push({
      amount: calculateAbilityValue(definition.shield.scaling, rank, getScalingStats(champion, champion.getStats())),
      remainingDuration: definition.shield.duration,
      sourceId: definition.id,
      shieldType: 'normal',
    });
    return { success: true };
  }
}
