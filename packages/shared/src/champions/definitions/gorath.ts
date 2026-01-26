/**
 * Gorath - The Stone Guardian
 * Tank with crowd control and durability
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

// =============================================================================
// Abilities
// =============================================================================

export const GorathSlam: AbilityDefinition = {
  id: 'gorath_slam',
  name: 'Ground Slam',
  description: 'Slam the ground, dealing {damage} magic damage and slowing enemies by 40% for 1 second.',
  type: 'active',
  targetType: 'no_target',
  maxRank: 5,
  manaCost: [50, 55, 60, 65, 70],
  cooldown: [8, 7.5, 7, 6.5, 6],
  aoeRadius: 300,
  shape: 'circle',
  damage: {
    type: 'magic',
    scaling: scaling([60, 100, 140, 180, 220], { bonusHealthRatio: 0.04 }),
  },
  appliesEffects: ['slow_40'],
  effectDuration: 1,
};

export const GorathFortify: AbilityDefinition = {
  id: 'gorath_fortify',
  name: 'Stone Skin',
  description: 'Increase armor and magic resist by 30% for 4 seconds.',
  type: 'active',
  targetType: 'self',
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [16, 15, 14, 13, 12],
  appliesEffects: ['gorath_fortify_buff', 'gorath_fortify_mr_buff'],
  effectDuration: 4,
};

export const GorathTaunt: AbilityDefinition = {
  id: 'gorath_taunt',
  name: 'Defiant Roar',
  description: 'Taunt all nearby enemies, forcing them to attack you for 1.5 seconds.',
  type: 'active',
  targetType: 'no_target',
  maxRank: 5,
  manaCost: [70, 70, 70, 70, 70],
  cooldown: [16, 15, 14, 13, 12],
  aoeRadius: 350,
  shape: 'circle',
  appliesEffects: ['taunt'],
  effectDuration: 1.5,
  // Taunt only affects champions and jungle camps (minions don't need to be taunted)
  affectsMinions: false,
};

export const GorathEarthquake: AbilityDefinition = {
  id: 'gorath_earthquake',
  name: 'Earthquake',
  description: 'Create a massive earthquake dealing {damage} magic damage and knocking up all enemies for 1 second.',
  type: 'active',
  targetType: 'no_target',
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [130, 110, 90],
  aoeRadius: 450,
  aoeDelay: 0.5, // Brief wind-up
  shape: 'circle',
  damage: {
    type: 'magic',
    scaling: scaling([150, 275, 400], { bonusHealthRatio: 0.06 }),
  },
  appliesEffects: ['knockup'],
  effectDuration: 1,
};

// =============================================================================
// Passive Ability
// =============================================================================

/**
 * Immovable - Gain armor stacks when taking damage. Stacks decay after
 * being out of combat for 4 seconds.
 */
export const GorathPassive: PassiveAbilityDefinition = {
  id: 'gorath_passive',
  name: 'Immovable',
  description: 'When taking damage, gain 5 armor (max 10 stacks). Stacks decay after 4 seconds out of combat.',
  trigger: 'on_take_damage',
  usesStacks: true,
  maxStacks: 10,
  stacksPerTrigger: 1,
  stackDuration: 4,
  internalCooldown: 0.5, // Can't gain stacks faster than every 0.5s
  statModifiers: [
    { stat: 'armor', flatValue: 5 }, // Per stack
  ],
};

// =============================================================================
// Collision & Animation
// =============================================================================

const GORATH_COLLISION: CircleCollision = {
  type: 'circle',
  radius: 25,  // Large tank, bigger hitbox
  offset: { x: 0, y: 3 },
};

const GORATH_ANIMATIONS: ChampionAnimations = {
  idle: {
    id: 'idle',
    totalFrames: 4,
    baseFrameDuration: 0.25,  // Slower, heavier idle
    loop: true,
    keyframes: [],
  },
  walk: {
    id: 'walk',
    totalFrames: 8,
    baseFrameDuration: 0.125,  // Slower, heavy walk
    loop: true,
    keyframes: [],
  },
  attack: {
    id: 'attack',
    totalFrames: 7,
    baseFrameDuration: 0.1,  // ~700ms total, slower heavy attacks
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: 'sound', soundId: 'rock_swing' } },
      { frame: 4, trigger: { type: 'damage' } },  // Damage later in animation
      { frame: 4, trigger: { type: 'sound', soundId: 'rock_impact' } },
    ],
  },
  death: {
    id: 'death',
    totalFrames: 10,
    baseFrameDuration: 0.125,  // Longer death animation
    loop: false,
    keyframes: [],
  },
  abilities: {
    gorath_slam: {
      id: 'gorath_slam',
      totalFrames: 8,
      baseFrameDuration: 0.075,  // 600ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'slam_windup' } },
        { frame: 5, trigger: { type: 'damage' } },
        { frame: 5, trigger: { type: 'effect', effectId: 'slow' } },
        { frame: 5, trigger: { type: 'vfx', vfxId: 'ground_slam' } },
      ],
    },
    gorath_fortify: {
      id: 'gorath_fortify',
      totalFrames: 5,
      baseFrameDuration: 0.08,  // 400ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'stone_armor' } },
        { frame: 2, trigger: { type: 'effect', effectId: 'fortify' } },
        { frame: 2, trigger: { type: 'vfx', vfxId: 'stone_skin' } },
      ],
    },
    gorath_taunt: {
      id: 'gorath_taunt',
      totalFrames: 8,
      baseFrameDuration: 0.0875,  // 700ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'roar_start' } },
        { frame: 4, trigger: { type: 'effect', effectId: 'taunt' } },
        { frame: 4, trigger: { type: 'vfx', vfxId: 'defiant_roar' } },
      ],
    },
    gorath_earthquake: {
      id: 'gorath_earthquake',
      totalFrames: 12,
      baseFrameDuration: 0.083,  // 1000ms total (includes wind-up)
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'earthquake_charge' } },
        { frame: 6, trigger: { type: 'vfx', vfxId: 'earthquake_warning' } },  // Visual warning
        { frame: 9, trigger: { type: 'damage' } },
        { frame: 9, trigger: { type: 'effect', effectId: 'knockup' } },
        { frame: 9, trigger: { type: 'vfx', vfxId: 'earthquake_impact' } },
      ],
    },
  },
};

// =============================================================================
// Champion Definition
// =============================================================================

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
  passive: 'gorath_passive',
  collision: GORATH_COLLISION,
  animations: GORATH_ANIMATIONS,
  attackAnimationSpeedScale: true,
};

// =============================================================================
// Ability Registry Export
// =============================================================================

export const GorathAbilities: Record<string, AbilityDefinition> = {
  gorath_slam: GorathSlam,
  gorath_fortify: GorathFortify,
  gorath_taunt: GorathTaunt,
  gorath_earthquake: GorathEarthquake,
};
