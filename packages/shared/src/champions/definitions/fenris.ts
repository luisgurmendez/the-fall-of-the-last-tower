/**
 * Fenris - The Cursed Howler
 * A werewolf who grows deadlier the closer he is to death: hurt, he turns
 * feral and his abilities hit harder (passive). He bites to heal (Q), rakes
 * whatever is in front of him (W), pounces on his prey (E), and in his
 * bloodthirst (R) every blow feeds him and a kill restores him whole.
 * Adapted from the user's card "Fenris, the Cursed Howler".
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
// Feral and Bloodthirst: the server's FenrisHooks applies them
// =============================================================================

export const FENRIS_FERAL = {
  /** Under this share of his health he's feral */
  health: 0.4,
  /** Feral, his abilities deal this much more damage... */
  damageBonus: 0.3,
  /** ...and Vicious Bite heals this many times as much */
  biteHealMultiplier: 2,
  /** Bloodthirst: the share of his basic attacks' damage they heal him, by R's rank */
  lifeSteal: [0.15, 0.2, 0.25],
} as const;

// =============================================================================
// Base Stats: a melee bruiser for the jungle
// =============================================================================

const FENRIS_BASE_STATS: ChampionBaseStats = {
  health: 560,
  healthRegen: 1.6,
  resource: 280,
  resourceRegen: 2.2,
  attackDamage: 60,
  abilityPower: 0,
  attackSpeed: 0.67,
  attackRange: 40, // Claws
  armor: 30,
  magicResist: 32,
  movementSpeed: 103,
  critChance: 0,
  critDamage: 2.0,
};

const FENRIS_GROWTH_STATS: ChampionGrowthStats = {
  health: 95,
  healthRegen: 0.17,
  resource: 40,
  resourceRegen: 0.2,
  attackDamage: 3.4,
  attackSpeed: 2.6,
  armor: 4,
  magicResist: 1.6,
};

// =============================================================================
// Abilities
// =============================================================================

/** Q: a bite that heals him (FenrisQHandler) */
export const FenrisViciousBite: AbilityDefinition = {
  id: "fenris_q",
  name: "Vicious Bite",
  description:
    "Bite the target enemy for {damage} physical damage and heal {heal} health. Feral, you heal twice as much.",
  type: "active",
  targetType: "target_enemy",
  maxRank: 5,
  manaCost: [40, 40, 40, 40, 40],
  cooldown: [8, 7.5, 7, 6.5, 6],
  range: 110,
  damage: {
    type: "physical",
    scaling: scaling([40, 70, 100, 130, 160], { adRatio: 0.7 }),
  },
  heal: {
    scaling: scaling([20, 30, 40, 50, 60], { adRatio: 0.2 }),
  },
};

/** W: a wide rake of claws in front of him (generic cone) */
export const FenrisSavageClaw: AbilityDefinition = {
  id: "fenris_w",
  name: "Savage Claw",
  description:
    "Rake your claws in front of you, dealing {damage} physical damage to every enemy there and slowing them by 30% for 1.5 seconds.",
  type: "active",
  targetType: "ground_target",
  shape: "cone",
  maxRank: 5,
  manaCost: [45, 45, 45, 45, 45],
  cooldown: [9, 8.5, 8, 7.5, 7],
  range: 170, // The rake's reach
  coneAngle: Math.PI / 2,
  aoeDelay: 0.15, // The swipe
  damage: {
    type: "physical",
    scaling: scaling([55, 90, 125, 160, 195], { adRatio: 0.8 }),
  },
  appliesEffects: ["slow_30"],
  effectDuration: 1.5,
};

/** E: he pounces on an enemy (generic targeted leap) */
export const FenrisPounce: AbilityDefinition = {
  id: "fenris_e",
  name: "Pounce",
  description:
    "Pounce on the target enemy, dealing {damage} physical damage and slowing it by 40% for 1.25 seconds.",
  type: "active",
  targetType: "target_enemy",
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [14, 13, 12, 11, 10],
  range: 320,
  dash: {
    speed: 800,
    distance: 320,
  },
  damage: {
    type: "physical",
    scaling: scaling([40, 70, 100, 130, 160], { adRatio: 0.5 }),
  },
  appliesEffects: ["slow_40"],
  effectDuration: 1.25,
};

/** R: bloodthirst: faster attacks that feed him, a kill restores him (FenrisHooks) */
export const FenrisBloodthirst: AbilityDefinition = {
  id: "fenris_r",
  name: "Bloodthirst",
  description:
    "For 8 seconds you attack 35% faster and your basic attacks heal you for 15/20/25% of their damage. Kill an enemy champion meanwhile and you heal to full health (and, feral, to full mana).",
  type: "active",
  targetType: "self",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [100, 85, 70],
  appliesEffects: ["fenris_bloodthirst"],
  effectDuration: 8,
};

// =============================================================================
// Passive
// =============================================================================

/** Adrenaline Rush - hurt, he turns feral (FenrisHooks) */
export const FenrisPassive: PassiveAbilityDefinition = {
  id: "fenris_passive",
  name: "Adrenaline Rush",
  description:
    "Below 40% health you are Feral: your abilities deal 30% more damage, Vicious Bite heals twice as much and you move 12% faster.",
  trigger: "always",
};

// =============================================================================
// Collision & Animation
// =============================================================================

const FENRIS_COLLISION: CircleCollision = {
  type: "circle",
  radius: 23,
  offset: { x: 0, y: 2 },
};

const FENRIS_ANIMATIONS: ChampionAnimations = {
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

export const FenrisDefinition: ChampionDefinition = {
  id: "fenris",
  name: "Fenris",
  title: "The Cursed Howler",
  class: "warrior",
  attackType: "melee",
  resourceType: "mana",
  baseStats: FENRIS_BASE_STATS,
  growthStats: FENRIS_GROWTH_STATS,
  abilities: {
    Q: "fenris_q",
    W: "fenris_w",
    E: "fenris_e",
    R: "fenris_r",
  },
  passive: "fenris_passive",
  collision: FENRIS_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/fenris.ts), for the health bar */
  visualHeight: 80,
  animations: FENRIS_ANIMATIONS,
  attackAnimationSpeedScale: true,
};

export const FenrisAbilities: Record<string, AbilityDefinition> = {
  fenris_q: FenrisViciousBite,
  fenris_w: FenrisSavageClaw,
  fenris_e: FenrisPounce,
  fenris_r: FenrisBloodthirst,
};
