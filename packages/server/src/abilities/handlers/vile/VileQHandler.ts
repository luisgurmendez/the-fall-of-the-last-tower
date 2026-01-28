/**
 * VileQHandler - Black Arrows of Vilix
 *
 * Charge-based skillshot that can be recast to dash to hit location.
 *
 * CHARGE MECHANICS:
 * - Min charge: 0.3s, Max charge: 2.0s
 * - Range increases with charge (+600 at max)
 * - Cannot move while charging
 *
 * RECAST MECHANICS:
 * - On hit (enemy or wall), can recast to dash to impact location
 * - 3 second recast window
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityExecutionResult,
  ProjectileHitContext,
} from '../../IAbilityHandler';
import { ServerProjectile } from '../../../simulation/ServerProjectile';
import { hasChargeBehavior } from '@siege/shared';
import { Logger } from '../../../utils/Logger';

export class VileQHandler extends BaseAbilityHandler {
  readonly abilityId = 'vile_black_arrows';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, targetPosition, context, definition, rank, damageMultiplier, chargeTime } = params;

    if (!targetPosition) {
      return { success: false };
    }

    // Calculate direction
    const direction = this.getDirection(champion, targetPosition);

    // Calculate damage
    const damageAmount = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const damageType = definition.damage?.type ?? 'physical';

    // Calculate effective range (with charge bonus)
    let effectiveRange = definition.range ?? 800;

    if (hasChargeBehavior(definition) && chargeTime !== undefined) {
      const charge = definition.charge!;
      const minCharge = charge.minChargeTime;
      const maxCharge = charge.maxChargeTime;

      // Calculate charge progress (0 to 1)
      const chargeProgress = Math.max(0, Math.min(1,
        (chargeTime - minCharge) / (maxCharge - minCharge)
      ));

      // Apply range bonus based on charge progress
      if (charge.maxChargeRangeBonus) {
        effectiveRange += charge.maxChargeRangeBonus * chargeProgress;
        Logger.champion.debug(
          `${champion.playerId} charged ${definition.id} for ${chargeTime.toFixed(2)}s ` +
          `(${(chargeProgress * 100).toFixed(0)}%), range: ${effectiveRange.toFixed(0)}`
        );
      }
    }

    // Create projectile
    const projectile = new ServerProjectile({
      id: context.generateEntityId(),
      position: champion.position.clone(),
      side: champion.side,
      direction: direction,
      speed: definition.projectileSpeed ?? 1800,
      radius: definition.projectileRadius ?? 25,
      maxDistance: effectiveRange,
      sourceId: champion.id,
      abilityId: definition.id,
      damage: damageAmount,
      damageType: damageType,
      piercing: false,
      appliesEffects: definition.appliesEffects,
      effectDuration: definition.effectDuration,
    });

    context.addEntity(projectile);

    Logger.champion.debug(
      `${champion.playerId} fired Black Arrow (range: ${effectiveRange.toFixed(0)})`
    );

    return { success: true };
  }

  /**
   * Called when the projectile hits an enemy or wall.
   * Enables recast to dash to the hit location.
   */
  onProjectileHit(hitContext: ProjectileHitContext, params: AbilityHandlerParams): void {
    const { champion } = params;

    // Enable recast with the hit position
    champion.enableRecast('Q', hitContext.hitPosition, 1, 3.0);

    Logger.champion.debug(
      `${champion.playerId} Black Arrow hit - recast available at (${hitContext.hitPosition.x.toFixed(0)}, ${hitContext.hitPosition.y.toFixed(0)})`
    );
  }

  /**
   * Check if recast is available.
   */
  canRecast(params: AbilityHandlerParams): boolean {
    const { champion } = params;
    return champion.hasRecastAvailable('Q');
  }

  /**
   * Execute recast - dash to the hit position.
   */
  executeRecast(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion } = params;

    const hitPosition = champion.getRecastHitPosition('Q');
    if (!hitPosition) {
      return { success: false };
    }

    const direction = hitPosition.subtracted(champion.position);
    const distance = direction.length();

    if (distance < 10) {
      // Already at position
      champion.consumeRecast('Q');
      return { success: true };
    }

    const normalizedDir = direction.normalized();
    const dashSpeed = 1500;

    champion.forcedMovement = {
      direction: normalizedDir,
      distance: distance,
      duration: distance / dashSpeed,
      elapsed: 0,
      type: 'dash',
      hitEntities: new Set(),
    };

    champion.direction = normalizedDir;
    champion.consumeRecast('Q');

    Logger.champion.debug(
      `${champion.playerId} recast Black Arrow - dashing to (${hitPosition.x.toFixed(0)}, ${hitPosition.y.toFixed(0)})`
    );

    return { success: true };
  }
}
