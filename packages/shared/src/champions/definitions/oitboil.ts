/**
 * Oitboil - The Pyromancer
 * A goblin with a flamethrower on each arm: a short-ranged mage who burns
 * everything near him with cheap sparks (Q), cools off and heals with blue
 * fire (W), rockets away on a trail of fire (E) and melts whoever stands
 * in front of him (R). His passive is heat: his abilities heat him up, and
 * at full heat he overheats, hitting harder while the fire burns him too.
 * Adapted from the user's card "Oitboil, the Pyromancer".
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
// Heat (passive): the server's OitboilHooks applies it
// =============================================================================

export const OITBOIL_HEAT = {
  max: 100,
  /** Heat each ability adds (the W vents instead) */
  gain: { oitboil_q: 20, oitboil_e: 25, oitboil_r: 40 } as Readonly<Record<string, number>>,
  /** Heat Blue Fire (W) takes away; during an overheat it ends it */
  vent: 40,
  /**
   * Seconds without casting before heat starts to fall (well past the Q's
   * cooldown: spamming it overheats him), and how fast it falls
   */
  decayDelay: 4.5,
  decayPerSecond: 15,
  /** The overheat */
  overheatDuration: 4,
  overheatDamageBonus: 0.25,
  /** Share of his maximum health the overheat burns each second (never below 1 health) */
  overheatBurnPerSecond: 0.03,
} as const;

// =============================================================================
// Base Stats: the toughest mage (he burns himself), with a short reach
// =============================================================================

const OITBOIL_BASE_STATS: ChampionBaseStats = {
  health: 640,
  healthRegen: 7,
  resource: 340,
  resourceRegen: 3.5,
  attackDamage: 56,
  abilityPower: 0,
  attackSpeed: 0.65,
  attackRange: 150, // Short bursts of flame
  armor: 24,
  magicResist: 30,
  movementSpeed: 100,
  critChance: 0,
  critDamage: 2.0,
};

const OITBOIL_GROWTH_STATS: ChampionGrowthStats = {
  health: 95,
  healthRegen: 0.7,
  resource: 40,
  resourceRegen: 0.25,
  attackDamage: 3.0,
  attackSpeed: 1.5,
  armor: 3.8,
  magicResist: 1.3,
};

// =============================================================================
// Abilities
// =============================================================================

/** Q: a cheap burst of sparks around him, enemies only */
export const OitboilSparkSpray: AbilityDefinition = {
  id: "oitboil_q",
  name: "Spark Spray",
  description:
    "Spray sparks all around you, dealing {damage} magic damage to nearby enemies. Heat +20.",
  type: "active",
  targetType: "no_target",
  maxRank: 5,
  manaCost: [20, 20, 20, 20, 20],
  cooldown: [3, 3, 3, 3, 3],
  aoeRadius: 130,
  damage: {
    type: "magic",
    scaling: scaling([50, 75, 100, 125, 150], { apRatio: 0.35 }),
  },
};

/** W: blue fire heals him and vents heat (OitboilWHandler, OitboilHooks) */
export const OitboilBlueFire: AbilityDefinition = {
  id: "oitboil_w",
  name: "Blue Fire",
  description:
    "Wrap yourself in cool blue fire, healing {heal} health and venting 40 heat. Ends an overheat.",
  type: "active",
  targetType: "self",
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [14, 13, 12, 11, 10],
  heal: {
    scaling: scaling([90, 120, 150, 180, 210], { apRatio: 0.5 }),
  },
};

/** E: rockets toward a point on his flamethrowers, leaving burning ground (OitboilEHandler) */
export const OitboilAfterburner: AbilityDefinition = {
  id: "oitboil_e",
  name: "Afterburner",
  description:
    "Blast your flamethrowers backward and rocket forward, leaving a trail of fire that deals {damage} magic damage over 2 seconds to enemies standing in it. Heat +25.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [12, 11, 10, 9, 8],
  range: 220,
  dash: {
    speed: 900,
    distance: 220,
  },
  // Over the trail's 2 seconds
  damage: {
    type: "magic",
    scaling: scaling([60, 90, 120, 150, 180], { apRatio: 0.4 }),
  },
  zoneDuration: 2,
  zoneTickRate: 0.5,
};

