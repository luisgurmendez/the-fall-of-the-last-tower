/**
 * CalamitusRHandler - Eruption
 *
 * After a moment every pool of his lava erupts, and so does the ground
 * around him: each enemy in any of them takes the damage once and is
 * stunned. Each pool's eruption is an ABILITY_CAST calamitus_lava_erupt
 * (for its VFX); his own is the R's cast.
 */

import { CALAMITUS_LAVA, GameEventType, canAbilityAffectEntityType } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import { applyEffectsToEntity } from '../../generic/AbilityHelpers';
import { lavaOf } from './lava';

export class CalamitusRHandler extends BaseAbilityHandler {
  readonly abilityId = 'calamitus_r';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition, rank, context, damageMultiplier } = params;
    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const radius = definition.aoeRadius ?? 220;

    context.schedule(definition.aoeDelay ?? 0.6, () => {
      if (champion.isDead) return;
      const areas = [
        { position: champion.position.clone(), radius },
        ...lavaOf(champion, context).map(pool => ({ position: pool.position.clone(), radius: pool.radius })),
      ];
      const struck = new Set<string>();
      for (const [i, area] of areas.entries()) {
        if (i > 0) {
          context.addEvent(GameEventType.ABILITY_CAST, {
            entityId: champion.id,
            abilityId: 'calamitus_lava_erupt',
            targetX: area.position.x,
            targetY: area.position.y,
          });
        }
        for (const entity of context.getEntitiesInRadius(area.position, area.radius + 60)) {
          if (struck.has(entity.id) || !this.isVictim(entity, champion.side, definition)) continue;
          if (entity.position.distanceTo(area.position) > area.radius + entity.getRadius()) continue;
          struck.add(entity.id);
          if (definition.damage) this.dealDamage(entity, damage, definition.damage.type, champion.id, context);
          applyEffectsToEntity(entity, ['stun'], CALAMITUS_LAVA.eruptionStun, champion.id);
        }
      }
    });
    return { success: true };
  }

  private isVictim(entity: ServerEntity, side: number, definition: AbilityHandlerParams['definition']): boolean {
    return entity.side !== side && !entity.isDead && canAbilityAffectEntityType(definition, entity.entityType);
  }
}
