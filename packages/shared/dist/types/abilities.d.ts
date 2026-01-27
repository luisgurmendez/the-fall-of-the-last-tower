/**
 * Type definitions for the ability system.
 * Shared between client and server.
 *
 * Abilities use COMPOSITION over inheritance - abilities can combine
 * multiple behaviors (charge, ammo, channel, recast, toggle, transform, empowered).
 */
import type { DamageType } from './units';
/**
 * Charge behavior: Hold to charge, release to cast.
 * Examples: Varus Q, Vi Q, Pantheon Q
 */
export interface ChargeBehavior {
    /** Minimum charge time before release is valid (seconds) */
    minChargeTime: number;
    /** Maximum charge time (auto-releases at max) (seconds) */
    maxChargeTime: number;
    /** Whether movement is allowed while charging */
    canMoveWhileCharging?: boolean;
    /** Movement speed multiplier while charging (0-1) */
    chargeMovementSpeed?: number;
    /** Whether charging can be cancelled */
    canCancel?: boolean;
    /** Mana drain per second while charging (optional) */
    manaDrainPerSecond?: number;
    /** Scaling factor at min charge (e.g., 0.5 = 50% damage at min) */
    minChargeMultiplier?: number;
    /** Scaling factor at max charge (e.g., 1.5 = 150% damage at max) */
    maxChargeMultiplier?: number;
    /** Range increase at max charge (added to base range) */
    maxChargeRangeBonus?: number;
}
/**
 * Ammo/charges behavior: Limited uses that regenerate over time.
 * Examples: Teemo R, Corki R, Akali R
 */
export interface AmmoBehavior {
    /** Maximum charges that can be stored */
    maxCharges: number;
    /** Time to regenerate one charge (seconds) at each rank */
    rechargeTime: number[];
    /** Starting charges when ability is learned */
    startingCharges?: number;
    /** Whether all charges are consumed at once */
    consumeAllOnCast?: boolean;
}
/**
 * Channel behavior: Cast over time, interruptible.
 * Examples: Katarina R, Nunu R, MF R
 */
export interface ChannelBehavior {
    /** Channel duration (seconds) */
    duration: number;
    /** Whether champion can move while channeling */
    canMove?: boolean;
    /** Whether champion can change direction while channeling */
    canRotate?: boolean;
    /** Whether channel is cancelled by taking damage */
    cancelOnDamage?: boolean;
    /** Damage threshold to cancel (if cancelOnDamage is true) */
    damageThreshold?: number;
    /** Tick rate for channel effects (e.g., damage per tick) */
    tickRate?: number;
    /** Effect applied on early cancel (interrupt) */
    interruptEffect?: string;
}
/**
 * Conditions for when recast is available.
 */
export type RecastCondition = 'always' | 'on_hit' | 'on_kill' | 'on_dash_complete' | 'manual';
/**
 * Transform behavior: Changes champion form/abilities.
 * Examples: Nidalee R, Elise R, Jayce R
 */
export interface TransformBehavior {
    /** ID of the alternate form (champion variant) */
    alternateFormId: string;
    /** Whether transform has a cooldown */
    hasCooldown?: boolean;
    /** Duration of transform (undefined = permanent until recast) */
    duration?: number;
    /** Ability replacements in alternate form (Q/W/E/R -> new ability IDs) */
    abilityReplacements?: Partial<Record<AbilitySlot, string>>;
}
/**
 * Stat transform behavior: Temporarily modifies champion stats.
 * Examples: Nasus R, Renekton R, Vile R
 */
export interface StatTransformBehavior {
    /** Duration of the transform (seconds) */
    duration: number;
    /** Attack range override during transform (e.g., 100 for melee) */
    attackRange?: number;
    /** Stat modifiers applied during transform (values at each rank) */
    statModifiers?: {
        maxHealth?: number[];
        attackDamage?: number[];
        attackSpeed?: number[];
        movementSpeed?: number[];
        armor?: number[];
        magicResist?: number[];
    };
    /** Soul stacks granted on cast (for Vile) */
    soulStacksOnCast?: number;
    /** Whether casting triggers all owned traps to explode */
    triggersTrapExplosion?: boolean;
    /** Whether the transform can be ended early */
    canEndEarly?: boolean;
}
/**
 * Toggle behavior configuration.
 * Examples: Aatrox E passive, Ashe Q
 */
