/**
 * Generic `ground_target` path, in order of precedence (traps are placed by
 * their ability's handler, VileEHandler):
 *
 * - A cone hits enemies in front of the caster (Cone.ts)
 * - A line hits enemies along a band toward the target (Line.ts)
 * - A dash with no aoeRadius is only the dash (run after this path)
 * - Otherwise a circle at the target position: damage and effects on enemies,
 *   or a persistent ServerZone when the ability has a zoneDuration
 * - With aoeDelay the circle, zone or cone lands later (scheduled on game time)
 */

import {
  calculateAbilityValue,
  canAbilityAffectEntityType,
  type AbilityDefinition,
} from "@siege/shared";
import type { AbilityCastParams } from "../../simulation/ServerAbilityExecutor";
import { ServerZone, type ZoneEffectType } from "../../simulation/ServerZone";
import { getScalingStats, applyEffectsToEntity } from "./AbilityHelpers";
import { executeConeAbility } from "./Cone";
import { executeLineAbility } from "./Line";

/**
 * Execute a ground-targeted ability.
 */
export function executeGroundTarget(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number,
  damageMultiplier: number = 1.0
): void {
  const { targetPosition, context } = params;

  if (!targetPosition) return;

  // Handle cone-shaped abilities
  if (definition.shape === "cone" && definition.coneAngle) {
    executeConeAbility(params, definition, rank, damageMultiplier);
    return;
  }

  // Handle line-shaped abilities (a thrust, not a projectile)
  if (definition.shape === "line") {
    executeLineAbility(params, definition, rank, damageMultiplier);
    return;
  }

  // A dash to a point with no area is just the dash (Movement.ts), its
  // buffs on the caster: no circle lands at the point (Elora's roll)
  if (definition.dash && !definition.aoeRadius) return;

  // Delayed AoE (like meteor): lands at the target point after aoeDelay
  if (definition.aoeDelay && definition.aoeDelay > 0) {
    const landing = { ...params, targetPosition: targetPosition.clone() };
    context.schedule(definition.aoeDelay, () => {
      executeCircleAoE(landing, definition, rank, damageMultiplier);
    });
    return;
  }

  // Default: immediate circular AoE
  executeCircleAoE(params, definition, rank, damageMultiplier);
}

/**
 * Execute a circular AoE at a position.
 */
function executeCircleAoE(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number,
  damageMultiplier: number = 1.0
): void {
  const { champion, targetPosition, context } = params;

  if (!targetPosition) return;

  const stats = champion.getStats();
  const radius = definition.aoeRadius ?? 200;

  // If this is a zone ability (has zoneDuration), create a persistent zone
  if (definition.zoneDuration && definition.zoneDuration > 0) {
    createZone(params, definition, rank, damageMultiplier);
    return;
  }

  // Get entities in the AoE
  const entities = context.getEntitiesInRadius(targetPosition, radius);

  // Calculate damage (with passive multiplier)
  let damageAmount = 0;
  if (definition.damage) {
    damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;
  }

  // Apply to enemies
  for (const entity of entities) {
    if (entity.side === champion.side) continue;
    if (entity.isDead) continue;

    // Check if ability can affect this entity type
    if (!canAbilityAffectEntityType(definition, entity.entityType)) {
      continue;
    }

    // Apply damage
    if (damageAmount > 0 && definition.damage) {
      entity.takeDamage(damageAmount, definition.damage.type, champion.id, context);
    }

    // Apply effects
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

/**
 * Create a persistent zone at target position.
 */
function createZone(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number,
  damageMultiplier: number = 1.0
): void {
  const { champion, targetPosition, context } = params;

  if (!targetPosition) return;

  const stats = champion.getStats();
  const radius = definition.aoeRadius ?? 200;

  // Calculate damage per tick (with passive multiplier)
  let damageAmount = 0;
  if (definition.damage) {
    damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;
  }

  // Determine zone type for visual
  let zoneType: ZoneEffectType = 'slow';
  if (damageAmount > 0) {
    zoneType = 'damage';
  } else if (definition.heal) {
    zoneType = 'heal';
  }

  // Create the zone
  const zone = new ServerZone({
    id: context.generateEntityId(),
    position: targetPosition.clone(),
    side: champion.side,
    radius,
    duration: definition.zoneDuration ?? 2,
    sourceId: champion.id,
    abilityId: definition.id,
    zoneType,
    damage: damageAmount,
    damageType: definition.damage?.type ?? 'magic',
    appliesEffects: definition.appliesEffects,
    effectDuration: definition.effectDuration ?? 0,
    tickRate: definition.zoneTickRate ?? 0,
  });

  context.addEntity(zone);
}
