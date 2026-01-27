/**
 * Vile - The Soul Herder
 * Ranged fighter/assassin jungler with soul-based mechanics
 */

import type {
  ChampionDefinition,
  ChampionBaseStats,
  ChampionGrowthStats,
} from '../../types/champions';
import type { AbilityDefinition, AbilityScaling, PassiveAbilityDefinition, AmmoBehavior } from '../../types/abilities';
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

const VILE_BASE_STATS: ChampionBaseStats = {
  health: 580,
  healthRegen: 7,
  resource: 300, // Mana
  resourceRegen: 7,
  attackDamage: 60,
  abilityPower: 0,
  attackSpeed: 0.65,
  attackRange: 450, // Ranged, becomes melee (100) during R
  armor: 32,
  magicResist: 32,
  movementSpeed: 340,
  critChance: 0,
  critDamage: 2.0,
};

const VILE_GROWTH_STATS: ChampionGrowthStats = {
  health: 95,
  healthRegen: 0.8,
  resource: 40,
  resourceRegen: 0.5,
  attackDamage: 3.5,
  attackSpeed: 2.5,
  armor: 4,
  magicResist: 1.5,
};

// =============================================================================
// Abilities
// =============================================================================

/**
 * Q - Black Arrows of Vilix
 * Charge-based skillshot that can be recast to dash to hit location
 */
export const VileBlackArrows: AbilityDefinition = {
  id: 'vile_black_arrows',
  name: 'Black Arrows of Vilix',
  description: 'Charge to fire an arrow that deals {damage} physical damage and slows by 50% for 2 seconds. Hit location can be dashed to by recasting.',
  type: 'active',
  targetType: 'skillshot',
  maxRank: 5,
  manaCost: [50, 55, 60, 65, 70],
  cooldown: [12, 11, 10, 9, 8],
  range: 800, // Base range, increases with charge up to +600
  projectileSpeed: 1800,
  projectileRadius: 25,
  shape: 'line',
  damage: {
    type: 'physical',
    scaling: scaling([70, 110, 150, 190, 230], { adRatio: 1.0 }),
  },
  appliesEffects: ['vile_q_slow'],
  effectDuration: 2,
  // Charge mechanics (follows ChargeBehavior interface)
  charge: {
    minChargeTime: 0.3,
    maxChargeTime: 2.0,
    canMoveWhileCharging: false,
    maxChargeRangeBonus: 600, // Additional range at max charge
    minChargeMultiplier: 1.0, // Full damage at min charge
    maxChargeMultiplier: 1.0, // No damage scaling with charge
  },
  // Recast mechanics
  recastWindow: 3.0, // 3 seconds to recast after hit
  recastCondition: 'on_hit', // Recast available when ability hits (or wall)
  recast: 1, // Can recast once (dash to hit location)
  stopsOnWall: true, // Projectile stops when hitting wall, enables recast
};

/**
 * W - Veil of Darkness
 * Self-targeted ability that grants stealth, invulnerability, and self-root
 */
export const VileVeilOfDarkness: AbilityDefinition = {
  id: 'vile_veil_of_darkness',
  name: 'Veil of Darkness',
  description: 'Become invisible and invulnerable for 2 seconds but cannot move. After the veil ends, gain 50% movement speed and slow resistance for 2 seconds.',
  type: 'active',
  targetType: 'self',
  maxRank: 5,
  manaCost: [80, 75, 70, 65, 60],
  cooldown: [22, 20, 18, 16, 14],
  appliesEffects: ['vile_invulnerable', 'vile_rooted_self', 'vile_stealth'],
  effectDuration: 2,
  // Post-effect buffs applied after duration ends (handled by executor)
  postEffects: {
    effects: ['vile_post_veil_speed', 'vile_slow_resist'],
    duration: 2,
  },
};

/**
 * E - Roots of Vilix
 * Place an invisible trap that triggers on enemy champions
 * Uses charge system (max 5 charges)
 */
export const VileRootsOfVilix: AbilityDefinition = {
  id: 'vile_roots_of_vilix',
  name: 'Roots of Vilix',
  description: 'Place an invisible trap that roots enemy champions for 1 second and grants Vile 5 soul stacks. Stores up to 5 charges.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 5,
  manaCost: [0, 0, 0, 0, 0], // Uses charges instead of mana
  cooldown: [1, 1, 1, 1, 1], // Small cooldown between trap placements
  range: 600,
  // Ammo/charge system (follows AmmoBehavior interface)
  ammo: {
    maxCharges: 5,
    startingCharges: 5,
    rechargeTime: [40, 35, 30, 25, 20], // Per rank
  } as AmmoBehavior,
  // Trap properties
  trap: {
    triggerRadius: 100,
    duration: 120, // 2 minutes
    isStealthed: true,
    rootDuration: 1,
    soulStacksOnTrigger: 5,
    // Explosion properties (when R is cast)
    explosionDamage: [80, 120, 160], // Based on R rank
    explosionRadius: 300,
    explosionRootDuration: 1,
  },
};

/**
 * R - Restoration of Vilix
 * Transform into a powerful melee form for 10 seconds
 */
