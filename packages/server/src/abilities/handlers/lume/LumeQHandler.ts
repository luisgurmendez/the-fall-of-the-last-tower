/**
 * LumeQHandler - Send the Light
 *
 * Send the Light Orb to a target location.
 * - Orb travels at 1200 units/s
 * - Deals magic damage to enemies in a small area on arrival
 * - Orb stays stationed at location for 4 seconds
 *
 * RECAST: Recall the orb early (while traveling or stationed).
 */

import { Vector, canAbilityAffectEntityType } from '@siege/shared';
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

export class LumeQHandler extends BaseAbilityHandler {
  readonly abilityId = 'lume_q';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    const { champion, context } = params;

    // Check if we're recasting (orb is away)
    if (champion.hasRecastAvailable('Q')) {
      return { valid: true };
    }

    // For initial cast, orb must exist and not be destroyed
    const orb = this.getOrb(champion, context);
    if (orb && orb.isDestroyed) {
      return { valid: false, reason: 'orb_destroyed', customMessage: 'Light Orb is destroyed' };
    }

    return { valid: true };
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, targetPosition, context, definition, rank, damageMultiplier } = params;

    if (!targetPosition) {
      return { success: false };
    }

    // Get or create orb
    const orb = this.getOrCreateOrb(champion, context);
    if (!orb || orb.isDestroyed) {
      Logger.debug('Ability', 'Lume Q failed - orb is destroyed');
      return { success: false };
    }

    // Calculate damage
    const damageAmount = this.calculateDamage(definition, rank, champion, damageMultiplier);
    const damageType = definition.damage?.type ?? 'magic';

    // Send orb with arrival callback for damage
    orb.sendTo(targetPosition, () => {
      // Deal damage on arrival
      const enemies = this.getAffectedEnemies(
        orb.position,
        LUME_ORB_CONFIG.qImpactRadius,
        champion,
        definition,
        context
      );

      for (const entity of enemies) {
        this.dealDamage(entity, damageAmount, damageType, champion.id, context);
      }

      Logger.debug('Ability', `Lume Q arrived - dealt ${damageAmount.toFixed(0)} damage`);
    });

    // Enable recast for recall
    champion.abilityStates.Q.recastWindowRemaining = 10;
    champion.abilityStates.Q.recastCount = 1;

    // Update facing direction
    this.faceToward(champion, targetPosition);

    Logger.champion.debug(
      `${champion.playerId} sent Light Orb to (${targetPosition.x.toFixed(0)}, ${targetPosition.y.toFixed(0)})`
    );

    return { success: true };
  }

  canRecast(params: AbilityHandlerParams): boolean {
    const { champion, context } = params;

    const orb = this.getOrb(champion, context);
    if (!orb || orb.isDestroyed || orb.isOrbiting) {
      return false;
    }

    return champion.hasRecastAvailable('Q');
  }

  executeRecast(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, context } = params;

    const orb = this.getOrb(champion, context);
    if (!orb || orb.isDestroyed || orb.isOrbiting) {
      return { success: false };
    }

    orb.recall();
    champion.consumeRecast('Q');

    Logger.champion.debug(`${champion.playerId} recalled Light Orb`);

    return { success: true, skipCooldown: true, skipManaCost: true };
  }

  // =============================================================================
  // Light Orb Helpers
  // =============================================================================

  private getOrb(champion: ServerChampion, context: ServerGameContext): ServerLightOrb | null {
    for (const entity of context.getAllEntities()) {
      if (entity instanceof ServerLightOrb && entity.ownerId === champion.id) {
        return entity;
      }
    }
    return null;
  }

  private getOrCreateOrb(champion: ServerChampion, context: ServerGameContext): ServerLightOrb | null {
    let orb = this.getOrb(champion, context);
    if (!orb) {
      orb = new ServerLightOrb({
        id: context.generateEntityId(),
        position: champion.position.clone().add(new Vector(LUME_ORB_CONFIG.orbitRadius, 0)),
        side: champion.side,
        ownerId: champion.id,
      });
      // Type assertion needed due to ServerLightOrb inheritance issue
      context.addEntity(orb as unknown as import('../../../simulation/ServerEntity').ServerEntity);
      Logger.debug('Ability', `Created Light Orb for Lume (${champion.playerId})`);
    }
    return orb;
  }
}
