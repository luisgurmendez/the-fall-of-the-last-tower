/**
 * VexDashHandler - Shadow Step
 *
 * Dash to target location and empower next basic attack.
 * If an enemy is marked (vex_mark), dash cooldown resets.
 *
 * SPECIAL MECHANICS:
 * - Applies 'vex_empowered' buff to self (not to enemies)
 * - Checks for marked enemies to reset cooldown
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityExecutionResult,
} from '../../IAbilityHandler';
import { Logger } from '../../../utils/Logger';

export class VexDashHandler extends BaseAbilityHandler {
  readonly abilityId = 'vex_dash';

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, targetPosition, context, definition, rank, damageMultiplier } = params;

    if (!targetPosition || !definition.dash) {
      return { success: false };
    }

    // Calculate dash direction
    const direction = targetPosition.subtracted(champion.position);
    if (direction.length() < 0.1) {
      return { success: false };
    }

    const normalizedDir = direction.normalized();
    const dashDistance = Math.min(direction.length(), definition.dash.distance);

    // Apply empowered attack buff to SELF (not enemies)
    if (definition.appliesEffects) {
      // Only apply buff effects to self
      this.applyBuffsToAlly(
        champion,
        definition.appliesEffects,
        definition.effectDuration ?? 4,
        champion.id
      );
    }

    // Set up the dash (damage applies on collision)
    const damageAmount = this.calculateDamage(definition, rank, champion, damageMultiplier);

    champion.forcedMovement = {
      direction: normalizedDir,
      distance: dashDistance,
      duration: dashDistance / definition.dash.speed,
      elapsed: 0,
      type: 'dash',
      hitbox: definition.aoeRadius ?? 60,
      damage: damageAmount,
      damageType: definition.damage?.type,
      // Only pass debuff effects to be applied on collision
      appliesEffects: definition.appliesEffects?.filter(
        e => !e.includes('_empowered') && !e.includes('_buff')
      ),
      effectDuration: definition.effectDuration,
      hitEntities: new Set(),
    };

    // Update facing direction
    champion.direction = normalizedDir;
    this.faceToward(champion, targetPosition);

    // Check for marked enemy - if found, signal cooldown reset
    const hasMarkedEnemy = this.checkForMarkedEnemy(params);

    Logger.champion.debug(
      `${champion.playerId} used Shadow Step${hasMarkedEnemy ? ' (cooldown reset - marked enemy)' : ''}`
    );

    return {
      success: true,
      cooldownOverride: hasMarkedEnemy ? 0 : undefined,
    };
  }

  /**
   * Check if there's an enemy with vex_mark effect nearby.
   */
  private checkForMarkedEnemy(params: AbilityHandlerParams): boolean {
    const { champion, context } = params;
    const checkRadius = 500; // Dash range + buffer

    const entities = context.getEntitiesInRadius(champion.position, checkRadius);

    for (const entity of entities) {
      if (entity.side === champion.side || entity.isDead) continue;

      // Check if entity has vex_mark effect
      if ('activeEffects' in entity) {
        const activeEffects = (entity as any).activeEffects as Array<{ definitionId: string }>;
        if (activeEffects?.some(e => e.definitionId === 'vex_mark')) {
          return true;
        }
      }
    }

    return false;
  }
}
