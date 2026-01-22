/**
 * Elara - The Radiant Healer
 * Ranged support with healing and utility
 */

import type {
  ChampionDefinition,
  ChampionBaseStats,
  ChampionGrowthStats,
} from '../../types/champions';
import type { AbilityDefinition, AbilityScaling, PassiveAbilityDefinition } from '../../types/abilities';

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

// =============================================================================
// Abilities
// =============================================================================

export const ElaraHeal: AbilityDefinition = {
  id: 'elara_heal',
  name: 'Radiant Blessing',
  description: 'Heal target ally for {heal} health.',
  type: 'active',
  targetType: 'target_ally',
  maxRank: 5,
  manaCost: [70, 80, 90, 100, 110],
  cooldown: [10, 9, 8, 7, 6],
  range: 700,
  heal: {
    scaling: scaling([70, 110, 150, 190, 230], { apRatio: 0.5 }),
  },
};

export const ElaraBarrier: AbilityDefinition = {
  id: 'elara_barrier',
  name: 'Sacred Shield',
  description: 'Grant target ally a shield absorbing {shield} damage for 2.5 seconds.',
  type: 'active',
  targetType: 'target_ally',
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [12, 11, 10, 9, 8],
  range: 700,
  shield: {
    scaling: scaling([60, 90, 120, 150, 180], { apRatio: 0.35 }),
    duration: 2.5,
  },
};

export const ElaraSpeed: AbilityDefinition = {
  id: 'elara_speed',
  name: 'Swift Grace',
  description: 'Grant yourself and nearby allies 30% bonus movement speed for 2 seconds.',
  type: 'active',
  targetType: 'no_target',
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [15, 14, 13, 12, 11],
  aoeRadius: 400,
  shape: 'circle',
  appliesEffects: ['speed_30'],
  effectDuration: 2,
};

export const ElaraResurrection: AbilityDefinition = {
  id: 'elara_resurrection',
  name: 'Divine Intervention',
  description: 'Heal all allies in range for {heal} health and cleanse all debuffs.',
  type: 'active',
  targetType: 'no_target',
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [140, 120, 100],
  aoeRadius: 600,
  shape: 'circle',
  heal: {
    scaling: scaling([150, 250, 350], { apRatio: 0.6 }),
  },
};

// =============================================================================
// Passive Ability
// =============================================================================

/**
 * Blessed Presence - Allies within 600 units passively heal 1% max HP per second.
 */
export const ElaraPassive: PassiveAbilityDefinition = {
  id: 'elara_passive',
  name: 'Blessed Presence',
  description: 'Nearby allies within 600 units heal 1% of their max health per second.',
  trigger: 'always',
  auraRadius: 600,
  heal: {
    scaling: scaling([0], { maxHealthRatio: 0.01 }),
  },
  intervalSeconds: 1,
};

// =============================================================================
// Champion Definition
// =============================================================================

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
  passive: 'elara_passive',
};

// =============================================================================
// Ability Registry Export
// =============================================================================

export const ElaraAbilities: Record<string, AbilityDefinition> = {
  elara_heal: ElaraHeal,
  elara_barrier: ElaraBarrier,
  elara_speed: ElaraSpeed,
  elara_resurrection: ElaraResurrection,
};
