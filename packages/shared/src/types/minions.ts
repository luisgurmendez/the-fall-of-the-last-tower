/**
 * Minion type definitions.
 * Shared between client and server.
 */

import type { Side } from './units';

/**
 * Minion types in the game.
 */
export type MinionType = 'melee' | 'caster' | 'siege' | 'super';

/**
 * Lane identifiers.
 */
export type LaneId = 'top' | 'mid' | 'bot';

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
  siegeWave: WaveComposition;  // Every 3rd wave
}

/**
 * Default minion stats.
 */
export const DEFAULT_MINION_STATS: Record<MinionType, MinionStats> = {
  melee: {
    health: 477,
    maxHealth: 477,
    armor: 0,
    magicResist: 0,
    attackDamage: 12,
    attackRange: 50,       // Reduced from 110 - true melee range
    attackCooldown: 1.25,
    movementSpeed: 200,    // Increased from 100 for better pacing
    sightRange: 500,
    goldReward: 21,
    experienceReward: 60,
  },
  caster: {
    health: 296,
    maxHealth: 296,
    armor: 0,
    magicResist: 0,
    attackDamage: 23,
    attackRange: 300,      // Reduced from 550 - reasonable ranged attack
    attackCooldown: 1.6,
    movementSpeed: 200,    // Increased from 100 for better pacing
    sightRange: 500,
    goldReward: 14,
    experienceReward: 32,
  },
  siege: {
    health: 900,
    maxHealth: 900,
    armor: 30,
    magicResist: 0,
    attackDamage: 50,
    attackRange: 300,
    attackCooldown: 2.0,
    movementSpeed: 180,    // Slightly slower than regular minions
    sightRange: 500,
    goldReward: 60,
    experienceReward: 93,
  },
  super: {
    health: 1500,
    maxHealth: 1500,
    armor: 30,
    magicResist: 0,
    attackDamage: 180,
    attackRange: 100,      // Reduced from 170 - melee super minion
    attackCooldown: 0.85,
    movementSpeed: 220,    // Faster than regular minions
    sightRange: 500,
    goldReward: 60,
    experienceReward: 97,
  },
};

/**
 * Default minion wave configuration.
 */
export const DEFAULT_MINION_WAVE_CONFIG = {
  waveInterval: 30,  // seconds between waves
  firstWaveDelay: 65,  // seconds until first wave (1:05)
  spawnDelayBetween: 0.8,  // seconds between each minion spawn
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
