/**
 * OitboilWHandler - Blue Fire
 *
 * Heals Oitboil (the generic self path doesn't heal); the heat it vents is
 * OitboilHooks.onAbilityCast's.
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';

export class OitboilWHandler extends BaseAbilityHandler {
  readonly abilityId = 'oitboil_w';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank } = params;
    this.healEntity(champion, this.calculateHeal(definition, rank, champion), context, champion.id);
    return { success: true };
  }
}
