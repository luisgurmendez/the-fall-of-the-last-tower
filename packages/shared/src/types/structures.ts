/**
 * Structure type definitions (towers, inhibitors, nexus).
 * Shared between client and server.
 */

import type { Side } from './units';

/**
 * Tower tier (outer = 1, inner = 2, inhibitor = 3).
 */
export type TowerTier = 1 | 2 | 3;

/**
 * Lane identifier for towers.
 */
export type TowerLane = 'top' | 'mid' | 'bot';

/**
 * Tower stats configuration.
 */
export interface TowerStats {
  health: number;
  maxHealth: number;
  armor: number;
  magicResist: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  /** Damage ramp per consecutive hit on same target */
  warmupDamagePerStack: number;
  maxWarmupStacks: number;
}

/**
 * Default tower stats by tier.
 */
export const DEFAULT_TOWER_STATS: Record<TowerTier, TowerStats> = {
  1: {
    health: 3000,
    maxHealth: 3000,
    armor: 40,
    magicResist: 40,
    attackDamage: 152,
    attackRange: 750,
    attackCooldown: 0.83,
    warmupDamagePerStack: 40,
    maxWarmupStacks: 5,
  },
  2: {
    health: 3500,
    maxHealth: 3500,
    armor: 55,
    magicResist: 55,
    attackDamage: 170,
    attackRange: 750,
    attackCooldown: 0.83,
    warmupDamagePerStack: 45,
    maxWarmupStacks: 5,
  },
  3: {
    health: 4000,
    maxHealth: 4000,
    armor: 70,
    magicResist: 70,
    attackDamage: 190,
    attackRange: 750,
    attackCooldown: 0.83,
    warmupDamagePerStack: 50,
    maxWarmupStacks: 5,
  },
};

/**
 * Tower targeting priority.
 */
export enum TowerTargetPriority {
  /** No target */
  NONE = 0,
  /** Minion targets */
  MINION = 10,
  /** Champion not attacking allies */
  CHAMPION = 50,
  /** Champion attacking an ally champion */
  CHAMPION_ATTACKING_ALLY = 100,
}

/**
 * Inhibitor stats.
 */
export interface InhibitorStats {
  health: number;
  maxHealth: number;
  armor: number;
  magicResist: number;
  respawnTime: number;
}

/**
 * Default inhibitor stats.
 */
export const DEFAULT_INHIBITOR_STATS: InhibitorStats = {
  health: 4000,
  maxHealth: 4000,
  armor: 20,
  magicResist: 20,
  respawnTime: 300, // 5 minutes
};

/**
 * Nexus stats.
 */
export interface NexusStats {
  health: number;
  maxHealth: number;
  armor: number;
  magicResist: number;
}

/**
 * Default nexus stats.
 */
export const DEFAULT_NEXUS_STATS: NexusStats = {
  health: 5500,
  maxHealth: 5500,
  armor: 20,
  magicResist: 20,
};

/**
 * Tower rewards on destruction.
 */
export interface TowerReward {
  localGold: number;
  globalGold: number;
  experience: number;
}

/**
 * Default tower rewards by tier.
 */
export const DEFAULT_TOWER_REWARDS: Record<TowerTier, TowerReward> = {
  1: {
    localGold: 250,
    globalGold: 150,
    experience: 100,
  },
  2: {
    localGold: 300,
    globalGold: 100,
    experience: 150,
  },
  3: {
    localGold: 350,
    globalGold: 50,
    experience: 200,
  },
};
