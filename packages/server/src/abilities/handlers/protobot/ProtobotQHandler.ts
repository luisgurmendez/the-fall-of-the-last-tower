/**
 * ProtobotQHandler - Magnetism
 *
 * A magnetic claw flies forward and stops on the first enemy it meets,
 * which takes the damage. An enemy champion is then pulled to Protobot,
 * stunned on the way, and Protobot gains a shield: an ABILITY_CAST
 * protobot_q_pull (for the chain's VFX). Minions and monsters are only hit.
 */

import { EntityType, GameEventType, PROTOBOT_MACHINE } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { ServerProjectile } from '../../../simulation/ServerProjectile';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { applyEffectsToEntity } from '../../generic/AbilityHelpers';

export class ProtobotQHandler extends BaseAbilityHandler {
  readonly abilityId = 'protobot_q';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, targetPosition, context, definition, rank, damageMultiplier } = params;
    if (!targetPosition) return { success: false };

    context.addEntity(new ServerProjectile({
      id: context.generateEntityId(),
      position: champion.position.clone(),
      side: champion.side,
      direction: this.getDirection(champion, targetPosition),
      speed: definition.projectileSpeed ?? 750,
      radius: definition.projectileRadius ?? 24,
      maxDistance: definition.range ?? 470,
      sourceId: champion.id,
      abilityId: definition.id,
      damage: this.calculateDamage(definition, rank, champion, damageMultiplier),
      damageType: definition.damage?.type ?? 'magic',
      onHit: (entity, hitContext) => {
        if (entity.entityType === EntityType.CHAMPION && !entity.isDead && !champion.isDead) {
          this.pull(champion, entity as ServerChampion, rank, hitContext);
        }
      },
    }));
    return { success: true };
  }

  /** Reel the champion in to just in front of Protobot */
  private pull(champion: ServerChampion, victim: ServerChampion, rank: number, context: ServerGameContext): void {
    const toProtobot = champion.position.subtracted(victim.position);
    const distance = toProtobot.length() - champion.getRadius() - victim.getRadius() - PROTOBOT_MACHINE.pullGap;
    if (distance > 1) {
      const duration = distance / PROTOBOT_MACHINE.pullSpeed;
      victim.forcedMovement = {
        direction: toProtobot.normalized(),
        distance,
        duration,
        elapsed: 0,
        type: 'knockback',
      };
      victim.dashAbilityId = null;
      applyEffectsToEntity(victim as ServerEntity, ['stun'], duration + 0.1, champion.id);
    }
    const shield = PROTOBOT_MACHINE.catchShield[Math.max(0, Math.min(rank, PROTOBOT_MACHINE.catchShield.length) - 1)];
    this.applyShield(champion, shield, PROTOBOT_MACHINE.catchShieldDuration, this.abilityId);
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: 'protobot_q_pull',
      targetEntityId: victim.id,
      targetX: victim.position.x,
      targetY: victim.position.y,
    });
  }
}
