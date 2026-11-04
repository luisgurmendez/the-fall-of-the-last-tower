/**
 * ZhakrulWHandler - Toxic Cloud
 *
 * A cloud of poison stays where he breathed it out (a zone, which slows
 * enemies in it). It billows out first (the definition's aoeDelay, its
 * warning: nothing in it is hurt or slowed yet), then settles: once a
 * second it hurts every enemy in it, more for each second in a row it has
 * been there, and gives it a dose of Ancient Venom.
 */

import { ZHAKRUL_KIT, canAbilityAffectEntityType } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { ServerZone } from '../../../simulation/ServerZone';
import { poison } from './venom';

export class ZhakrulWHandler extends BaseAbilityHandler {
  readonly abilityId = 'zhakrul_w';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, damageMultiplier } = params;
    const center = champion.position.clone();
    const radius = definition.aoeRadius ?? 190;
    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const billow = definition.aoeDelay ?? 0;

    context.schedule(billow, () => context.addEntity(new ServerZone({
      id: context.generateEntityId(),
      position: center.clone(),
      side: champion.side,
      radius,
      duration: ZHAKRUL_KIT.cloudDuration,
      sourceId: champion.id,
      abilityId: definition.id,
      zoneType: 'slow',
      appliesEffects: definition.appliesEffects,
      effectDuration: definition.effectDuration ?? 0.5,
    })));

    /** Seconds in a row each enemy has been in the cloud */
    const inCloud = new Map<string, number>();
    const ticks = Math.floor(ZHAKRUL_KIT.cloudDuration);
    for (let i = 0; i < ticks; i++) {
      context.schedule(billow + i, () => {
        const inside = new Set<string>();
        for (const entity of context.getEntitiesInRadius(center, radius + 40)) {
          if (entity.side === champion.side || entity.isDead || !canAbilityAffectEntityType(definition, entity.entityType)) continue;
          if (entity.position.distanceTo(center) > radius) continue;
          const seconds = inCloud.get(entity.id) ?? 0;
          inside.add(entity.id);
          inCloud.set(entity.id, seconds + 1);
          if (definition.damage) {
            this.dealDamage(entity, damage * (1 + ZHAKRUL_KIT.cloudGrowth * seconds), definition.damage.type, champion.id, context);
          }
          poison(champion, entity, 1, context);
        }
        // Leaving the cloud starts the count over
        for (const id of inCloud.keys()) if (!inside.has(id)) inCloud.delete(id);
      });
    }
    return { success: true };
  }
}
