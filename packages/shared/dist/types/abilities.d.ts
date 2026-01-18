/**
 * Type definitions for the ability system.
 * Shared between client and server.
 */
import type { DamageType } from './units';
/**
 * Ability slot identifiers (like LoL's Q, W, E, R).
 */
export type AbilitySlot = 'Q' | 'W' | 'E' | 'R';
/**
 * Whether the ability is passive (auto-triggered) or active (manually cast).
 */
export type AbilityType = 'passive' | 'active';
/**
 * How the ability selects its target(s).
 */
export type AbilityTargetType = 'self' | 'target_enemy' | 'target_ally' | 'target_unit' | 'skillshot' | 'ground_target' | 'aura' | 'toggle' | 'no_target';
/**
 * The shape of an ability's effect area.
 */
export type AbilityShape = 'single' | 'line' | 'cone' | 'circle' | 'rectangle';
/**
 * What triggers a passive ability.
 */
export type PassiveTrigger = 'on_attack' | 'on_hit' | 'on_ability_cast' | 'on_ability_hit' | 'on_take_damage' | 'on_kill' | 'on_assist' | 'on_low_health' | 'on_full_mana' | 'on_interval' | 'on_enter_combat' | 'on_leave_combat' | 'always';
/**
 * Configuration for ability scaling.
 */
export interface AbilityScaling {
    /** Base value at each rank (index 0 = rank 1) */
    base: number[];
    /** Scaling ratio with Attack Damage (0-1+) */
    adRatio?: number;
    /** Scaling ratio with Ability Power (0-1+) */
    apRatio?: number;
    /** Scaling ratio with bonus health */
    bonusHealthRatio?: number;
    /** Scaling ratio with max health */
    maxHealthRatio?: number;
    /** Scaling ratio with missing health */
    missingHealthRatio?: number;
    /** Scaling ratio with armor */
    armorRatio?: number;
    /** Scaling ratio with magic resist */
    magicResistRatio?: number;
}
/**
 * Definition of an ability's properties (static data).
 */
export interface AbilityDefinition {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description with placeholders for values */
    description: string;
    /** Passive or active ability */
    type: AbilityType;
    /** How targets are selected */
    targetType: AbilityTargetType;
    /** Maximum ability rank */
    maxRank: number;
    /** Mana cost at each rank (active only) */
    manaCost?: number[];
    /** Cooldown in seconds at each rank (active only) */
    cooldown?: number[];
    /** Cast time in seconds (0 = instant) */
    castTime?: number;
    /** Maximum cast range */
    range?: number;
    /** Area of effect radius (if applicable) */
    aoeRadius?: number;
    /** Shape of the ability effect */
    shape?: AbilityShape;
    /** Damage configuration */
    damage?: {
        type: DamageType;
        scaling: AbilityScaling;
    };
    /** Heal configuration */
    heal?: {
        scaling: AbilityScaling;
    };
    /** Shield configuration */
    shield?: {
        scaling: AbilityScaling;
        duration: number;
    };
    /** For passive abilities: what triggers it */
    passiveTrigger?: PassiveTrigger;
    /** For passive abilities: internal cooldown between triggers */
    passiveCooldown?: number;
}
/**
 * Runtime state of an ability (for network sync).
 */
export interface AbilityState {
    /** Current rank (0 = not learned, 1-5 = learned) */
    rank: number;
    /** Time remaining on cooldown (0 = ready) */
    cooldownRemaining: number;
    /** Total cooldown duration for the current rank */
    cooldownTotal: number;
    /** Whether the ability is currently being cast */
    isCasting: boolean;
    /** Time remaining in cast (for channeled abilities) */
    castTimeRemaining: number;
    /** For toggle abilities: whether currently active */
    isToggled: boolean;
    /** For passive abilities: internal cooldown remaining */
    passiveCooldownRemaining: number;
}
/**
 * Result of an ability cast attempt.
 */
export interface AbilityCastResult {
    /** Whether the ability was successfully cast */
    success: boolean;
    /** Reason for failure (if any) */
    failReason?: 'on_cooldown' | 'not_enough_mana' | 'invalid_target' | 'out_of_range' | 'silenced' | 'stunned';
    /** Mana consumed */
    manaCost?: number;
    /** Cooldown started (seconds) */
    cooldownStarted?: number;
}
/**
 * Conditions for AI to consider casting an ability.
 */
export interface AbilityAIConditions {
    /** Minimum mana percentage to cast (0-1) */
    minManaPercent?: number;
    /** Only cast if caster health above this percentage (0-1) */
    minHealthPercent?: number;
    /** Only cast if caster health below this percentage (0-1) */
    maxHealthPercent?: number;
    /** Minimum enemies in range to cast */
    minEnemiesInRange?: number;
    /** Minimum allies in range to cast */
    minAlliesInRange?: number;
    /** Only cast if target health below this percentage (0-1) */
    targetMaxHealthPercent?: number;
    /** Only cast if target health above this percentage (0-1) */
    targetMinHealthPercent?: number;
    /** Priority score for AI decision making (higher = cast sooner) */
    priority?: number;
}
/**
 * Calculate scaled ability value.
 */
export declare function calculateAbilityValue(scaling: AbilityScaling, rank: number, stats: {
    attackDamage?: number;
    abilityPower?: number;
    bonusHealth?: number;
    maxHealth?: number;
    missingHealth?: number;
    armor?: number;
    magicResist?: number;
}): number;
//# sourceMappingURL=abilities.d.ts.map