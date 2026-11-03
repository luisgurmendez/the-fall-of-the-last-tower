/**
 * Zhak'rul - The Ancient Scorpion
 * A giant scorpion who doesn't kill in one blow but wears his prey down:
 * his attacks and some abilities poison, up to three times, and at three the
 * venom turns ancient and burns harder (passive). His pincers punish the
 * poisoned (Q), he breathes out a toxic cloud (W), he travels underground,
 * under walls too, and bursts out knocking enemies up (E), and his stinger
 * injects a deadly dose (R).
 * Designed by the user.
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
// Ancient Venom and the rest of his kit: the server's ZhakrulHooks and handlers apply them
// =============================================================================

export const ZHAKRUL_VENOM = {
  /** The poison lasts this long, from the last dose */
  duration: 3,
  /** Up to this many doses at once */
  maxStacks: 3,
  /** It deals its magic damage once every this many seconds... */
  tickEvery: 1,
  /** ...this much per dose: base, per level and a share of ability power */
  perStackBase: 2,
  perStackPerLevel: 0.5,
  perStackApRatio: 0.03,
  /** At three doses it turns ancient: this many times the damage while it lasts */
  ancientMultiplier: 1.4,
} as const;

export const ZHAKRUL_KIT = {
  /** Deadly Pincers: this much more damage per dose on the target */
  pincerBonusPerStack: 0.1,
  /** Toxic Cloud: how long it stays where he breathed it out */
  cloudDuration: 4,
  /** Each second in the cloud hurts this much more than the one before */
  cloudGrowth: 0.25,
  /** Burrowed Ambush: how fast he travels underground */
  burrowSpeed: 650,
  /** Death Stinger: its venom's damage comes in this many ticks over this long... */
  stingTicks: 6,
  stingDuration: 3,
  /** ...and is this much more per dose the target already had */
  stingBonusPerStack: 0.15,
} as const;

// =============================================================================
// Base Stats: a slow, armored melee bruiser that scales with ability power
// =============================================================================

const ZHAKRUL_BASE_STATS: ChampionBaseStats = {
  health: 570,
  healthRegen: 1.6,
  resource: 300,
  resourceRegen: 2.3,
  attackDamage: 58,
  abilityPower: 0,
  attackSpeed: 0.65,
  attackRange: 50, // Long pincers
  armor: 33,
  magicResist: 32,
  movementSpeed: 100, // Heavy (only Gorath is slower): little mobility without his E
  critChance: 0,
  critDamage: 2.0,
};

const ZHAKRUL_GROWTH_STATS: ChampionGrowthStats = {
  health: 90,
  healthRegen: 0.16,
  resource: 40,
  resourceRegen: 0.2,
  attackDamage: 3,
  attackSpeed: 2.2,
  armor: 4.3,
  magicResist: 1.6,
};

// =============================================================================
// Abilities
// =============================================================================

/** Q: both pincers snap shut in front of him, harder on the poisoned (ZhakrulQHandler) */
export const ZhakrulDeadlyPincers: AbilityDefinition = {
  id: "zhakrul_q",
  name: "Deadly Pincers",
  description:
    "Snap both pincers shut like scissors in front of you: {damage} magic damage to every enemy there, 10% more for each dose of Ancient Venom on it.",
  type: "active",
  targetType: "ground_target",
  shape: "cone",
  maxRank: 5,
  manaCost: [40, 40, 40, 40, 40],
  cooldown: [7, 6.5, 6, 5.5, 5],
  range: 150, // The pincers' reach
  coneAngle: Math.PI / 2,
  aoeDelay: 0.2, // The snap
  damage: {
    type: "magic",
    scaling: scaling([50, 80, 110, 140, 170], { apRatio: 0.5 }),
  },
};