/**
 * R: a stream of fire in a short cone for a second, burning a share of
 * each enemy's current health; then he's exhausted (OitboilRHandler)
 */
export const OitboilFlamethrower: AbilityDefinition = {
  id: "oitboil_r",
  name: "Flamethrower",
  description:
    "Plant your feet and pour fire forward for 1 second: enemy champions in the cone lose 35/40/45% of their current health as magic damage, other enemies take {damage}. Then you are exhausted for 1.5 seconds: you can walk but not attack or cast. Heat +40.",
  type: "active",
  targetType: "ground_target", // Aimed
  shape: "cone",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [110, 95, 80],
  range: 260, // The cone's length
  coneAngle: Math.PI / 3,
  // On units that aren't champions
  damage: {
    type: "magic",
    scaling: scaling([150, 250, 350], { apRatio: 0.6 }),
  },
};

/** Flamethrower's share of a champion's current health, by rank */
export const OITBOIL_FLAMETHROWER_SHARE = [0.35, 0.4, 0.45] as const;

// =============================================================================
// Passive
// =============================================================================

/** Overheat - heat from his abilities; at full heat he overheats (OitboilHooks) */
export const OitboilPassive: PassiveAbilityDefinition = {
  id: "oitboil_passive",
  name: "Overheat",
  description:
    "Your abilities heat you up (Q 20, E 25, R 40) and heat falls when you stop casting. At 100 heat you overheat for 4 seconds: you deal 25% more damage, but you burn for 3% of your maximum health each second. Blue Fire (W) vents heat.",
  trigger: "always",
  usesStacks: true,
  maxStacks: OITBOIL_HEAT.max,
  stackName: "Heat",
};

// =============================================================================
// Collision & Animation
// =============================================================================

const OITBOIL_COLLISION: CircleCollision = {
  type: "circle",
  radius: 19,
  offset: { x: 0, y: 2 },
};

const OITBOIL_ANIMATIONS: ChampionAnimations = {
  idle: { id: "idle", totalFrames: 4, baseFrameDuration: 0.2, loop: true, keyframes: [] },
  walk: { id: "walk", totalFrames: 8, baseFrameDuration: 0.1, loop: true, keyframes: [] },
  attack: {
    id: "attack",
    totalFrames: 6,
    baseFrameDuration: 0.083,
    loop: false,
    // The puff of flame leaves the nozzle a little past halfway
    keyframes: [{ frame: 3, trigger: { type: "projectile" } }],
  },
  death: { id: "death", totalFrames: 8, baseFrameDuration: 0.125, loop: false, keyframes: [] },
};

// =============================================================================
// Champion Definition
// =============================================================================

export const OitboilDefinition: ChampionDefinition = {
  id: "oitboil",
  name: "Oitboil",
  title: "The Pyromancer",
  class: "mage",
  attackType: "ranged",
  resourceType: "mana",
  baseStats: OITBOIL_BASE_STATS,
  growthStats: OITBOIL_GROWTH_STATS,
  abilities: {
    Q: "oitboil_q",
    W: "oitboil_w",
    E: "oitboil_e",
    R: "oitboil_r",
  },
  passive: "oitboil_passive",
  collision: OITBOIL_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/oitboil.ts), for the health bar */
  visualHeight: 70,
  animations: OITBOIL_ANIMATIONS,
  attackAnimationSpeedScale: true,
  basicAttackProjectileSpeed: 650, // A short puff of flame
};

export const OitboilAbilities: Record<string, AbilityDefinition> = {
  oitboil_q: OitboilSparkSpray,
  oitboil_w: OitboilBlueFire,
  oitboil_e: OitboilAfterburner,
  oitboil_r: OitboilFlamethrower,
};
