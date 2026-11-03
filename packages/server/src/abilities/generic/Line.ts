/**
 * Generic line (a `ground_target` with shape 'line'): damage and effects on
 * every enemy in a straight band from the caster toward the target, `range`
 * long and twice `aoeRadius` wide (a spear thrust). With aoeDelay it lands
 * later, on the band where the cast was (where clients draw its warning),
 * even if the caster moved since (Elora's barrage after a roll or a Flash).
 */

import {
  calculateAbilityValue,
  canAbilityAffectEntityType,
  type AbilityDefinition,
  type Vector,
} from "@siege/shared";
import type { AbilityCastParams } from "../../simulation/ServerAbilityExecutor";
import type { ServerGameContext } from "../../game/ServerGameContext";
import type { ServerEntity } from "../../simulation/ServerEntity";
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

  const from = champion.position.clone();
  const applyLine = () => applyLineArea(params, definition, from, direction, damageAmount);
  if (definition.aoeDelay && definition.aoeDelay > 0) {
    context.schedule(definition.aoeDelay, applyLine);
  } else {
    applyLine();
  }
}

/**
 * Damage and effects on enemies in the band from `from` (where the caster
 * stood at the cast) along `direction`.
 */
function applyLineArea(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  from: Vector,
  direction: Vector,
  damageAmount: number
): void {
  const { champion, context } = params;
  if (champion.isDead) return;

  const band = { from, direction, length: definition.range ?? 300, halfWidth: definition.aoeRadius ?? 30 };
  for (const entity of entitiesInBand(context, band)) {
    if (entity.side === champion.side || entity.isDead || entity.id === champion.id) continue;
    if (!canAbilityAffectEntityType(definition, entity.entityType)) continue;

    if (damageAmount > 0 && definition.damage) {
      entity.takeDamage(damageAmount, definition.damage.type, champion.id, context);
    }
    if (definition.appliesEffects) {
      applyEffectsToEntity(entity, definition.appliesEffects, definition.effectDuration ?? 0, champion.id);
    }
  }
}

/** A straight band: from a point along a unit direction, `length` long, twice `halfWidth` wide */
export interface Band {
  from: Vector;
  direction: Vector;
  length: number;
  halfWidth: number;
}

/**
 * Every entity touching the band, counting its body (Lume's beams use it
 * too). Callers filter sides and types.
 */
export function entitiesInBand(context: ServerGameContext, band: Band): ServerEntity[] {
  const { from, direction, length, halfWidth } = band;
  const middle = from.added(direction.scaled(length / 2));
  return context.getEntitiesInRadius(middle, length / 2 + halfWidth + 60).filter(entity => {
    const toEntity = entity.position.subtracted(from);
    const along = toEntity.x * direction.x + toEntity.y * direction.y;
    const across = Math.abs(toEntity.x * direction.y - toEntity.y * direction.x);
    const radius = entity.getRadius();
    return along >= -radius && along <= length + radius && across <= halfWidth + radius;
  });
}
