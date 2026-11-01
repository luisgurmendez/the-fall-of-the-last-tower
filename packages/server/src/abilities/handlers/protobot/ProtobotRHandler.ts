/**
 * ProtobotRHandler - Overload
 *
 * He charges for a moment, then an electromagnetic pulse goes off around
 * him: every enemy in reach takes the damage, enemy champions lose their
 * shields, and they're silenced. The pulse is an ABILITY_CAST
 * protobot_r_pulse (for its VFX); the charge is the R's cast.
 */

import { EntityType, GameEventType, canAbilityAffectEntityType } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import { applyEffectsToEntity } from '../../generic/AbilityHelpers';

export class ProtobotRHandler extends BaseAbilityHandler {
  readonly abilityId = 'protobot_r';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, damageMultiplier } = params;
    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const radius = definition.aoeRadius ?? 280;

    context.schedule(definition.aoeDelay ?? 0.5, () => {
      if (champion.isDead) return;
      context.addEvent(GameEventType.ABILITY_CAST, {
        entityId: champion.id,
        abilityId: 'protobot_r_pulse',
        targetX: champion.position.x,
        targetY: champion.position.y,
      });
      for (const entity of context.getEntitiesInRadius(champion.position, radius + 60)) {
        if (entity.side === champion.side || entity.isDead || !canAbilityAffectEntityType(definition, entity.entityType)) continue;
        if (entity.position.distanceTo(champion.position) > radius + entity.getRadius()) continue;
        if (entity.entityType === EntityType.CHAMPION) (entity as ServerChampion).shields = [];
        if (definition.damage) this.dealDamage(entity, damage, definition.damage.type, champion.id, context);
        if (!entity.isDead) applyEffectsToEntity(entity, definition.appliesEffects ?? [], definition.effectDuration ?? 1.5, champion.id);
      }
    });
    return { success: true };
  }
}
