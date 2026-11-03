/**
 * ZhakrulEHandler - Burrowed Ambush
 *
 * He burrows and travels underground toward the spot, under walls too
 * (a forced movement that passes walls, ending where Terrain.landingSpot
 * finds open ground), drawn as zhakrul_e while it lasts. He bursts out
 * where he ends up, once the burrow is over: an ABILITY_CAST
 * zhakrul_e_burst (for its VFX), damage and a knock-up on the enemies
 * around. Like the other dashes it has no cast time (getCastTime: movesCaster).
 */

import { GameEventType, ZHAKRUL_KIT, canAbilityAffectEntityType } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { applyEffectsToEntity } from '../../generic/AbilityHelpers';

export class ZhakrulEHandler extends BaseAbilityHandler {
  readonly abilityId = 'zhakrul_e';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, damageMultiplier, targetPosition } = params;
    if (!targetPosition) return { success: false };

    const to = context.terrain.landingSpot(champion.position, targetPosition, definition.range ?? 320, champion.getRadius());
    const offset = to.subtracted(champion.position);
    const distance = offset.length();
    const duration = distance / ZHAKRUL_KIT.burrowSpeed;
    if (distance > 1) {
      champion.forcedMovement = {
        direction: offset.normalized(),
        distance,
        duration,
        elapsed: 0,
        type: 'dash',
        passesWalls: true,
      };
      champion.dashAbilityId = definition.id;
      this.faceToward(champion, to);
    }

    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const radius = definition.aoeRadius ?? 130;
    const burst = () => {
      if (champion.isDead) return;
      // Delayed actions run before units move in a tick: still underground, come up next tick
      if (champion.forcedMovement && champion.dashAbilityId === definition.id) {
        context.schedule(0, burst);
        return;
      }
      context.addEvent(GameEventType.ABILITY_CAST, {
        entityId: champion.id,
        abilityId: 'zhakrul_e_burst',
        targetX: champion.position.x,
        targetY: champion.position.y,
      });
      for (const entity of context.getEntitiesInRadius(champion.position, radius + 60)) {
        if (entity.side === champion.side || entity.isDead || !canAbilityAffectEntityType(definition, entity.entityType)) continue;
        if (entity.position.distanceTo(champion.position) > radius + entity.getRadius()) continue;
        if (definition.damage) this.dealDamage(entity, damage, definition.damage.type, champion.id, context);
        if (!entity.isDead) applyEffectsToEntity(entity, definition.appliesEffects ?? [], definition.effectDuration ?? 0.75, champion.id);
      }
    };
    context.schedule(duration, burst);
    return { success: true };
  }
}
