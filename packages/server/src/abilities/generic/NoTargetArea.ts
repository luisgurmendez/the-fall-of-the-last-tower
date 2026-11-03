/**
 * Generic `no_target` path: an area around the caster.
 *
 * - Damage and debuffs (anything not in the 'buff' category) hit enemies
 * - Heals and buffs go to allies; buffs also go to the caster right away
 * - The area is centered where the caster stood when casting, and with
 *   aoeDelay it lands later (scheduled on game time) unless the caster died
 */

import {
  calculateAbilityValue,
  canAbilityAffectEntityType,
  type AbilityDefinition,
  type Vector,
} from "@siege/shared";
import type { AbilityCastParams } from "../../simulation/ServerAbilityExecutor";
import { getServerEffectById } from "../../data/effects";
import { getScalingStats, applyEffectsToEntity } from "./AbilityHelpers";

/**
 * Execute a no-target ability (AoE around self).
 */
export function executeNoTargetAbility(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  rank: number,
  damageMultiplier: number = 1.0
): void {
  const { champion, context } = params;
  const stats = champion.getStats();

  const radius = definition.aoeRadius ?? 300;

  // Calculate damage if applicable (with passive multiplier)
  let damageAmount = 0;
  if (definition.damage) {
    damageAmount = calculateAbilityValue(definition.damage.scaling, rank, getScalingStats(champion, stats)) * damageMultiplier;
  }

  // Calculate heal if applicable
  let healAmount = 0;
  if (definition.heal) {
    healAmount = calculateAbilityValue(definition.heal.scaling, rank, getScalingStats(champion, stats));
  }

  // Buffs go to the caster and allies, debuffs (slows, taunts, knockups) to enemies
  const { buffs, debuffs } = splitEffects(definition.appliesEffects ?? []);
  const effectDuration = definition.effectDuration ?? 0;

  if (buffs.length > 0) {
    applyEffectsToEntity(champion, buffs, effectDuration, champion.id);
  }

  // The area is where the caster stood when casting; with aoeDelay it lands later
  const center = champion.position.clone();
  const applyArea = () => {
    if (!champion.isDead) applyNoTargetArea(params, definition, center, radius, damageAmount, healAmount, buffs, debuffs);
  };
  if (definition.aoeDelay && definition.aoeDelay > 0) {
    context.schedule(definition.aoeDelay, applyArea);
  } else {
    applyArea();
  }
}

/**
 * Split effect IDs into buffs and the rest (debuffs and crowd control).
 */
function splitEffects(effectIds: string[]): { buffs: string[]; debuffs: string[] } {
  const buffs: string[] = [];
  const debuffs: string[] = [];
  for (const effectId of effectIds) {
    if (getServerEffectById(effectId)?.category === 'buff') buffs.push(effectId);
    else debuffs.push(effectId);
  }
  return { buffs, debuffs };
}

/**
 * Damage, debuff, heal and buff everything around a point for a no_target ability.
 */
function applyNoTargetArea(
  params: AbilityCastParams,
  definition: AbilityDefinition,
  center: Vector,
  radius: number,
  damageAmount: number,
  healAmount: number,
  buffs: string[],
  debuffs: string[]
): void {
  const { champion, context } = params;
  const effectDuration = definition.effectDuration ?? 0;
  const entities = context.getEntitiesInRadius(center, radius);

  for (const entity of entities) {
    if (entity.id === champion.id) continue;

    const isEnemy = entity.side !== champion.side;
    const isAlly = entity.side === champion.side;

    // Check if ability can affect this entity type (allies too: heals and buffs never reach structures)
    if (!canAbilityAffectEntityType(definition, entity.entityType)) {
      continue;
    }

    // Apply damage to enemies
    if (isEnemy && damageAmount > 0 && definition.damage) {
      entity.takeDamage(damageAmount, definition.damage.type, champion.id, context);
    }

    // Apply debuffs to enemies (stun, slow, taunt), whether or not the ability does damage
    if (isEnemy && debuffs.length > 0) {
      applyEffectsToEntity(entity, debuffs, effectDuration, champion.id);
    }

    // Apply healing to allies
    if (isAlly && healAmount > 0) {
      if ("heal" in entity && typeof entity.heal === "function") {
        entity.heal(healAmount, context, champion.id);
      }
    }

    // Apply buffs to allies (like the speed buff from Elara's E)
    if (isAlly && buffs.length > 0) {
      applyEffectsToEntity(entity, buffs, effectDuration, champion.id);
    }
  }
}
