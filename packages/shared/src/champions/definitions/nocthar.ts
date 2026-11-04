/**
 * Nocthar - The Unburied
 * A rotting, half-zombie monster who crawled out of his grave and won't go
 * back, pulling the dead out of the ground to fight beside him. A mage who
 * commands an army: enemies dying near him rise as Hollows (passive), his
 * Heed Me (E) orders them where to go and whom to kill, his Lament (W) scares
 * enemies off him and frenzies the Hollows near him, and Colossus of Bones (R)
 * fuses them into one colossus. While it lives his W, E and R are the
 * colossus's: Bone Volley and Trample cost it health, which enemies dying
 * near it heal back, and R orders it. Grasping Hands (Q) is his own.
 * See docs/champions/nocthar-design.md.
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
import type { SummonStats } from "../../types/minions";

function scaling(
  base: number[],
  options?: { adRatio?: number; apRatio?: number },
): AbilityScaling {
  return { base, ...options };
}

// =============================================================================
// His kit's numbers: the server's NoctharHooks and handlers apply them
// =============================================================================

export const NOCTHAR_KIT = {
  /** Nobody Leaves: an enemy dying within this of him rises as a Hollow... */
  raiseRadius: 230,
  /** ...if the passive is ready: then it waits this long, from level 1 down to level 18 */
  raiseCooldownAtLevel1: 12.5,
  raiseCooldownAtLevel18: 7.5,
  /** At most this many Hollows at once */
  maxHollows: 5,
  /** Seconds a Hollow takes to climb out of the ground */
  riseTime: 0.75,
  /** Farther than this from him, Hollows and the colossus drop their orders and come back */
  leash: 380,
  /** A Hollow from a champion is this much bigger, and stronger */
  bigHollowScale: 1.3,
  bigHollowStrength: 1.5,

  /** With the colossus alive, an enemy dying near it heals it this share of its max health */
  colossusHealPerUnit: 0.01,
  colossusHealPerChampion: 0.25,

  /** Grasping Hands: the hands drag enemies this far toward the middle */
  qPull: 30,
  qSlowEffect: "slow_30",
  qSlowDuration: 1.5,

  /** Lament: enemies within this of him flee... */
  wFearRadius: 150,
  wFearDuration: 1,
  /** ...and his Hollows within this of him attack faster for a while, by rank */
  wFrenzyRadius: 300,
  wFrenzyAttackSpeed: [0.4, 0.5, 0.6, 0.7, 0.8],
  wFrenzyDuration: 2,

  /** Heed Me: the first order after this cooldown (by rank) is a charge... */
  eChargeCooldown: [10, 9, 8, 7, 6],
  /** ...its Hollows run faster and hit harder for a while */
  eChargeSpeed: 0.3,
  eChargeDamage: [0.2, 0.25, 0.3, 0.35, 0.4],
  eChargeDuration: 3,
  /** An order at a point this close to him is an order to come back */
  eReturnRadius: 40,

  /** Colossus of Bones: interrupted in its cast, it's back after this */
  rInterruptedCooldown: 10,
  /** Where it rises, enemies within this are knocked up */
  rKnockupRadius: 110,
  rKnockupDuration: 1,

  /** Bone Volley and Trample cost the colossus this share of its max health */
  colossusAbilityCost: 0.1,
  /** Bone Volley: the colossus throws as far as this, the bones land after its windup and flight */
  colossusWRange: 300,
  colossusWWindup: 0.4,
  colossusWFlight: 0.5,
  colossusWSlowEffect: "slow_40",
  colossusWSlowDuration: 1.5,
  /** Trample: after its windup the colossus charges this far over this long, carrying who it hits */
  colossusEWindup: 0.35,
  colossusEDistance: 210,
  colossusEDuration: 0.4,
  colossusEWidth: 20,
  colossusEKnockupDuration: 0.5,
} as const;

