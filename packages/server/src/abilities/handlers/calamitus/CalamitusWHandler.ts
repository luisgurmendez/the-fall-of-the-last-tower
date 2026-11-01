/**
 * CalamitusWHandler - Magma Landslide
 *
 * The generic line (damage and the slow, after the wave rolls), and when it
 * lands a stream of lava pools down the same line.
 */

import { CALAMITUS_LAVA } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { executeLineAbility } from '../../generic/Line';
import { spawnLava } from './lava';

export class CalamitusWHandler extends BaseAbilityHandler {
  readonly abilityId = 'calamitus_w';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, damageMultiplier, targetPosition } = params;
    if (!targetPosition) return { success: false };
    const offset = targetPosition.subtracted(champion.position);
    if (offset.length() < 1) return { success: false };
    const direction = offset.normalized();

    executeLineAbility(params, definition, rank, damageMultiplier);

    const length = definition.range ?? 380;
    context.schedule(definition.aoeDelay ?? 0, () => {
      if (champion.isDead) return;
      // From where he is as it lands, like the line's damage
      const from = champion.position.clone();
      for (let along = CALAMITUS_LAVA.streamSpacing / 2; along < length; along += CALAMITUS_LAVA.streamSpacing) {
        spawnLava(champion, context, from.added(direction.scaled(along)), CALAMITUS_LAVA.streamRadius, definition.id);
      }
    });
    return { success: true };
  }
}
