/**
 * KipRHandler - Show Them All
 *
 * The X enemy champions he marked within reach (aoeRadius, to the edge of
 * their body) when he casts it are his targets: X volleys, one at once and
 * then one every 0.15 s, each an arrow at every target. An arrow follows its
 * target (ServerTargetedProjectile) and deals the full damage times
 * kipArrowShare(X): with one mark one arrow of 100%, and each target takes
 * 100% + 25% per other mark in all (2 marks: 2 x 62.5%; 5 marks: 5 x 40%).
 * Each arrow may crit (his crit chance and damage). The arrows aren't basic
 * attacks: they leave the marks for his basic attacks to pop.
 *
 * Set at the cast: a mark that runs out between volleys doesn't stop its
 * target's arrows. A target that dies gets no more (they don't go to the
 * others). If he dies, is stunned or silenced between volleys, the rest
 * aren't fired. With no marked enemy in reach the cast fails, nothing spent.
 * Each volley after the first sends an ABILITY_CAST kip_r_volley (its sound).
 */

import { GameEventType, KIP_KIT, kipArrowShare } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult, AbilityValidationResult } from '../../IAbilityHandler';
import { ServerTargetedProjectile } from '../../../simulation/ServerTargetedProjectile';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { markedEnemies } from './marks';

/** An arrow's size, as the client draws it */
const ARROW_RADIUS = 6;

export class KipRHandler extends BaseAbilityHandler {
  readonly abilityId = 'kip_r';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    const { champion, context, definition } = params;
    return markedEnemies(champion, context, definition.aoeRadius ?? 650).length > 0
      ? { valid: true }
      : { valid: false, reason: 'invalid_target' };
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank, damageMultiplier } = params;
    const targets = markedEnemies(champion, context, definition.aoeRadius ?? 650);
    if (targets.length === 0) return { success: false };

    const arrow = this.calculateDamage(definition, rank, champion, damageMultiplier) * kipArrowShare(targets.length);
    let stopped = false;
    const volley = (index: number) => {
      if (stopped) return;
      if (champion.isDead || !champion.ccStatus.canCast) {
        stopped = true;
        return;
      }
      if (index > 0) {
        context.addEvent(GameEventType.ABILITY_CAST, {
          entityId: champion.id,
          abilityId: 'kip_r_volley',
          targetX: champion.position.x,
          targetY: champion.position.y,
        });
      }
      for (const target of targets) {
        if (!target.isDead) this.fireArrow(champion, target, arrow, context);
      }
    };

    volley(0);
    for (let i = 1; i < targets.length; i++) {
      context.schedule(i * KIP_KIT.rVolleyEvery, () => volley(i));
    }
    return { success: true };
  }

  private fireArrow(champion: ServerChampion, target: ServerChampion, damage: number, context: ServerGameContext): void {
    const stats = champion.getStats();
    const crit = stats.critChance > 0 && Math.random() < stats.critChance;
    context.addEntity(new ServerTargetedProjectile({
      id: context.generateEntityId(),
      position: champion.position.clone(),
      side: champion.side,
      targetId: target.id,
      speed: KIP_KIT.rArrowSpeed,
      radius: ARROW_RADIUS,
      sourceId: champion.id,
      projectileType: 'kip_r',
      damage: crit ? damage * stats.critDamage : damage,
      damageType: 'physical',
      ability: { crit },
    }));
  }
}
