/**
 * NoctharWHandler - Lament
 *
 * After its cast time (0.3 s) he wails: the enemy units within wFearRadius
 * of him (to the edge of their bodies) take damage and flee from him (fear,
 * from him) for 1 s; his Hollows within wFrenzyRadius attack faster for 2 s
 * (an ABILITY_CAST nocthar_w_frenzy on each, for their VFX).
 */

import { GameEventType, NOCTHAR_KIT } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { hollowsOf } from './army';

export class NoctharWHandler extends BaseAbilityHandler {
  readonly abilityId = 'nocthar_w';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank, damageMultiplier } = params;
    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const radius = NOCTHAR_KIT.wFearRadius;

    for (const entity of this.getAffectedEnemies(champion.position, radius + 40, champion, definition, context)) {
      if (entity.position.distanceTo(champion.position) > radius + entity.getRadius()) continue;
      this.dealDamage(entity, damage, definition.damage!.type, champion.id, context);
      if (entity.isDead) continue;
      (entity as Partial<{ applyEffect(id: string, duration: number, sourceId?: string): void }>)
        .applyEffect?.('fear', NOCTHAR_KIT.wFearDuration, champion.id);
    }

    const bonus = NOCTHAR_KIT.wFrenzyAttackSpeed[Math.min(rank, NOCTHAR_KIT.wFrenzyAttackSpeed.length) - 1];
    for (const hollow of hollowsOf(champion, context)) {
      if (hollow.position.distanceTo(champion.position) > NOCTHAR_KIT.wFrenzyRadius) continue;
      hollow.frenzyFor(bonus, NOCTHAR_KIT.wFrenzyDuration);
      context.addEvent(GameEventType.ABILITY_CAST, {
        entityId: champion.id,
        abilityId: 'nocthar_w_frenzy',
        targetEntityId: hollow.id,
        targetX: hollow.position.x,
        targetY: hollow.position.y,
      });
    }
    return { success: true };
  }
}
