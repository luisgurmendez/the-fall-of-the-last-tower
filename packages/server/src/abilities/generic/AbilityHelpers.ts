/**
 * Helpers shared by the generic ability paths.
 */

import type { ChampionStats } from "@siege/shared";
import type { ServerChampion } from "../../simulation/ServerChampion";
import type { ServerEntity } from "../../simulation/ServerEntity";

/**
 * Caster stats that ability damage, heal and shield scaling reads.
 */
export interface ScalingStats {
  attackDamage: number;
  abilityPower: number;
  bonusHealth: number;
  maxHealth: number;
}

/**
 * Get the scaling stats for a champion from its current stats.
 */
export function getScalingStats(champion: ServerChampion, stats: ChampionStats): ScalingStats {
  return {
    attackDamage: stats.attackDamage,
    abilityPower: stats.abilityPower,
    bonusHealth: stats.maxHealth - champion.definition.baseStats.health,
    maxHealth: stats.maxHealth,
  };
}

/**
 * Apply effects to an entity. Entities that can't hold effects are skipped.
 */
export function applyEffectsToEntity(
  entity: ServerEntity,
  effectIds: string[],
  duration: number,
  sourceId: string
): void {
  if (!("applyEffect" in entity)) return;

  const applyEffect = (
    entity as {
      applyEffect: (id: string, duration: number, sourceId?: string) => void;
    }
  ).applyEffect;

  for (const effectId of effectIds) {
    applyEffect.call(entity, effectId, duration, sourceId);
  }
}
