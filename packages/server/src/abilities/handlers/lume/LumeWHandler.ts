/**
 * LumeWHandler - Warmth
 *
 * The Light Orb pulses with warmth:
 * - Allied champions are healed
 * - Enemy champions take magic damage
 *
 * Effect centered on orb's current position.
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

export class LumeWHandler extends BaseAbilityHandler {
  readonly abilityId = 'lume_w';

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
      Logger.debug('Ability', 'Lume W failed - orb is destroyed');
      return { success: false };
    }

    // Calculate damage and heal
    const damageAmount = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const healAmount = this.calculateHeal(definition, rank, champion);
    const damageType = definition.damage?.type ?? 'magic';
    const pulseRadius = definition.aoeRadius ?? LUME_ORB_CONFIG.wPulseRadius;

    // Get entities in range of orb
    const entities = params.context.getEntitiesInRadius(orb.position, pulseRadius);

    for (const entity of entities) {
      if (entity.isDead) continue;

      const isAlly = entity.side === champion.side;

      if (isAlly && healAmount > 0) {
        // Heal allies (including Lume)
        this.healEntity(entity, healAmount);
      } else if (!isAlly && damageAmount > 0) {
        // Damage enemies
        this.dealDamage(entity, damageAmount, damageType, champion.id, context);
      }
    }

    Logger.champion.debug(
      `${champion.playerId} cast Warmth - healed ${healAmount.toFixed(0)}, dealt ${damageAmount.toFixed(0)}`
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
