/**
 * Protobot 45 - The Sentient Machine
 * A war machine that learns from every blow it takes (passive): it reels
 * enemies in with a magnetic claw (Q), overcharges into a shield (W), sends
 * them flying with a rocket punch (E), and overloads into a pulse that
 * shorts out their abilities and their shields (R).
 * Adapted from the user's card "Protobot 45, Sentient Machine".
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

function scaling(
  base: number[],
  options?: { adRatio?: number; apRatio?: number; maxHealthRatio?: number },
): AbilityScaling {
  return { base, ...options };
}

// =============================================================================
// Machine Learning and Magnetism: the server's ProtobotHooks and ProtobotQHandler apply them
// =============================================================================

export const PROTOBOT_MACHINE = {
  /** Each lesson: this much armor and magic resist... */
  resistsPerLesson: 3,
  /** ...for this long... */
  lessonDuration: 6,
  /** ...up to this many at once */
  maxLessons: 6,
  /** He learns at most once in this many seconds */
  lessonEvery: 1,
  /** Magnetism pulls a champion this fast, to this far in front of him */
  pullSpeed: 1100,
  pullGap: 20,
  /** The shield he gains when the claw catches a champion, by Q's rank */
  catchShield: [40, 60, 80, 100, 120],
  catchShieldDuration: 3,
} as const;

// =============================================================================
// Base Stats: a slow, heavy tank
// =============================================================================

const PROTOBOT_BASE_STATS: ChampionBaseStats = {
  health: 600,
  healthRegen: 1.4,
  resource: 300,
  resourceRegen: 2.4,
  attackDamage: 56,
  abilityPower: 0,
  attackSpeed: 0.63,
  attackRange: 45, // Big steel fists
  armor: 34,
  magicResist: 32,
  movementSpeed: 100,
  critChance: 0,
  critDamage: 2.0,
};

const PROTOBOT_GROWTH_STATS: ChampionGrowthStats = {
  health: 98,
  healthRegen: 0.16,
  resource: 40,
  resourceRegen: 0.2,
  attackDamage: 3,
  attackSpeed: 1.8,
  armor: 4.2,
  magicResist: 1.6,
};

// =============================================================================
// Abilities
// =============================================================================

/** Q: a magnetic claw; a champion it catches is pulled to him (ProtobotQHandler) */
export const ProtobotMagnetism: AbilityDefinition = {
  id: "protobot_q",
  name: "Magnetism",
  description:
    "Fire a magnetic claw: the first enemy hit takes {damage} magic damage. An enemy champion is pulled to you, stunned on the way, and you gain a shield of 40-120 for 3 seconds.",
  type: "active",
  targetType: "skillshot",
  maxRank: 5,
  manaCost: [90, 90, 90, 90, 90],
  cooldown: [18, 16.5, 15, 13.5, 12],
  range: 470,
  projectileSpeed: 750,
  projectileRadius: 24,
  shape: "line",
  damage: {
    type: "magic",
    scaling: scaling([70, 115, 160, 205, 250], { apRatio: 0.6 }),
  },
};

/** W: he overcharges: a shield and a burst of speed (generic self shield and effect) */
export const ProtobotHypercharge: AbilityDefinition = {
  id: "protobot_w",
  name: "Hypercharge",
  description:
    "Overcharge: a shield absorbing {shield} damage for 3 seconds, and 30% movement speed for 2 seconds.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [16, 15, 14, 13, 12],
  shield: {
    scaling: scaling([60, 95, 130, 165, 200], { maxHealthRatio: 0.06 }),
    duration: 3,
  },
  appliesEffects: ["speed_30"],
  effectDuration: 2,
};

/** E: a rocket punch that knocks the target up (ProtobotEHandler) */
export const ProtobotRocketPunch: AbilityDefinition = {
  id: "protobot_e",
  name: "Rocket Punch",
  description:
    "Fire your fist at the target enemy: {damage} magic damage and knocked up for 1 second. You gain a shield of {shield} for 2 seconds.",
  type: "active",
  targetType: "target_enemy",
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [10, 9.5, 9, 8.5, 8],
  range: 170,
  damage: {
    type: "magic",
    scaling: scaling([60, 100, 140, 180, 220], { apRatio: 0.5 }),
  },
  shield: {
    scaling: scaling([30, 45, 60, 75, 90]),
    duration: 2,
  },
  appliesEffects: ["knockup"],
  effectDuration: 1,
};

/** R: an electromagnetic pulse around him (ProtobotRHandler) */
export const ProtobotOverload: AbilityDefinition = {
  id: "protobot_r",
  name: "Overload",
  description:
    "Charge up for half a second, then release a pulse: enemies within reach take {damage} magic damage, lose their shields and are silenced for 1.5 seconds.",
  type: "active",
  targetType: "no_target",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [100, 85, 70],
  aoeRadius: 280,
  aoeDelay: 0.5, // The charge
  shape: "circle",
  damage: {
    type: "magic",
    scaling: scaling([150, 250, 350], { apRatio: 0.7 }),
  },
  appliesEffects: ["silence"],
  effectDuration: 1.5,
};

// =============================================================================
// Passive
// =============================================================================

/** Machine Learning - he hardens against the champions that hurt him (ProtobotHooks) */
export const ProtobotPassive: PassiveAbilityDefinition = {
  id: "protobot_passive",
  name: "Machine Learning",
  description:
    "Each time an enemy champion damages you (at most once a second) you learn from it: 3 armor and magic resist for 6 seconds, up to 6 times.",
  trigger: "always",
};

// =============================================================================
// Collision & Animation
// =============================================================================

const PROTOBOT_COLLISION: CircleCollision = {
  type: "circle",
  radius: 25,
  offset: { x: 0, y: 2 },
};

const PROTOBOT_ANIMATIONS: ChampionAnimations = {
  idle: { id: "idle", totalFrames: 4, baseFrameDuration: 0.2, loop: true, keyframes: [] },
  walk: { id: "walk", totalFrames: 8, baseFrameDuration: 0.1, loop: true, keyframes: [] },
  attack: {
    id: "attack",
    totalFrames: 6,
    baseFrameDuration: 0.083,
    loop: false,
    keyframes: [{ frame: 3, trigger: { type: "damage" } }],
  },
  death: { id: "death", totalFrames: 8, baseFrameDuration: 0.125, loop: false, keyframes: [] },
};

// =============================================================================
// Champion Definition
// =============================================================================

export const ProtobotDefinition: ChampionDefinition = {
  id: "protobot",
  name: "Protobot 45",
  title: "The Sentient Machine",
  class: "tank",
  attackType: "melee",
  resourceType: "mana",
  baseStats: PROTOBOT_BASE_STATS,
  growthStats: PROTOBOT_GROWTH_STATS,
  abilities: {
    Q: "protobot_q",
    W: "protobot_w",
    E: "protobot_e",
    R: "protobot_r",
  },
  passive: "protobot_passive",
  collision: PROTOBOT_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/protobot.ts), for the health bar */
  visualHeight: 88,
  animations: PROTOBOT_ANIMATIONS,
  attackAnimationSpeedScale: true,
};

export const ProtobotAbilities: Record<string, AbilityDefinition> = {
  protobot_q: ProtobotMagnetism,
  protobot_w: ProtobotHypercharge,
  protobot_e: ProtobotRocketPunch,
  protobot_r: ProtobotOverload,
};
