/**
 * ChampionStats - Effective stat calculation for a champion.
 *
 * Stats are built in this order:
 * 1. Base stats plus per-level growth
 * 2. Stat modifiers from abilities and passives (flat, then percent)
 * 3. Item stats
 * 4. Stat effects (buffs/debuffs), scaled by stacks
 *
 * This is a pure calculation. ServerChampion.getStats() caches the result
 * and copies maxHealth, maxResource and movementSpeed back onto the champion.
 */

import {
  calculateStat,
  calculateAttackSpeed,
  type ChampionBaseStats,
  type ChampionStats,
  type StatModifier,
} from '@siege/shared';
import {
  getServerItemById,
  type ServerItemDefinition,
} from '../../data/items';
import {
  getServerEffectById,
  isStatEffect,
  type ServerStatEffectDef,
} from '../../data/effects';
import type { ServerChampion } from '../ServerChampion';

/**
 * Map effect stat type to ChampionStats key.
 * Note: lifesteal/spell_vamp/penetration are not in ChampionStats, handled separately
 */
const EFFECT_STAT_KEYS: Record<string, keyof ChampionStats> = {
  'attack_damage': 'attackDamage',
  'ability_power': 'abilityPower',
  'armor': 'armor',
  'magic_resist': 'magicResist',
  'attack_speed': 'attackSpeed',
  'movement_speed': 'movementSpeed',
  'health_regen': 'healthRegen',
  'mana_regen': 'resourceRegen',
  'ability_haste': 'abilityHaste',
  'crit_chance': 'critChance',
  'crit_damage': 'critDamage',
};

/**
 * Calculate a champion's current stats (level, modifiers, items and effects).
 */
export function calculateChampionStats(
  champion: ServerChampion,
  modifiers: readonly StatModifier[]
): ChampionStats {
  const base = champion.definition.baseStats;
  const growth = champion.definition.growthStats;
  const level = champion.level;

  const stats: ChampionStats = {
    health: champion.health,
    maxHealth: calculateStat(base.health, growth.health, level),
    healthRegen: calculateStat(base.healthRegen, growth.healthRegen, level),
    resource: champion.resource,
    maxResource: calculateStat(base.resource, growth.resource, level),
    resourceRegen: calculateStat(base.resourceRegen, growth.resourceRegen, level),
    attackDamage: calculateStat(base.attackDamage, growth.attackDamage, level),
    abilityPower: base.abilityPower,
    attackSpeed: calculateAttackSpeed(base.attackSpeed, growth.attackSpeed, level),
    attackRange: base.attackRange,
    armor: calculateStat(base.armor, growth.armor, level),
    magicResist: calculateStat(base.magicResist, growth.magicResist, level),
    movementSpeed: base.movementSpeed,
    critChance: base.critChance,
    critDamage: base.critDamage,
    abilityHaste: base.abilityHaste ?? 0,
    level,
  };

  // Apply modifiers from abilities/buffs
  for (const modifier of modifiers) {
    applyStatModifier(stats, modifier);
  }

  // Apply item stats
  for (const item of champion.items) {
    if (item) {
      const itemDef = getServerItemById(item.definitionId);
      if (itemDef) {
        applyItemStats(stats, itemDef);
      }
    }
  }

  // Apply effect stat modifiers (buffs/debuffs)
  for (const effect of champion.activeEffects) {
    const effectDef = getServerEffectById(effect.definitionId);
    if (effectDef && isStatEffect(effectDef)) {
      applyEffectStatModifier(stats, effectDef, effect.stacks);
    }
  }

  return stats;
}

/**
 * Apply a stat modifier.
 */
function applyStatModifier(stats: ChampionStats, modifier: StatModifier): void {
  if (modifier.flat) {
    for (const [key, value] of Object.entries(modifier.flat)) {
      const statKey = key as keyof ChampionBaseStats;
      if (statKey in stats && typeof value === 'number') {
        (stats as unknown as Record<string, number>)[statKey] += value;
      }
    }
  }

  if (modifier.percent) {
    for (const [key, value] of Object.entries(modifier.percent)) {
      const statKey = key as keyof ChampionBaseStats;
      if (statKey in stats && typeof value === 'number') {
        (stats as unknown as Record<string, number>)[statKey] *= value;
      }
    }
  }
}

/**
 * Apply item stats to champion stats.
 */
function applyItemStats(stats: ChampionStats, itemDef: ServerItemDefinition): void {
  for (const [key, value] of Object.entries(itemDef.stats)) {
    const statKey = key as keyof ChampionBaseStats;
    if (statKey in stats && typeof value === 'number') {
      // Special handling for attack speed (percentage based)
      if (statKey === 'attackSpeed') {
        stats.attackSpeed *= (1 + value);
      } else if (statKey === 'health') {
        stats.maxHealth += value;
      } else if (statKey === 'resource') {
        stats.maxResource += value;
      } else {
        (stats as unknown as Record<string, number>)[statKey] += value;
      }
    }
  }
}

/**
 * Apply effect stat modifier to champion stats.
 */
function applyEffectStatModifier(
  stats: ChampionStats,
  effectDef: ServerStatEffectDef,
  stacks: number
): void {
  const statKey = EFFECT_STAT_KEYS[effectDef.stat];
  if (!statKey || !(statKey in stats)) return;

  // Apply flat value (multiplied by stacks)
  if (effectDef.flatValue !== undefined) {
    (stats as unknown as Record<string, number>)[statKey] += effectDef.flatValue * stacks;
  }

  // Apply percent value (compounded by stacks)
  if (effectDef.percentValue !== undefined) {
    const multiplier = Math.pow(1 + effectDef.percentValue, stacks);
    (stats as unknown as Record<string, number>)[statKey] *= multiplier;
  }
}
