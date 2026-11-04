/**
 * Lume – The Wandering Light
 * Utility mage focused on positioning a persistent Light Orb
 *
 * DESIGN PHILOSOPHY:
 * - Low-complexity kit centered around a single unique mechanic (the Light Orb)
 * - Rewards strategic orb positioning rather than mechanical execution
 * - Team-oriented with ally buffs and zone control
 * - An ultimate fired from the orb: where it is decides where the beam goes
 *
 * LIGHT ORB STATES:
 * - ORBITING: Circles Lume at 60 unit radius, 2 rad/s
 * - TRAVELING: Moving to/from target at 480 units/s
 * - STATIONED: Fixed at location for 4s before auto-returning
 * - DESTROYED: Gone while Lume is dead; back orbiting her when she respawns
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
import type { RectangleCollision } from "../../types/collision";
import type { ChampionAnimations } from "../../types/animation";

// =============================================================================
// Scaling Helper
// =============================================================================

function scaling(
  base: number[],
  options?: {
    apRatio?: number;
    adRatio?: number;
  },
): AbilityScaling {
  return {
    base,
    ...options,
  };
}

// =============================================================================
// Light Orb Configuration (exported for server use)
// =============================================================================

export const LUME_ORB_CONFIG = {
  orbitRadius: 60, // Distance from Lume when orbiting
  orbitSpeed: 2.0, // Radians per second
  // Units per second when traveling: sent to its range (360) it lands about 1 s after the press
  // (0.25 s cast + 0.75 s flight), enough to walk out of the 80 around where it lands (dodge rule)
  travelSpeed: 480,
  stationedDuration: 4.0, // Seconds before auto-returning (less than min cooldown)
  passiveAuraRadius: 160, // Radius for passive effects
  allySpeedBonus: 0.15, // 15% movement speed
  enemyDamageAmp: 0.08, // 8% increased magic damage from Lume
  qImpactRadius: 80, // Damage radius on Q arrival
  wPulseRadius: 150, // W heal/damage radius
  eBeamHalfWidth: 20, // E: half the width of the beam between Lume and the orb
  eAllySpeedEffect: "speed_20", // E: allies crossing the beam
  rBeamLength: 1000, // R: how far the eclipse beam reaches from the orb
  rBeamHalfWidth: 60, // R: half its width
  // Called back (Q recast), the orb slows the enemies it passes through
  returnSlowRadius: 50,
  returnSlowEffect: "slow_30",
  returnSlowDuration: 1.5,
} as const;

// =============================================================================
// Base Stats
// =============================================================================

const LUME_BASE_STATS: ChampionBaseStats = {
  health: 590,
  healthRegen: 1.2,
  resource: 320,
  resourceRegen: 2.3,
  attackDamage: 52,
  abilityPower: 0,
  attackSpeed: 0.65,
  attackRange: 220, // Standard ranged mage
  armor: 26,
  magicResist: 30,
  movementSpeed: 101, // Slightly slow, E compensates
  critChance: 0,
  critDamage: 2.0,
};

const LUME_GROWTH_STATS: ChampionGrowthStats = {
  health: 85,
  healthRegen: 0.12,
  resource: 45,
  resourceRegen: 0.27,
  attackDamage: 3.2,
  attackSpeed: 2.0,
  armor: 3.5,
  magicResist: 1.3,
};

// =============================================================================
// Passive Ability
// =============================================================================

/**
 * Guiding Glow
 *
 * Lume is accompanied by a Light Orb that orbits him.
 *
 * ALLY BONUS: Champions near the orb gain 15% bonus movement speed.
 * ENEMY DEBUFF: Enemies near the orb take 8% increased magic damage from Lume.
 *
 * The orb goes when Lume dies and comes back with her; while it's gone the
 * passive and the orb abilities are off.
 *
 * IMPLEMENTATION NOTES:
 * - Aura effects are applied by ServerLightOrb.updatePassiveEffects()
 * - Effects refresh while in range (0.5s duration, applied each tick)
 * - Damage amp only applies to Lume's magic damage, not teammates
 */
export const LumePassive: PassiveAbilityDefinition = {
  id: "lume_passive",
  name: "Guiding Glow",
  description:
    "Lume is accompanied by a Light Orb. Allies near the orb gain 15% bonus movement speed. Enemies near the orb take 8% increased magic damage from Lume.",
  trigger: "always",
};

// =============================================================================
// Q Ability - Send the Light
// =============================================================================

