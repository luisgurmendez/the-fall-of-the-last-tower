/**
 * Warrior - Kael, The Iron Vanguard
 * Melee bruiser with engage and durability
 */

import type {
  ChampionDefinition,
  ChampionBaseStats,
  ChampionGrowthStats,
} from "../../types/champions";
import type {
  AbilityDefinition,
  AbilityScaling,
  PassiveAbilityDefinition,
} from "../../types/abilities";
import type { CircleCollision } from "../../types/collision";
import type { ChampionAnimations } from "../../types/animation";

// =============================================================================
// Helper function for creating scaling
// =============================================================================

function scaling(
  base: number[],
  options?: {
    adRatio?: number;
    apRatio?: number;
    bonusHealthRatio?: number;
    maxHealthRatio?: number;
    missingHealthRatio?: number;
  },
): AbilityScaling {
  return {
    base,
    ...options,
  };
}

// =============================================================================
// Base Stats
// =============================================================================

const WARRIOR_BASE_STATS: ChampionBaseStats = {
  health: 630,
  healthRegen: 1.6,
  resource: 280,
  resourceRegen: 2.3,
  attackDamage: 60,
  abilityPower: 0,
  attackSpeed: 0.65,
  attackRange: 40, // Melee
  armor: 32,
  magicResist: 32,
  movementSpeed: 103,
  critChance: 0,
  critDamage: 2.0,
};

const WARRIOR_GROWTH_STATS: ChampionGrowthStats = {
  health: 95,
  healthRegen: 0.16,
  resource: 40,
  resourceRegen: 0.17,
  attackDamage: 3.5,
  attackSpeed: 2.5,
  armor: 3.6,
  magicResist: 1.5,
};

// =============================================================================
// Abilities
// =============================================================================

export const WarriorSlash: AbilityDefinition = {
  id: "warrior_slash",
  name: "Cleaving Strike",
  description: "Slash enemies in a cone, dealing {damage} physical damage.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [40, 45, 50, 55, 60],
  cooldown: [7, 6.5, 6, 5.5, 5],
  range: 130,
  aoeRadius: 130,
  aoeDelay: 0.3, // The swing: 0.55 s with the cast, 0.37 of the time to step back out
  coneAngle: Math.PI / 2, // 90 degrees
  shape: "cone",
  damage: {
    type: "physical",
    scaling: scaling([50, 80, 110, 140, 170], { adRatio: 0.8 }),
  },
};

export const WarriorShield: AbilityDefinition = {
  id: "warrior_shield",
  name: "Iron Will",
  description: "Gain a shield absorbing {shield} damage for 3 seconds.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [14, 13, 12, 11, 10],
  shield: {
    scaling: scaling([60, 90, 120, 150, 180], { bonusHealthRatio: 0.08 }),
    duration: 3,
  },
};

export const WarriorCharge: AbilityDefinition = {
  id: "warrior_charge",
  name: "Valiant Charge",
  description:
    "Dash forward, dealing {damage} physical damage to enemies hit and slowing them by 30% for 1.5 seconds.",
  type: "active",
  targetType: "skillshot",
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [12, 11, 10, 9, 8],
  range: 260,
  dash: {
    speed: 650,
    distance: 260,
  },
  aoeRadius: 45, // Hitbox radius during the dash (a band about 90 wide)
  damage: {
    type: "physical",
    scaling: scaling([50, 85, 120, 155, 190], { adRatio: 0.6 }),
  },
  appliesEffects: ["slow_30"],
  effectDuration: 1.5,
};

export const WarriorUltimate: AbilityDefinition = {
  id: "warrior_ultimate",
  name: "Heroic Strike",
  description:
    "Leap to target enemy and slam down, dealing {damage} physical damage and stunning them for 1.25 seconds.",
  type: "active",
  targetType: "target_enemy",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [120, 100, 80],
  range: 260,
  dash: {
    speed: 700, // Fast leap
    distance: 260, // Matches ability range
  },
  damage: {
    type: "physical",
    scaling: scaling([125, 225, 325], { adRatio: 0.8 }),
  },
  appliesEffects: ["stun"],
  effectDuration: 1.25,
};

