/**
 * Structure type definitions (towers, inhibitors, nexus).
 * Shared between client and server.
 */

import type { EntityCollision, CircleCollision } from "./collision";
import { DEFAULT_TOWER_COLLISION } from "./collision";

/**
 * Tower tier (outer = 1, inner = 2, inhibitor = 3).
 */
export type TowerTier = 1 | 2 | 3;

/**
 * Lane identifier for towers.
 */
export type TowerLane = "top" | "mid" | "bot";

/**
 * Tower stats configuration.
 */
export interface TowerStats {
  health: number;
  maxHealth: number;
  armor: number;
  magicResist: number;
  /** Damage per shot at the start (always, against minions) */
  attackDamage: number;
  /** Against champions it grows this much a minute of game time, up to maxChampionDamage (like the classic MOBA's turrets) */
  championDamagePerMinute: number;
  maxChampionDamage: number;
  /** Gap between the tower's body and its target's (edge to edge) */
  attackRange: number;
  /** How far the tower sees, from its center */
  sightRange: number;
  /** Seconds between shots */
  attackCooldown: number;
  /** Each consecutive shot on the same target deals this much more (0.3: +30%), up to maxWarmupStacks shots */
  warmupPercentPerStack: number;
  maxWarmupStacks: number;
  /** Collision shape for the tower */
  collision?: EntityCollision;
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
    championDamagePerMinute: 7.5,
    maxChampionDamage: 302,
    attackRange: 300,
    sightRange: 440,
    attackCooldown: 1.2,
    warmupPercentPerStack: 0.3,
    maxWarmupStacks: 4,
    collision: DEFAULT_TOWER_COLLISION,
  },
  2: {
    health: 3500,
    maxHealth: 3500,
    armor: 55,
    magicResist: 55,
    attackDamage: 170,
    championDamagePerMinute: 8,
    maxChampionDamage: 330,
    attackRange: 300,
    sightRange: 440,
    attackCooldown: 1.2,
    warmupPercentPerStack: 0.3,
    maxWarmupStacks: 4,
    collision: DEFAULT_TOWER_COLLISION,
  },
  3: {
    health: 4000,
    maxHealth: 4000,
    armor: 70,
    magicResist: 70,
    attackDamage: 190,
    championDamagePerMinute: 8.5,
    maxChampionDamage: 360,
    attackRange: 300,
    sightRange: 440,
    attackCooldown: 1.2,
    warmupPercentPerStack: 0.3,
    maxWarmupStacks: 4,
    collision: DEFAULT_TOWER_COLLISION,
  },
};

/**
 * Tower targeting priority.
 * Towers prioritize minions over champions, unless a champion has aggro
 * (dealt damage to an allied champion under tower).
 */
export enum TowerTargetPriority {
  /** No target */
  NONE = 0,
  /** Champion without aggro (lowest priority - only if no minions) */
  CHAMPION = 10,
  /** Minion targets (prioritized over champions) */
  MINION = 50,
  /** Champion with tower aggro (dealt damage to allied champion) */
  CHAMPION_WITH_AGGRO = 100,
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
  /** Collision shape for the inhibitor */
  collision?: CircleCollision;
}

/**
 * Default inhibitor stats (the same as MOBAConfig.INHIBITORS.STATS, which the
 * server uses).
 */
export const DEFAULT_INHIBITOR_STATS: InhibitorStats = {
  health: 3500,
  maxHealth: 3500,
  armor: 20,
  magicResist: 20,
  respawnTime: 240, // 4 minutes
  collision: { type: "circle", radius: 40, offset: { x: 0, y: 0 } },
};

/**
 * Nexus stats.
 */
export interface NexusStats {
  health: number;
  maxHealth: number;
  armor: number;
  magicResist: number;
  /** Collision shape for the nexus */
  collision?: CircleCollision;
}

/**
 * Default nexus stats.
 */
export const DEFAULT_NEXUS_STATS: NexusStats = {
  health: 5500,
  maxHealth: 5500,
  armor: 20,
  magicResist: 20,
  collision: { type: "circle", radius: 75, offset: { x: 0, y: 0 } },
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
