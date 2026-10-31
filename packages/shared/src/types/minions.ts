/**
 * Minion type definitions.
 * Shared between client and server.
 */

import type { EntityCollision } from "./collision";
import type { EntityAnimations } from "./animation";

/**
 * Minion types in the game.
 */
export type MinionType = "melee" | "caster" | "siege" | "super";

/**
 * Lane identifiers.
 */
export type LaneId = "top" | "mid" | "bot";

/**
 * Minion base stats by type.
 */
export interface MinionStats {
  health: number;
  maxHealth: number;
  armor: number;
  magicResist: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  movementSpeed: number;
  sightRange: number;
  goldReward: number;
  experienceReward: number;

  // ============== Collision & Animation (Optional) ==============

  /** Collision shape for this minion type */
  collision?: EntityCollision;

  /** Animation data with keyframe triggers */
  animations?: EntityAnimations;
}

/**
 * Minion wave composition.
 */
export interface WaveComposition {
  melee: number;
  caster: number;
  siege: number;
}

/**
 * Minion configuration for spawning.
 */
export interface MinionConfig {
  /** Stats for each minion type */
  stats: Record<MinionType, MinionStats>;
  /** Wave timing */
  waveInterval: number;
  firstWaveDelay: number;
  spawnDelayBetween: number;
  /** Wave composition (per side per lane) */
  normalWave: WaveComposition;
  siegeWave: WaveComposition; // Every 3rd wave
}

/**
 * Default minion stats. Minions walk a little slower than champions
 * (115 against 128-138) and swing at an unhurried pace, so a lane reads
 * calmly at this camera's scale.
 */
export const DEFAULT_MINION_STATS: Record<MinionType, MinionStats> = {
  melee: {
    health: 477,
    maxHealth: 477,
    armor: 10,
    magicResist: 10,
    attackDamage: 23,
    attackRange: 44,
    attackCooldown: 1.1,
    movementSpeed: 104,
    sightRange: 400,
    goldReward: 21,
    experienceReward: 60,
    collision: {
      type: "circle",
      radius: 12,
      offset: { x: 0, y: 0 },
    },
  },
  caster: {
    health: 296,
    maxHealth: 296,
    armor: 5,
    magicResist: 5,
    attackDamage: 22,
    attackRange: 220,
    attackCooldown: 1.75,
    movementSpeed: 104,
    sightRange: 400,
    goldReward: 14,
    experienceReward: 32,
    collision: {
      type: "circle",
      radius: 10, // Smaller caster minion
      offset: { x: 0, y: 0 },
    },
  },
  siege: {
    health: 900,
    maxHealth: 900,
    armor: 30,
    magicResist: 0,
    attackDamage: 50,
    attackRange: 140,
    attackCooldown: 2.2,
    movementSpeed: 104,
    sightRange: 400,
    goldReward: 60,
    experienceReward: 93,
    collision: {
      type: "circle",
      radius: 18, // Larger siege minion
      offset: { x: 0, y: 0 },
    },
  },
  super: {
    health: 1500,
    maxHealth: 1500,
    armor: 30,
    magicResist: 0,
    attackDamage: 180,
    attackRange: 70, // Melee super minion
    attackCooldown: 0.95,
    movementSpeed: 113, // Faster than regular minions
    sightRange: 400,
    goldReward: 60,
    experienceReward: 97,
    collision: {
      type: "circle",
      radius: 22, // Large super minion
      offset: { x: 0, y: 0 },
    },
  },
};

/**
 * Default minion wave configuration.
 */
export const DEFAULT_MINION_WAVE_CONFIG = {
  waveInterval: 30,
  firstWaveDelay: 65,
  spawnDelayBetween: 1.4,
  normalWave: {
    melee: 3,
    caster: 3,
    siege: 0,
  },
  siegeWave: {
    melee: 3,
    caster: 3,
    siege: 1,
  },
};
