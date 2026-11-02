/**
 * ChampionStats - Effective stat calculation for a champion.
 *
 * Stats are built in this order:
 * 1. Base stats plus per-level growth
 * 2. Stat modifiers from abilities and passives (flat, then percent)
 * 3. Item stats: flat, attack speed bonuses added together, stacking
 *    passives' stacks; tenacity from several sources combines (1 - product)
 * 4. Stat effects (buffs/debuffs), scaled by stacks
 * 5. Item passives that scale stats: ability power from max mana, then the
 *    ability power multiplier; crit chance capped at 100%
 *
 * This is a pure calculation. ServerChampion.getStats() caches the result
 * and copies maxHealth, maxResource and movementSpeed back onto the champion.
 */

import {
  calculateStat,
  calculateAttackSpeed,
  type ChampionBaseStats,
  type FullChampionStats,
  type ItemCatalogEntry,
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
 */
const EFFECT_STAT_KEYS: Record<string, keyof FullChampionStats> = {
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
  'max_health': 'maxHealth',
  'lifesteal': 'lifesteal',
  'spell_vamp': 'omnivamp',
  'armor_penetration': 'lethality',
  'magic_penetration': 'magicPen',
  'tenacity': 'tenacity',
};

/**
 * Calculate a champion's current stats (level, modifiers, items and effects).
 */
export function calculateChampionStats(
  champion: ServerChampion,
  modifiers: readonly StatModifier[]
): FullChampionStats {
  const base = champion.definition.baseStats;
  const growth = champion.definition.growthStats;
  const level = champion.level;

  const stats: FullChampionStats = {
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
    lethality: 0,
    armorPenPercent: 0,
    magicPen: 0,
    magicPenPercent: 0,
    lifesteal: 0,
    omnivamp: 0,
    healShieldPower: 0,
    tenacity: 0,
  };

  // Apply modifiers from abilities/buffs
  for (const modifier of modifiers) {
    applyStatModifier(stats, modifier);
  }

  // Apply item stats
  let bonusAttackSpeed = 0;
  const items: ServerItemDefinition[] = [];
  for (const item of champion.items) {
    if (item) {
      const itemDef = getServerItemById(item.definitionId);
      if (itemDef) {
        items.push(itemDef);
        bonusAttackSpeed += applyItemStats(stats, itemDef, item.stacks ?? 0);
      }
    }
  }
  stats.attackSpeed *= 1 + bonusAttackSpeed;

  // Apply effect stat modifiers (buffs/debuffs)
  for (const effect of champion.activeEffects) {
    const effectDef = getServerEffectById(effect.definitionId);
    if (effectDef && isStatEffect(effectDef)) {
      applyEffectStatModifier(stats, effectDef, effect.stacks);
    }
  }

  applyItemScaling(stats, items);
  return stats;
}

/** Item passives that scale other stats (once each, whatever holds them) */
function applyItemScaling(stats: FullChampionStats, items: readonly ItemCatalogEntry[]): void {
  const passives = items.flatMap(item => item.passives);
  const manaToAp = passives.find(passive => passive.effectType === 'mana_to_ap');
  if (manaToAp) stats.abilityPower += stats.maxResource * Number(manaToAp.effectData.percent);
  const amp = passives.find(passive => passive.effectType === 'ap_amp');
  if (amp) stats.abilityPower *= 1 + Number(amp.effectData.percent);
  stats.critChance = Math.min(1, stats.critChance);
}

/**
 * Apply a stat modifier.
 */
function applyStatModifier(stats: FullChampionStats, modifier: StatModifier): void {
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
 * Apply an item's stats (and its stacking passive's stacks) to champion stats.
 * @returns Its attack speed bonus, added up with the others' before it applies
 */
function applyItemStats(stats: FullChampionStats, itemDef: ServerItemDefinition, stacks: number): number {
  let bonusAttackSpeed = 0;
  const add = (key: string, value: number) => {
    if (key === 'attackSpeed') bonusAttackSpeed += value;
    else if (key === 'health') stats.maxHealth += value;
    else if (key === 'resource') stats.maxResource += value;
    else if (key === 'tenacity') stats.tenacity = combineTenacity(stats.tenacity, value);
    else if (key in stats) (stats as unknown as Record<string, number>)[key] += value;
  };
  for (const [key, value] of Object.entries(itemDef.stats)) {
    if (typeof value === 'number') add(key, value);
  }
  for (const passive of itemDef.passives) {
    if (passive.effectType === 'stacking' && stacks > 0) {
      add(String(passive.effectData.stat), stacks * Number(passive.effectData.perStack));
    }
  }
  return bonusAttackSpeed;
}

/** Two sources of tenacity: each shortens what the other leaves */
function combineTenacity(a: number, b: number): number {
  return 1 - (1 - a) * (1 - b);
}

/**
 * Apply effect stat modifier to champion stats.
 */
function applyEffectStatModifier(
  stats: FullChampionStats,
  effectDef: ServerStatEffectDef,
  stacks: number
): void {
  for (const change of [effectDef, ...(effectDef.alsoModifies ?? [])]) {
    const statKey = EFFECT_STAT_KEYS[change.stat];
    if (!statKey || !(statKey in stats)) continue;
    const record = stats as unknown as Record<string, number>;

    // Apply flat value (multiplied by stacks)
    if (change.flatValue !== undefined) {
      if (statKey === 'tenacity') stats.tenacity = combineTenacity(stats.tenacity, change.flatValue);
      else record[statKey] += change.flatValue * stacks;
    }

    // Apply percent value (compounded by stacks)
    if (change.percentValue !== undefined) {
      record[statKey] *= Math.pow(1 + change.percentValue, stacks);
    }
  }
}
