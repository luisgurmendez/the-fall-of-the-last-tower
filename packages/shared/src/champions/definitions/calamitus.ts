/**
 * Calamitus - The Flowing Magma
 * A tank of black rock and molten cracks who floods the ground with lava:
 * his abilities leave pools of it that burn enemies, and standing in them
 * he's harder to break (passive). He bursts lava around him (Q), sends a
 * landslide of magma ahead (W), hardens into obsidian (E), and makes all
 * his lava erupt at once (R).
 * Adapted from the user's card "Calamitus, the Flowing Magma".
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
// Lava: the server's Calamitus handlers and hooks apply it
// =============================================================================

export const CALAMITUS_LAVA = {
  /** How long a pool of lava lasts */
  duration: 4,
  /** Seconds between its burns */
  tickRate: 0.5,
  /** Its burn each second: base plus per level, plus a share of ability power */
  burnBase: 6,
  burnPerLevel: 1.5,
  burnApRatio: 0.05,
  /** Standing in his own lava he gains this much armor and magic resist */
  resists: 15,
  /** Magma Landslide's stream: pools this big, this far apart */
  streamRadius: 45,
  streamSpacing: 70,
  /** Obsidian Skin is this much stronger cast on his lava */
  skinOnLavaBonus: 0.5,
  /** Eruption stuns this long */
  eruptionStun: 1,
} as const;

// =============================================================================
// Base Stats: tough, at a walk (Gorath stays the slowest)
// =============================================================================

const CALAMITUS_BASE_STATS: ChampionBaseStats = {
  health: 640,
  healthRegen: 9,
  resource: 300,
  resourceRegen: 2.5,
  attackDamage: 56,
  abilityPower: 0,
  attackSpeed: 0.62,
  attackRange: 70, // Molten fists, long arms
  armor: 34,
  magicResist: 32,
  movementSpeed: 100,
  critChance: 0,
  critDamage: 2.0,
};

const CALAMITUS_GROWTH_STATS: ChampionGrowthStats = {
  health: 105,
  healthRegen: 0.9,
  resource: 40,
  resourceRegen: 0.2,
  attackDamage: 3.2,
  attackSpeed: 1.8,
  armor: 4.5,
  magicResist: 1.8,
};

// =============================================================================
// Abilities
// =============================================================================

/** Q: lava bursts up around him and stays as a pool (CalamitusQHandler) */
export const CalamitusLavaFlow: AbilityDefinition = {
  id: "calamitus_q",
  name: "Lava Flow",
  description:
    "Lava bursts up around you, dealing {damage} magic damage to nearby enemies, and stays as a pool for 4 seconds.",
  type: "active",
  targetType: "no_target",
  maxRank: 5,
  manaCost: [45, 45, 45, 45, 45],
  cooldown: [9, 8.5, 8, 7.5, 7],
  aoeRadius: 140,
  damage: {
    type: "magic",
    scaling: scaling([50, 80, 110, 140, 170], { apRatio: 0.4 }),
  },
};

/** W: a landslide of magma down a line, leaving a stream of lava (CalamitusWHandler) */
export const CalamitusMagmaLandslide: AbilityDefinition = {
  id: "calamitus_w",
  name: "Magma Landslide",
  description:
    "Send a wave of magma ahead, dealing {damage} magic damage to enemies in its path and slowing them by 30% for 1.5 seconds. It leaves a stream of lava for 4 seconds.",
  type: "active",
  targetType: "ground_target",
  shape: "line",
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [12, 11, 10, 9, 8],
  range: 380, // The line's length
  aoeRadius: 45, // Half its width
  aoeDelay: 0.3, // The wave rolls
  damage: {
    type: "magic",
    scaling: scaling([60, 95, 130, 165, 200], { apRatio: 0.5 }),
  },
  appliesEffects: ["slow_30"],
  effectDuration: 1.5,
};

/** E: his skin hardens to obsidian, a shield (CalamitusEHandler) */
export const CalamitusObsidianSkin: AbilityDefinition = {
  id: "calamitus_e",
  name: "Obsidian Skin",
  description:
    "Harden into obsidian: a shield absorbing {shield} damage for 3 seconds, half again as strong if you stand in your lava.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [16, 15, 14, 13, 12],
  shield: {
    scaling: scaling([50, 75, 100, 125, 150], { maxHealthRatio: 0.05 }),
    duration: 3,
  },
};

/** R: all his lava erupts, and the ground around him (CalamitusRHandler) */
export const CalamitusEruption: AbilityDefinition = {
  id: "calamitus_r",
  name: "Eruption",
  description:
    "After a moment, every pool of your lava erupts, and so does the ground around you: enemies there take {damage} magic damage and are stunned for 1 second.",
  type: "active",
  targetType: "no_target",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [110, 95, 80],
  aoeRadius: 220, // Around him
  aoeDelay: 0.6, // The ground rumbles
  damage: {
    type: "magic",
    scaling: scaling([120, 200, 280], { apRatio: 0.5 }),
  },
};

// =============================================================================
// Passive
// =============================================================================

/** Lavaborn - his lava burns enemies, and hardens him (CalamitusHooks) */
export const CalamitusPassive: PassiveAbilityDefinition = {
  id: "calamitus_passive",
  name: "Lavaborn",
  description:
    "Your abilities leave pools of lava that burn enemies in them for 8-33 (+5% ability power) magic damage a second. Standing in your lava you gain 15 armor and magic resist.",
  trigger: "always",
};

// =============================================================================
// Collision & Animation
// =============================================================================

const CALAMITUS_COLLISION: CircleCollision = {
  type: "circle",
  radius: 25,
  offset: { x: 0, y: 2 },
};

const CALAMITUS_ANIMATIONS: ChampionAnimations = {
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

export const CalamitusDefinition: ChampionDefinition = {
  id: "calamitus",
  name: "Calamitus",
  title: "The Flowing Magma",
  class: "tank",
  attackType: "melee",
  resourceType: "mana",
  baseStats: CALAMITUS_BASE_STATS,
  growthStats: CALAMITUS_GROWTH_STATS,
  abilities: {
    Q: "calamitus_q",
    W: "calamitus_w",
    E: "calamitus_e",
    R: "calamitus_r",
  },
  passive: "calamitus_passive",
  collision: CALAMITUS_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/calamitus.ts), for the health bar */
  visualHeight: 86,
  animations: CALAMITUS_ANIMATIONS,
  attackAnimationSpeedScale: true,
};

export const CalamitusAbilities: Record<string, AbilityDefinition> = {
  calamitus_q: CalamitusLavaFlow,
  calamitus_w: CalamitusMagmaLandslide,
  calamitus_e: CalamitusObsidianSkin,
  calamitus_r: CalamitusEruption,
};
