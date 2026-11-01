/**
 * OitboilEHandler - Afterburner
 *
 * Oitboil rockets toward the target (the generic dash) and leaves burning
 * ground behind him: small fire zones dropped where he is as he passes, far
 * enough apart that an enemy stands in one at a time. Together they deal the
 * ability's damage over the zones' duration.
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { dashToDestination } from '../../generic/Movement';
import { ServerZone } from '../../../simulation/ServerZone';

/** Radius of each patch of fire; they're dropped twice this apart */
const TRAIL_RADIUS = 34;

export class OitboilEHandler extends BaseAbilityHandler {
  readonly abilityId = 'oitboil_e';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank, damageMultiplier, targetPosition } = params;
    if (!targetPosition || !definition.dash) return { success: false };
    const offset = targetPosition.subtracted(champion.position);
    if (offset.length() < 1) return { success: false };

    const distance = Math.min(offset.length(), definition.dash.distance);
    const dashDuration = distance / definition.dash.speed;
    dashToDestination(params, definition, rank, damageMultiplier);

    const duration = definition.zoneDuration ?? 2;
    const tickRate = definition.zoneTickRate ?? 0.5;
    const damagePerTick = this.calculateDamage(definition, rank, champion, damageMultiplier) / Math.max(1, Math.floor(duration / tickRate));
    const patches = Math.max(1, Math.floor(distance / (TRAIL_RADIUS * 2)));
    for (let i = 0; i < patches; i++) {
      // Where he is as he passes: from where he took off, not where he lands
      context.schedule((i / patches) * dashDuration, () => {
        if (champion.isDead) return;
        context.addEntity(new ServerZone({
          id: context.generateEntityId(),
          position: champion.position.clone(),
          side: champion.side,
          radius: TRAIL_RADIUS,
          duration,
          sourceId: champion.id,
          abilityId: definition.id,
          zoneType: 'damage',
          damage: damagePerTick,
          damageType: definition.damage?.type ?? 'magic',
          tickRate,
        }));
      });
    }

    return { success: true, animationDuration: dashDuration };
  }
}
