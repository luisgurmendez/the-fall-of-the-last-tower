/**
 * HopRHandler - Savage Kick
 *
 * Kicks an enemy champion away from Hop-To-Eat: damage, then it flies back
 * (a knockback), stunned. Each other enemy champion it flies into takes the
 * same damage and is knocked up: an ABILITY_CAST hop_r_crash for the VFX.
 */

import { EntityType, GameEventType, HOP_HOP } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import { applyEffectsToEntity } from '../../generic/AbilityHelpers';

export class HopRHandler extends BaseAbilityHandler {
  readonly abilityId = 'hop_r';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, targetEntityId, damageMultiplier } = params;
    const target = targetEntityId ? context.getEntity(targetEntityId) : undefined;
    if (!target || target.isDead || target.entityType !== EntityType.CHAMPION) return { success: false };
    const victim = target as ServerChampion;

    const away = victim.position.subtracted(champion.position);
    const direction = away.length() > 1 ? away.normalized() : champion.direction.clone();
    this.faceToward(champion, victim.position);

    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const damageType = definition.damage?.type ?? 'physical';
    this.dealDamage(victim, damage, damageType, champion.id, context);
    if (victim.isDead) return { success: true };

    const duration = HOP_HOP.kickDistance / HOP_HOP.kickSpeed;
    victim.forcedMovement = {
      direction,
      distance: HOP_HOP.kickDistance,
      duration,
      elapsed: 0,
      type: 'knockback',
      touches: {
        radius: HOP_HOP.crashRadius,
        touched: new Set([champion.id, victim.id]),
        touch: (entity) => {
          if (entity.entityType !== EntityType.CHAMPION || entity.side !== victim.side) return;
          this.dealDamage(entity, damage, damageType, champion.id, context);
          if (!entity.isDead) applyEffectsToEntity(entity, ['knockup'], HOP_HOP.crashKnockup, champion.id);
          context.addEvent(GameEventType.ABILITY_CAST, {
            entityId: champion.id,
            abilityId: 'hop_r_crash',
            targetX: entity.position.x,
            targetY: entity.position.y,
          });
        },
      },
    };
    victim.dashAbilityId = null;
    applyEffectsToEntity(victim, ['stun'], duration + 0.1, champion.id);
    return { success: true };
  }
}
