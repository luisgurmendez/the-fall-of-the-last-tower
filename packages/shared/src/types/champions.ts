/**
 * Type definitions for the champion system.
 * Shared between client and server.
 */

import type { AbilitySlot } from './abilities';

/**
 * Champion class/role archetype.
 */
export type ChampionClass =
  | 'warrior'    // Melee bruiser, balanced offense/defense
  | 'tank'       // High durability, crowd control
  | 'assassin'   // High burst damage, mobile, fragile
  | 'mage'       // Magic damage, abilities focused
  | 'marksman'   // Physical damage, basic attack focused
  | 'support';   // Utility, healing, buffs

/**
 * Attack type determines basic attack behavior.
 */
export type AttackType = 'melee' | 'ranged';

/**
 * Resource type (most champions use mana).
 */
export type ResourceType =
  | 'mana'       // Standard blue bar
  | 'energy'    // Quick regenerating, small pool
  | 'rage'      // Builds from dealing/taking damage
  | 'health'    // Uses HP to cast
  | 'none';     // No resource

/**
 * Base statistics for a champion at level 1.
 */
export interface ChampionBaseStats {
  // Health
  health: number;
  healthRegen: number;  // Per second

  // Resource
  resource: number;      // Mana/Energy/etc
  resourceRegen: number; // Per second

  // Offense
  attackDamage: number;
  abilityPower: number;
  attackSpeed: number;   // Attacks per second
  attackRange: number;   // Units

  // Defense
  armor: number;
  magicResist: number;

  // Mobility
  movementSpeed: number;

  // Critical
  critChance: number;    // 0-1
  critDamage: number;    // Multiplier (default 2.0)
}

/**
 * How much stats grow per level.
 */
export interface ChampionGrowthStats {
  health: number;
  healthRegen: number;
  resource: number;
  resourceRegen: number;
  attackDamage: number;
  attackSpeed: number;  // Percentage bonus per level
  armor: number;
  magicResist: number;
}

/**
 * Current stats (base + growth + modifiers).
 */
export interface ChampionStats extends ChampionBaseStats {
  maxHealth: number;
  maxResource: number;
  level: number;
}

/**
 * Stat modifiers from items, buffs, etc.
 */
export interface StatModifier {
  /** Unique identifier for the modifier source */
  source: string;

  /** Flat bonus added to stat */
  flat?: Partial<ChampionBaseStats>;

  /** Percentage multiplier (1.0 = no change, 1.1 = +10%) */
  percent?: Partial<Record<keyof ChampionBaseStats, number>>;

  /** Duration in seconds (undefined = permanent) */
  duration?: number;

  /** Time remaining */
  timeRemaining?: number;
}

/**
 * Definition of a champion (static data).
 */
export interface ChampionDefinition {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Short description/title */
  title: string;

  /** Champion class */
  class: ChampionClass;

  /** Melee or ranged */
  attackType: AttackType;

  /** Resource used for abilities */
  resourceType: ResourceType;

  /** Base stats at level 1 */
  baseStats: ChampionBaseStats;

  /** Stats gained per level */
  growthStats: ChampionGrowthStats;

  /** Ability IDs for each slot */
  abilities: Record<AbilitySlot, string>;
}

/**
 * Runtime state of a champion (for network sync).
 */
export interface ChampionState {
  /** Current health */
  health: number;

  /** Current resource (mana/energy/etc) */
  resource: number;

  /** Current level (1-18) */
  level: number;

  /** Experience points */
  experience: number;

  /** Experience needed for next level */
  experienceToNextLevel: number;

  /** Ability ranks for each slot (0 = not learned) */
  abilityRanks: Record<AbilitySlot, number>;

  /** Available skill points */
  skillPoints: number;

  /** Whether in combat (for regen purposes) */
  inCombat: boolean;

  /** Time since last in combat */
  timeSinceCombat: number;

  /** Whether currently dead */
  isDead: boolean;

  /** Respawn timer (if dead) */
  respawnTimer: number;

  /** Active stat modifiers */
  modifiers: StatModifier[];
}

/**
 * Experience thresholds for each level.
 */
export const LEVEL_EXPERIENCE: number[] = [
  0,      // Level 1
  280,    // Level 2
  660,    // Level 3
  1140,   // Level 4
  1720,   // Level 5
  2400,   // Level 6
  3180,   // Level 7
  4060,   // Level 8
  5040,   // Level 9
  6120,   // Level 10
  7300,   // Level 11
  8580,   // Level 12
  9960,   // Level 13
  11440,  // Level 14
  13020,  // Level 15
  14700,  // Level 16
  16480,  // Level 17
  18360,  // Level 18
];

/**
 * Calculate stat at a given level.
 */
export function calculateStat(
  baseStat: number,
  growthStat: number,
  level: number
): number {
  // Linear growth: base + growth * (level - 1)
  return baseStat + growthStat * (level - 1);
}

/**
 * Calculate attack speed at a given level.
 */
export function calculateAttackSpeed(
  baseAttackSpeed: number,
  attackSpeedGrowth: number,
  level: number,
  bonusAttackSpeed = 0
): number {
  const growthBonus = attackSpeedGrowth * (level - 1) / 100;
  return baseAttackSpeed * (1 + growthBonus + bonusAttackSpeed);
}

/**
 * Calculate all stats for a champion at a given level.
 */
export function calculateStatsAtLevel(
  baseStats: ChampionBaseStats,
  growthStats: ChampionGrowthStats,
  level: number
): ChampionStats {
  return {
    health: calculateStat(baseStats.health, growthStats.health, level),
    maxHealth: calculateStat(baseStats.health, growthStats.health, level),
    healthRegen: calculateStat(baseStats.healthRegen, growthStats.healthRegen, level),
    resource: calculateStat(baseStats.resource, growthStats.resource, level),
    maxResource: calculateStat(baseStats.resource, growthStats.resource, level),
    resourceRegen: calculateStat(baseStats.resourceRegen, growthStats.resourceRegen, level),
    attackDamage: calculateStat(baseStats.attackDamage, growthStats.attackDamage, level),
    abilityPower: baseStats.abilityPower,
    attackSpeed: calculateAttackSpeed(baseStats.attackSpeed, growthStats.attackSpeed, level),
    attackRange: baseStats.attackRange,
    armor: calculateStat(baseStats.armor, growthStats.armor, level),
    magicResist: calculateStat(baseStats.magicResist, growthStats.magicResist, level),
    movementSpeed: baseStats.movementSpeed,
    critChance: baseStats.critChance,
    critDamage: baseStats.critDamage,
    level,
  };
}
