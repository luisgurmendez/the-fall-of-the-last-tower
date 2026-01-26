/**
 * Magnus - The Battlemage
 * Ranged mage with burst damage
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

export const MagnusMudGround: AbilityDefinition = {
  id: 'magnus_mud',
  name: 'Quagmire',
  description: 'Create a pool of mud at target location, slowing enemies inside by 20% for 2 seconds.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 5,
  manaCost: [70, 75, 80, 85, 90],
  cooldown: [14, 13, 12, 11, 10],
  range: 600,
  aoeRadius: 200,
  shape: 'circle',
  appliesEffects: ['slow_20'],
  effectDuration: 2,
  zoneDuration: 2, // Zone persists for 2 seconds
};

export const MagnusMeteor: AbilityDefinition = {
  id: 'magnus_meteor',
  name: 'Inferno Zone',
  description: 'Create a burning zone at target location that deals {damage} magic damage every second for 5 seconds and slows enemies by 10%.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [120, 100, 80],
  range: 800,
  aoeRadius: 250,
  shape: 'circle',
  damage: {
    type: 'magic',
    scaling: scaling([60, 100, 140], { apRatio: 0.25 }), // Per tick damage (5 ticks = 300/500/700 + 125% AP total)
  },
  appliesEffects: ['slow_10'],
  effectDuration: 1, // Slow refreshes each tick
  zoneDuration: 5, // Zone persists for 5 seconds
  zoneTickRate: 1, // Damage every 1 second
};

// =============================================================================
// Passive Ability
// =============================================================================

/**
 * Arcane Surge - Gain stacks on ability casts. At 4 stacks, next ability
 * deals 30% bonus damage and consumes all stacks.
 */
export const MagnusPassive: PassiveAbilityDefinition = {
  id: 'magnus_passive',
  name: 'Arcane Surge',
  description: 'After casting 4 abilities, your next ability deals 30% bonus damage.',
  trigger: 'on_ability_cast',
  usesStacks: true,
  maxStacks: 4,
  stacksPerTrigger: 1,
  stackDuration: 10,
  requiredStacks: 4,
  consumeStacksOnActivation: true,
};

// =============================================================================
// Collision & Animation
// =============================================================================

const MAGNUS_COLLISION: CircleCollision = {
  type: 'circle',
  radius: 18,  // Ranged mage, slightly smaller hitbox
  offset: { x: 0, y: 2 },
};

const MAGNUS_ANIMATIONS: ChampionAnimations = {
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
      { frame: 0, trigger: { type: 'sound', soundId: 'staff_charge' } },
      { frame: 3, trigger: { type: 'projectile' } },  // Ranged attack spawns projectile
      { frame: 3, trigger: { type: 'sound', soundId: 'staff_fire' } },
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
    magnus_fireball: {
      id: 'magnus_fireball',
      totalFrames: 8,
      baseFrameDuration: 0.0625,  // 500ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'fireball_charge' } },
        { frame: 4, trigger: { type: 'projectile' } },
        { frame: 4, trigger: { type: 'vfx', vfxId: 'fireball_cast' } },
      ],
    },
    magnus_shield: {
      id: 'magnus_shield',
      totalFrames: 4,
      baseFrameDuration: 0.075,  // 300ms total
      loop: false,
      keyframes: [
        { frame: 1, trigger: { type: 'effect', effectId: 'shield' } },
        { frame: 1, trigger: { type: 'vfx', vfxId: 'arcane_barrier' } },
      ],
    },
    magnus_mud: {
      id: 'magnus_mud',
      totalFrames: 6,
      baseFrameDuration: 0.083,  // 500ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'mud_cast' } },
        { frame: 3, trigger: { type: 'effect', effectId: 'zone' } },
        { frame: 3, trigger: { type: 'vfx', vfxId: 'mud_pool' } },
      ],
    },
    magnus_meteor: {
      id: 'magnus_meteor',
      totalFrames: 10,
      baseFrameDuration: 0.08,  // 800ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'meteor_summon' } },
        { frame: 6, trigger: { type: 'effect', effectId: 'zone' } },
        { frame: 6, trigger: { type: 'vfx', vfxId: 'inferno_zone' } },
      ],
    },
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
    E: 'magnus_mud',
    R: 'magnus_meteor',
  },
  passive: 'magnus_passive',
  collision: MAGNUS_COLLISION,
  animations: MAGNUS_ANIMATIONS,
  attackAnimationSpeedScale: true,
};

// =============================================================================
// Ability Registry Export
// =============================================================================

export const MagnusAbilities: Record<string, AbilityDefinition> = {
  magnus_fireball: MagnusFireball,
  magnus_shield: MagnusShield,
  magnus_mud: MagnusMudGround,
  magnus_meteor: MagnusMeteor,
};
