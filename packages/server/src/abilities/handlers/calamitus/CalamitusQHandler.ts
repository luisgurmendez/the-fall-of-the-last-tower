/**
 * CalamitusQHandler - Lava Flow
 *
 * Lava bursts up around Calamitus: magic damage to the enemies near him,
 * and a pool of lava under him (his passive's).
 */

import { canAbilityAffectEntityType } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { spawnLava } from './lava';

export class CalamitusQHandler extends BaseAbilityHandler {
  readonly abilityId = 'calamitus_q';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, damageMultiplier } = params;
    const radius = definition.aoeRadius ?? 140;
    if (definition.damage) {
      const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);
      for (const entity of context.getEntitiesInRadius(champion.position, radius)) {
        if (entity.side === champion.side || entity.isDead || !canAbilityAffectEntityType(definition, entity.entityType)) continue;
        this.dealDamage(entity, damage, definition.damage.type, champion.id, context);
      }
    }
    spawnLava(champion, context, champion.position, radius, definition.id);
    return { success: true };
  }
}
