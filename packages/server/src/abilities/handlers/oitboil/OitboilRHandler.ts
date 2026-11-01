/**
 * OitboilRHandler - Flamethrower
 *
 * Oitboil plants his feet and pours fire forward for a second: a few
 * pulses in the cone, each burning a share of every enemy champion's
 * current health (together the rank's share, OITBOIL_FLAMETHROWER_SHARE)
 * and a part of the flat damage on other units. He's rooted while he
 * pours, and can't attack or cast until the exhaustion after it ends.
 * Stunned or killed, the stream stops.
 */

import { canAbilityAffectEntityType, EntityType, OITBOIL_FLAMETHROWER_SHARE } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';

/** How long he pours, and how long he's exhausted after */
export const FLAMETHROWER_DURATION = 1;
export const FLAMETHROWER_EXHAUSTION = 1.5;
const PULSES = 4;

export class OitboilRHandler extends BaseAbilityHandler {
  readonly abilityId = 'oitboil_r';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank, damageMultiplier, targetPosition } = params;
    if (!targetPosition) return { success: false };
    const aim = targetPosition.subtracted(champion.position);
    if (aim.length() < 1) return { success: false };
    const direction = aim.normalized();
    champion.direction = direction;

    // Each pulse takes this share of what's left, so all of them take the rank's share
    const share = OITBOIL_FLAMETHROWER_SHARE[rank - 1] ?? OITBOIL_FLAMETHROWER_SHARE[0];
    const pulseShare = 1 - Math.pow(1 - share, 1 / PULSES);
    const pulseDamage = this.calculateDamage(definition, rank, champion, damageMultiplier) / PULSES;
    const damageType = definition.damage?.type ?? 'magic';
    const length = definition.range ?? 260;
    const halfAngle = (definition.coneAngle ?? Math.PI / 3) / 2;

    champion.applyEffect('oitboil_flamethrower', FLAMETHROWER_DURATION, champion.id);
    champion.applyEffect('oitboil_exhausted', FLAMETHROWER_DURATION + FLAMETHROWER_EXHAUSTION, champion.id);
    champion.applyEffect('oitboil_exhausted_disarm', FLAMETHROWER_DURATION + FLAMETHROWER_EXHAUSTION, champion.id);

    let stopped = false;
    const pulse = () => {
      if (stopped || champion.isDead || champion.ccStatus.isStunned) {
        stopped = true;
        champion.removeEffect('oitboil_flamethrower');
        return;
      }
      for (const entity of context.getEntitiesInRadius(champion.position, length)) {
        if (entity.side === champion.side || entity.isDead) continue;
        if (!canAbilityAffectEntityType(definition, entity.entityType)) continue;
        const toEntity = entity.position.subtracted(champion.position);
        const angle = Math.abs(Math.atan2(direction.x * toEntity.y - direction.y * toEntity.x, direction.x * toEntity.x + direction.y * toEntity.y));
        if (toEntity.length() > 1 && angle > halfAngle) continue;
        const damage = entity.entityType === EntityType.CHAMPION
          ? entity.health * pulseShare * damageMultiplier
          : pulseDamage;
        this.dealDamage(entity, damage, damageType, champion.id, context);
      }
    };
    for (let i = 0; i < PULSES; i++) {
      context.schedule(0.1 + (i * (FLAMETHROWER_DURATION - 0.15)) / PULSES, pulse);
    }

    return { success: true, animationDuration: FLAMETHROWER_DURATION };
  }
}
