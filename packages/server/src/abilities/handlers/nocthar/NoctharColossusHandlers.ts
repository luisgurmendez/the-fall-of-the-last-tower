/**
 * The colossus's abilities, in his W, E and R while it lives:
 * - Bone Volley (W): it pays 10% of its max health, holds still for its
 *   windup and hurls bones at the area (as far as colossusWRange from it):
 *   they land after their flight, damaging and slowing the enemies there
 *   (ABILITY_CAST nocthar_colossus_w, then nocthar_colossus_w_impact)
 * - Trample (E): it pays 10%, holds still for its windup, then charges
 *   toward the aim carrying the enemies it hits (knocked up meanwhile);
 *   where it stops they take damage and are knocked up for 0.5 s
 *   (nocthar_colossus_e, then nocthar_colossus_e_end)
 * - Colossus, Heed Me (R): orders to it, as Heed Me's to the Hollows
 *
 * Without its colossus (or the health to pay) a cast fails, costing nothing.
 * The damage is his (kills, gold and items count it as his).
 */

import { GameEventType, NOCTHAR_KIT, Vector } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult, AbilityValidationResult } from '../../IAbilityHandler';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import { colossusOf, orderFrom } from './army';

type EffectHolder = Partial<{ applyEffect(id: string, duration: number, sourceId?: string): void }>;

/** What a colossus ability costs it */
function cost(colossus: { maxHealth: number }): number {
  return colossus.maxHealth * NOCTHAR_KIT.colossusAbilityCost;
}

/** Valid with a colossus that can pay */
function canPay(params: AbilityHandlerParams): AbilityValidationResult {
  const colossus = colossusOf(params.champion, params.context);
  return colossus && colossus.health > cost(colossus) ? { valid: true } : { valid: false, reason: 'invalid_target' };
}

export class NoctharColossusWHandler extends BaseAbilityHandler {
  readonly abilityId = 'nocthar_colossus_w';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    return canPay(params);
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank, targetPosition, damageMultiplier } = params;
    const colossus = colossusOf(champion, context);
    if (!colossus || !targetPosition || !colossus.payHealth(cost(colossus))) return { success: false };

    const offset = targetPosition.subtracted(colossus.position);
    const landing = offset.length() > NOCTHAR_KIT.colossusWRange
      ? colossus.position.added(offset.normalized().scaled(NOCTHAR_KIT.colossusWRange))
      : targetPosition.clone();
    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const radius = definition.aoeRadius ?? 90;

    colossus.holdFor(NOCTHAR_KIT.colossusWWindup);
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: 'nocthar_colossus_w',
      sourceEntityId: colossus.id,
      targetX: landing.x,
      targetY: landing.y,
    });

    context.schedule(NOCTHAR_KIT.colossusWWindup, () => {
      if (colossus.isDead) return;
      context.schedule(NOCTHAR_KIT.colossusWFlight, () => {
        context.addEvent(GameEventType.ABILITY_CAST, {
          entityId: champion.id,
          abilityId: 'nocthar_colossus_w_impact',
          targetX: landing.x,
          targetY: landing.y,
        });
        for (const entity of this.getAffectedEnemies(landing, radius + 40, champion, definition, context)) {
          if (entity.position.distanceTo(landing) > radius + entity.getRadius()) continue;
          this.dealDamage(entity, damage, definition.damage!.type, champion.id, context);
          if (!entity.isDead) {
            (entity as EffectHolder).applyEffect?.(NOCTHAR_KIT.colossusWSlowEffect, NOCTHAR_KIT.colossusWSlowDuration, champion.id);
          }
        }
      });
    });
    return { success: true };
  }
}

export class NoctharColossusEHandler extends BaseAbilityHandler {
  readonly abilityId = 'nocthar_colossus_e';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    return canPay(params);
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank, targetPosition, damageMultiplier } = params;
    const colossus = colossusOf(champion, context);
    if (!colossus || !targetPosition || !colossus.payHealth(cost(colossus))) return { success: false };

    const aim = targetPosition.subtracted(colossus.position);
    const direction = aim.length() > 1 ? aim.normalized() : new Vector(1, 0);
    const end = colossus.position.added(direction.scaled(NOCTHAR_KIT.colossusEDistance));
    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);

    colossus.holdFor(NOCTHAR_KIT.colossusEWindup);
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: 'nocthar_colossus_e',
      sourceEntityId: colossus.id,
      targetX: end.x,
      targetY: end.y,
    });

    context.schedule(NOCTHAR_KIT.colossusEWindup, () => {
      if (colossus.isDead) return;
      const carried: ServerEntity[] = [];
      colossus.startDash({
        direction,
        distance: NOCTHAR_KIT.colossusEDistance,
        duration: NOCTHAR_KIT.colossusEDuration,
        touchRadius: NOCTHAR_KIT.colossusEWidth,
        carries: true,
        onTouch: entity => {
          carried.push(entity);
          // Carried, it can't act
          (entity as EffectHolder).applyEffect?.('knockup', NOCTHAR_KIT.colossusEDuration, champion.id);
        },
        onEnd: () => {
          context.addEvent(GameEventType.ABILITY_CAST, {
            entityId: champion.id,
            abilityId: 'nocthar_colossus_e_end',
            sourceEntityId: colossus.id,
            targetX: colossus.position.x,
            targetY: colossus.position.y,
          });
          for (const entity of carried) {
            if (entity.isDead) continue;
            this.dealDamage(entity, damage, definition.damage!.type, champion.id, context);
            if (!entity.isDead) (entity as EffectHolder).applyEffect?.('knockup', NOCTHAR_KIT.colossusEKnockupDuration, champion.id);
          }
        },
      });
    });
    return { success: true };
  }
}

export class NoctharColossusRHandler extends BaseAbilityHandler {
  readonly abilityId = 'nocthar_colossus_r';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    return colossusOf(params.champion, params.context) ? { valid: true } : { valid: false, reason: 'invalid_target' };
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, targetPosition, targetEntityId } = params;
    const colossus = colossusOf(champion, context);
    const order = orderFrom(champion, targetPosition, targetEntityId, context);
    if (!colossus || !order) return { success: false };
    colossus.command(order, context);
    return { success: true };
  }
}
