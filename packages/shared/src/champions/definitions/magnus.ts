/**
 * Magnus - The Battlemage
 * Ranged mage with burst damage
 */

import type {
  ChampionDefinition,
  ChampionBaseStats,
  ChampionGrowthStats,
} from '../../types/champions';
import type { AbilityDefinition, AbilityScaling } from '../../types/abilities';

// =============================================================================
// Helper function for creating scaling
// =============================================================================

function scaling(base: number[], options?: {
  adRatio?: number;
  apRatio?: number;
  bonusHealthRatio?: number;
  maxHealthRatio?: number;
  missingHealthRatio?: number;
}): AbilityScaling {
  return {
    base,
    ...options,
  };
}

// =============================================================================
// Base Stats
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

// =============================================================================
// Abilities
// =============================================================================

export const MagnusFireball: AbilityDefinition = {
  id: 'magnus_fireball',
  name: 'Fireball',
  description: 'Launch a fireball that deals {damage} magic damage to the first enemy hit.',
  type: 'active',
  targetType: 'skillshot',
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [8, 7.5, 7, 6.5, 6],
  range: 900,
  projectileSpeed: 1200,
  projectileRadius: 30,
  shape: 'line',
  damage: {
    type: 'magic',
    scaling: scaling([80, 120, 160, 200, 240], { apRatio: 0.75 }),
  },
};

export const MagnusShield: AbilityDefinition = {
  id: 'magnus_shield',
  name: 'Arcane Barrier',
  description: 'Create a magical shield absorbing {shield} damage for 4 seconds.',
  type: 'active',
  targetType: 'self',
  maxRank: 5,
  manaCost: [80, 90, 100, 110, 120],
  cooldown: [18, 16, 14, 12, 10],
  shield: {
    scaling: scaling([60, 100, 140, 180, 220], { apRatio: 0.4 }),
    duration: 4,
  },
};

export const MagnusBlink: AbilityDefinition = {
  id: 'magnus_blink',
  name: 'Blink',
  description: 'Teleport to target location.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 5,
  manaCost: [90, 85, 80, 75, 70],
  cooldown: [22, 20, 18, 16, 14],
  range: 450,
  teleport: true,
};

export const MagnusMeteor: AbilityDefinition = {
  id: 'magnus_meteor',
  name: 'Meteor Strike',
  description: 'Call down a meteor at target location after 1 second, dealing {damage} magic damage to all enemies in the area.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [120, 100, 80],
  range: 800,
  aoeRadius: 250,
  aoeDelay: 1,
  shape: 'circle',
  damage: {
    type: 'magic',
    scaling: scaling([200, 350, 500], { apRatio: 0.9 }),
  },
};

// =============================================================================
// Champion Definition
// =============================================================================

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
// Ability Registry Export
// =============================================================================

export const MagnusAbilities: Record<string, AbilityDefinition> = {
  magnus_fireball: MagnusFireball,
  magnus_shield: MagnusShield,
  magnus_blink: MagnusBlink,
  magnus_meteor: MagnusMeteor,
};