// =============================================================================
// Passive Ability
// =============================================================================

/** Undying Resolve's base shield from levels 1, 6, 11 and 16 (getPassiveLevelValue) */
const UNDYING_RESOLVE_SHIELD = { levels: [1, 6, 11, 16], values: [80, 120, 160, 200] };

/**
 * Undying Resolve - When below 30% health, gain a shield and bonus armor.
 * 60 second internal cooldown.
 */
export const WarriorPassive: PassiveAbilityDefinition = {
  id: "warrior_passive",
  name: "Undying Resolve",
  description:
    "When below 30% health, gain a shield absorbing {shield} damage and 20% bonus armor for 5 seconds. 60 second cooldown.",
  trigger: "on_low_health",
  healthThreshold: 0.3,
  internalCooldown: 60,
  shield: {
    // Its base by level, plus 10% bonus health
    scaling: scaling(UNDYING_RESOLVE_SHIELD.values, { bonusHealthRatio: 0.1 }),
    duration: 5,
  },
  // 20% bonus armor, while the shield lasts
  appliesEffects: ["warrior_undying_resolve"],
  levelScaling: UNDYING_RESOLVE_SHIELD,
};

// =============================================================================
// Collision & Animation
// =============================================================================

const WARRIOR_COLLISION: CircleCollision = {
  type: "circle",
  radius: 20, // Melee champion, slightly smaller hitbox
  offset: { x: 0, y: 2 }, // Slightly offset down for feet
};

const WARRIOR_ANIMATIONS: ChampionAnimations = {
  idle: {
    id: "idle",
    totalFrames: 4,
    baseFrameDuration: 0.2,
    loop: true,
    keyframes: [],
  },
  walk: {
    id: "walk",
    totalFrames: 8,
    baseFrameDuration: 0.1,
    loop: true,
    keyframes: [],
  },
  attack: {
    id: "attack",
    totalFrames: 6,
    baseFrameDuration: 0.083, // ~500ms total at 1.0 AS
    loop: false,
    keyframes: [
      { frame: 3, trigger: { type: "damage" } }, // Damage at frame 3 (50%)
    ],
  },
  death: {
    id: "death",
    totalFrames: 8,
    baseFrameDuration: 0.125,
    loop: false,
    keyframes: [],
  },
  abilities: {
    warrior_slash: {
      id: "warrior_slash",
      totalFrames: 8,
      baseFrameDuration: 0.05, // 400ms total
      loop: false,
      keyframes: [
      ],
    },
    warrior_shield: {
      id: "warrior_shield",
      totalFrames: 4,
      baseFrameDuration: 0.075, // 300ms total
      loop: false,
      keyframes: [
      ],
    },
    warrior_charge: {
      id: "warrior_charge",
      totalFrames: 6,
      baseFrameDuration: 0.067, // 400ms total
      loop: false,
      keyframes: [
      ],
    },
    warrior_ultimate: {
      id: "warrior_ultimate",
      totalFrames: 10,
      baseFrameDuration: 0.06, // 600ms total
      loop: false,
      keyframes: [
      ],
    },
  },
};

// =============================================================================
// Champion Definition
// =============================================================================

export const WarriorDefinition: ChampionDefinition = {
  id: "warrior",
  name: "Kael",
  title: "The Iron Vanguard",
  class: "warrior",
  attackType: "melee",
  resourceType: "mana",
  baseStats: WARRIOR_BASE_STATS,
  growthStats: WARRIOR_GROWTH_STATS,
  abilities: {
    Q: "warrior_slash",
    W: "warrior_shield",
    E: "warrior_charge",
    R: "warrior_ultimate",
  },
  passive: "warrior_passive",
  collision: WARRIOR_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/warrior.ts), for the health bar */
  visualHeight: 78,
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
