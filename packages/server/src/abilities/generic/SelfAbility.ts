/**
 * Generic `self` path: a shield and effects on the caster, or a stat
 * transform when the ability has a statTransform.
 */

import { calculateAbilityValue, type AbilityDefinition } from "@siege/shared";
import type { AbilityCastParams } from "../../simulation/ServerAbilityExecutor";
import { getScalingStats } from "./AbilityHelpers";
import { executeStatTransform } from "./StatTransform";

/**
 * Execute a self-targeted ability.
 */
export function executeSelfAbility(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number
): void {
  const { champion } = params;
  // Read before the transform too: getStats() refreshes champion.maxHealth,
  // which caps the transform's bonus health heal
  const stats = champion.getStats();

  // Handle stat transform (like Vile's R)
  if (definition.statTransform) {
    executeStatTransform(params, definition, rank);
    return;
  }

  // Apply shield
  if (definition.shield) {
    const shieldAmount = calculateAbilityValue(definition.shield.scaling, rank, getScalingStats(champion, stats));

    champion.shields.push({
      amount: shieldAmount,
      remainingDuration: definition.shield.duration,
      sourceId: definition.id,
      shieldType: 'normal',
    });
  }

  // Apply effects
  if (definition.appliesEffects) {
    for (const effectId of definition.appliesEffects) {
      champion.applyEffect(
        effectId,
        definition.effectDuration ?? 0,
        champion.id
      );
    }
  }
}
