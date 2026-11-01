/**
 * HopWHandler - Carrot Break
 *
 * It stops to eat: a heal that grows with the health it's missing, rooted
 * while it eats (hop_eating), then a sugar rush of attack speed
 * (hop_sugar_rush).
 */

import { calculateAbilityValue } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';

/** How long it can't move while it eats */
const EATING = 0.75;

export class HopWHandler extends BaseAbilityHandler {
  readonly abilityId = 'hop_w';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context } = params;
    if (definition.heal) {
      const heal = calculateAbilityValue(definition.heal.scaling, rank, {
        ...this.getScalingContext(champion),
        missingHealth: champion.maxHealth - champion.health,
      });
      this.healEntity(champion, heal, context, champion.id);
    }
    champion.applyEffect('hop_eating', EATING, champion.id);
    champion.applyEffect('hop_sugar_rush', definition.effectDuration ?? 3, champion.id);
    return { success: true };
  }
}
