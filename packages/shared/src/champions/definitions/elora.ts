/**
 * Elora Pawynn - The Master Hunter
 * A marksman with the longest reach: every third arrow on the same prey
 * finds a weak point, the next one can be poisoned (Q), a pinning arrow
 * roots the first enemy it meets (W), she rolls out of trouble with her
 * attacks quickening (E), and looses a barrage down a long lane (R).
 * Adapted from the user's card "Elora Pawynn, Master Hunter".
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
// Hunt rules: the server's EloraHooks applies them
// =============================================================================

export const ELORA_HUNT = {
  /** Every this many basic attacks on the same target, a weak point */
  weakPointEvery: 3,
  /** The weak point's bonus physical damage: base plus a share of attack damage */
  weakPointBase: 20,
  weakPointPerLevel: 4,
  weakPointAdRatio: 0.4,
  /** Poison Arrow's poison: magic damage over this long, in ticks */
  poisonDuration: 3,
  poisonTicks: 3,
} as const;

// =============================================================================
// Base Stats: fragile, with the longest attack range
// =============================================================================

const ELORA_BASE_STATS: ChampionBaseStats = {
  health: 540,
  healthRegen: 6.5,
  resource: 300,
  resourceRegen: 2.8,
  attackDamage: 58,
  abilityPower: 0,
  attackSpeed: 0.66,
  attackRange: 240, // The longest bow
  armor: 24,
  magicResist: 30,
  movementSpeed: 100,
  critChance: 0,
  critDamage: 2.0,
};

const ELORA_GROWTH_STATS: ChampionGrowthStats = {
  health: 88,
  healthRegen: 0.6,
  resource: 35,
  resourceRegen: 0.2,
  attackDamage: 3.0,
  attackSpeed: 2.8,
  armor: 3.8,
  magicResist: 1.3,
};

// =============================================================================
// Abilities
// =============================================================================

/** Q: the next arrow is poisoned (EloraQHandler, EloraHooks) */
export const EloraPoisonArrow: AbilityDefinition = {
  id: "elora_q",
  name: "Poison Arrow",
  description:
    "Your next basic attack within 4 seconds deals {damage} bonus physical damage, slows by 20% and poisons for 20/35/50/65/80 (+30% attack damage) magic damage over 3 seconds. The attack is ready at once.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [30, 30, 30, 30, 30],
  cooldown: [7, 6.5, 6, 5.5, 5],
  damage: {
    type: "physical",
    scaling: scaling([20, 40, 60, 80, 100], { adRatio: 0.3 }),
  },
  appliesEffects: ["elora_poison_arrow"],
  effectDuration: 4,
};

/** The poison of Poison Arrow, over its 3 seconds */
export const ELORA_POISON: AbilityScaling = scaling([20, 35, 50, 65, 80], { adRatio: 0.3 });

/** W: a pinning arrow; the first enemy hit is rooted */
export const EloraPinningArrow: AbilityDefinition = {
  id: "elora_w",
  name: "Pinning Arrow",
  description:
    "Loose a heavy arrow that deals {damage} physical damage to the first enemy hit and pins it to the ground (rooted) for 1.2 seconds.",
  type: "active",
  targetType: "skillshot",
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [14, 13, 12, 11, 10],
  range: 460,
  projectileSpeed: 560,
  projectileRadius: 18,
  shape: "line",
  damage: {
    type: "physical",
    scaling: scaling([60, 100, 140, 180, 220], { adRatio: 0.7 }),
  },
  appliesEffects: ["root"],
  effectDuration: 1.2,
};

/** E: a roll; her attacks quicken for a moment (generic dash with a self-buff) */
export const EloraDexterity: AbilityDefinition = {
  id: "elora_e",
  name: "Dexterity",
  description:
    "Roll a short way toward a point. For 2.5 seconds after, you attack 35% faster.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [40, 40, 40, 40, 40],
  cooldown: [12, 11, 10, 9, 8],
  range: 170,
  dash: {
    speed: 700,
    distance: 170,
  },
  appliesEffects: ["elora_dexterity"],
  effectDuration: 2.5,
};

/** R: a barrage of arrows down a long, wide lane (generic line area) */
export const EloraArrowBarrage: AbilityDefinition = {
  id: "elora_r",
  name: "Arrow Barrage",
  description:
    "After a moment, a barrage of arrows sweeps a long lane ahead, dealing {damage} physical damage to every enemy in it and slowing by 30% for 1.5 seconds.",
  type: "active",
  targetType: "ground_target",
  shape: "line",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [100, 85, 70],
  range: 700, // The lane's length
  aoeRadius: 55, // Half the lane's width
  aoeDelay: 0.6, // The arrows fly
  damage: {
    type: "physical",
    scaling: scaling([180, 300, 420], { adRatio: 0.9 }),
  },
  appliesEffects: ["slow_30"],
  effectDuration: 1.5,
};

// =============================================================================
// Passive
// =============================================================================

/** Proficient Archer - every third arrow on the same prey finds a weak point (EloraHooks) */
export const EloraPassive: PassiveAbilityDefinition = {
  id: "elora_passive",
  name: "Proficient Archer",
  description:
    "Your bow reaches farther than any other. Every third basic attack on the same target strikes a weak point for 24-92 (+40% attack damage) bonus physical damage.",
  trigger: "always",
  usesStacks: true,
  maxStacks: ELORA_HUNT.weakPointEvery - 1,
  stackName: "Aim",
};

// =============================================================================
// Collision & Animation
// =============================================================================

const ELORA_COLLISION: CircleCollision = {
  type: "circle",
  radius: 19,
  offset: { x: 0, y: 2 },
};

const ELORA_ANIMATIONS: ChampionAnimations = {
  idle: { id: "idle", totalFrames: 4, baseFrameDuration: 0.2, loop: true, keyframes: [] },
  walk: { id: "walk", totalFrames: 8, baseFrameDuration: 0.1, loop: true, keyframes: [] },
  attack: {
    id: "attack",
    totalFrames: 6,
    baseFrameDuration: 0.083,
    loop: false,
    // The arrow leaves the string past halfway
    keyframes: [{ frame: 3, trigger: { type: "projectile" } }],
  },
  death: { id: "death", totalFrames: 8, baseFrameDuration: 0.125, loop: false, keyframes: [] },
};

// =============================================================================
// Champion Definition
// =============================================================================

export const EloraDefinition: ChampionDefinition = {
  id: "elora",
  name: "Elora",
  title: "The Master Hunter",
  class: "marksman",
  attackType: "ranged",
  resourceType: "mana",
  baseStats: ELORA_BASE_STATS,
  growthStats: ELORA_GROWTH_STATS,
  abilities: {
    Q: "elora_q",
    W: "elora_w",
    E: "elora_e",
    R: "elora_r",
  },
  passive: "elora_passive",
  collision: ELORA_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/elora.ts), for the health bar */
  visualHeight: 72,
  animations: ELORA_ANIMATIONS,
  attackAnimationSpeedScale: true,
  basicAttackProjectileSpeed: 900, // An arrow: the fastest shots
};

export const EloraAbilities: Record<string, AbilityDefinition> = {
  elora_q: EloraPoisonArrow,
  elora_w: EloraPinningArrow,
  elora_e: EloraDexterity,
  elora_r: EloraArrowBarrage,
};