export interface ToggleBehavior {
    /** Mana drain per second while active */
    manaDrainPerSecond?: number;
    /** Health drain per second while active */
    healthDrainPerSecond?: number;
    /** Whether toggle auto-deactivates at 0 mana */
    deactivateOnNoMana?: boolean;
    /** Minimum duration before can toggle off */
    minActiveDuration?: number;
}
/**
 * Empowered behavior: Next ability/attack is enhanced.
 * Examples: Rengar Q, GP Q, Jax W
 */
export interface EmpoweredBehavior {
    /** What is empowered: next attack, next ability, or both */
    empowers: 'attack' | 'ability' | 'both';
    /** Which ability slot is empowered (if specific) */
    empoweredAbility?: AbilitySlot;
    /** Duration the empowerment lasts (seconds) */
    duration: number;
    /** Bonus damage/effects when consumed */
    bonusDamage?: AbilityScaling;
    /** Effect ID applied when empowered action is used */
    appliesEffect?: string;
}
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
    /** Width for line/dash abilities */
    width?: number;
    /** Cone angle in radians (for cone-shaped abilities) */
    coneAngle?: number;
    /** Delay before AoE applies damage (for abilities like Meteor) */
    aoeDelay?: number;
    /** Duration for persistent AoEs (0 or undefined = instant) */
    aoeDuration?: number;
    /** Tick rate for persistent AoEs */
    aoeTickRate?: number;
    /** Duration for zone abilities (creates persistent ground effect) */
    zoneDuration?: number;
    /** Tick rate for zone damage/effects in seconds */
    zoneTickRate?: number;
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
    /** Whether this ability affects enemy champions (default: true) */
    affectsChampions?: boolean;
    /** Whether this ability affects minions (default: true) */
    affectsMinions?: boolean;
    /** Whether this ability affects towers/structures (default: false) */
    affectsTowers?: boolean;
    /** Whether this ability affects jungle camps (default: true) */
    affectsJungleCamps?: boolean;
    /** Whether this ability affects wards (default: false) */
    affectsWards?: boolean;
    /** For passive abilities: what triggers it */
    passiveTrigger?: PassiveTrigger;
    /** For passive abilities: internal cooldown between triggers */
    passiveCooldown?: number;
    /**
     * Recast behavior: Ability can be cast multiple times.
     * - number: Recast same ability N times (e.g., 3 for Riven Q)
     * - AbilityDefinition: Different ability on recast (e.g., Lee Sin Q1 -> Q2)
     */
    recast?: AbilityDefinition | number;
    /** Time window to recast after first cast (seconds) */
    recastWindow?: number;
    /** Condition for when recast becomes available */
    recastCondition?: RecastCondition;
    /**
     * Ammo/charges behavior: Limited uses that regenerate.
     * - number: Simple max charges (uses default recharge = cooldown)
     * - AmmoBehavior: Full configuration
     */
    ammo?: number | AmmoBehavior;
    /** Charge behavior: Hold to charge, release to cast */
    charge?: ChargeBehavior;
    /** Channel behavior: Cast over time, interruptible */
    channel?: ChannelBehavior;
    /**
     * Toggle behavior configuration.
     * - true: Simple toggle (no mana drain)
     * - ToggleBehavior: Full configuration with mana/health drain
     */
    toggle?: boolean | ToggleBehavior;
    /** Transform behavior: Changes champion form */
    transform?: TransformBehavior;
    /** Stat transform behavior: Temporarily modifies stats (e.g., Nasus R, Vile R) */
    statTransform?: StatTransformBehavior;
    /** Empowered behavior: Enhances next attack/ability */
    empowered?: EmpoweredBehavior;
    /** Whether projectile stops on wall collision (enables wall-hit recast for some abilities) */
    stopsOnWall?: boolean;
    /** Effects applied after the main ability duration ends (e.g., speed buff after stealth) */
    postEffects?: {
        effects: string[];
        duration: number;
    };
    /** Trap configuration for abilities that place invisible traps */
    trap?: {
        /** Radius within which enemy champions trigger the trap */
        triggerRadius: number;
        /** How long the trap lasts before expiring (seconds) */
        duration: number;
        /** Whether the trap is invisible to enemies */
        isStealthed: boolean;
        /** Duration of root effect when triggered (seconds) */
        rootDuration: number;
        /** Soul stacks granted to owner when trap triggers */
        soulStacksOnTrigger?: number;
        /** Damage dealt when trap explodes (from ultimate) at each R rank */
        explosionDamage?: number[];
        /** Radius of explosion */
        explosionRadius?: number;
        /** Root duration when trap explodes */
        explosionRootDuration?: number;
    };
    /** Aura configuration for abilities that deal damage around the champion */
    aura?: {
        /** Radius of the aura */
        radius: number;
        /** Damage dealt per tick */
        damage: {
            type: DamageType;
            scaling: AbilityScaling;
        };
        /** Time between damage ticks (seconds) */
        tickRate: number;
    };
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
    /** Current ammo/charges (for ammo abilities) */
    charges?: number;
    /** Time remaining until next charge regenerates */
    chargeRegenRemaining?: number;
    /** Current recast count (for multi-recast abilities) */
    recastCount?: number;
    /** Time remaining in recast window */
    recastWindowRemaining?: number;
    /** Current charge progress (0-1) for charge abilities */
    chargeProgress?: number;
    /** Whether currently charging */
    isCharging?: boolean;
    /** Whether currently channeling */
    isChanneling?: boolean;
    /** Channel progress (0-1) */
    channelProgress?: number;
    /** Whether currently transformed (for transform abilities) */
    isTransformed?: boolean;
    /** Whether empowerment is active */
    isEmpowered?: boolean;
    /** Time remaining on empowerment */
    empoweredTimeRemaining?: number;
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
    /** Soul stack scaling by level and target type */
    soulScaling?: {
        minion: {
            levels: number[];
            stacks: number[];
        };
        jungle: {
            levels: number[];
            stacks: number[];
        };
        champion: {
            levels: number[];
            stacks: number[];
        };
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
 * Entity types for ability targeting checks.
 * Must match EntityType enum from network.ts
 */
export declare const AbilityEntityType: {
    readonly CHAMPION: 0;
    readonly MINION: 1;
    readonly TOWER: 2;
    readonly INHIBITOR: 3;
    readonly NEXUS: 4;
    readonly JUNGLE_CAMP: 5;
    readonly WARD: 7;
};
/**
 * Check if an ability can affect a specific entity type.
 * Returns true if the ability can damage/affect the given entity type.
 *
 * Default behavior:
 * - Champions: true
 * - Minions: true
 * - Towers/Structures: false (most abilities don't damage towers)
 * - Jungle camps: true
 * - Wards: false
 */
export declare function canAbilityAffectEntityType(ability: AbilityDefinition | undefined, entityType: number): boolean;
/**
 * Check if ability has charge behavior.
 */
export declare function hasChargeBehavior(ability: AbilityDefinition): ability is AbilityDefinition & {
    charge: ChargeBehavior;
};
/**
 * Check if ability has ammo/charges behavior.
 */
export declare function hasAmmoBehavior(ability: AbilityDefinition): boolean;
/**
 * Get normalized ammo behavior (handles number | AmmoBehavior).
 */
export declare function getAmmoBehavior(ability: AbilityDefinition): AmmoBehavior | undefined;
/**
 * Check if ability has channel behavior.
 */
export declare function hasChannelBehavior(ability: AbilityDefinition): ability is AbilityDefinition & {
    channel: ChannelBehavior;
};
/**
 * Check if ability has recast behavior.
 */
export declare function hasRecastBehavior(ability: AbilityDefinition): boolean;
/**
 * Get recast ability definition.
 * Returns the same ability if recast is a number, or the specified ability if it's a definition.
 */
export declare function getRecastAbility(ability: AbilityDefinition): {
    ability: AbilityDefinition;
    maxRecasts: number;
} | undefined;
/**
 * Check if ability has toggle behavior.
 */
export declare function hasToggleBehavior(ability: AbilityDefinition): boolean;
/**
 * Get normalized toggle behavior (handles boolean | ToggleBehavior).
 */
export declare function getToggleBehavior(ability: AbilityDefinition): ToggleBehavior | undefined;
/**
 * Check if ability has transform behavior.
 */
export declare function hasTransformBehavior(ability: AbilityDefinition): ability is AbilityDefinition & {
    transform: TransformBehavior;
};
/**
 * Check if ability has empowered behavior.
 */
export declare function hasEmpoweredBehavior(ability: AbilityDefinition): ability is AbilityDefinition & {
    empowered: EmpoweredBehavior;
};
/**
 * Check if ability has any complex behavior that requires special handling.
 */
export declare function hasComplexBehavior(ability: AbilityDefinition): boolean;
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