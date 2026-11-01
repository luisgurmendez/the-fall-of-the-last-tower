/**
 * EloraQHandler - Poison Arrow
 *
 * Nocks a poisoned arrow: the next basic attack within 4 seconds is ready at
 * once (an attack reset), and its bonus damage, slow and poison come from
 * EloraHooks while the effect lasts.
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';

export class EloraQHandler extends BaseAbilityHandler {
  readonly abilityId = 'elora_q';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition } = params;
    const duration = definition.effectDuration ?? 4;

    for (const effectId of definition.appliesEffects ?? []) {
      champion.applyEffect(effectId, duration, champion.id);
    }
    champion.basicAttacks.resetCooldown();

    return { success: true };
  }
}
