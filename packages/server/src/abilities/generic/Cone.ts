/**
 * Generic cone (a `ground_target` with shape 'cone' and a coneAngle):
 * damage and effects on enemies in a cone from the caster toward the target.
 * With aoeDelay it lands later (the swing), from wherever the caster is
 * then, still aimed where the cast was.
 */

import {
  calculateAbilityValue,
  canAbilityAffectEntityType,
  type AbilityDefinition,
} from "@siege/shared";
import type { AbilityCastParams } from "../../simulation/ServerAbilityExecutor";
import { getScalingStats, applyEffectsToEntity } from "./AbilityHelpers";

/**
 * Execute a cone-shaped ability.
 */
export function executeConeAbility(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number,
  damageMultiplier: number = 1.0
): void {
  const { champion, targetPosition, context } = params;

  if (!targetPosition) return;

  const stats = champion.getStats();

  // Direction from champion to target
  const direction = targetPosition.subtracted(champion.position).normalized();
  const dirAngle = Math.atan2(direction.y, direction.x);

  // Calculate damage (with passive multiplier)
  let damageAmount = 0;
  if (definition.damage) {
    damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;
  }

  const applyCone = () => applyConeArea(params, definition, dirAngle, damageAmount);
  if (definition.aoeDelay && definition.aoeDelay > 0) {
    context.schedule(definition.aoeDelay, applyCone);
  } else {
    applyCone();
  }
}

/**
 * Damage and effects on enemies in the cone from the caster along dirAngle.
 */
function applyConeArea(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  dirAngle: number,
  damageAmount: number
): void {
  const { champion, context } = params;
  if (champion.isDead) return;

  const radius = definition.aoeRadius ?? definition.range ?? 300;
  const coneAngle = definition.coneAngle ?? Math.PI / 2; // 90 degrees default

  // Get entities in range
  const entities = context.getEntitiesInRadius(champion.position, radius);

  for (const entity of entities) {
    if (entity.side === champion.side) continue;
    if (entity.isDead) continue;
    if (entity.id === champion.id) continue;

    // Check if ability can affect this entity type
    if (!canAbilityAffectEntityType(definition, entity.entityType)) {
      continue;
    }

    // Check if entity is in cone
    const toEntity = entity.position.subtracted(champion.position);
    const entityAngle = Math.atan2(toEntity.y, toEntity.x);
    const angleDiff = Math.abs(normalizeAngle(entityAngle - dirAngle));

    if (angleDiff <= coneAngle / 2) {
      // Entity is in cone
      if (damageAmount > 0 && definition.damage) {
        entity.takeDamage(damageAmount, definition.damage.type, champion.id, context);
      }

      if (definition.appliesEffects) {
        applyEffectsToEntity(
          entity,
          definition.appliesEffects,
          definition.effectDuration ?? 0,
          champion.id
        );
      }
    }
  }
}

/**
 * Normalize an angle to be within -PI to PI.
 */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}
