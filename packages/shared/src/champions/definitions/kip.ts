/**
 * Kip - The Would-Be Legend
 * A scrappy kid with a bow too big for him who only wants to prove to
 * everyone that he's the best archer there is. A ranged top laner who hunts
 * tanks: his Target Practice (Q) and Grand Entrance (E) mark enemy
 * champions, his team sees the marked and runs faster at them, and his next
 * arrow on a marked enemy pops the mark for heavy damage, more the bigger
 * the target (passive). Run Them Down (W) makes him faster the more he crits
 * and slows the marked; Show Them All (R) shoots every marked enemy once per
 * mark.
 * Designed by a friend of the user (Kip's name and look are ours).
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
// The mark and the rest of his kit: the server's KipHooks and handlers apply them
// =============================================================================

export const KIP_KIT = {
  /** The mark Target Practice and Grand Entrance put on enemy champions */
  markEffect: "kip_mark",
  /** How long a mark lasts (another one refreshes it) */
  markDuration: 4,

  /** The Bigger They Are: his arrow on an enemy he marked pops the mark for bonus physical damage... */
  popAdRatio: 0.6,
  /** ...plus this share of the target's max health... */
  popMaxHealthRatio: 0.06,
  /** ...plus this share of how much more max health the target has than him... */
  popHealthGapRatio: 0.1,
  /** ...counted up to this much */
  popHealthGapCap: 2000,

  /** His team's champions' basic attacks on a marked enemy speed the attacker up */
  huntSpeedEffect: "kip_hunt_speed",
  huntSpeed: 0.2,
  huntSpeedDuration: 1.5,

  /** Run Them Down (passive): movement speed at 100% crit chance, by rank (less crit, less speed) */
  wSpeedAtFullCrit: [0.1, 0.125, 0.15, 0.175, 0.2],
  /** Run Them Down (active): the marked enemies in reach are slowed (40%) this long, by rank */
  wSlowEffect: "slow_40",
  wSlowDuration: [1, 1.25, 1.5, 1.75, 2],

  /** Grand Entrance: his dash's speed (its length is the ability's range) */
  eDashSpeed: 750,

  /** Show Them All: one volley of arrows (one at each marked enemy) every this many seconds */
  rVolleyEvery: 0.15,
  /** How fast its arrows fly (they follow their targets) */
  rArrowSpeed: 1100,
  /** Each marked enemy takes 100% of the damage in all, plus this much per other marked enemy */
  rBonusPerOtherMark: 0.25,
} as const;

/** Show Them All: each arrow's share of the full damage with `marks` marked enemies (X arrows at each) */
export function kipArrowShare(marks: number): number {
  return marks <= 0 ? 0 : (1 + KIP_KIT.rBonusPerOtherMark * (marks - 1)) / marks;
}

/** The Bigger They Are: the pop's bonus physical damage */
export function kipPopDamage(attackDamage: number, targetMaxHealth: number, ownMaxHealth: number): number {
  const gap = Math.min(KIP_KIT.popHealthGapCap, Math.max(0, targetMaxHealth - ownMaxHealth));
  return KIP_KIT.popAdRatio * attackDamage + KIP_KIT.popMaxHealthRatio * targetMaxHealth + KIP_KIT.popHealthGapRatio * gap;
}

// =============================================================================
// Base Stats: a ranged top laner, sturdier than the bot lane's marksmen
// =============================================================================

const KIP_BASE_STATS: ChampionBaseStats = {
  health: 610,
  healthRegen: 1.4,
  resource: 300,
  resourceRegen: 2.6,
  attackDamage: 59,
  abilityPower: 0,
  attackSpeed: 0.65,
  attackRange: 200, // A big bow, but not Elora's reach
  armor: 27,
  magicResist: 30,
  movementSpeed: 102,
  critChance: 0,
  critDamage: 2.0,
};

const KIP_GROWTH_STATS: ChampionGrowthStats = {
  health: 92,
  healthRegen: 0.14,
  resource: 38,
  resourceRegen: 0.2,
  attackDamage: 3.1,
  attackSpeed: 2.5,
  armor: 4,
  magicResist: 1.4,
};

// =============================================================================
// Abilities
// =============================================================================

/** Q: an arrow that stops at the first enemy; a champion is marked (KipQHandler) */
export const KipTargetPractice: AbilityDefinition = {
  id: "kip_q",
  name: "Target Practice",
  description:
    "Shoot an arrow that stops at the first enemy it hits: {damage} physical damage. An enemy champion hit is marked for 4 seconds.",
  type: "active",
  targetType: "skillshot",
  maxRank: 5,
  manaCost: [40, 45, 50, 55, 60],
  cooldown: [8, 7.5, 7, 6.5, 6],
  range: 500,
  projectileSpeed: 560,
  projectileRadius: 18,
  shape: "line",
  damage: {
    type: "physical",
    scaling: scaling([50, 80, 110, 140, 170], { adRatio: 0.7 }),
  },
};

