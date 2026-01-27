/**
 * Lume – The Wandering Light
 * Utility mage focused on positioning a persistent Light Orb
 *
 * DESIGN PHILOSOPHY:
 * - Low-complexity kit centered around a single unique mechanic (the Light Orb)
 * - Rewards strategic orb positioning rather than mechanical execution
 * - Team-oriented with ally buffs and zone control
 * - High risk/reward ultimate that sacrifices the orb for burst damage
 *
 * LIGHT ORB STATES:
 * - ORBITING: Circles Lume at 60 unit radius, 2 rad/s
 * - TRAVELING: Moving to/from target at 1200 units/s
 * - STATIONED: Fixed at location for 4s before auto-returning
 * - DESTROYED: Gone for 60s after R cast, no orb abilities usable
 */

import type {
  ChampionDefinition,
  ChampionBaseStats,
  ChampionGrowthStats,
} from '../../types/champions';
import type {
  AbilityDefinition,
  AbilityScaling,
  PassiveAbilityDefinition,
} from '../../types/abilities';
import type { CircleCollision } from '../../types/collision';
import type { ChampionAnimations } from '../../types/animation';

// =============================================================================
// Scaling Helper
// =============================================================================

function scaling(base: number[], options?: {
  apRatio?: number;
  adRatio?: number;
}): AbilityScaling {
  return {
    base,
    ...options,
  };
}

// =============================================================================
// Light Orb Configuration (exported for server use)
// =============================================================================

export const LUME_ORB_CONFIG = {
  orbitRadius: 60,            // Distance from Lume when orbiting
  orbitSpeed: 2.0,            // Radians per second
  travelSpeed: 1200,          // Units per second when traveling
  stationedDuration: 4.0,     // Seconds before auto-returning
  passiveAuraRadius: 300,     // Radius for passive effects
  allySpeedBonus: 0.15,       // 15% movement speed
  enemyDamageAmp: 0.08,       // 8% increased magic damage from Lume
  respawnTime: 60.0,          // Seconds to respawn after R
  qImpactRadius: 150,         // Damage radius on Q arrival
  wPulseRadius: 300,          // W heal/damage radius
  eBlindRadius: 200,          // E blind radius on arrival
  rExplosionRadius: 400,      // R explosion radius
} as const;

// =============================================================================
// Base Stats
// =============================================================================

const LUME_BASE_STATS: ChampionBaseStats = {
  health: 540,
  healthRegen: 6.5,
  resource: 320,
  resourceRegen: 7,
  attackDamage: 52,
  abilityPower: 0,
  attackSpeed: 0.65,
  attackRange: 550,           // Standard ranged mage
  armor: 26,
  magicResist: 30,
  movementSpeed: 335,         // Slightly slow, E compensates
  critChance: 0,
  critDamage: 2.0,
};

