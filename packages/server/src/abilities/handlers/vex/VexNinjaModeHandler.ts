/**
 * VexNinjaModeHandler - Ninja Mode
 *
 * Enter a heightened combat state for 15 seconds.
 *
 * WHILE IN NINJA MODE:
 * - Gains bonus attack speed (30% / 45% / 60% by rank)
 * - Q (Shadow Shuriken) and E (Shadow Step) cooldowns are reduced by 50%
 * - Champion takedowns extend duration by 2 seconds (max 20 seconds total)
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityExecutionResult,
} from '../../IAbilityHandler';
import { Logger } from '../../../utils/Logger';

export class VexNinjaModeHandler extends BaseAbilityHandler {
  readonly abilityId = 'vex_ninja_mode';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank } = params;

    if (!definition.statTransform) {
      return { success: false };
    }

    const transform = definition.statTransform;
    const duration = transform.duration; // 15 seconds base

    // Apply attack speed bonus as a stat modifier
    if (transform.statModifiers?.attackSpeed) {
      const attackSpeedBonus = transform.statModifiers.attackSpeed[rank - 1];
      champion.addModifier({
        source: `ninja_mode_${definition.id}`,
        percent: { attackSpeed: 1 + attackSpeedBonus },
        duration,
        timeRemaining: duration,
      });

      Logger.champion.debug(
        `${champion.playerId} Ninja Mode: +${Math.round(attackSpeedBonus * 100)}% attack speed for ${duration}s`
      );
    }

    // Apply the ninja mode effect for state tracking and CDR
    // The effect drives all Ninja Mode behavior (CDR checked in updateAbilities,
    // takedown extension via extendEffectDuration in RewardSystem)
    if (definition.appliesEffects) {
      for (const effectId of definition.appliesEffects) {
        champion.applyEffect(effectId, duration, champion.id);
      }
    }

    Logger.champion.info(
      `${champion.playerId} activated Ninja Mode for ${duration}s`
    );

    return { success: true };
  }
}
