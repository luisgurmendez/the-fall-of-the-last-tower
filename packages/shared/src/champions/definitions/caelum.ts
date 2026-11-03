/**
 * Caelum Lightbranch - Of the Whispering Woods
 * An old druid who keeps his allies on their feet: his light mends everyone
 * near him now and then (passive), a ray of light stings the first enemy
 * it meets (Q), he emboldens an ally (W), calls roots up out of the ground
 * (E), and gives his own life to save an ally's (R).
 * Adapted from the user's card "Caelum Lightbranch, of the Whispering Woods".
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
// Lightweaving and Martyr: the server's CaelumHooks and CaelumRHandler apply them
// =============================================================================

export const CAELUM_LIGHT = {
  /** Seconds between pulses of Lightweaving (it waits for someone to be hurt) */
  weaveEvery: 8,
  /** Its reach around him */
  weaveRadius: 300,
  /** Its heal: base plus per level, plus a share of ability power */
  weaveBase: 10,
  weavePerLevel: 4,
  weaveApRatio: 0.1,
  /** Martyr: the share of his current health he gives... */
  martyrShare: 0.25,
  /** ...and how many times that the ally heals on top of the base heal */
  martyrMultiplier: 2,
} as const;

// =============================================================================
// Base Stats: a frail caster who stays behind his allies
// =============================================================================

const CAELUM_BASE_STATS: ChampionBaseStats = {
  health: 520,
  healthRegen: 1.2,
  resource: 380,
  resourceRegen: 4,
  attackDamage: 48,
  abilityPower: 0,
  attackSpeed: 0.62,
  attackRange: 200,
  armor: 22,
  magicResist: 30,
  movementSpeed: 100,
  critChance: 0,
  critDamage: 2.0,
};

const CAELUM_GROWTH_STATS: ChampionGrowthStats = {
  health: 85,
  healthRegen: 0.12,
  resource: 45,
  resourceRegen: 0.4,
  attackDamage: 2.6,
  attackSpeed: 2.0,
  armor: 3.8,
  magicResist: 1.3,
};

// =============================================================================
// Abilities
// =============================================================================

/** Q: a ray of light; the first enemy hit is stung and slowed (generic skillshot) */
export const CaelumRayOfLight: AbilityDefinition = {
  id: "caelum_q",
  name: "Ray of Light",
  description:
    "Send a ray of light that deals {damage} magic damage to the first enemy hit and slows it by 20% for 1.5 seconds.",
  type: "active",
  targetType: "skillshot",
  maxRank: 5,
  manaCost: [50, 55, 60, 65, 70],
  cooldown: [7, 6.5, 6, 5.5, 5],
  range: 440,
  projectileSpeed: 650,
  projectileRadius: 22,
  shape: "line",
  damage: {
    type: "magic",
    scaling: scaling([85, 130, 175, 225, 270], { apRatio: 0.6 }),
  },
  appliesEffects: ["slow_20"],
  effectDuration: 1.5,
};

/** W: an ally (or himself) emboldened (generic ally target with effects) */
export const CaelumEmbolden: AbilityDefinition = {
  id: "caelum_w",
  name: "Embolden",
  description:
    "Embolden an ally or yourself for 4 seconds: 20% more attack damage and ability power, and 20% movement speed.",
  type: "active",
  targetType: "target_ally",
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [16, 14.5, 13, 11.5, 10],
  range: 360,
  appliesEffects: ["caelum_embolden", "caelum_embolden_power", "speed_20"],
  effectDuration: 4,
};

/** E: roots burst up out of the ground and hold the enemies there (generic ground target) */
export const CaelumWhisperingRoots: AbilityDefinition = {
  id: "caelum_e",
  name: "Whispering Roots",
  description:
    "Call roots up out of the ground: after a moment, enemies there take {damage} magic damage and are rooted for 1.5 seconds.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [70, 70, 70, 70, 70],
  cooldown: [15, 14, 13, 12, 11],
  range: 380,
  aoeRadius: 100,
  aoeDelay: 0.8, // The roots rise
  shape: "circle",
  damage: {
    type: "magic",
    scaling: scaling([60, 100, 140, 185, 225], { apRatio: 0.4 }),
  },
  appliesEffects: ["root"],
  effectDuration: 1.5,
};

/** R: he gives a quarter of his health; an ally heals a lot more (CaelumRHandler) */
export const CaelumMartyr: AbilityDefinition = {
  id: "caelum_r",
  name: "Martyr",
  description:
    "Give 25% of your current health to another allied champion: it heals {heal} plus twice the health you gave.",
  type: "active",
  targetType: "target_ally",
  excludesSelf: true,
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [110, 95, 80],
  range: 450,
  heal: {
    scaling: scaling([150, 250, 350], { apRatio: 0.6 }),
  },
};

// =============================================================================
// Passive
// =============================================================================

/** Lightweaving - every 8 seconds his light mends him and allies near him (CaelumHooks) */
export const CaelumPassive: PassiveAbilityDefinition = {
  id: "caelum_passive",
  name: "Lightweaving",
  description:
    "Every 8 seconds, when someone near you is hurt, your light heals you and allied champions within 300 for 14-82 (+10% ability power).",
  trigger: "always",
};

// =============================================================================
// Collision & Animation
// =============================================================================

const CAELUM_COLLISION: CircleCollision = {
  type: "circle",
  radius: 19,
  offset: { x: 0, y: 2 },
};

const CAELUM_ANIMATIONS: ChampionAnimations = {
  idle: { id: "idle", totalFrames: 4, baseFrameDuration: 0.2, loop: true, keyframes: [] },
  walk: { id: "walk", totalFrames: 8, baseFrameDuration: 0.1, loop: true, keyframes: [] },
  attack: {
    id: "attack",
    totalFrames: 6,
    baseFrameDuration: 0.083,
    loop: false,
    keyframes: [{ frame: 3, trigger: { type: "projectile" } }],
  },
  death: { id: "death", totalFrames: 8, baseFrameDuration: 0.125, loop: false, keyframes: [] },
};

// =============================================================================
// Champion Definition
// =============================================================================

export const CaelumDefinition: ChampionDefinition = {
  id: "caelum",
  name: "Caelum",
  title: "Of the Whispering Woods",
  class: "support",
  attackType: "ranged",
  resourceType: "mana",
  baseStats: CAELUM_BASE_STATS,
  growthStats: CAELUM_GROWTH_STATS,
  abilities: {
    Q: "caelum_q",
    W: "caelum_w",
    E: "caelum_e",
    R: "caelum_r",
  },
  passive: "caelum_passive",
  collision: CAELUM_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/caelum.ts), for the health bar */
  visualHeight: 74,
  animations: CAELUM_ANIMATIONS,
  attackAnimationSpeedScale: true,
  basicAttackProjectileSpeed: 600, // A mote of light
};

export const CaelumAbilities: Record<string, AbilityDefinition> = {
  caelum_q: CaelumRayOfLight,
  caelum_w: CaelumEmbolden,
  caelum_e: CaelumWhisperingRoots,
  caelum_r: CaelumMartyr,
};
