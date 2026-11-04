/**
 * KipEHandler - Grand Entrance
 *
 * He leaps toward the spot, up to the ability's range (a dash: a wall stops
 * it, and rooted or grounded he can't: movesCaster), drawn as kip_e. Once he
 * lands (where a wall stopped him, too) he bursts: an ABILITY_CAST
 * kip_e_land there (for its VFX), damage to the enemies around (units its
 * ability affects: no towers or wards) and the enemy champions among them
 * are marked. Nothing happens on the way. Dead, or thrown off course (a
 * knockback took over the dash), he doesn't burst. Like the other dashes it
 * has no cast time.
 */

import { GameEventType, KIP_KIT, canAbilityAffectEntityType } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { markIfChampion } from './marks';

export class KipEHandler extends BaseAbilityHandler {
  readonly abilityId = 'kip_e';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, damageMultiplier, targetPosition } = params;
    if (!targetPosition) return { success: false };

    const offset = targetPosition.subtracted(champion.position);
    const distance = Math.min(offset.length(), definition.range ?? 200);
    if (distance > 1) {
      champion.forcedMovement = {
        direction: offset.normalized(),
        distance,
        duration: distance / KIP_KIT.eDashSpeed,
        elapsed: 0,
        type: 'dash',
      };
      champion.dashAbilityId = definition.id;
      this.faceToward(champion, targetPosition);
    }
    const leap = champion.forcedMovement;

    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const radius = definition.aoeRadius ?? 130;
    const burst = () => {
      if (champion.isDead) return;
      // Scheduled actions run before units move in a tick: still in the air, look again next tick
      if (leap && champion.forcedMovement === leap) {
        context.schedule(0, burst);
        return;
      }
      // Something else moved him (a knockback): no landing
      if (champion.forcedMovement) return;
      context.addEvent(GameEventType.ABILITY_CAST, {
        entityId: champion.id,
        abilityId: 'kip_e_land',
        targetX: champion.position.x,
        targetY: champion.position.y,
      });
      for (const entity of context.getEntitiesInRadius(champion.position, radius + 60)) {
        if (entity.side === champion.side || entity.isDead || !canAbilityAffectEntityType(definition, entity.entityType)) continue;
        if (entity.position.distanceTo(champion.position) > radius + entity.getRadius()) continue;
        if (definition.damage) this.dealDamage(entity, damage, definition.damage.type, champion.id, context);
        markIfChampion(entity, champion);
      }
    };
    context.schedule(0, burst);
    return { success: true };
  }
}