/** W: faster the more he crits; the marked are slowed (KipWHandler, KipHooks) */
export const KipRunThemDown: AbilityDefinition = {
  id: "kip_w",
  name: "Run Them Down",
  description:
    "Passive: you move faster the more critical strike chance you have, up to 10/12.5/15/17.5/20% at 100%. Active: every enemy champion you marked within 650 is slowed by 40% for 1/1.25/1.5/1.75/2 seconds.",
  type: "active",
  targetType: "no_target",
  dodgeExempt: "it slows only enemies Kip has marked, whose mark shows over them for 4 seconds: avoiding the mark is the counterplay, not walking out",
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [16, 15, 14, 13, 12],
  aoeRadius: 650, // His reach: marked enemies within it
  appliesEffects: ["slow_40"],
};

/** E: a showy dash; where he lands, damage, and the champions there are marked (KipEHandler) */
export const KipGrandEntrance: AbilityDefinition = {
  id: "kip_e",
  name: "Grand Entrance",
  description:
    "Leap to a spot (a wall stops you). Where you land, enemies around take {damage} physical damage, and enemy champions there are marked for 4 seconds.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [16, 15, 14, 13, 12],
  range: 200, // How far he leaps
  movesCaster: true,
  aoeRadius: 130, // Where he lands
  shape: "circle",
  damage: {
    type: "physical",
    scaling: scaling([60, 95, 130, 165, 200], { adRatio: 0.5 }),
  },
};

/** R: X arrows at each of the X marked enemies in reach (KipRHandler) */
export const KipShowThemAll: AbilityDefinition = {
  id: "kip_r",
  name: "Show Them All",
  description:
    "Shoot every enemy champion you marked within 650, once for each of them, in quick volleys: with one mark, one arrow of {damage} physical damage; each marked enemy takes 25% more in all for every other mark (2 marks: 2 arrows of 62.5% at each; 5 marks: 5 arrows of 40%). Arrows can critically strike, and leave the marks.",
  type: "active",
  targetType: "no_target",
  dodgeExempt: "its arrows home in on the enemies Kip has marked, one volley per mark, after a golden flourish: avoiding the mark is the counterplay, not walking out",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [100, 85, 70],
  aoeRadius: 650, // His reach: marked enemies within it
  affectsMinions: false,
  affectsJungleCamps: false,
  damage: {
    type: "physical",
    scaling: scaling([175, 275, 375], { adRatio: 0.8 }),
  },
};

// =============================================================================
// Passive
// =============================================================================

/** The Bigger They Are - his arrow pops his marks, harder on the big (KipHooks) */
export const KipPassive: PassiveAbilityDefinition = {
  id: "kip_passive",
  name: "The Bigger They Are",
  description:
    "Enemy champions you mark are seen by your team, even in fog and bushes, and your team's basic attacks on them give the attacker 20% movement speed for 1.5 seconds. Your basic attack on an enemy you marked pops the mark: 60% AD + 6% of its max health + 10% of how much more max health it has than you (up to +200) bonus physical damage. Only your basic attacks pop marks.",
  trigger: "always",
  usesStacks: true,
  maxStacks: 5,
  stackName: "Marked",
};

// =============================================================================
// Collision & Animation
// =============================================================================

const KIP_COLLISION: CircleCollision = {
  type: "circle",
  radius: 19,
  offset: { x: 0, y: 2 },
};

const KIP_ANIMATIONS: ChampionAnimations = {
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

export const KipDefinition: ChampionDefinition = {
  id: "kip",
  name: "Kip",
  title: "The Would-Be Legend",
  class: "marksman",
  attackType: "ranged",
  resourceType: "mana",
  baseStats: KIP_BASE_STATS,
  growthStats: KIP_GROWTH_STATS,
  abilities: {
    Q: "kip_q",
    W: "kip_w",
    E: "kip_e",
    R: "kip_r",
  },
  passive: "kip_passive",
  collision: KIP_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/kip.ts), for the health bar */
  visualHeight: 72,
  animations: KIP_ANIMATIONS,
  attackAnimationSpeedScale: true,
  basicAttackProjectileSpeed: 850,
};

export const KipAbilities: Record<string, AbilityDefinition> = {
  kip_q: KipTargetPractice,
  kip_w: KipRunThemDown,
  kip_e: KipGrandEntrance,
  kip_r: KipShowThemAll,
};
