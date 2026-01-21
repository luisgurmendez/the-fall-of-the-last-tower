/**
 * Champion Registry - Definitions for all playable champions.
 *
 * This registry contains the static data for all champions,
 * shared between client and server.
 */

import type { ChampionDefinition, ChampionBaseStats, ChampionGrowthStats } from '../types/champions';

// =============================================================================
// WARRIOR - Melee bruiser with engage and durability
// =============================================================================

const WARRIOR_BASE_STATS: ChampionBaseStats = {
  health: 580,
  healthRegen: 8,
  resource: 280,
  resourceRegen: 7,
  attackDamage: 60,
  abilityPower: 0,
  attackSpeed: 0.65,
  attackRange: 125, // Melee
  armor: 35,
  magicResist: 32,
  movementSpeed: 340,
  critChance: 0,
  critDamage: 2.0,
};

const WARRIOR_GROWTH_STATS: ChampionGrowthStats = {
  health: 95,
  healthRegen: 0.8,
  resource: 40,
  resourceRegen: 0.5,
  attackDamage: 3.5,
  attackSpeed: 2.5,
  armor: 4.0,
  magicResist: 1.5,
};

export const WarriorDefinition: ChampionDefinition = {
  id: 'warrior',
  name: 'Kael',
  title: 'The Iron Vanguard',
  class: 'warrior',
  attackType: 'melee',
  resourceType: 'mana',
  baseStats: WARRIOR_BASE_STATS,
  growthStats: WARRIOR_GROWTH_STATS,
  abilities: {
    Q: 'warrior_slash',
    W: 'warrior_shield',
    E: 'warrior_charge',
    R: 'warrior_ultimate',
  },
};

// =============================================================================
// MAGNUS - Ranged mage with burst damage
// =============================================================================

const MAGNUS_BASE_STATS: ChampionBaseStats = {
  health: 425,
  healthRegen: 5,
  resource: 375,
  resourceRegen: 12,
  attackDamage: 53,
  abilityPower: 0, // AP comes from items
  attackSpeed: 0.625,
  attackRange: 550, // Ranged
  armor: 20,
  magicResist: 30,
  movementSpeed: 330,
  critChance: 0,
  critDamage: 2.0,
};

const MAGNUS_GROWTH_STATS: ChampionGrowthStats = {
  health: 85,
  healthRegen: 0.5,
  resource: 40,
  resourceRegen: 0.8,
  attackDamage: 3.0,
  attackSpeed: 1.5,
  armor: 3.5,
  magicResist: 1.25,
};

export const MagnusDefinition: ChampionDefinition = {
  id: 'magnus',
  name: 'Magnus',
  title: 'The Battlemage',
  class: 'mage',
  attackType: 'ranged',
  resourceType: 'mana',
  baseStats: MAGNUS_BASE_STATS,
  growthStats: MAGNUS_GROWTH_STATS,
  abilities: {
    Q: 'magnus_fireball',
    W: 'magnus_shield',
    E: 'magnus_blink',
    R: 'magnus_meteor',
  },
};

// =============================================================================
// ELARA - Ranged support with healing and utility
// =============================================================================

const ELARA_BASE_STATS: ChampionBaseStats = {
  health: 480,
  healthRegen: 6,
  resource: 400,
  resourceRegen: 14,
  attackDamage: 48,
  abilityPower: 0,
  attackSpeed: 0.625,
  attackRange: 525,
  armor: 22,
  magicResist: 34,
  movementSpeed: 335,
  critChance: 0,
  critDamage: 2.0,
};

const ELARA_GROWTH_STATS: ChampionGrowthStats = {
  health: 75,
  healthRegen: 0.6,
  resource: 50,
  resourceRegen: 1.0,
  attackDamage: 2.5,
  attackSpeed: 1.2,
  armor: 3.0,
  magicResist: 1.0,
};