/**
 * Send the Light
 *
 * FIRST CAST: Send the Light Orb to a target location.
 * - Orb travels at 480 units/s
 * - Deals magic damage to enemies in a small area on arrival
 * - Orb stays stationed at location for 4 seconds before auto-returning
 *
 * RECAST: Recall the orb early (while traveling or stationed).
 * - Orb returns to orbiting state
 * - No cooldown on recast
 *
 * IMPLEMENTATION NOTES:
 * - Uses ground_target targeting
 * - Cooldown starts when orb is sent
 * - Recast is always available while orb is away
 */
export const LumeQ: AbilityDefinition = {
  id: "lume_q",
  name: "Send the Light",
  description:
    "Send the Light Orb to a target location, dealing {damage} magic damage to enemies in a small area on arrival. The orb remains stationed for 4 seconds. Recast to call it back, slowing the enemies it passes through by 30% for 1.5 seconds.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [40, 45, 50, 55, 60],
  cooldown: [8, 7.5, 7, 6.5, 6],
  range: 360,
  damage: {
    type: "magic",
    scaling: scaling([70, 110, 155, 195, 235], { apRatio: 0.6 }),
  },
  aoeRadius: LUME_ORB_CONFIG.qImpactRadius,
  recast: {
    id: "lume_q_recall",
    name: "Recall Light",
    description: "Recall the Light Orb to orbit around you. On its way back it slows the enemies it passes through by 30% for 1.5 seconds.",
    type: "active",
    targetType: "self",
    maxRank: 5,
    manaCost: [0, 0, 0, 0, 0],
    cooldown: [0, 0, 0, 0, 0],
  },
  recastCondition: "always",
  recastWindow: 10, // While the orb is away (out, stationed, back): LumeQHandler
  dodgeExempt:
    "Its warning is the orb's flight (LumeQHandler, at LUME_ORB_CONFIG.travelSpeed 480): at its 360 range it lands 1 s after the press (0.25 s cast + 0.75 s), walking out of its 80 radius takes 1 s",
};

// =============================================================================
// W Ability - Warmth
// =============================================================================

/**
 * Warmth
 *
 * The Light Orb gathers warmth for aoeDelay, then pulses where it was,
 * affecting nearby units:
 * - Allies (Lume, champions, minions) are healed
 * - Enemies (champions, minions, monsters) take magic damage
 *
 * IMPLEMENTATION NOTES:
 * - Effect centered on the orb's position at the cast (its VFX and sound too)
 * - Units only: no structures, no wards
 * - Single pulse, not persistent
 */
export const LumeW: AbilityDefinition = {
  id: "lume_w",
  name: "Warmth",
  description:
    "The Light Orb gathers warmth for a moment, then pulses, healing allies near it for {heal} and dealing {damage} magic damage to enemies near it.",
  type: "active",
  targetType: "self", // Activates at orb location
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [14, 13, 12, 11, 10],
  range: 0, // Centered on orb
  damage: {
    type: "magic",
    scaling: scaling([60, 95, 130, 165, 200], { apRatio: 0.5 }),
  },
  heal: {
    scaling: scaling([60, 90, 120, 150, 180], { apRatio: 0.45 }),
  },
  aoeRadius: LUME_ORB_CONFIG.wPulseRadius,
  aoeDelay: 0.45, // The orb gathering warmth: the warning (LumeWHandler)
  dodgeExempt:
    "Centered on the orb, not on Lume: everyone sees where it is, and it gathers warmth for 0.45 s before it pulses (like League's Orianna W, the counterplay is keeping away from the orb)",
};

// =============================================================================
// E Ability - Prismatic Beam
// =============================================================================

/**
 * Prismatic Beam
 *
 * For 2.5 seconds a beam of light runs between Lume and the Light Orb,
 * wherever they move (LumeHooks applies it each tick while Lume has the
 * lume_prism effect):
 * - Enemies it touches take its damage once per cast and are slowed while
 *   in it
 * - Allied champions crossing it are sped up
 * Placing the orb (Q) makes the beam: a wall across a lane, or a line to
 * chase along.
 */
export const LumeE: AbilityDefinition = {
  id: "lume_e",
  name: "Prismatic Beam",
  description:
    "For 2.5 seconds a beam of light joins Lume and the Light Orb. Enemies it touches take {damage} magic damage (once) and are slowed by 30% while in it; allied champions crossing it gain 20% movement speed.",
  type: "active",
  targetType: "self", // The beam runs from Lume to the orb
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [14, 13, 12, 11, 10],
  range: 0,
  damage: {
    type: "magic",
    scaling: scaling([70, 105, 140, 175, 210], { apRatio: 0.4 }),
  },
  appliesEffects: ["slow_30"],
  effectDuration: 2.5, // How long the beam lasts
  aoeRadius: LUME_ORB_CONFIG.eBeamHalfWidth,
  dodgeExempt:
    "A beam that stays 2.5 s between Lume and the orb, both in sight: it's walked around or out of, like a wall (its damage is once a cast), not reacted to as it lands",
};

