/**
 * KipWHandler - Run Them Down (active)
 *
 * Every enemy champion he marked within reach (aoeRadius, to the edge of its
 * body) is slowed by 40% for 1-2 seconds by rank; an ABILITY_CAST kip_w_hit
 * on each (for the VFX). The marks stay. With none in reach the cast fails
 * and nothing is spent. Its passive part (speed from crit chance) is in
 * KipHooks.modifyStats.
 */

import { GameEventType, KIP_KIT } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult, AbilityValidationResult } from '../../IAbilityHandler';
import { markedEnemies } from './marks';

export class KipWHandler extends BaseAbilityHandler {
  readonly abilityId = 'kip_w';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    const { champion, context, definition } = params;
    return markedEnemies(champion, context, definition.aoeRadius ?? 650).length > 0
      ? { valid: true }
      : { valid: false, reason: 'invalid_target' };
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank } = params;
    const targets = markedEnemies(champion, context, definition.aoeRadius ?? 650);
    if (targets.length === 0) return { success: false };

    const duration = KIP_KIT.wSlowDuration[Math.min(rank, KIP_KIT.wSlowDuration.length) - 1];
    for (const target of targets) {
      target.applyEffect(KIP_KIT.wSlowEffect, duration, champion.id);
      context.addEvent(GameEventType.ABILITY_CAST, {
        entityId: champion.id,
        abilityId: 'kip_w_hit',
        targetEntityId: target.id,
        targetX: target.position.x,
        targetY: target.position.y,
      });
    }
    return { success: true };
  }
}
