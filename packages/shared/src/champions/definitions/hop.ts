/**
 * Hop-To-Eat - Deadly Cuteness
 * A rabbit far more dangerous than it looks: every few seconds its next
 * basic attack is a hop onto its prey (passive). Its fangs bite through
 * armor (Q), it stops to eat a carrot that heals it and makes it frantic
 * (W), it hops away or in (E), and it kicks an enemy champion flying into
 * its allies (R).
 * Adapted from the user's card "Hop-To-Eat, Deadly Cuteness".
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
  options?: { adRatio?: number; apRatio?: number; missingHealthRatio?: number },
): AbilityScaling {
  return { base, ...options };
}

// =============================================================================
// Hop to It! and Savage Kick: the server's HopHooks and HopRHandler apply them
// =============================================================================

export const HOP_HOP = {
  /** Seconds between hops */
  every: 6,
  /** How far away the hopping attack can start */
  reach: 250,
  /** The hop's speed (faster if the attack's blow comes sooner) */
  speed: 900,
  /** The hopping attack's bonus physical damage: base plus per level, plus a share of attack damage */
  bonusBase: 15,
  bonusPerLevel: 5,
  bonusAdRatio: 0.3,
  /** Savage Kick: how far and how fast the target flies */
  kickDistance: 380,
  kickSpeed: 1000,
  /** An enemy champion it flies into is knocked up this long */
  crashKnockup: 0.75,
  /** How close the flying champion has to pass to crash into another */
  crashRadius: 55,
} as const;

// =============================================================================
// Base Stats: a quick, fragile melee assassin
// =============================================================================

const HOP_BASE_STATS: ChampionBaseStats = {
  health: 530,
  healthRegen: 1.6,
  resource: 280,
  resourceRegen: 2.4,
  attackDamage: 62,
  abilityPower: 0,
  attackSpeed: 0.68,
  attackRange: 40, // Teeth and feet
  armor: 27,
  magicResist: 30,
  movementSpeed: 106, // The quickest
  critChance: 0,
  critDamage: 2.0,
};

const HOP_GROWTH_STATS: ChampionGrowthStats = {
  health: 88,
  healthRegen: 0.16,
  resource: 40,
  resourceRegen: 0.2,
  attackDamage: 3.3,
  attackSpeed: 3,
  armor: 4,
  magicResist: 1.3,
};

// =============================================================================
// Abilities
// =============================================================================

/** Q: a bite that pierces armor (HopQHandler) */
export const HopRodentFangs: AbilityDefinition = {
  id: "hop_q",
  name: "Rodent Fangs",
  description:
    "Bite the target enemy through its armor: it loses 10 armor for 4 seconds, then takes {damage} physical damage.",
  type: "active",
  targetType: "target_enemy",
  maxRank: 5,
  manaCost: [35, 35, 35, 35, 35],
  cooldown: [7, 6.5, 6, 5.5, 5],
  range: 110,
  damage: {
    type: "physical",
    scaling: scaling([50, 85, 120, 155, 190], { adRatio: 0.8 }),
  },
  appliesEffects: ["armor_reduction"],
  effectDuration: 4,
};

/** W: it stops to eat a carrot: a heal, then frantic attacks (HopWHandler) */
export const HopCarrotBreak: AbilityDefinition = {
  id: "hop_w",
  name: "Carrot Break",
  description:
    "Stop to eat a carrot: heal {heal} and attack 30% faster for 3 seconds, but you can't move for 0.75 seconds while you eat.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [14, 13, 12, 11, 10],
  heal: {
    scaling: scaling([60, 95, 130, 165, 200], { adRatio: 0.4, missingHealthRatio: 0.06 }),
  },
  appliesEffects: ["hop_eating", "hop_sugar_rush"],
  effectDuration: 3,
};

/** E: a long hop; the next basic attack hops again (generic dash, HopHooks) */
export const HopBunnyHop: AbilityDefinition = {
  id: "hop_e",
  name: "Bunny Hop",
  description:
    "Hop to a nearby spot. Your next basic attack hops onto its target again (Hop to It!).",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [40, 40, 40, 40, 40],
  cooldown: [12, 11, 10, 9, 8],
  range: 220,
  dash: {
    speed: 750,
    distance: 220,
  },
};

/** R: a kick that sends an enemy champion flying into its allies (HopRHandler) */
export const HopSavageKick: AbilityDefinition = {
  id: "hop_r",
  name: "Savage Kick",
  description:
    "Kick the target enemy champion away: {damage} physical damage, and it flies back, stunned. Enemy champions it crashes into take the same damage and are knocked up for 0.75 seconds.",
  type: "active",
  targetType: "target_enemy",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [110, 95, 80],
  range: 120,
  affectsMinions: false,
  affectsJungleCamps: false,
  damage: {
    type: "physical",
    scaling: scaling([150, 250, 350], { adRatio: 1 }),
  },
};

// =============================================================================
// Passive
// =============================================================================

/** Hop to It! - every few seconds its next attack is a hop (HopHooks) */
export const HopPassive: PassiveAbilityDefinition = {
  id: "hop_passive",
  name: "Hop to It!",
  description:
    "Every 6 seconds, your next basic attack hops onto its target from up to 250 away and deals 20-105 (+30% attack damage) bonus physical damage.",
  trigger: "always",
};

// =============================================================================
// Collision & Animation
// =============================================================================

const HOP_COLLISION: CircleCollision = {
  type: "circle",
  radius: 19,
  offset: { x: 0, y: 2 },
};

const HOP_ANIMATIONS: ChampionAnimations = {
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

export const HopDefinition: ChampionDefinition = {
  id: "hop",
  name: "Hop-To-Eat",
  title: "Deadly Cuteness",
  class: "assassin",
  attackType: "melee",
  resourceType: "mana",
  baseStats: HOP_BASE_STATS,
  growthStats: HOP_GROWTH_STATS,
  abilities: {
    Q: "hop_q",
    W: "hop_w",
    E: "hop_e",
    R: "hop_r",
  },
  passive: "hop_passive",
  collision: HOP_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/hop.ts), for the health bar */
  visualHeight: 75,
  animations: HOP_ANIMATIONS,
  attackAnimationSpeedScale: true,
};

export const HopAbilities: Record<string, AbilityDefinition> = {
  hop_q: HopRodentFangs,
  hop_w: HopCarrotBreak,
  hop_e: HopBunnyHop,
  hop_r: HopSavageKick,
};