export const VileRestorationOfVilix: AbilityDefinition = {
  id: 'vile_restoration_of_vilix',
  name: 'Restoration of Vilix',
  description: 'Transform for 10 seconds, gaining massive stats, melee range, and an aura that damages nearby enemies. Grants 100 soul stacks and causes all traps to explode.',
  type: 'active',
  targetType: 'self',
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [140, 120, 100],
  // Stat transform properties (uses StatTransformBehavior)
  statTransform: {
    duration: 10,
    attackRange: 100, // Melee
    statModifiers: {
      maxHealth: [200, 350, 500],
      attackDamage: [30, 50, 70],
      attackSpeed: [0.30, 0.45, 0.60], // Percent bonus
      movementSpeed: [0.20, 0.30, 0.40], // Percent bonus
    },
    soulStacksOnCast: 100,
    triggersTrapExplosion: true,
    canEndEarly: false,
  },
  // Aura damage (per second to nearby enemies)
  aura: {
    radius: 300,
    damage: {
      type: 'magic',
      scaling: scaling([25, 40, 55], { apRatio: 0.20 }),
    },
    tickRate: 1, // Every 1 second
  },
};

// =============================================================================
// Passive Ability
// =============================================================================

/**
 * Souls of Vilix - Dual-trigger passive
 * on_kill: Gain soul stacks based on target type and level
 * on_hit: Consume all stacks to deal bonus damage to champions
 */
export const VilePassive: PassiveAbilityDefinition = {
  id: 'vile_passive',
  name: 'Souls of Vilix',
  description: 'Killing enemies grants soul stacks. Basic attacks against champions consume all stacks to deal bonus physical damage.',
  trigger: 'on_kill', // Primary trigger
  additionalTriggers: ['on_hit'], // Secondary trigger for consumption
  usesStacks: true,
  maxStacks: 0, // No cap
  stackDuration: 0, // No decay
  // Soul stack scaling by level and target type
  // Handled by custom handler in PassiveTriggerSystem
  soulScaling: {
    minion: {
      levels: [1, 6, 11, 16],
      stacks: [2, 3, 5, 7],
    },
    jungle: {
      levels: [1, 6, 11, 16],
      stacks: [5, 7, 9, 11],
    },
    champion: {
      levels: [1, 6, 11, 16],
      stacks: [7, 9, 11, 15],
    },
  },
  // Damage on consume (basic attack vs champion)
  damage: {
    type: 'physical',
    scaling: scaling([0]), // Base 0, damage = stacks consumed
  },
  consumeStacksOnActivation: true,
};

// =============================================================================
// Collision & Animation
// =============================================================================

const VILE_COLLISION: CircleCollision = {
  type: 'circle',
  radius: 20,
  offset: { x: 0, y: 2 },
};

const VILE_ANIMATIONS: ChampionAnimations = {
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
    baseFrameDuration: 0.1, // Scales with attack speed
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: 'sound', soundId: 'vile_attack' } },
      { frame: 3, trigger: { type: 'damage' } },
      { frame: 3, trigger: { type: 'sound', soundId: 'vile_hit' } },
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
    vile_black_arrows: {
      id: 'vile_black_arrows',
      totalFrames: 8,
      baseFrameDuration: 0.05,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'vile_charge' } },
        { frame: 4, trigger: { type: 'projectile' } },
        { frame: 4, trigger: { type: 'vfx', vfxId: 'black_arrow' } },
      ],
    },
    vile_veil_of_darkness: {
      id: 'vile_veil_of_darkness',
      totalFrames: 6,
      baseFrameDuration: 0.08,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'vile_veil' } },
        { frame: 2, trigger: { type: 'effect', effectId: 'veil' } },
        { frame: 2, trigger: { type: 'vfx', vfxId: 'dark_veil' } },
      ],
    },
    vile_roots_of_vilix: {
      id: 'vile_roots_of_vilix',
      totalFrames: 5,
      baseFrameDuration: 0.06,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'vile_trap_place' } },
        { frame: 3, trigger: { type: 'vfx', vfxId: 'root_trap' } },
      ],
    },
    vile_restoration_of_vilix: {
      id: 'vile_restoration_of_vilix',
      totalFrames: 10,
      baseFrameDuration: 0.08,
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'sound', soundId: 'vile_transform' } },
        { frame: 5, trigger: { type: 'effect', effectId: 'transform' } },
        { frame: 5, trigger: { type: 'vfx', vfxId: 'soul_restoration' } },
      ],
    },
  },
};

// =============================================================================
// Champion Definition
// =============================================================================

export const VileDefinition: ChampionDefinition = {
  id: 'vile',
  name: 'Vile',
  title: 'The Soul Herder',
  class: 'fighter',
  attackType: 'ranged', // Becomes melee during R
  resourceType: 'mana',
  baseStats: VILE_BASE_STATS,
  growthStats: VILE_GROWTH_STATS,
  abilities: {
    Q: 'vile_black_arrows',
    W: 'vile_veil_of_darkness',
    E: 'vile_roots_of_vilix',
    R: 'vile_restoration_of_vilix',
  },
  passive: 'vile_passive',
  collision: VILE_COLLISION,
  animations: VILE_ANIMATIONS,
  attackAnimationSpeedScale: true,
};

// =============================================================================
// Ability Registry Export
// =============================================================================

export const VileAbilities: Record<string, AbilityDefinition> = {
  vile_black_arrows: VileBlackArrows,
  vile_veil_of_darkness: VileVeilOfDarkness,
  vile_roots_of_vilix: VileRootsOfVilix,
  vile_restoration_of_vilix: VileRestorationOfVilix,
};
