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
    /** Projectile speed in units per second */
    projectileSpeed?: number;
    /** Projectile collision radius */
    projectileRadius?: number;
    /** Whether projectile passes through targets */
    piercing?: boolean;
    /** Cone angle in radians (for cone-shaped abilities) */
    coneAngle?: number;
    /** Delay before AoE applies damage (for abilities like Meteor) */
    aoeDelay?: number;
    /** Duration for persistent AoEs (0 or undefined = instant) */
    aoeDuration?: number;
    /** Tick rate for persistent AoEs */
    aoeTickRate?: number;
    /** Dash configuration (for mobility abilities) */
    dash?: {
        speed: number;
        distance: number;
    };
    /** Whether this is a blink/teleport (instant reposition) */
    teleport?: boolean;
    /** Effect IDs to apply to targets */
    appliesEffects?: string[];
    /** Duration for applied effects */
    effectDuration?: number;
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
 * Stat modifier for passive abilities.
 */
export interface PassiveStatModifier {
    /** Which stat to modify */
    stat: keyof import('./champions').ChampionBaseStats;
    /** Flat value bonus */
    flatValue?: number;
    /** Percentage bonus (0.2 = +20%) */
    percentValue?: number;
}
/**
 * Passive ability definition (champion-specific, slot "P").
 * Unlike active abilities, passives trigger automatically based on game events.
 */
export interface PassiveAbilityDefinition {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description with placeholders for values */
    description: string;
    /** Primary trigger for this passive */
    trigger: PassiveTrigger;
    /** Additional triggers (some passives can proc from multiple sources) */
    additionalTriggers?: PassiveTrigger[];
    /** Internal cooldown between triggers (seconds) */
    internalCooldown?: number;
    /** For on_low_health: health percentage threshold (0.3 = 30%) */
    healthThreshold?: number;
    /** For on_interval: trigger every X seconds */
    intervalSeconds?: number;
    /** Whether this passive uses stacks */
    usesStacks?: boolean;
    /** Maximum stacks */
    maxStacks?: number;
    /** Stacks gained per trigger */
    stacksPerTrigger?: number;
    /** Duration before stacks expire (seconds) */
    stackDuration?: number;
    /** Number of stacks required to activate the effect */
    requiredStacks?: number;
    /** Whether to consume stacks when effect activates */
    consumeStacksOnActivation?: boolean;
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
    /** Stat modifiers applied when active */
    statModifiers?: PassiveStatModifier[];
    /** Effect IDs to apply to targets */
    appliesEffects?: string[];
    /** Duration for applied effects */
    effectDuration?: number;
    /** Radius for aura-based passives */
    auraRadius?: number;
    /** Whether this passive scales with champion level (not ability ranks) */
    scalesWithLevel?: boolean;
    /** Level scaling configuration: values at specific levels */
    levelScaling?: {
        levels: number[];
        values: number[];
    };
}
/**
 * Runtime state of a passive ability (for network sync).
 */
export interface PassiveState {
    /** Whether the passive effect is currently active */
    isActive: boolean;
    /** Time remaining on internal cooldown (0 = ready) */
    cooldownRemaining: number;
    /** Current number of stacks */
    stacks: number;
    /** Time remaining before stacks expire */
    stackTimeRemaining: number;
    /** Time until next interval trigger (for on_interval passives) */
    nextIntervalIn: number;
    /** Custom data for complex passives */
    customData?: Record<string, unknown>;
}
/**
 * Get the passive value at a specific champion level.
 */
export declare function getPassiveLevelValue(passive: PassiveAbilityDefinition, level: number): number;
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