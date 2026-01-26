/**
 * Vex - The Shadow Blade
 * Melee assassin with high burst and mobility
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
  movementSpeed: 350, // High mobility assassin
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

// =============================================================================
// Abilities
// =============================================================================

export const VexShuriken: AbilityDefinition = {
  id: 'vex_shuriken',
  name: 'Shadow Shuriken',
  description: 'Throw a shuriken that deals {damage} physical damage and marks the target for 4 seconds. Marked enemies take 10% increased damage from Vex.',
  type: 'active',
  targetType: 'skillshot',
  maxRank: 5,
  manaCost: [30, 30, 30, 30, 30], // Energy-based, low cost
  cooldown: [6, 5.5, 5, 4.5, 4],
  range: 700,
  projectileSpeed: 1500,
  projectileRadius: 20,
  shape: 'line',
  damage: {
    type: 'physical',
    scaling: scaling([40, 70, 100, 130, 160], { adRatio: 0.7 }),
  },
  appliesEffects: ['vex_mark'],
  effectDuration: 4,
};

export const VexShroud: AbilityDefinition = {
  id: 'vex_shroud',
  name: 'Shadow Shroud',
  description: 'Become invisible for 1.5 seconds and gain 20% bonus movement speed. Attacking or using abilities breaks stealth.',
  type: 'active',
  targetType: 'self',
  maxRank: 5,
  manaCost: [50, 45, 40, 35, 30],
  cooldown: [18, 16, 14, 12, 10],
  appliesEffects: ['vex_stealth', 'speed_20'],
  effectDuration: 1.5,
};

export const VexDash: AbilityDefinition = {
  id: 'vex_dash',
  name: 'Shadow Step',
  description: 'Dash to target location and empower your next basic attack to deal {damage} bonus physical damage. If an enemy is marked, dash resets its cooldown.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 5,
  manaCost: [40, 40, 40, 40, 40],
  cooldown: [14, 12, 10, 8, 6],
  range: 400,
  dash: {
    speed: 1400,
    distance: 400,
  },
  // Empowered attack bonus damage
  damage: {
    type: 'physical',
    scaling: scaling([30, 50, 70, 90, 110], { adRatio: 0.5 }),
  },
  appliesEffects: ['vex_empowered'],
  effectDuration: 4, // 4 seconds to use empowered attack
};

export const VexExecute: AbilityDefinition = {
  id: 'vex_execute',
  name: 'Death Mark',
  description: 'Mark target enemy champion. After 2 seconds, the mark detonates dealing {damage} physical damage plus 30% of damage dealt during the mark.',
  type: 'active',
  targetType: 'target_enemy',
  maxRank: 3,
  manaCost: [0, 0, 0], // Energy-based ultimate
  cooldown: [100, 80, 60],
  range: 400,
  damage: {
    type: 'physical',
    scaling: scaling([100, 200, 300], { adRatio: 1.0 }),
  },
  appliesEffects: ['vex_death_mark'],
  effectDuration: 2,
  // Champion-only ultimate - can't be used on minions or jungle camps
  affectsMinions: false,
  affectsJungleCamps: false,
};

// =============================================================================
// Passive Ability
// =============================================================================

/**
 * Assassin's Mark - Every 3rd basic attack deals bonus true damage
 * based on target's max health.
 */
export const VexPassive: PassiveAbilityDefinition = {
  id: 'vex_passive',
  name: "Assassin's Mark",
  description: 'Every 3rd basic attack deals bonus true damage equal to 4% of the target\'s max health.',
  trigger: 'on_hit',
  usesStacks: true,
  maxStacks: 3,
  stacksPerTrigger: 1,
  stackDuration: 5,
  requiredStacks: 3,
  consumeStacksOnActivation: true,
  damage: {
    type: 'true',
    scaling: scaling([0], { maxHealthRatio: 0.04 }),
  },
};

// =============================================================================
// Collision & Animation
// =============================================================================

const VEX_COLLISION: CircleCollision = {
  type: 'circle',
  radius: 18,  // Agile assassin, smaller hitbox
  offset: { x: 0, y: 2 },
};

const VEX_ANIMATIONS: ChampionAnimations = {
  idle: {
    id: 'idle',
    totalFrames: 4,
    baseFrameDuration: 0.175,  // Slightly faster idle for assassin
    loop: true,
    keyframes: [],
  },
  walk: {
    id: 'walk',
    totalFrames: 8,
    baseFrameDuration: 0.08,  // Fast walk animation
    loop: true,
    keyframes: [],
  },
  attack: {
    id: 'attack',
    totalFrames: 5,
    baseFrameDuration: 0.08,  // ~400ms total, fast melee attacks
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: 'sound', soundId: 'blade_slash' } },
      { frame: 2, trigger: { type: 'damage' } },  // Fast damage frame
      { frame: 2, trigger: { type: 'sound', soundId: 'blade_hit' } },
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
    vex_shuriken: {
      id: 'vex_shuriken',
      totalFrames: 6,
      baseFrameDuration: 0.05,  // 300ms total, fast throw
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'shuriken_throw' } },
        { frame: 2, trigger: { type: 'projectile' } },
        { frame: 2, trigger: { type: 'vfx', vfxId: 'shadow_shuriken' } },
      ],
    },
    vex_shroud: {
      id: 'vex_shroud',
      totalFrames: 4,
      baseFrameDuration: 0.075,  // 300ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'shroud_activate' } },
        { frame: 1, trigger: { type: 'effect', effectId: 'stealth' } },
        { frame: 1, trigger: { type: 'vfx', vfxId: 'shadow_shroud' } },
      ],
    },
    vex_dash: {
      id: 'vex_dash',
      totalFrames: 5,
      baseFrameDuration: 0.06,  // 300ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'dash_start' } },
        { frame: 4, trigger: { type: 'effect', effectId: 'empower' } },
        { frame: 4, trigger: { type: 'vfx', vfxId: 'shadow_step' } },
      ],
    },
    vex_execute: {
      id: 'vex_execute',
      totalFrames: 8,
      baseFrameDuration: 0.0625,  // 500ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'death_mark_cast' } },
        { frame: 4, trigger: { type: 'effect', effectId: 'death_mark' } },
        { frame: 4, trigger: { type: 'vfx', vfxId: 'death_mark' } },
      ],
    },
  },
};

// =============================================================================
// Champion Definition
// =============================================================================

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
  passive: 'vex_passive',
  collision: VEX_COLLISION,
  animations: VEX_ANIMATIONS,
  attackAnimationSpeedScale: true,
};

// =============================================================================
// Ability Registry Export
// =============================================================================

export const VexAbilities: Record<string, AbilityDefinition> = {
  vex_shuriken: VexShuriken,
  vex_shroud: VexShroud,
  vex_dash: VexDash,
  vex_execute: VexExecute,
};