/** Nobody Leaves's cooldown at a level: 12.5 s at 1 down to 7.5 s at 18 */
export function noctharRaiseCooldown(level: number): number {
  const t = (Math.min(18, Math.max(1, level)) - 1) / 17;
  return NOCTHAR_KIT.raiseCooldownAtLevel1 + (NOCTHAR_KIT.raiseCooldownAtLevel18 - NOCTHAR_KIT.raiseCooldownAtLevel1) * t;
}

/** A Hollow's numbers: they grow with his level and ability power (a big one is stronger) */
export function hollowStats(level: number, abilityPower: number, big = false): SummonStats {
  const strength = big ? NOCTHAR_KIT.bigHollowStrength : 1;
  return {
    maxHealth: Math.round((180 + 24 * (level - 1) + 0.3 * abilityPower) * strength),
    armor: 12 + level,
    magicResist: 12 + level,
    attackDamage: (9 + 1.6 * (level - 1) + 0.1 * abilityPower) * strength,
    damageType: "magic",
    attackRange: 30,
    attackCooldown: 1.2,
    attackWindup: 0.25,
    movementSpeed: 95,
    sightRange: 300,
    acquisitionRange: 70,
    radius: 11,
    mass: 40,
  };
}

/**
 * How much a colossus absorbed: a Hollow counts 1, a big one 2
 * (Colossus of Bones grows with it)
 */
export function colossusStats(level: number, abilityPower: number, absorbed: number): SummonStats {
  const growth = 1 + 0.18 * absorbed;
  return {
    maxHealth: Math.round((350 + 45 * (level - 1)) * growth + 0.5 * abilityPower),
    armor: 25 + 2 * level,
    magicResist: 25 + 2 * level,
    attackDamage: (30 + 4 * (level - 1)) * (1 + 0.1 * absorbed) + 0.3 * abilityPower,
    damageType: "magic",
    attackRange: 45,
    attackCooldown: 1.4,
    attackWindup: 0.4,
    movementSpeed: 95,
    sightRange: 400,
    acquisitionRange: 80,
    radius: 24,
    mass: 200,
  };
}

/** How big the colossus is drawn: bigger the more it absorbed */
export function colossusScale(absorbed: number): number {
  return Math.min(1.6, 1 + 0.06 * absorbed);
}

// =============================================================================
// Base Stats: a ranged mage, a little sturdier than most (he's dead already)
// =============================================================================

const NOCTHAR_BASE_STATS: ChampionBaseStats = {
  health: 580,
  healthRegen: 1.1,
  resource: 360,
  resourceRegen: 3.5,
  attackDamage: 50,
  abilityPower: 0,
  attackSpeed: 0.625,
  attackRange: 210,
  armor: 24,
  magicResist: 30,
  movementSpeed: 100,
  critChance: 0,
  critDamage: 2.0,
};

const NOCTHAR_GROWTH_STATS: ChampionGrowthStats = {
  health: 90,
  healthRegen: 0.11,
  resource: 40,
  resourceRegen: 0.25,
  attackDamage: 3.0,
  attackSpeed: 1.5,
  armor: 4,
  magicResist: 1.3,
};

// =============================================================================
// Abilities
// =============================================================================

/** Q: hands burst out of the ground, drag enemies in and slow them (NoctharQHandler) */
export const NoctharGraspingHands: AbilityDefinition = {
  id: "nocthar_q",
  name: "Grasping Hands",
  description:
    "Slam your claws into the ground: after a moment, bony hands burst out in an area, dealing {damage} magic damage, dragging enemies toward its middle and slowing them by 30% for 1.5 seconds.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [9, 8.5, 8, 7.5, 7],
  castTime: 0.25,
  range: 340,
  aoeRadius: 95,
  aoeDelay: 0.85, // The ground cracks and the fingertips poke out, then the hands
  shape: "circle",
  damage: {
    type: "magic",
    scaling: scaling([70, 110, 150, 190, 230], { apRatio: 0.6 }),
  },
};

