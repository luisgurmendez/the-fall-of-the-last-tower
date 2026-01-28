/**
 * LumeEHandler - Dazzle Step
 *
 * Dash toward the Light Orb's current position.
 *
 * ON ARRIVAL (within 50 units of orb):
 * - Nearby enemies are blinded
 * - Blind causes auto-attacks to miss
 *
 * DASH PROPERTIES:
 * - Speed: 1200 units/s
 * - Max distance: 600 units
 * - Stops at orb if within range
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityValidationResult,
  AbilityExecutionResult,
} from '../../IAbilityHandler';
import { ServerLightOrb, LUME_ORB_CONFIG } from '../../../simulation/ServerLightOrb';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { Logger } from '../../../utils/Logger';

export class LumeEHandler extends BaseAbilityHandler {
  readonly abilityId = 'lume_e';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    const { champion, context } = params;

    const orb = this.getOrb(champion, context);
    if (!orb || orb.isDestroyed) {
      return { valid: false, reason: 'orb_destroyed', customMessage: 'Light Orb is destroyed' };
    }

    return { valid: true };
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank } = params;

    const orb = this.getOrb(champion, context);
    if (!orb || orb.isDestroyed) {
      Logger.debug('Ability', 'Lume E failed - orb is destroyed');
      return { success: false };
    }

    // Calculate dash direction toward orb
    const direction = orb.position.subtracted(champion.position);
    const maxDashDistance = definition.dash?.distance ?? 600;
    const distance = Math.min(direction.length(), maxDashDistance);

    if (distance < 10) {
      // Already at orb - just apply blind
      this.applyBlindEffect(champion, orb.position, definition, rank, context);
      return { success: true };
    }

    const normalizedDir = direction.normalized();
    const dashSpeed = definition.dash?.speed ?? 1200;

    // Set up the dash
    champion.forcedMovement = {
      direction: normalizedDir,
      distance,
      duration: distance / dashSpeed,
      elapsed: 0,
      type: 'dash',
      hitEntities: new Set(),
    };

    // Update facing direction
    champion.direction = normalizedDir;

    // Schedule blind effect check on dash completion
    const blindDelay = distance / dashSpeed;
    setTimeout(() => {
      const currentOrb = this.getOrb(champion, context);
      if (currentOrb && champion.position.distanceTo(currentOrb.position) <= 50) {
        this.applyBlindEffect(champion, currentOrb.position, definition, rank, context);
      }
    }, blindDelay * 1000);

    Logger.champion.debug(`${champion.playerId} dashed toward Light Orb`);

    return { success: true };
  }

  // =============================================================================
  // Blind Effect
  // =============================================================================

  private applyBlindEffect(
    champion: ServerChampion,
    position: import('@siege/shared').Vector,
    definition: import('@siege/shared').AbilityDefinition,
    rank: number,
    context: ServerGameContext
  ): void {
    const blindRadius = LUME_ORB_CONFIG.eBlindRadius;
    const blindDuration = Array.isArray(definition.effectDuration)
      ? definition.effectDuration[rank - 1]
      : definition.effectDuration ?? 1.0;

    const enemies = context.getEntitiesInRadius(position, blindRadius);

    for (const entity of enemies) {
      if (entity.side === champion.side) continue;
      if (entity.isDead) continue;

      this.applyEffects(entity, ['blind'], blindDuration, champion.id);
    }

    Logger.debug('Ability', `Lume E blinded enemies for ${blindDuration}s`);
  }

  // =============================================================================
  // Light Orb Helper
  // =============================================================================

  private getOrb(champion: ServerChampion, context: ServerGameContext): ServerLightOrb | null {
    for (const entity of context.getAllEntities()) {
      if (entity instanceof ServerLightOrb && entity.ownerId === champion.id) {
        return entity;
      }
    }
    return null;
  }
}