const LUME_GROWTH_STATS: ChampionGrowthStats = {
  health: 85,
  healthRegen: 0.6,
  resource: 45,
  resourceRegen: 0.8,
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
 * If the orb is destroyed (by R), all passive effects are disabled until respawn.
 *
 * IMPLEMENTATION NOTES:
 * - Aura effects are applied by ServerLightOrb.updatePassiveEffects()
 * - Effects refresh while in range (0.5s duration, applied each tick)
 * - Damage amp only applies to Lume's magic damage, not teammates
 */
export const LumePassive: PassiveAbilityDefinition = {
  id: 'lume_passive',
  name: 'Guiding Glow',
  description:
    'Lume is accompanied by a Light Orb. Allies near the orb gain 15% bonus movement speed. Enemies near the orb take 8% increased magic damage from Lume.',
  trigger: 'always',
};

// =============================================================================
// Q Ability - Send the Light
// =============================================================================

/**
 * Send the Light
 *
 * FIRST CAST: Send the Light Orb to a target location.
 * - Orb travels at 1200 units/s
 * - Deals magic damage to enemies in a small area on arrival
 * - Orb stays stationed at location for 4 seconds
 *
 * RECAST: Recall the orb early (while traveling or stationed).
 * - Orb returns to orbiting state
 * - No cooldown on recast
 *
 * CANNOT CAST IF: Orb is destroyed
 *
 * IMPLEMENTATION NOTES:
 * - Uses ground_target targeting
 * - Cooldown starts when orb is sent
 * - Recast is always available while orb is away
 */
export const LumeQ: AbilityDefinition = {
  id: 'lume_q',
  name: 'Send the Light',
  description:
    'Send the Light Orb to a target location, dealing {damage} magic damage to enemies in a small area on arrival. The orb remains stationed for 4 seconds. Recast to recall the orb early.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 5,
  manaCost: [40, 45, 50, 55, 60],
  cooldown: [8, 7.5, 7, 6.5, 6],
  range: 800,
  damage: {
    type: 'magic',
    scaling: scaling([60, 95, 130, 165, 200], { apRatio: 0.6 }),
  },
  aoeRadius: LUME_ORB_CONFIG.qImpactRadius,
  recast: {
    id: 'lume_q_recall',
    name: 'Recall Light',
    description: 'Recall the Light Orb to orbit around you.',
    type: 'active',
    targetType: 'self',
    maxRank: 5,
    manaCost: [0, 0, 0, 0, 0],
    cooldown: [0, 0, 0, 0, 0],
  },
  recastCondition: 'always',
  recastWindow: 10,
};

// =============================================================================
// W Ability - Warmth
// =============================================================================

/**
 * Warmth
 *
 * The Light Orb pulses with warmth, affecting nearby units:
 * - Allied champions are healed
 * - Enemy champions take magic damage
 *
 * CANNOT CAST IF: Orb is destroyed
 *
 * IMPLEMENTATION NOTES:
 * - Effect centered on orb's current position
 * - Affects champions only (not minions)
 * - Single pulse, not persistent
 */
export const LumeW: AbilityDefinition = {
  id: 'lume_w',
  name: 'Warmth',
  description:
    'The Light Orb pulses, healing allied champions for {heal} and dealing {damage} magic damage to enemy champions within range.',
  type: 'active',
  targetType: 'self', // Activates at orb location
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [14, 13, 12, 11, 10],
  range: 0, // Centered on orb
  damage: {
    type: 'magic',
    scaling: scaling([50, 80, 110, 140, 170], { apRatio: 0.5 }),
  },
  heal: {
    scaling: scaling([60, 90, 120, 150, 180], { apRatio: 0.45 }),
  },
  aoeRadius: LUME_ORB_CONFIG.wPulseRadius,
};

// =============================================================================
// E Ability - Dazzle Step
// =============================================================================

/**
 * Dazzle Step
 *
 * Dash toward the Light Orb's current position.
 *
 * ON ARRIVAL (within 50 units of orb):
 * - Nearby enemies are blinded
 * - Blind causes auto-attacks to miss
 *
 * DASH PROPERTIES:
 * - Speed: 1200 units/s
 * - Max distance: 600 units
 * - Stops at orb if within range
 * - Can dash toward traveling orb (targets current position)
 *
 * CANNOT CAST IF: Orb is destroyed
 *
 * IMPLEMENTATION NOTES:
 * - Dash direction calculated from Lume to orb at cast time
 * - If orb is farther than 600 units, dashes max distance toward it
 * - Blind effect only if Lume ends within 50 units of orb
 */
export const LumeE: AbilityDefinition = {
  id: 'lume_e',
  name: 'Dazzle Step',
  description:
    'Dash toward the Light Orb. If Lume reaches the orb, nearby enemies are blinded for {effectDuration} seconds.',
  type: 'active',
  targetType: 'self', // Direction determined by orb location
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [18, 16, 14, 12, 10],
  range: 0, // Not a targeted ability
  dash: {
    speed: 1200,
    distance: 600,
  },
  appliesEffects: ['blind'],
  effectDuration: 1.2, // Blind duration scales with ability executor
  aoeRadius: LUME_ORB_CONFIG.eBlindRadius,
};

// =============================================================================
// R Ability - Beaconfall
// =============================================================================

/**
 * Beaconfall
 *
 * The Light Orb explodes at its current position.
 *
 * EXPLOSION:
 * - Large area magic damage
 * - 40% slow for 2 seconds
 * - Centered on orb's current position
 *
 * CONSEQUENCE:
 * - The orb is destroyed
 * - All orb-related abilities (Q, W, E) become unusable
 * - Passive aura effects stop
 * - Orb respawns after 60 seconds in orbiting state
 *
 * CANNOT CAST IF: Orb is already destroyed
 *
 * IMPLEMENTATION NOTES:
 * - Cooldown is separate from orb respawn timer
 * - R cooldown continues even while orb is destroyed
 * - Can only cast R again after orb respawns
 */
export const LumeR: AbilityDefinition = {
  id: 'lume_r',
  name: 'Beaconfall',
  description:
    'The Light Orb explodes, dealing {damage} magic damage in a large area and slowing enemies by 40% for 2 seconds. The orb is destroyed and regenerates after 60 seconds.',
  type: 'active',
  targetType: 'self', // Detonates at orb location
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [120, 100, 80],
  range: 0,
  damage: {
    type: 'magic',
    scaling: scaling([200, 300, 400], { apRatio: 0.8 }),
  },
  appliesEffects: ['slow_40'],
  effectDuration: 2.0,
  aoeRadius: LUME_ORB_CONFIG.rExplosionRadius,
};

// =============================================================================
// Collision & Animation
// =============================================================================

const LUME_COLLISION: CircleCollision = {
  type: 'circle',
  radius: 22,
  offset: { x: 0, y: 0 },
};

const LUME_ANIMATIONS: ChampionAnimations = {
  idle: {
    id: 'idle',
    totalFrames: 4,
    baseFrameDuration: 0.2,
    loop: true,
    keyframes: [],
  },
  walk: {
    id: 'walk',
    totalFrames: 8,
    baseFrameDuration: 0.1,
    loop: true,
    keyframes: [],
  },
  attack: {
    id: 'attack',
    totalFrames: 6,
    baseFrameDuration: 0.1,
    loop: false,
    keyframes: [
      { frame: 3, trigger: { type: 'damage' } },
    ],
  },
  death: {
    id: 'death',
    totalFrames: 10,
    baseFrameDuration: 0.12,
    loop: false,
    keyframes: [],
  },
  // Ability-specific animations
  abilities: {
    lume_q: {
      id: 'lume_q',
      totalFrames: 4,
      baseFrameDuration: 0.1,
      loop: false,
      keyframes: [],
    },
    lume_w: {
      id: 'lume_w',
      totalFrames: 5,
      baseFrameDuration: 0.1,
      loop: false,
      keyframes: [],
    },
    lume_e: {
      id: 'lume_e',
      totalFrames: 6,
      baseFrameDuration: 0.08,
      loop: false,
      keyframes: [],
    },
    lume_r: {
      id: 'lume_r',
      totalFrames: 8,
      baseFrameDuration: 0.1,
      loop: false,
      keyframes: [],
    },
  },
};

// =============================================================================
// Champion Definition
// =============================================================================

export const LumeDefinition: ChampionDefinition = {
  id: 'lume',
  name: 'Lume',
  title: 'The Wandering Light',
  class: 'mage',
  attackType: 'ranged',
  resourceType: 'mana',
  baseStats: LUME_BASE_STATS,
  growthStats: LUME_GROWTH_STATS,
  abilities: {
    Q: 'lume_q',
    W: 'lume_w',
    E: 'lume_e',
    R: 'lume_r',
  },
  passive: 'lume_passive',
  collision: LUME_COLLISION,
  animations: LUME_ANIMATIONS,
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
