/**
 * Generic movement: dashes, teleports and the generic recast dash.
 *
 * - Dashes and teleports go to the target position, or else to the target
 *   entity's position (for target_ally and target_unit)
 * - A target_enemy dash is a leap at the enemy (leapToTarget): it follows
 *   it, over walls, and its damage and effects land when it reaches it,
 *   on it alone
 * - A dash applies its self-buffs (effects in the 'buff' category) on cast;
 *   the other effects, and damage if the ability has an aoeRadius, hit what
 *   the dash runs into
 * - A teleport is instant and clamped to the ability's range
 * - The generic recast dashes to where the ability's projectile hit
 * - Every dash sets the champion's dashAbilityId, so clients draw it as one
 */

import { calculateAbilityValue, GameEventType, type AbilityDefinition, type Vector } from "@siege/shared";
import type { AbilityCastParams } from "../../simulation/ServerAbilityExecutor";
import type { ServerChampion } from "../../simulation/ServerChampion";
import { getServerEffectById } from "../../data/effects";
import { getScalingStats } from "./AbilityHelpers";
import { executeTargetEnemyAbility } from "./TargetedAbility";

/** Whether an effect goes on the caster (a buff) rather than on what the dash hits */
function isSelfBuff(effectId: string): boolean {
  return getServerEffectById(effectId)?.category === 'buff';
}

/** Speed of the generic recast dash */
const RECAST_DASH_SPEED = 800;

/**
 * Dash toward the ability's destination, if it has one.
 */
export function dashToDestination(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number,
  damageMultiplier: number
): void {
  const destination = getDestination(params);
  if (destination) {
    executeDash({ ...params, targetPosition: destination }, definition, rank, damageMultiplier);
  }
}

/** A leap may fly this much farther than its dash distance, chasing a target that moves away */
const LEAP_CHASE = 120;

/**
 * Leap at the target enemy: fly at it wherever it moves (over walls) and,
 * landing next to it, hit it with the ability (its damage and effects, on
 * it alone) and tell clients (`<id>_land`, for its blow). Nothing happens at
 * the cast; a target that dies or gets away isn't hit.
 */
export function leapToTarget(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number,
  damageMultiplier: number
): void {
  const { champion, context, targetEntityId } = params;
  const target = targetEntityId ? context.getEntity(targetEntityId) : undefined;
  if (!target || !definition.dash) return;

  const reach = champion.getRadius() + target.getRadius();
  const offset = target.position.subtracted(champion.position);
  const direction = offset.length() > 0.1 ? offset.normalized() : champion.direction.clone();
  const gap = Math.max(0, offset.length() - reach);
  champion.forcedMovement = {
    direction,
    distance: gap,
    duration: gap / definition.dash.speed,
    elapsed: 0,
    type: "dash",
    passesWalls: true,
    follow: {
      targetId: target.id,
      reach,
      speed: definition.dash.speed,
      maxDistance: definition.dash.distance + LEAP_CHASE,
      flown: 0,
      gap,
      land: () => {
        executeTargetEnemyAbility(params, definition, rank, damageMultiplier);
        context.addEvent(GameEventType.ABILITY_CAST, {
          entityId: champion.id,
          abilityId: `${definition.id}_land`,
          targetEntityId: target.id,
          targetX: target.position.x,
          targetY: target.position.y,
        });
      },
    },
  };
  champion.dashAbilityId = definition.id;
  champion.direction = direction.clone();
}

/**
 * Teleport to the ability's destination, if it has one.
 */
export function teleportToDestination(params: AbilityCastParams, definition: AbilityDefinition): void {
  const destination = getDestination(params);
  if (destination) {
    executeTeleport({ ...params, targetPosition: destination }, definition);
  }
}

/**
 * Execute the recast dash to the hit position (e.g., Vile's Q dash to hit location).
 */
export function executeRecastDash(champion: ServerChampion, hitPosition: Vector, abilityId: string): void {
  const direction = hitPosition.subtracted(champion.position);
  const distance = direction.length();

  if (distance < 10) {
    // Already at the position
    return;
  }

  const normalizedDir = direction.normalized();

  champion.forcedMovement = {
    direction: normalizedDir,
    distance: distance,
    duration: distance / RECAST_DASH_SPEED,
    elapsed: 0,
    type: "dash",
    hitEntities: new Set(),
  };
  champion.dashAbilityId = abilityId;

  // Update facing direction
  champion.direction = normalizedDir;
}

/**
 * The target position, or else the target entity's position.
 */
function getDestination(params: AbilityCastParams): Vector | undefined {
  if (params.targetPosition) return params.targetPosition;
  if (!params.targetEntityId) return undefined;
  return params.context.getEntity(params.targetEntityId)?.position.clone();
}

/**
 * Execute a dash ability.
 */
function executeDash(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number,
  damageMultiplier: number
): void {
  const { champion, targetPosition } = params;

  if (!targetPosition || !definition.dash) return;

  const direction = targetPosition.subtracted(champion.position);
  if (direction.length() < 0.1) return;

  const normalizedDir = direction.normalized();
  const dashDistance = Math.min(direction.length(), definition.dash.distance);

  // Apply self-buff effects (like Elora's quickened attacks after her roll)
  // Check for effects that should be applied to caster (buff effects)
  if (definition.appliesEffects) {
    for (const effectId of definition.appliesEffects) {
      // Self-buffs (like vex_empowered) go on the caster
      if (isSelfBuff(effectId)) {
        champion.applyEffect(
          effectId,
          definition.effectDuration ?? 4,
          champion.id
        );
      }
    }
  }

  // Calculate damage for collision if ability has damage (with passive multiplier)
  // (Without an aoeRadius the dash hits nothing on the way)
  let damageAmount = 0;
  const dashHasDamageOnCollision = definition.damage && definition.aoeRadius;
  if (dashHasDamageOnCollision) {
    const stats = champion.getStats();
    damageAmount = calculateAbilityValue(definition.damage!.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;
  }

  champion.forcedMovement = {
    direction: normalizedDir,
    distance: dashDistance,
    duration: dashDistance / definition.dash.speed,
    elapsed: 0,
    type: "dash",
    // Collision data for dash abilities that damage/apply effects on hit
    hitbox: definition.aoeRadius ?? 60,
    damage: damageAmount,
    damageType: definition.damage?.type,
    // Only pass debuff effects to be applied on collision (not self-buffs)
    appliesEffects: definition.appliesEffects?.filter(e => !isSelfBuff(e)),
    effectDuration: definition.effectDuration,
    hitEntities: new Set(),
  };
  // So clients show it as a dash (the ability's frame of motion, afterimages)
  champion.dashAbilityId = definition.id;

  // Update facing direction
  champion.direction = normalizedDir;
}

/**
 * Execute a teleport/blink ability.
 */
function executeTeleport(params: AbilityCastParams, definition: AbilityDefinition): void {
  const { champion, targetPosition } = params;

  if (!targetPosition) return;

  // Clamp to range
  const direction = targetPosition.subtracted(champion.position);
  const maxRange = definition.range ?? 500;

  if (direction.length() > maxRange) {
    direction.normalize().scalar(maxRange);
  }

  const finalPosition = champion.position.added(direction);

  // Instant teleport
  champion.position.setFrom(finalPosition);
}
