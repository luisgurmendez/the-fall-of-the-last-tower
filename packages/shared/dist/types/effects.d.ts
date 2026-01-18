/**
 * Type definitions for the effects/status system.
 * Shared between client and server.
 */
/**
 * Categories of effects.
 */
export type EffectCategory = 'buff' | 'debuff' | 'neutral';
/**
 * Types of crowd control effects.
 */
export type CrowdControlType = 'stun' | 'silence' | 'grounded' | 'root' | 'blind' | 'disarm' | 'slow' | 'knockup' | 'knockback' | 'fear' | 'charm' | 'taunt' | 'sleep' | 'suppress';
/**
 * Types of stat modification effects.
 */
export type StatModificationType = 'attack_damage' | 'ability_power' | 'armor' | 'magic_resist' | 'attack_speed' | 'movement_speed' | 'health_regen' | 'mana_regen' | 'crit_chance' | 'crit_damage' | 'lifesteal' | 'spell_vamp' | 'armor_penetration' | 'magic_penetration';
/**
 * Types of over-time effects.
 */
export type OverTimeType = 'damage' | 'heal' | 'mana_drain' | 'mana_restore';
/**
 * How effects stack when multiple instances are applied.
 */
export type StackBehavior = 'refresh' | 'extend' | 'stack' | 'replace' | 'ignore';
/**
 * Base effect definition (static data).
 */
export interface EffectDefinition {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Icon identifier for UI */
    icon?: string;
    /** Buff, debuff, or neutral */
    category: EffectCategory;
    /** Duration in seconds (undefined = permanent until removed) */
    duration?: number;
    /** How the effect stacks */
    stackBehavior: StackBehavior;
    /** Maximum stacks (for stackable effects) */
    maxStacks?: number;
    /** Whether the effect can be cleansed/removed */
    cleansable: boolean;
    /** Whether the effect persists through death */
    persistsThroughDeath: boolean;
}
/**
 * Crowd control effect definition.
 */
export interface CrowdControlEffectDef extends EffectDefinition {
    /** Type of CC */
    ccType: CrowdControlType;
}
/**
 * Stat modification effect definition.
 */
export interface StatModificationEffectDef extends EffectDefinition {
    /** Which stat to modify */
    stat: StatModificationType;
    /** Flat value change */
    flatValue?: number;
    /** Percentage change (0.1 = +10%, -0.1 = -10%) */
    percentValue?: number;
}
/**
 * Over-time effect definition.
 */
export interface OverTimeEffectDef extends EffectDefinition {
    /** Type of over-time effect */
    otType: OverTimeType;
    /** Value per tick */
    valuePerTick: number;
    /** Time between ticks in seconds */
    tickInterval: number;
    /** Damage type (for DoT) */
    damageType?: 'physical' | 'magic' | 'true';
}
/**
 * Shield effect definition.
 */
export interface ShieldEffectDef extends EffectDefinition {
    /** Shield amount */
    shieldAmount: number;
    /** Types of damage the shield blocks */
    blocksPhysical: boolean;
    blocksMagic: boolean;
}
/**
 * Runtime state of an active effect (for network sync).
 */
export interface ActiveEffectState {
    /** Effect definition ID */
    definitionId: string;
    /** Source entity ID (who applied the effect) */
    sourceId?: string;
    /** Time remaining in seconds */
    timeRemaining: number;
    /** Current stack count */
    stacks: number;
    /** For shields: remaining shield amount */
    shieldRemaining?: number;
    /** For over-time: time until next tick */
    nextTickIn?: number;
    /** Unique instance ID (for tracking) */
    instanceId: string;
}
/**
 * Summary of crowd control effects on a unit.
 */
export interface CrowdControlStatus {
    /** Cannot move, attack, or cast */
    isStunned: boolean;
    /** Cannot cast abilities */
    isSilenced: boolean;
    /** Cannot use movement abilities */
    isGrounded: boolean;
    /** Cannot move at all */
    isRooted: boolean;
    /** Cannot basic attack */
    isDisarmed: boolean;
    /** Whether the unit can move */
    canMove: boolean;
    /** Whether the unit can attack */
    canAttack: boolean;
    /** Whether the unit can cast abilities */
    canCast: boolean;
    /** Whether the unit can use movement abilities (dashes, blinks) */
    canUseMobilityAbilities: boolean;
}
/**
 * Compute crowd control status from active effects.
 */
export declare function computeCCStatus(effects: ActiveEffectState[], getDefinition: (id: string) => EffectDefinition | undefined): CrowdControlStatus;
/**
 * Create default CC status (no effects).
 */
export declare function defaultCCStatus(): CrowdControlStatus;
//# sourceMappingURL=effects.d.ts.map