/**
 * KipQHandler - Target Practice
 *
 * An arrow (after the usual 0.25 s cast time) that stops at the first enemy
 * it meets: that enemy takes the damage, and an enemy champion is marked
 * (kip_mark, 4 s; one already marked has it refreshed, never popped). A
 * minion or a monster is only hurt.
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { ServerProjectile } from '../../../simulation/ServerProjectile';
import { markIfChampion } from './marks';

export class KipQHandler extends BaseAbilityHandler {
  readonly abilityId = 'kip_q';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, targetPosition, context, definition, rank, damageMultiplier } = params;
    if (!targetPosition) return { success: false };

    context.addEntity(new ServerProjectile({
      id: context.generateEntityId(),
      position: champion.position.clone(),
      side: champion.side,
      direction: this.getDirection(champion, targetPosition),
      speed: definition.projectileSpeed ?? 560,
      radius: definition.projectileRadius ?? 18,
      maxDistance: definition.range ?? 500,
      sourceId: champion.id,
      abilityId: definition.id,
      damage: this.calculateDamage(definition, rank, champion, damageMultiplier),
      damageType: definition.damage?.type ?? 'physical',
      onHit: entity => markIfChampion(entity, champion),
    }));
    return { success: true };
  }
}
