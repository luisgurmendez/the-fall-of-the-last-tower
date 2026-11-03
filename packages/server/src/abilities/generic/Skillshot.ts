/**
 * Generic `skillshot` path: fire a projectile toward the target position.
 *
 * - The projectile spawns at the ability animation's projectile keyframe
 *   (scheduled on the champion), or right away without one
 * - Charge abilities gain range with charge time, and their damage goes from
 *   minChargeMultiplier to maxChargeMultiplier (1 when not given)
 * - Skillshots with a dash fire nothing; the dash carries the ability
 * - A projectile hit can enable a recast (see ServerProjectile)
 */

import {
  calculateAbilityValue,
  hasChargeBehavior,
  type AbilityDefinition,
  type DamageType,
  getCastTime,
} from "@siege/shared";
import type { AbilityCastParams } from "../../simulation/ServerAbilityExecutor";
import { ServerProjectile } from "../../simulation/ServerProjectile";
import { Logger } from "../../utils/Logger";
import { getScalingStats } from "./AbilityHelpers";

/**
 * Execute a skillshot ability.
 */
export function executeSkillshot(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number,
  damageMultiplier: number = 1.0
): void {
  const { champion, targetPosition, context } = params;

  if (!targetPosition) return;

  // If this ability has a dash, skip projectile - the dash handles damage
  // The dash is executed separately, after the target type path
  if (definition.dash) {
    return;
  }

  const stats = champion.getStats();

  // Calculate direction
  const direction = targetPosition.subtracted(champion.position);
  if (direction.length() < 0.1) {
    // If target is too close, use champion's facing direction
    direction.x = champion.direction.x;
    direction.y = champion.direction.y;
  }

  // Calculate damage (with passive multiplier)
  let damageAmount = 0;
  let damageType: DamageType = "physical";
  if (definition.damage) {
    damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;
    damageType = definition.damage.type;
  }

  const projectileDelay = getProjectileDelay(params, definition);
  const effectiveRange = getEffectiveRange(params, definition);
  damageAmount *= getChargeDamageMultiplier(params, definition);

  // Prepare projectile config
  const projectileConfig = {
    direction: direction.normalized(),
    speed: definition.projectileSpeed ?? 1000,
    radius: definition.projectileRadius ?? 30,
    maxDistance: effectiveRange,
    damage: damageAmount,
    damageType,
    piercing: definition.piercing ?? false,
    appliesEffects: definition.appliesEffects,
    effectDuration: definition.effectDuration,
  };

  if (projectileDelay > 0) {
    // Schedule projectile spawn at keyframe time
    champion.scheduleAbilityProjectile(definition.id, projectileDelay, projectileConfig);
  } else {
    // No animation delay - spawn immediately (fallback for abilities without animations)
    const projectile = new ServerProjectile({
      id: context.generateEntityId(),
      position: champion.position.clone(),
      side: champion.side,
      direction: projectileConfig.direction,
      speed: projectileConfig.speed,
      radius: projectileConfig.radius,
      maxDistance: projectileConfig.maxDistance,
      sourceId: champion.id,
      abilityId: definition.id,
      damage: projectileConfig.damage,
      damageType: projectileConfig.damageType,
      piercing: projectileConfig.piercing,
      appliesEffects: projectileConfig.appliesEffects,
      effectDuration: projectileConfig.effectDuration,
    });

    context.addEntity(projectile);
  }
}

/**
 * Seconds until the ability animation's projectile keyframe (0 without one).
 */
function getProjectileDelay(params: AbilityCastParams, definition: AbilityDefinition): number {
  const { champion } = params;

  // Check if ability has animation with projectile keyframe
  const abilityAnimation = champion.definition.animations?.abilities?.[definition.id];
  let projectileDelay = 0;

  if (abilityAnimation) {
    // Find the projectile keyframe
    const projectileKeyframe = abilityAnimation.keyframes.find(
      k => k.trigger.type === 'projectile'
    );
    if (projectileKeyframe) {
      // Calculate delay based on animation timing
      projectileDelay = projectileKeyframe.frame * abilityAnimation.baseFrameDuration;
    }
  }

  // The cast time already waited out the start of the animation (it began with ABILITY_WINDUP)
  return Math.max(0, projectileDelay - getCastTime(definition));
}

/**
 * How far along its charge the cast is (0 to 1), or null for one that
 * doesn't charge.
 */
function getChargeProgress(params: AbilityCastParams, definition: AbilityDefinition): number | null {
  if (!hasChargeBehavior(definition) || params.chargeTime === undefined) return null;
  const { minChargeTime, maxChargeTime } = definition.charge;
  if (maxChargeTime <= minChargeTime) return 1;
  return Math.max(0, Math.min(1, (params.chargeTime - minChargeTime) / (maxChargeTime - minChargeTime)));
}

/**
 * The charge's damage multiplier, from its minChargeMultiplier to its
 * maxChargeMultiplier (1 without a charge).
 */
function getChargeDamageMultiplier(params: AbilityCastParams, definition: AbilityDefinition): number {
  const chargeProgress = getChargeProgress(params, definition);
  if (chargeProgress === null) return 1;
  const min = definition.charge!.minChargeMultiplier ?? 1;
  const max = definition.charge!.maxChargeMultiplier ?? 1;
  return min + (max - min) * chargeProgress;
}

/**
 * Projectile range, with the charge bonus if applicable.
 */
function getEffectiveRange(params: AbilityCastParams, definition: AbilityDefinition): number {
  const { champion } = params;
  let effectiveRange = definition.range ?? 800;

  const chargeProgress = getChargeProgress(params, definition);
  if (chargeProgress !== null) {
    const charge = definition.charge!;

    // Apply range bonus based on charge progress
    if (charge.maxChargeRangeBonus) {
      effectiveRange += charge.maxChargeRangeBonus * chargeProgress;
      Logger.champion.debug(
        `${champion.playerId} charged ${definition.id} for ${params.chargeTime!.toFixed(2)}s ` +
        `(${(chargeProgress * 100).toFixed(0)}%), range: ${effectiveRange.toFixed(0)}`
      );
    }
  }

  return effectiveRange;
}