/** W: a cloud of poison around him that hurts more the longer enemies stay (ZhakrulWHandler) */
export const ZhakrulToxicCloud: AbilityDefinition = {
  id: "zhakrul_w",
  name: "Toxic Cloud",
  description:
    "Breathe out a cloud of poison around you for 4 seconds. Enemies in it are slowed by 30%, take {damage} magic damage each second, 25% more for every second they stay, and get a dose of Ancient Venom.",
  type: "active",
  targetType: "no_target",
  maxRank: 5,
  manaCost: [70, 70, 70, 70, 70],
  cooldown: [14, 13, 12, 11, 10],
  aoeRadius: 190,
  shape: "circle",
  damage: {
    type: "magic",
    scaling: scaling([10, 18, 26, 34, 42], { apRatio: 0.1 }),
  },
  appliesEffects: ["slow_30"],
  effectDuration: 1, // The slow lingers a second after leaving the cloud
};

/** E: he travels underground, under walls too, and bursts out (ZhakrulEHandler) */
export const ZhakrulBurrowedAmbush: AbilityDefinition = {
  id: "zhakrul_e",
  name: "Burrowed Ambush",
  description:
    "Burrow and travel underground to a spot, under walls too. You burst out snapping your pincers: enemies around take {damage} magic damage and are knocked up for 1 second.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [16, 15, 14, 13, 12],
  range: 320,
  aoeRadius: 130, // Where he bursts out
  shape: "circle",
  damage: {
    type: "magic",
    scaling: scaling([60, 95, 130, 165, 200], { apRatio: 0.5 }),
  },
  appliesEffects: ["knockup"],
  effectDuration: 1,
};

/** R: his stinger stuns a champion and injects a deadly dose (ZhakrulRHandler) */
export const ZhakrulDeathStinger: AbilityDefinition = {
  id: "zhakrul_r",
  name: "Death Stinger",
  description:
    "Drive your stinger into the target enemy champion: it's stunned for 1.25 seconds and takes {damage} magic damage over 3 seconds, 15% more for each dose of Ancient Venom it had. Then it has three doses: the venom turns ancient.",
  type: "active",
  targetType: "target_enemy",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [100, 85, 70],
  range: 150, // The tail reaches over his head
  affectsMinions: false,
  affectsJungleCamps: false,
  damage: {
    type: "magic",
    scaling: scaling([150, 250, 350], { apRatio: 0.8 }),
  },
  appliesEffects: ["stun"],
  effectDuration: 1.25,
};

// =============================================================================
// Passive
// =============================================================================

/** Ancient Venom - his attacks wear the enemy down (ZhakrulHooks) */
export const ZhakrulPassive: PassiveAbilityDefinition = {
  id: "zhakrul_passive",
  name: "Ancient Venom",
  description:
    "Your basic attacks, Toxic Cloud and Death Stinger poison for 3 seconds: magic damage every second, 3-11 (+3% ability power) per dose, up to 3 doses. At 3 doses the venom turns ancient and deals 40% more for as long as it lasts.",
  trigger: "always",
};

// =============================================================================
// Collision & Animation
// =============================================================================

const ZHAKRUL_COLLISION: CircleCollision = {
  type: "circle",
  radius: 26, // A wide body on six legs
  offset: { x: 0, y: 2 },
};

const ZHAKRUL_ANIMATIONS: ChampionAnimations = {
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

export const ZhakrulDefinition: ChampionDefinition = {
  id: "zhakrul",
  name: "Zhak'rul",
  title: "The Ancient Scorpion",
  class: "warrior",
  attackType: "melee",
  resourceType: "mana",
  baseStats: ZHAKRUL_BASE_STATS,
  growthStats: ZHAKRUL_GROWTH_STATS,
  abilities: {
    Q: "zhakrul_q",
    W: "zhakrul_w",
    E: "zhakrul_e",
    R: "zhakrul_r",
  },
  passive: "zhakrul_passive",
  collision: ZHAKRUL_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/zhakrul.ts), for the health bar */
  visualHeight: 80,
  animations: ZHAKRUL_ANIMATIONS,
  attackAnimationSpeedScale: true,
};

export const ZhakrulAbilities: Record<string, AbilityDefinition> = {
  zhakrul_q: ZhakrulDeadlyPincers,
  zhakrul_w: ZhakrulToxicCloud,
  zhakrul_e: ZhakrulBurrowedAmbush,
  zhakrul_r: ZhakrulDeathStinger,
};
