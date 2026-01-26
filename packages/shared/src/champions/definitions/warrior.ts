/**
 * Warrior - Kael, The Iron Vanguard
 * Melee bruiser with engage and durability
 */

import type {
  ChampionDefinition,
  ChampionBaseStats,
  ChampionGrowthStats,
} from '../../types/champions';
import type { AbilityDefinition, AbilityScaling, PassiveAbilityDefinition } from '../../types/abilities';
import type { CircleCollision } from '../../types/collision';
import type { ChampionAnimations } from '../../types/animation';

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

// =============================================================================
// Abilities
// =============================================================================

export const WarriorSlash: AbilityDefinition = {
  id: 'warrior_slash',
  name: 'Cleaving Strike',
  description: 'Slash enemies in a cone, dealing {damage} physical damage.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 5,
  manaCost: [40, 45, 50, 55, 60],
  cooldown: [6, 5.5, 5, 4.5, 4],
  range: 300,
  aoeRadius: 200,
  coneAngle: Math.PI / 2, // 90 degrees
  shape: 'cone',
  damage: {
    type: 'physical',
    scaling: scaling([60, 95, 130, 165, 200], { adRatio: 0.8 }),
  },
};

export const WarriorShield: AbilityDefinition = {
  id: 'warrior_shield',
  name: 'Iron Will',
  description: 'Gain a shield absorbing {shield} damage for 3 seconds.',
  type: 'active',
  targetType: 'self',
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [14, 13, 12, 11, 10],
  shield: {
    scaling: scaling([80, 120, 160, 200, 240], { bonusHealthRatio: 0.08 }),
    duration: 3,
  },
};

export const WarriorCharge: AbilityDefinition = {
  id: 'warrior_charge',
  name: 'Valiant Charge',
  description: 'Dash forward, dealing {damage} physical damage to enemies hit and slowing them by 30% for 1.5 seconds.',
  type: 'active',
  targetType: 'skillshot',
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [12, 11, 10, 9, 8],
  range: 500,
  dash: {
    speed: 1200,
    distance: 500,
  },
  aoeRadius: 60, // Hitbox width during dash
  damage: {
    type: 'physical',
    scaling: scaling([50, 85, 120, 155, 190], { adRatio: 0.6 }),
  },
  appliesEffects: ['slow_30'],
  effectDuration: 1.5,
};

export const WarriorUltimate: AbilityDefinition = {
  id: 'warrior_ultimate',
  name: 'Heroic Strike',
  description: 'Leap to target enemy and slam down, dealing {damage} physical damage and stunning them for 1 second.',
  type: 'active',
  targetType: 'target_enemy',
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [120, 100, 80],
  range: 600,
  dash: {
    speed: 1500,  // Fast leap
    distance: 600, // Matches ability range
  },
  damage: {
    type: 'physical',
    scaling: scaling([150, 250, 350], { adRatio: 1.0 }),
  },
  appliesEffects: ['stun'],
  effectDuration: 1,
};

// =============================================================================
// Passive Ability
// =============================================================================

/**
 * Undying Resolve - When below 30% health, gain a shield and bonus armor.
 * 60 second internal cooldown.
 */
export const WarriorPassive: PassiveAbilityDefinition = {
  id: 'warrior_passive',
  name: 'Undying Resolve',
  description: 'When below 30% health, gain a shield absorbing {shield} damage and 20% bonus armor for 5 seconds. 60 second cooldown.',
  trigger: 'on_low_health',
  healthThreshold: 0.3,
  internalCooldown: 60,
  shield: {
    scaling: scaling([80, 120, 160, 200], { bonusHealthRatio: 0.1 }),
    duration: 5,
  },
  statModifiers: [
    { stat: 'armor', percentValue: 0.2 },
  ],
  scalesWithLevel: true,
  levelScaling: {
    levels: [1, 6, 11, 16],
    values: [80, 120, 160, 200],
  },
};

// =============================================================================
// Collision & Animation
// =============================================================================

const WARRIOR_COLLISION: CircleCollision = {
  type: 'circle',
  radius: 20,  // Melee champion, slightly smaller hitbox
  offset: { x: 0, y: 2 },  // Slightly offset down for feet
};

const WARRIOR_ANIMATIONS: ChampionAnimations = {
  idle: {
    id: 'idle',
    totalFrames: 4,
    baseFrameDuration: 0.2,
    loop: true,
    keyframes: [],
  },
  walk: {
    id: 'walk',
    totalFrames: 8,
    baseFrameDuration: 0.1,
    loop: true,
    keyframes: [],
  },
  attack: {
    id: 'attack',
    totalFrames: 6,
    baseFrameDuration: 0.083,  // ~500ms total at 1.0 AS
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: 'sound', soundId: 'sword_swing' } },
      { frame: 3, trigger: { type: 'damage' } },  // Damage at frame 3 (50%)
      { frame: 3, trigger: { type: 'sound', soundId: 'sword_hit' } },
    ],
  },
  death: {
    id: 'death',
    totalFrames: 8,
    baseFrameDuration: 0.125,
    loop: false,
    keyframes: [],
  },
  abilities: {
    warrior_slash: {
      id: 'warrior_slash',
      totalFrames: 8,
      baseFrameDuration: 0.05,  // 400ms total
      loop: false,
      keyframes: [
        { frame: 4, trigger: { type: 'damage' } },
        { frame: 4, trigger: { type: 'vfx', vfxId: 'slash_arc' } },
      ],
    },
    warrior_shield: {
      id: 'warrior_shield',
      totalFrames: 4,
      baseFrameDuration: 0.075,  // 300ms total
      loop: false,
      keyframes: [
        { frame: 1, trigger: { type: 'effect', effectId: 'shield' } },
      ],
    },
    warrior_charge: {
      id: 'warrior_charge',
      totalFrames: 6,
      baseFrameDuration: 0.067,  // 400ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'charge_start' } },
        { frame: 5, trigger: { type: 'damage' } },  // Damage at end of dash
      ],
    },
    warrior_ultimate: {
      id: 'warrior_ultimate',
      totalFrames: 10,
      baseFrameDuration: 0.06,  // 600ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'leap_start' } },
        { frame: 7, trigger: { type: 'damage' } },  // Damage on landing
        { frame: 7, trigger: { type: 'effect', effectId: 'stun' } },
        { frame: 7, trigger: { type: 'vfx', vfxId: 'slam_impact' } },
      ],
    },
  },
};

// =============================================================================
// Champion Definition
// =============================================================================

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
  passive: 'warrior_passive',
  collision: WARRIOR_COLLISION,
  animations: WARRIOR_ANIMATIONS,
  attackAnimationSpeedScale: true,
};

// =============================================================================
// Ability Registry Export
// =============================================================================

export const WarriorAbilities: Record<string, AbilityDefinition> = {
  warrior_slash: WarriorSlash,
  warrior_shield: WarriorShield,
  warrior_charge: WarriorCharge,
  warrior_ultimate: WarriorUltimate,
};