export const ElaraDefinition: ChampionDefinition = {
  id: 'elara',
  name: 'Elara',
  title: 'The Radiant Healer',
  class: 'support',
  attackType: 'ranged',
  resourceType: 'mana',
  baseStats: ELARA_BASE_STATS,
  growthStats: ELARA_GROWTH_STATS,
  abilities: {
    Q: 'elara_heal',
    W: 'elara_barrier',
    E: 'elara_speed',
    R: 'elara_resurrection',
  },
};

// =============================================================================
// VEX - Melee assassin with high burst and mobility
// =============================================================================

const VEX_BASE_STATS: ChampionBaseStats = {
  health: 520,
  healthRegen: 6,
  resource: 260,
  resourceRegen: 8,
  attackDamage: 65,
  abilityPower: 0,
  attackSpeed: 0.68,
  attackRange: 125, // Melee
  armor: 28,
  magicResist: 30,
  movementSpeed: 350,
  critChance: 0,
  critDamage: 2.0,
};

const VEX_GROWTH_STATS: ChampionGrowthStats = {
  health: 80,
  healthRegen: 0.6,
  resource: 35,
  resourceRegen: 0.6,
  attackDamage: 4.0,
  attackSpeed: 3.0,
  armor: 3.5,
  magicResist: 1.25,
};

export const VexDefinition: ChampionDefinition = {
  id: 'vex',
  name: 'Vex',
  title: 'The Shadow Blade',
  class: 'assassin',
  attackType: 'melee',
  resourceType: 'energy',
  baseStats: VEX_BASE_STATS,
  growthStats: VEX_GROWTH_STATS,
  abilities: {
    Q: 'vex_shuriken',
    W: 'vex_shroud',
    E: 'vex_dash',
    R: 'vex_execute',
  },
};

// =============================================================================
// GORATH - Tank with crowd control and durability
// =============================================================================

const GORATH_BASE_STATS: ChampionBaseStats = {
  health: 650,
  healthRegen: 9,
  resource: 320,
  resourceRegen: 8,
  attackDamage: 55,
  abilityPower: 0,
  attackSpeed: 0.6,
  attackRange: 150, // Melee
  armor: 40,
  magicResist: 35,
  movementSpeed: 330,
  critChance: 0,
  critDamage: 2.0,
};

const GORATH_GROWTH_STATS: ChampionGrowthStats = {
  health: 110,
  healthRegen: 1.0,
  resource: 45,
  resourceRegen: 0.6,
  attackDamage: 3.0,
  attackSpeed: 2.0,
  armor: 5.0,
  magicResist: 2.0,
};

export const GorathDefinition: ChampionDefinition = {
  id: 'gorath',
  name: 'Gorath',
  title: 'The Stone Guardian',
  class: 'tank',
  attackType: 'melee',
  resourceType: 'mana',
  baseStats: GORATH_BASE_STATS,
  growthStats: GORATH_GROWTH_STATS,
  abilities: {
    Q: 'gorath_slam',
    W: 'gorath_fortify',
    E: 'gorath_taunt',
    R: 'gorath_earthquake',
  },
};

// =============================================================================
// Registry
// =============================================================================

/**
 * All champion definitions.
 */
export const CHAMPION_DEFINITIONS: Record<string, ChampionDefinition> = {
  warrior: WarriorDefinition,
  magnus: MagnusDefinition,
  elara: ElaraDefinition,
  vex: VexDefinition,
  gorath: GorathDefinition,
};

/**
 * Get a champion definition by ID.
 */
export function getChampionDefinition(id: string): ChampionDefinition | undefined {
  return CHAMPION_DEFINITIONS[id];
}

/**
 * Get all champion IDs.
 */
export function getAllChampionIds(): string[] {
  return Object.keys(CHAMPION_DEFINITIONS);
}

/**
 * Get all champion definitions.
 */
export function getAllChampionDefinitions(): ChampionDefinition[] {
  return Object.values(CHAMPION_DEFINITIONS);
}
