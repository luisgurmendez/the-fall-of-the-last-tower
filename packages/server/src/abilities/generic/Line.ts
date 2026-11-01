/**
 * Generic line (a `ground_target` with shape 'line'): damage and effects on
 * every enemy in a straight band from the caster toward the target, `range`
 * long and twice `aoeRadius` wide (a spear thrust). With aoeDelay it lands
 * later, from wherever the caster is then, still aimed where the cast was.
 */

import {
  calculateAbilityValue,
  canAbilityAffectEntityType,
  type AbilityDefinition,
  type Vector,
} from "@siege/shared";
import type { AbilityCastParams } from "../../simulation/ServerAbilityExecutor";
import { getScalingStats, applyEffectsToEntity } from "./AbilityHelpers";

/**
 * Execute a line-shaped ability.
 */
export function executeLineAbility(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number,
  damageMultiplier: number = 1.0
): void {
  const { champion, targetPosition, context } = params;
  if (!targetPosition) return;

  const direction = targetPosition.subtracted(champion.position).normalized();
  let damageAmount = 0;
  if (definition.damage) {
    damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, champion.getStats())) * damageMultiplier;
  }

  const applyLine = () => applyLineArea(params, definition, direction, damageAmount);
  if (definition.aoeDelay && definition.aoeDelay > 0) {
    context.schedule(definition.aoeDelay, applyLine);
  } else {
    applyLine();
  }
}

/**
 * Damage and effects on enemies in the band from the caster along `direction`.
 */
function applyLineArea(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  direction: Vector,
  damageAmount: number
): void {
  const { champion, context } = params;
  if (champion.isDead) return;

  const length = definition.range ?? 300;
  const halfWidth = definition.aoeRadius ?? 30;

  for (const entity of context.getEntitiesInRadius(champion.position, length + halfWidth)) {
    if (entity.side === champion.side || entity.isDead || entity.id === champion.id) continue;
    if (!canAbilityAffectEntityType(definition, entity.entityType)) continue;

    // Along the line and how far off it, counting the entity's body
    const toEntity = entity.position.subtracted(champion.position);
    const along = toEntity.x * direction.x + toEntity.y * direction.y;
    const across = Math.abs(toEntity.x * direction.y - toEntity.y * direction.x);
    const radius = entity.getRadius();
    if (along < -radius || along > length + radius || across > halfWidth + radius) continue;

    if (damageAmount > 0 && definition.damage) {
      entity.takeDamage(damageAmount, definition.damage.type, champion.id, context);
    }
    if (definition.appliesEffects) {
      applyEffectsToEntity(entity, definition.appliesEffects, definition.effectDuration ?? 0, champion.id);
    }
  }
}
