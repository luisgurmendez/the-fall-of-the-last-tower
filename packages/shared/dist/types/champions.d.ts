/**
 * Type definitions for the champion system.
 * Shared between client and server.
 */
import type { AbilitySlot } from './abilities';
import type { EntityCollision } from './collision';
import type { ChampionAnimations } from './animation';
/**
 * Champion class/role archetype.
 */
export type ChampionClass = 'warrior' | 'tank' | 'assassin' | 'mage' | 'marksman' | 'support';
/**
 * Attack type determines basic attack behavior.
 */
export type AttackType = 'melee' | 'ranged';
/**
 * Resource type (most champions use mana).
 */
export type ResourceType = 'mana' | 'energy' | 'rage' | 'health' | 'none';
/**
 * Base statistics for a champion at level 1.
 */
export interface ChampionBaseStats {
    health: number;
    healthRegen: number;
    resource: number;
    resourceRegen: number;
    attackDamage: number;
    abilityPower: number;
    attackSpeed: number;
    attackRange: number;
    armor: number;
    magicResist: number;
    movementSpeed: number;
    critChance: number;
    critDamage: number;
}
/**
 * How much stats grow per level.
 */
export interface ChampionGrowthStats {
    health: number;
    healthRegen: number;
    resource: number;
    resourceRegen: number;
    attackDamage: number;
    attackSpeed: number;
    armor: number;
    magicResist: number;
}
/**
 * Current stats (base + growth + modifiers).
 */
export interface ChampionStats extends ChampionBaseStats {
    maxHealth: number;
    maxResource: number;
    level: number;
}
/**
 * Stat modifiers from items, buffs, etc.
 */
export interface StatModifier {
    /** Unique identifier for the modifier source */
    source: string;
    /** Flat bonus added to stat */
    flat?: Partial<ChampionBaseStats>;
    /** Percentage multiplier (1.0 = no change, 1.1 = +10%) */
    percent?: Partial<Record<keyof ChampionBaseStats, number>>;
    /** Duration in seconds (undefined = permanent) */
    duration?: number;
    /** Time remaining */
    timeRemaining?: number;
}
/**
 * Definition of a champion (static data).
 */
export interface ChampionDefinition {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Short description/title */
    title: string;
    /** Champion class */
    class: ChampionClass;
    /** Melee or ranged */
    attackType: AttackType;
    /** Resource used for abilities */
    resourceType: ResourceType;
    /** Base stats at level 1 */
    baseStats: ChampionBaseStats;
    /** Stats gained per level */
    growthStats: ChampionGrowthStats;
    /** Ability IDs for each slot */
    abilities: Record<AbilitySlot, string>;
    /** Passive ability ID (slot "P") */
    passive: string;
    /** Collision shape for this champion (defaults to circle with radius 25) */
    collision?: EntityCollision;
    /** Animation data with keyframe triggers (optional - server uses for action scheduling) */
    animations?: ChampionAnimations;
    /** Whether attack animation speed scales with attack speed stat (default: true) */
    attackAnimationSpeedScale?: boolean;
}
/**
 * Runtime state of a champion (for network sync).
 */
export interface ChampionState {
    /** Current health */
    health: number;
    /** Current resource (mana/energy/etc) */
    resource: number;
    /** Current level (1-18) */
    level: number;
    /** Experience points */
    experience: number;
    /** Experience needed for next level */
    experienceToNextLevel: number;
    /** Ability ranks for each slot (0 = not learned) */
    abilityRanks: Record<AbilitySlot, number>;
    /** Available skill points */
    skillPoints: number;
    /** Whether in combat (for regen purposes) */
    inCombat: boolean;
    /** Time since last in combat */
    timeSinceCombat: number;
    /** Whether currently dead */
    isDead: boolean;
    /** Respawn timer (if dead) */
    respawnTimer: number;
    /** Active stat modifiers */
    modifiers: StatModifier[];
}
/**
 * Experience thresholds for each level.
 */
export declare const LEVEL_EXPERIENCE: number[];
/**
 * Calculate stat at a given level.
 */
export declare function calculateStat(baseStat: number, growthStat: number, level: number): number;
/**
 * Calculate attack speed at a given level.
 */
export declare function calculateAttackSpeed(baseAttackSpeed: number, attackSpeedGrowth: number, level: number, bonusAttackSpeed?: number): number;
/**
 * Calculate all stats for a champion at a given level.
 */
export declare function calculateStatsAtLevel(baseStats: ChampionBaseStats, growthStats: ChampionGrowthStats, level: number): ChampionStats;
//# sourceMappingURL=champions.d.ts.map