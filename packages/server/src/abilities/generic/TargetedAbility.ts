/**
 * Generic unit-targeted paths. castAbility has already validated the target
 * (side, range and, for enemies, entity type).
 *
 * - `target_enemy`: damage and effects on the enemy
 * - `target_ally`: heal, shield and effects on the ally
 */

import { calculateAbilityValue, type AbilityDefinition } from "@siege/shared";
import type { AbilityCastParams } from "../../simulation/ServerAbilityExecutor";
import type { ServerChampion } from "../../simulation/ServerChampion";
import { getScalingStats, applyEffectsToEntity } from "./AbilityHelpers";

/**
 * Execute a targeted enemy ability.
 */
export function executeTargetEnemyAbility(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number,
  damageMultiplier: number = 1.0
): void {
  const { champion, targetEntityId, context } = params;

  if (!targetEntityId) return;

  const target = context.getEntity(targetEntityId);
  if (!target || target.isDead) return;

  const stats = champion.getStats();

  // Calculate and apply damage (with passive multiplier)
  if (definition.damage) {
    const damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;

    target.takeDamage(damageAmount, definition.damage.type, champion.id, context);
  }

  // Apply effects
  if (definition.appliesEffects) {
    applyEffectsToEntity(
      target,
      definition.appliesEffects,
      definition.effectDuration ?? 0,
      champion.id
    );
  }
}

/**
 * Execute a targeted ally ability.
 */
export function executeTargetAllyAbility(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number
): void {
  const { champion, targetEntityId, context } = params;

  if (!targetEntityId) return;

  const target = context.getEntity(targetEntityId);
  if (!target || target.isDead) return;

  const stats = champion.getStats();

  // Apply healing
  if (
    definition.heal &&
    "heal" in target &&
    typeof target.heal === "function"
  ) {
    const healAmount = calculateAbilityValue(definition.heal.scaling, rank, getScalingStats(champion, stats));

    (target as { heal: (amount: number) => void }).heal(healAmount);
  }

  // Apply shield
  if (definition.shield && "shields" in target) {
    const shieldAmount = calculateAbilityValue(definition.shield.scaling, rank, getScalingStats(champion, stats));

    (target as ServerChampion).shields.push({
      amount: shieldAmount,
      remainingDuration: definition.shield.duration,
      sourceId: definition.id,
      shieldType: 'normal',
    });
  }

  // Apply effects
  if (definition.appliesEffects) {
    applyEffectsToEntity(
      target,
      definition.appliesEffects,
      definition.effectDuration ?? 0,
      champion.id
    );
  }
}
