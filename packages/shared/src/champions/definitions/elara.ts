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
// Collision & Animation
// =============================================================================

const ELARA_COLLISION: CircleCollision = {
  type: 'circle',
  radius: 18,  // Ranged support, smaller hitbox
  offset: { x: 0, y: 2 },
};

const ELARA_ANIMATIONS: ChampionAnimations = {
  idle: {
    id: 'idle',
    totalFrames: 4,
    baseFrameDuration: 0.2,
    loop: true,
    keyframes: [],
  },
  walk: {
    id: 'walk',
    totalFrames: 6,
    baseFrameDuration: 0.1,
    loop: true,
    keyframes: [],
  },
  attack: {
    id: 'attack',
    totalFrames: 6,
    baseFrameDuration: 0.1,  // ~600ms total at 1.0 AS
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: 'sound', soundId: 'light_cast' } },
      { frame: 3, trigger: { type: 'projectile' } },  // Ranged attack spawns projectile
      { frame: 3, trigger: { type: 'sound', soundId: 'light_release' } },
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
    elara_heal: {
      id: 'elara_heal',
      totalFrames: 6,
      baseFrameDuration: 0.083,  // 500ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'heal_charge' } },
        { frame: 3, trigger: { type: 'effect', effectId: 'heal' } },
        { frame: 3, trigger: { type: 'vfx', vfxId: 'radiant_blessing' } },
      ],
    },
    elara_barrier: {
      id: 'elara_barrier',
      totalFrames: 5,
      baseFrameDuration: 0.08,  // 400ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'shield_cast' } },
        { frame: 2, trigger: { type: 'effect', effectId: 'shield' } },
        { frame: 2, trigger: { type: 'vfx', vfxId: 'sacred_shield' } },
      ],
    },
    elara_speed: {
      id: 'elara_speed',
      totalFrames: 4,
      baseFrameDuration: 0.075,  // 300ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'speed_cast' } },
        { frame: 2, trigger: { type: 'effect', effectId: 'speed_buff' } },
        { frame: 2, trigger: { type: 'vfx', vfxId: 'swift_grace' } },
      ],
    },
    elara_resurrection: {
      id: 'elara_resurrection',
      totalFrames: 12,
      baseFrameDuration: 0.083,  // 1000ms total (long cast)
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'divine_charge' } },
        { frame: 8, trigger: { type: 'effect', effectId: 'heal' } },
        { frame: 8, trigger: { type: 'effect', effectId: 'cleanse' } },
        { frame: 8, trigger: { type: 'vfx', vfxId: 'divine_intervention' } },
      ],
    },
  },
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
  collision: ELARA_COLLISION,
  animations: ELARA_ANIMATIONS,
  attackAnimationSpeedScale: true,
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
