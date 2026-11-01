/**
 * CaelumRHandler - Martyr
 *
 * Caelum gives a quarter of his current health to another allied champion,
 * which heals the ability's heal plus twice what he gave. Not on himself,
 * nor on minions (the cast is refused and nothing is spent).
 */

import { CAELUM_LIGHT, EntityType, GameEventType } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';

export class CaelumRHandler extends BaseAbilityHandler {
  readonly abilityId = 'caelum_r';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, targetEntityId } = params;
    const ally = targetEntityId ? context.getEntity(targetEntityId) : undefined;
    if (!ally || ally.id === champion.id || ally.entityType !== EntityType.CHAMPION || ally.isDead) {
      return { success: false };
    }

    // His own health, given (never his last point of it)
    const given = Math.min(champion.health * CAELUM_LIGHT.martyrShare, champion.health - 1);
    champion.health -= given;

    const heal = this.calculateHeal(definition, rank, champion);
    this.healEntity(ally, heal + given * CAELUM_LIGHT.martyrMultiplier, context, champion.id);

    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: 'caelum_r_given',
      targetX: ally.position.x,
      targetY: ally.position.y,
    });
    return { success: true };
  }
}
