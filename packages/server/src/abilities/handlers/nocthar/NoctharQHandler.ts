/**
 * NoctharQHandler - Grasping Hands
 *
 * After its cast time (0.25 s) the ground cracks where he aimed and, after
 * aoeDelay (0.6 s), bony hands burst out of the circle: an ABILITY_CAST
 * nocthar_q_burst there, damage to the enemies in it, a drag toward its
 * middle (qPull, never past it: champions slide, other units are moved) and
 * a 30% slow.
 */

import { EntityType, GameEventType, NOCTHAR_KIT, Vector } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';

/** How long a dragged champion slides */
const DRAG_TIME = 0.15;

export class NoctharQHandler extends BaseAbilityHandler {
  readonly abilityId = 'nocthar_q';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank, targetPosition, damageMultiplier } = params;
    if (!targetPosition) return { success: false };
    const center = targetPosition.clone();
    const radius = definition.aoeRadius ?? 95;
    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);

    context.schedule(definition.aoeDelay ?? 0, () => {
      context.addEvent(GameEventType.ABILITY_CAST, {
        entityId: champion.id,
        abilityId: 'nocthar_q_burst',
        targetX: center.x,
        targetY: center.y,
      });
      for (const entity of this.getAffectedEnemies(center, radius + 40, champion, definition, context)) {
        if (entity.position.distanceTo(center) > radius + entity.getRadius()) continue;
        this.dealDamage(entity, damage, definition.damage!.type, champion.id, context);
        if (entity.isDead) continue;
        (entity as Partial<{ applyEffect(id: string, duration: number, sourceId?: string): void }>)
          .applyEffect?.(NOCTHAR_KIT.qSlowEffect, NOCTHAR_KIT.qSlowDuration, champion.id);
        drag(entity, center);
      }
    });
    return { success: true };
  }
}

/** Pull a unit toward the circle's middle, never past it */
function drag(entity: ServerEntity, center: Vector): void {
  const toCenter = center.subtracted(entity.position);
  const distance = Math.min(NOCTHAR_KIT.qPull, toCenter.length());
  if (distance < 0.5) return;
  const direction = toCenter.normalized();
  if (entity.entityType === EntityType.CHAMPION) {
    const champion = entity as ServerChampion;
    if (champion.forcedMovement) return;
    champion.forcedMovement = { direction, distance, duration: DRAG_TIME, elapsed: 0, type: 'knockback' };
    return;
  }
  entity.position.add(direction.scaled(distance));
}