// =============================================================================
// R Ability - Eclipse
// =============================================================================

/**
 * Eclipse
 *
 * The Light Orb gathers light for aoeDelay (clients draw the line), then
 * fires a beam rBeamLength long from where it was toward the aim: magic
 * damage to every enemy along it. The orb isn't spent (LumeRHandler).
 */
export const LumeR: AbilityDefinition = {
  id: "lume_r",
  name: "Eclipse",
  description:
    "The Light Orb gathers light, then fires a huge beam toward the target location, dealing {damage} magic damage to every enemy along it.",
  type: "active",
  targetType: "ground_target", // Aimed; the beam starts at the orb
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [110, 95, 80],
  range: 1100, // Aim anywhere ahead
  shape: "line",
  damage: {
    type: "magic",
    scaling: scaling([220, 340, 460], { apRatio: 0.7 }),
  },
  aoeRadius: LUME_ORB_CONFIG.rBeamHalfWidth,
  aoeDelay: 0.6, // The orb gathering light: the warning
};

// =============================================================================
// Collision & Animation
// =============================================================================

const LUME_COLLISION: RectangleCollision = {
  type: "rectangle",
  width: 30, // 38 pixels * 0.8 scale
  height: 62, // 78 pixels * 0.8 scale
  offset: { x: 0, y: 0 },
};

// Visual height for UI positioning (matches collision since sprite fits collision bounds)
const LUME_VISUAL_HEIGHT = 87;

const LUME_ANIMATIONS: ChampionAnimations = {
  idle: {
    id: "idle",
    totalFrames: 1, // Single frame idle sprite
    baseFrameDuration: 0.2,
    loop: true,
    keyframes: [],
  },
  walk: {
    id: "walk",
    totalFrames: 6, // 6 frames in walk spritesheet
    baseFrameDuration: 0.1,
    loop: true,
    keyframes: [],
  },
  attack: {
    id: "attack",
    totalFrames: 10, // Updated for new attack animation
    baseFrameDuration: 0.08,
    loop: false,
    keyframes: [{ frame: 4, trigger: { type: "damage" } }], // The bolt leaves at frame 4
  },
  death: {
    id: "death",
    totalFrames: 10,
    baseFrameDuration: 0.12,
    loop: false,
    keyframes: [],
  },
  // Ability-specific animations
  abilities: {
    lume_q: {
      id: "lume_q",
      totalFrames: 8, // 8 frames in Q spritesheet
      baseFrameDuration: 0.075,
      loop: false,
      keyframes: [],
    },
    lume_w: {
      id: "lume_w",
      // Lume-W-Sheet.png (animated from her idle with PixMiniMax: scripts/animate-frame.ts): she cups her
      // hands at her chest while the orb gathers warmth, and spreads her palms at frame 10, as it pulses
      // (aoeDelay 0.45 s)
      totalFrames: 13,
      baseFrameDuration: 0.045,
      loop: false,
      keyframes: [],
    },
    lume_e: {
      id: "lume_e",
      totalFrames: 11, // 11 frames in E spritesheet
      baseFrameDuration: 0.055,
      loop: false,
      keyframes: [],
    },
    lume_r: {
      id: "lume_r",
      totalFrames: 12, // 12 frames in R spritesheet
      baseFrameDuration: 0.067, // Adjusted for 12 frames
      loop: false,
      keyframes: [],
    },
  },
};

// =============================================================================
// Champion Definition
// =============================================================================

export const LumeDefinition: ChampionDefinition = {
  id: "lume",
  name: "Lume",
  title: "The Wandering Light",
  class: "mage",
  attackType: "ranged",
  resourceType: "mana",
  baseStats: LUME_BASE_STATS,
  growthStats: LUME_GROWTH_STATS,
  abilities: {
    Q: "lume_q",
    W: "lume_w",
    E: "lume_e",
    R: "lume_r",
  },
  passive: "lume_passive",
  collision: LUME_COLLISION,
  visualHeight: LUME_VISUAL_HEIGHT,
  animations: LUME_ANIMATIONS,
  // Fast light-based projectile for ranged auto attacks
  basicAttackProjectileSpeed: 800,
};

// =============================================================================
// Ability Registry Export
// =============================================================================

export const LumeAbilities: Record<string, AbilityDefinition> = {
  lume_q: LumeQ,
  lume_w: LumeW,
  lume_e: LumeE,
  lume_r: LumeR,
};
