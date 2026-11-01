/**
 * CalamitusEHandler - Obsidian Skin
 *
 * A shield that scales with his maximum health, half again as strong if
 * he's standing in his lava.
 */

import { CALAMITUS_LAVA, calculateAbilityValue } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { inLava } from './lava';

export class CalamitusEHandler extends BaseAbilityHandler {
  readonly abilityId = 'calamitus_e';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context } = params;
    if (!definition.shield) return { success: false };
    const amount = calculateAbilityValue(definition.shield.scaling, rank, this.getScalingContext(champion))
      * (inLava(champion, context, champion.position) ? 1 + CALAMITUS_LAVA.skinOnLavaBonus : 1);
    this.applyShield(champion, amount, definition.shield.duration ?? 3, definition.id);
    return { success: true };
  }
}