/** W: enemies near him flee; his Hollows near him frenzy (NoctharWHandler) */
export const NoctharLament: AbilityDefinition = {
  id: "nocthar_w",
  name: "Lament",
  description:
    "Wail from beyond the grave: enemies near you take {damage} magic damage and flee in fear for 1 second. Your Hollows near you attack 40/50/60/70/80% faster for 2 seconds.",
  type: "active",
  targetType: "no_target",
  maxRank: 5,
  manaCost: [70, 75, 80, 85, 90],
  cooldown: [14, 13, 12, 11, 10],
  castTime: 0.5, // He draws breath: a channel the enemy sees coming
  aoeRadius: 150,
  appliesEffects: ["fear"],
  effectDuration: 1,
  damage: {
    type: "magic",
    scaling: scaling([60, 90, 120, 150, 180], { apRatio: 0.4 }),
  },
};

/** E: orders to the Hollows; the first after a while is a charge (NoctharEHandler) */
export const NoctharHeedMe: AbilityDefinition = {
  id: "nocthar_e",
  name: "Heed Me",
  description:
    "Order your Hollows: at the ground, they go there and fight what comes near; at an enemy, they hunt it until it dies or hides; at yourself, they come back. Free, with no cooldown. The first order after 10/9/8/7/6 seconds is a charge: for 3 seconds they run 30% faster and hit 20/25/30/35/40% harder.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [0, 0, 0, 0, 0],
  cooldown: [0, 0, 0, 0, 0],
  castTime: 0,
};

/** R: the Hollows sink and a colossus of their bones rises (NoctharRHandler) */
export const NoctharColossusOfBones: AbilityDefinition = {
  id: "nocthar_r",
  name: "Colossus of Bones",
  description:
    "Plunge your arms into the earth: your Hollows sink into the ground and, after 1.5 seconds, a colossus made of their bones bursts out, dealing {damage} magic damage and knocking up enemies around it for 1 second. It's bigger and stronger for each Hollow it took. It lasts until it's destroyed; meanwhile your W, E and R are its own, no more Hollows rise, and enemies dying near it heal it. Its cooldown starts when it falls. Stunned or silenced while casting, nothing happens and it's back in 10 seconds.",
  type: "active",
  targetType: "ground_target",
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [120, 100, 80],
  castTime: 1.5,
  range: 260,
  aoeRadius: 110,
  damage: {
    type: "magic",
    scaling: scaling([150, 250, 350], { apRatio: 0.6 }),
  },
};

/** W with the colossus: it throws its own bones at an area (NoctharColossusWHandler) */
export const NoctharBoneVolley: AbilityDefinition = {
  id: "nocthar_colossus_w",
  name: "Bone Volley",
  description:
    "The colossus rips bones off its back and hurls them at an area: {damage} magic damage and a 40% slow for 1.5 seconds. Costs it 10% of its max health.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [0, 0, 0, 0, 0],
  cooldown: [8, 7.5, 7, 6.5, 6],
  castTime: 0, // The colossus winds up, not him
  aoeRadius: 90,
  shape: "circle",
  damage: {
    type: "magic",
    scaling: scaling([70, 110, 150, 190, 230], { apRatio: 0.5 }),
  },
};

/** E with the colossus: it charges, carrying who it hits (NoctharColossusEHandler) */
export const NoctharTrample: AbilityDefinition = {
  id: "nocthar_colossus_e",
  name: "Trample",
  description:
    "The colossus lowers its head and charges: enemies in its way are carried along, take {damage} magic damage and are knocked up for 0.5 seconds where it stops. Costs it 10% of its max health.",
  type: "active",
  targetType: "ground_target",
  maxRank: 5,
  manaCost: [0, 0, 0, 0, 0],
  cooldown: [12, 11, 10, 9, 8],
  castTime: 0,
  damage: {
    type: "magic",
    scaling: scaling([60, 95, 130, 165, 200], { apRatio: 0.4 }),
  },
};

