/**
 * LumeRHandler - Beaconfall
 *
 * The Light Orb explodes at its current position.
 *
 * EXPLOSION:
 * - Large area magic damage
 * - 40% slow for 2 seconds
 * - Centered on orb's current position
 *
 * CONSEQUENCE:
 * - The orb is destroyed
 * - All orb-related abilities (Q, W, E) become unusable
 * - Passive aura effects stop
 * - Orb respawns after 60 seconds
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

export class LumeRHandler extends BaseAbilityHandler {
  readonly abilityId = 'lume_r';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    const { champion, context } = params;

    const orb = this.getOrb(champion, context);
    if (!orb || orb.isDestroyed) {
      return { valid: false, reason: 'orb_destroyed', customMessage: 'Light Orb is destroyed' };
    }

    return { valid: true };
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context, definition, rank, damageMultiplier } = params;

    const orb = this.getOrb(champion, context);
    if (!orb || orb.isDestroyed) {
      Logger.debug('Ability', 'Lume R failed - orb is destroyed');
      return { success: false };
    }

    const explosionPosition = orb.position.clone();

    // Calculate damage
    const damageAmount = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const damageType = definition.damage?.type ?? 'magic';
    const explosionRadius = definition.aoeRadius ?? LUME_ORB_CONFIG.rExplosionRadius;

    // Get slow duration
    const slowDuration = Array.isArray(definition.effectDuration)
      ? definition.effectDuration[rank - 1]
      : definition.effectDuration ?? 2.0;

    // Get enemies in explosion radius
    const enemies = this.getAffectedEnemies(
      explosionPosition,
      explosionRadius,
      champion,
      definition,
      context
    );

    for (const entity of enemies) {
      // Deal damage
      this.dealDamage(entity, damageAmount, damageType, champion.id, context);

      // Apply slow
      if (definition.appliesEffects) {
        this.applyEffects(entity, definition.appliesEffects, slowDuration, champion.id);
      }
    }

    // Destroy the orb
    orb.destroy();

    Logger.champion.info(
      `${champion.playerId} cast Beaconfall - dealt ${damageAmount.toFixed(0)} damage, orb destroyed`
    );

    return { success: true };
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
