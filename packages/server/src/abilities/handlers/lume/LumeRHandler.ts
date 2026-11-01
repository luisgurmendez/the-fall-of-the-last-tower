/**
 * LumeRHandler - Eclipse
 *
 * The Light Orb gathers light for aoeDelay (clients draw the line from the
 * orb), then fires a beam rBeamLength long from where the orb was toward the
 * aim: magic damage to every enemy along it. The orb isn't spent.
 */

import { canAbilityAffectEntityType, LUME_ORB_CONFIG } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityValidationResult,
  AbilityExecutionResult,
} from '../../IAbilityHandler';
import { entitiesInBand } from '../../generic/Line';
import { findOrb } from './LumeEHandler';

export class LumeRHandler extends BaseAbilityHandler {
  readonly abilityId = 'lume_r';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    const orb = findOrb(params.champion, params.context);
    if (!orb || orb.isDestroyed) {
      return { valid: false, reason: 'orb_destroyed', customMessage: 'Light Orb is destroyed' };
    }
    return { valid: true };
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank, damageMultiplier, targetPosition } = params;
    const orb = findOrb(champion, context);
    if (!orb || orb.isDestroyed || !targetPosition) return { success: false };

    // From the orb toward the aim (from Lume's aim when it's on the orb itself)
    const origin = orb.position.clone();
    let aim = targetPosition.subtracted(origin);
    if (aim.length() < 1) aim = targetPosition.subtracted(champion.position);
    if (aim.length() < 1) return { success: false };
    const direction = aim.normalized();
    const length = LUME_ORB_CONFIG.rBeamLength;
    const damage = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const damageType = definition.damage?.type ?? 'magic';

    const fire = () => {
      if (champion.isDead) return;
      const band = { from: origin, direction, length, halfWidth: definition.aoeRadius ?? LUME_ORB_CONFIG.rBeamHalfWidth };
      for (const entity of entitiesInBand(context, band)) {
        if (entity.side === champion.side || entity.isDead) continue;
        if (!canAbilityAffectEntityType(definition, entity.entityType)) continue;
        this.dealDamage(entity, damage, damageType, champion.id, context);
      }
    };
    context.schedule(definition.aoeDelay ?? 0.6, fire);

    // The VFX runs from the orb to the beam's end
    return { success: true, vfxOrigin: origin, vfxPosition: origin.added(direction.scaled(length)) };
  }
}
