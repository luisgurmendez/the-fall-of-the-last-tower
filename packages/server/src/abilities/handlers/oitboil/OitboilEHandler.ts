/**
 * OitboilEHandler - Afterburner
 *
 * Oitboil rockets toward the target (the generic dash) and leaves burning
 * ground behind him: small fire zones dropped where he is as he passes.
 * Together they deal the ability's damage over the zones' duration. They
 * burn as one (a ZoneHitGroup): an enemy standing where two overlap takes
 * one patch's damage, and where a wall stopped him no patch is dropped on
 * another (they piled up there, 2-3 times the damage).
 */

import type { Vector } from '@siege/shared';
import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type { AbilityHandlerParams, AbilityExecutionResult } from '../../IAbilityHandler';
import { dashToDestination } from '../../generic/Movement';
import { ServerZone, ZoneHitGroup } from '../../../simulation/ServerZone';

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
    const hitGroup = new ZoneHitGroup();
    const dropped: Vector[] = [];
    for (let i = 0; i < patches; i++) {
      // Where he is as he passes: from where he took off, not where he lands
      context.schedule((i / patches) * dashDuration, () => {
        if (champion.isDead) return;
        const position = champion.position.clone();
        if (dropped.some(patch => patch.distanceTo(position) < TRAIL_RADIUS)) return;
        dropped.push(position);
        context.addEntity(new ServerZone({
          id: context.generateEntityId(),
          position,
          side: champion.side,
          radius: TRAIL_RADIUS,
          duration,
          sourceId: champion.id,
          abilityId: definition.id,
          zoneType: 'damage',
          damage: damagePerTick,
          damageType: definition.damage?.type ?? 'magic',
          tickRate,
          hitGroup,
        }));
      });
    }

    return { success: true, animationDuration: dashDuration };
  }
}
