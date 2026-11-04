/**
 * NoctharRHandler - Colossus of Bones
 *
 * At the end of its cast time (1.5 s; meanwhile his Hollows run to the spot,
 * NoctharHooks.onCastStart) the Hollows sink and the colossus bursts out
 * where he aimed (army.ts raiseColossus): an ABILITY_CAST nocthar_r_emerge
 * there, damage to the enemies within rKnockupRadius and a 1 s knockup. Its
 * cooldown starts when the colossus falls (army.ts endColossus), so the cast
 * starts none.
 */

import { GameEventType, NOCTHAR_KIT } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { raiseColossus } from './army';

export class NoctharRHandler extends BaseAbilityHandler {
  readonly abilityId = 'nocthar_r';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank, targetPosition, damageMultiplier } = params;
    if (!targetPosition) return { success: false };
    const colossus = raiseColossus(champion, targetPosition, context);
    context.addEvent(GameEventType.ABILITY_CAST, {
      entityId: champion.id,
      abilityId: 'nocthar_r_emerge',
      targetEntityId: colossus.id,
      targetX: colossus.position.x,
      targetY: colossus.position.y,
    });

    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const radius = NOCTHAR_KIT.rKnockupRadius;
    for (const entity of this.getAffectedEnemies(colossus.position, radius + 40, champion, definition, context)) {
      if (entity.position.distanceTo(colossus.position) > radius + entity.getRadius()) continue;
      this.dealDamage(entity, damage, definition.damage!.type, champion.id, context);
      if (entity.isDead) continue;
      (entity as Partial<{ applyEffect(id: string, duration: number, sourceId?: string): void }>)
        .applyEffect?.('knockup', NOCTHAR_KIT.rKnockupDuration, champion.id);
    }
    return { success: true, cooldownOverride: 0 };
  }
}
