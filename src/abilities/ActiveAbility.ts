/**
 * Base class for active abilities.
 *
 * Active abilities are manually cast by the player (or AI),
 * consume mana, and have cooldowns.
 */

import type { Champion } from '@/champions/Champion';
import type GameContext from '@/core/gameContext';
import Vector from '@/physics/vector';
import Ability from './Ability';
import {
  AbilityDefinition,
  AbilityCastContext,
  AbilityCastResult,
  AbilitySlot,
  AbilityTargetType,
  AbilityAIConditions,
} from './types';

/**
 * Abstract base class for active abilities.
 */
abstract class ActiveAbility extends Ability {
  /** AI conditions for when to cast this ability */
  protected aiConditions: AbilityAIConditions;

  constructor(
    definition: AbilityDefinition,
    slot: AbilitySlot,
    aiConditions: AbilityAIConditions = {}
  ) {
    super(definition, slot);
    this.aiConditions = aiConditions;
  }

  /**
   * Get the target type for this ability.
   */
  get targetType(): AbilityTargetType {
    return this.definition.targetType;
  }

  /**
   * Get the cast range.
   */
  get range(): number {
    return this.definition.range ?? 0;
  }

  /**
   * Get the area of effect radius.
   */
  get aoeRadius(): number {
    return this.definition.aoeRadius ?? 0;
  }

  /**
   * Check if a target is valid for this ability.
   */
  isValidTarget(target: Champion | null, targetPosition: Vector | null): boolean {
    switch (this.targetType) {
      case 'self':
      case 'no_target':
        return true;

      case 'target_enemy':
        return target !== null && target.getSide() !== this.owner?.getSide();

      case 'target_ally':
        return target !== null && target.getSide() === this.owner?.getSide();

      case 'target_unit':
        return target !== null;

      case 'skillshot':
      case 'ground_target':
        return targetPosition !== null;

      case 'toggle':
        return true;

      case 'aura':
        return true;

      default:
        return false;
    }
  }

  /**
   * Additional validation for targeted abilities.
   */
  protected override onCanCast(context: AbilityCastContext): AbilityCastResult {
    // Validate target based on ability type
    if (!this.isValidTarget(context.targetUnit ?? null, context.targetPosition ?? null)) {
      return { success: false, failReason: 'invalid_target' };
    }

    return { success: true };
  }

  /**
   * Check if the AI should cast this ability.
   */
  shouldAICast(context: {
    caster: Champion;
    nearbyEnemies: Champion[];
    nearbyAllies: Champion[];
    primaryTarget: Champion | null;
  }): boolean {
    if (!this.isLearned || this.isOnCooldown) {
      return false;
    }

    const { caster, nearbyEnemies, nearbyAllies, primaryTarget } = context;
    const conditions = this.aiConditions;
    const stats = caster.getStats();

    // Check mana
    if (conditions.minManaPercent !== undefined) {
      const manaPercent = stats.resource / stats.maxResource;
      if (manaPercent < conditions.minManaPercent) {
        return false;
      }
    }

    // Check caster health
    if (conditions.minHealthPercent !== undefined) {
      const healthPercent = stats.health / stats.maxHealth;
      if (healthPercent < conditions.minHealthPercent) {
        return false;
      }
    }

    if (conditions.maxHealthPercent !== undefined) {
      const healthPercent = stats.health / stats.maxHealth;
      if (healthPercent > conditions.maxHealthPercent) {
        return false;
      }
    }

    // Check enemies in range
    if (conditions.minEnemiesInRange !== undefined) {
      const enemiesInRange = this.countUnitsInRange(caster, nearbyEnemies);
      if (enemiesInRange < conditions.minEnemiesInRange) {
        return false;
      }
    }

    // Check allies in range
    if (conditions.minAlliesInRange !== undefined) {
      const alliesInRange = this.countUnitsInRange(caster, nearbyAllies);
      if (alliesInRange < conditions.minAlliesInRange) {
        return false;
      }
    }

    // Check target health (for targeted abilities)
    if (primaryTarget && conditions.targetMaxHealthPercent !== undefined) {
      const targetHealthPercent = primaryTarget.getStats().health / primaryTarget.getStats().maxHealth;
      if (targetHealthPercent > conditions.targetMaxHealthPercent) {
        return false;
      }
    }

    if (primaryTarget && conditions.targetMinHealthPercent !== undefined) {
      const targetHealthPercent = primaryTarget.getStats().health / primaryTarget.getStats().maxHealth;
      if (targetHealthPercent < conditions.targetMinHealthPercent) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get AI priority for casting this ability.
   */
  getAIPriority(): number {
    return this.aiConditions.priority ?? 0;
  }

  /**
   * Count units within ability range.
   */
  private countUnitsInRange(caster: Champion, units: Champion[]): number {
    const range = this.range || Infinity;
    const casterPos = caster.getPosition();

    return units.filter(unit =>
      casterPos.distanceTo(unit.getPosition()) <= range
    ).length;
  }

  /**
   * Handle toggle abilities.
   */
  toggleAbility(): boolean {
    if (this.targetType !== 'toggle') {
      return false;
    }

    if (!this.isLearned) {
      return false;
    }

    this.toggle();
    return true;
  }

  /**
   * Abstract: implement the ability's effect.
   */
  protected abstract execute(context: AbilityCastContext): void;
}

export default ActiveAbility;
