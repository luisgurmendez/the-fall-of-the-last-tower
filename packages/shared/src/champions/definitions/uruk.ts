/**
 * Urûk - Silver Dragonborn
 * A spear fighter with long reach: pokes with Q, wins trades with an
 * armor-piercing charged attack (W), shields himself in silver scales that
 * burst in frost (E, ability power) and finishes the weakened with a leap
 * (R). His passive hunts: hurt enemy champions near him make him faster.
 * Adapted from the user's card "Urûk, Silver Dragonborn".
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
  options?: { adRatio?: number; apRatio?: number },
): AbilityScaling {
  return { base, ...options };
}

// =============================================================================
// Base Stats: a little under Kael's, his edge is the spear's reach
// =============================================================================

const URUK_BASE_STATS: ChampionBaseStats = {
  health: 545,
  healthRegen: 1.6,
  resource: 300,
  resourceRegen: 2.4,
  attackDamage: 60,
  abilityPower: 0,
  attackSpeed: 0.65,
  attackRange: 95, // A spear: melee, with reach
  armor: 30,
  magicResist: 30,
  movementSpeed: 103,
  critChance: 0,
  critDamage: 2.0,
};

const URUK_GROWTH_STATS: ChampionGrowthStats = {
  health: 88,
  healthRegen: 0.16,
  resource: 40,
  resourceRegen: 0.17,
  attackDamage: 3.4,
  attackSpeed: 2.8,
  armor: 3.6,
  magicResist: 1.3,
};

// =============================================================================
// Abilities
// =============================================================================

/** Q: a spear thrust in a line, hitting every enemy along it */
export const UrukThrust: AbilityDefinition = {
  id: "uruk_q",
  name: "Spear Thrust",
  description: "Thrust the spear forward, dealing {damage} physical damage to every enemy in a line.",
  type: "active",
  targetType: "ground_target",
  shape: "line",
  maxRank: 5,
  manaCost: [40, 45, 50, 55, 60],
  cooldown: [7, 6.5, 6, 5.5, 5],
  range: 260,
  aoeRadius: 35, // Half the line's width
  aoeDelay: 0.15, // The thrust
  damage: {
    type: "physical",
    scaling: scaling([60, 95, 130, 165, 200], { adRatio: 0.8 }),
  },
};

/**
 * W: the next basic attack reaches further and deals bonus damage, and his
 * physical damage pierces armor for a few seconds (UrukHooks)
 */
export const UrukSpearCharge: AbilityDefinition = {
  id: "uruk_w",
  name: "Spear Charge",
  description:
    "Your next basic attack within 4 seconds reaches 40 further and deals {damage} bonus physical damage. For 4 seconds your physical damage ignores 10/14/18/22/26 armor.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [30, 30, 30, 30, 30],
  cooldown: [8, 7.5, 7, 6.5, 6],
  damage: {
    type: "physical",
    scaling: scaling([40, 65, 90, 115, 140], { adRatio: 0.5 }),
  },
  appliesEffects: ["uruk_spear_charge", "uruk_piercing"],
  effectDuration: 4,
};

/**
 * E: a shield of silver scales; when it breaks or runs out it bursts in
 * frost around him (UrukHooks), damaging and slowing
 */
export const UrukSilverScales: AbilityDefinition = {
  id: "uruk_e",
  name: "Silver Scales",
  description:
    "Harden your scales into a shield absorbing {shield} damage for 2.5 seconds. When it breaks or ends it bursts in frost, dealing {damage} magic damage around you and slowing by 30% for 1 second.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [13, 12, 11, 10, 9],
  aoeRadius: 170, // The frost burst
  shield: {
    scaling: scaling([70, 100, 130, 160, 190], { apRatio: 0.6 }),
    duration: 2.5,
  },
  // The burst
  damage: {
    type: "magic",
    scaling: scaling([50, 75, 100, 125, 150], { apRatio: 0.5 }),
  },
  appliesEffects: ["slow_30"],
  effectDuration: 1,
};

/** R: leap to an enemy and run it through, harder the lower its health */
export const UrukFatalStrike: AbilityDefinition = {
  id: "uruk_r",
  name: "Fatal Strike",
  description:
    "Leap to target enemy and run it through, dealing {damage} physical damage, up to 50% more the less health it has left.",
  type: "active",
  targetType: "target_enemy",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [100, 85, 70],
  range: 300,
  dash: {
    speed: 750,
    distance: 300,
  },
  damage: {
    type: "physical",
    scaling: scaling([175, 275, 375], { adRatio: 1.0 }),
    executeBonus: 0.5,
  },
};

// =============================================================================
// Passive
// =============================================================================

/**
 * Hunter's Instinct - near a hurt enemy champion, faster on his feet and
 * with the spear (UrukHooks applies uruk_hunt while it holds)
 */
export const UrukPassive: PassiveAbilityDefinition = {
  id: "uruk_passive",
  name: "Hunter's Instinct",
  description:
    "While an enemy champion you can see within 800 is below 50% health, gain 12% movement speed and 10% attack speed.",
  trigger: "always",
};

// =============================================================================
// Collision & Animation
// =============================================================================

const URUK_COLLISION: CircleCollision = {
  type: "circle",
  radius: 21,
  offset: { x: 0, y: 2 },
};

const URUK_ANIMATIONS: ChampionAnimations = {
  idle: { id: "idle", totalFrames: 4, baseFrameDuration: 0.2, loop: true, keyframes: [] },
  walk: { id: "walk", totalFrames: 8, baseFrameDuration: 0.1, loop: true, keyframes: [] },
  attack: {
    id: "attack",
    totalFrames: 6,
    baseFrameDuration: 0.083,
    loop: false,
    // The thrust lands a little past halfway
    keyframes: [{ frame: 3, trigger: { type: "damage" } }],
  },
  death: { id: "death", totalFrames: 8, baseFrameDuration: 0.125, loop: false, keyframes: [] },
};

// =============================================================================
// Champion Definition
// =============================================================================

export const UrukDefinition: ChampionDefinition = {
  id: "uruk",
  // Without the circumflex: the game's pixel font has no û
  name: "Uruk",
  title: "The Silver Dragonborn",
  class: "warrior",
  attackType: "melee",
  resourceType: "mana",
  baseStats: URUK_BASE_STATS,
  growthStats: URUK_GROWTH_STATS,
  abilities: {
    Q: "uruk_q",
    W: "uruk_w",
    E: "uruk_e",
    R: "uruk_r",
  },
  passive: "uruk_passive",
  collision: URUK_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/uruk.ts), for the health bar */
  visualHeight: 80,
  animations: URUK_ANIMATIONS,
  attackAnimationSpeedScale: true,
};

export const UrukAbilities: Record<string, AbilityDefinition> = {
  uruk_q: UrukThrust,
  uruk_w: UrukSpearCharge,
  uruk_e: UrukSilverScales,
  uruk_r: UrukFatalStrike,
};
