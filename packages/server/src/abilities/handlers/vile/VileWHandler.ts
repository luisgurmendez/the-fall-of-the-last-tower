/**
 * VileWHandler - Veil of Darkness
 *
 * Self-targeted ability that grants stealth, invulnerability, and self-root.
 *
 * DURING EFFECT (2 seconds):
 * - Invisible
 * - Invulnerable
 * - Cannot move (rooted)
 *
 * AFTER EFFECT:
 * - 50% movement speed for 2 seconds
 * - Slow resistance for 2 seconds
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityExecutionResult,
} from '../../IAbilityHandler';
import { Logger } from '../../../utils/Logger';

export class VileWHandler extends BaseAbilityHandler {
  readonly abilityId = 'vile_veil_of_darkness';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition } = params;

    const veilDuration = Array.isArray(definition.effectDuration)
      ? definition.effectDuration[params.rank - 1]
      : definition.effectDuration ?? 2;

    // Apply veil effects (stealth, invulnerable, self-root)
    if (definition.appliesEffects) {
      this.applyEffects(
        champion,
        definition.appliesEffects,
        veilDuration,
        champion.id
      );
    }

    // Schedule post-veil effects
    if (definition.postEffects) {
      const postEffects = definition.postEffects;
      setTimeout(() => {
        // Check if champion is still alive
        if (!champion.isDead) {
          this.applyEffects(
            champion,
            postEffects.effects,
            postEffects.duration,
            champion.id
          );
          Logger.champion.debug(
            `${champion.playerId} Veil ended - gained speed and slow resistance`
          );
        }
      }, veilDuration * 1000);
    }

    Logger.champion.debug(
      `${champion.playerId} entered Veil of Darkness for ${veilDuration}s`
    );

    return { success: true };
  }
}