/** R with the colossus: orders to it (NoctharColossusRHandler) */
export const NoctharCommandColossus: AbilityDefinition = {
  id: "nocthar_colossus_r",
  name: "Colossus, Heed Me",
  description:
    "Order the colossus: at the ground, it goes there; at an enemy, it hunts it; at yourself, it comes back. Free, with no cooldown.",
  type: "active",
  targetType: "ground_target",
  maxRank: 3,
  manaCost: [0, 0, 0],
  cooldown: [0, 0, 0],
  castTime: 0,
};

// =============================================================================
// Passive
// =============================================================================

/** Nobody Leaves - the enemies dying near him rise as Hollows (NoctharHooks) */
export const NoctharPassive: PassiveAbilityDefinition = {
  id: "nocthar_passive",
  name: "Nobody Leaves",
  description:
    "An enemy dying near you (a minion, a monster or a champion) claws its way out of the ground as a Hollow that fights for you, follows you and hits what you hit, until it's destroyed. Then this waits 12.5 seconds (7.5 at level 18). Up to 5 Hollows; a champion rises as a bigger one. If you die, they crumble.",
  trigger: "always",
  usesStacks: true,
  maxStacks: NOCTHAR_KIT.maxHollows,
  stackName: "Hollows",
};

// =============================================================================
// Collision & Animation
// =============================================================================

const NOCTHAR_COLLISION: CircleCollision = {
  type: "circle",
  radius: 20,
  offset: { x: 0, y: 2 },
};

const NOCTHAR_ANIMATIONS: ChampionAnimations = {
  idle: { id: "idle", totalFrames: 4, baseFrameDuration: 0.2, loop: true, keyframes: [] },
  walk: { id: "walk", totalFrames: 8, baseFrameDuration: 0.1, loop: true, keyframes: [] },
  attack: {
    id: "attack",
    totalFrames: 6,
    baseFrameDuration: 0.083,
    loop: false,
    // The bone shard leaves his claw past halfway
    keyframes: [{ frame: 3, trigger: { type: "projectile" } }],
  },
  death: { id: "death", totalFrames: 8, baseFrameDuration: 0.125, loop: false, keyframes: [] },
};

// =============================================================================
// Champion Definition
// =============================================================================

export const NoctharDefinition: ChampionDefinition = {
  id: "nocthar",
  name: "Nocthar",
  title: "The Unburied",
  class: "mage",
  attackType: "ranged",
  resourceType: "mana",
  baseStats: NOCTHAR_BASE_STATS,
  growthStats: NOCTHAR_GROWTH_STATS,
  abilities: {
    Q: "nocthar_q",
    W: "nocthar_w",
    E: "nocthar_e",
    R: "nocthar_r",
  },
  passive: "nocthar_passive",
  swapAbilities: {
    W: "nocthar_colossus_w",
    E: "nocthar_colossus_e",
    R: "nocthar_colossus_r",
  },
  collision: NOCTHAR_COLLISION,
  /** Height of the sprite as drawn (src/render/champions/nocthar.ts), for the health bar */
  visualHeight: 76,
  animations: NOCTHAR_ANIMATIONS,
  attackAnimationSpeedScale: true,
  basicAttackProjectileSpeed: 700,
};

/** His W, E and R while the colossus lives (NoctharHooks swaps them in) */
export const NOCTHAR_COLOSSUS_SLOTS = NoctharDefinition.swapAbilities as Record<"W" | "E" | "R", string>;

export const NoctharAbilities: Record<string, AbilityDefinition> = {
  nocthar_q: NoctharGraspingHands,
  nocthar_w: NoctharLament,
  nocthar_e: NoctharHeedMe,
  nocthar_r: NoctharColossusOfBones,
  nocthar_colossus_w: NoctharBoneVolley,
  nocthar_colossus_e: NoctharTrample,
  nocthar_colossus_r: NoctharCommandColossus,
};
