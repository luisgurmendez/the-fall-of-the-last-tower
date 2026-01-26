/**
 * ServerChampion - Server-side champion implementation.
 *
 * This class handles the authoritative champion state:
 * - Position, health, mana
 * - Abilities and cooldowns
 * - Effects and crowd control
 * - Items and stats
 *
 * NO RENDERING - purely simulation.
 */
import { Vector, DamageType, ChampionSnapshot, AbilitySlot, AbilityState, ChampionDefinition, ChampionStats, StatModifier, ActiveEffectState, CrowdControlStatus, EquippedItemState, PassiveState } from '@siege/shared';
import { ServerEntity, ServerEntityConfig } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';
export interface ServerChampionConfig extends Omit<ServerEntityConfig, 'entityType'> {
    definition: ChampionDefinition;
    playerId: string;
}
export interface ActiveShield {
    amount: number;
    remainingDuration: number;
    sourceId: string;
    /** Shield type for visual styling - defaults to 'normal' if not specified */
    shieldType?: 'normal' | 'magic' | 'physical' | 'passive';
}
export interface ForcedMovement {
    direction: Vector;
    distance: number;
    duration: number;
    elapsed: number;
    type: 'dash' | 'knockback';
    hitbox?: number;
    damage?: number;
    damageType?: DamageType;
    appliesEffects?: string[];
    effectDuration?: number;
    hitEntities?: Set<string>;
}
export declare class ServerChampion extends ServerEntity {
    readonly playerId: string;
    readonly definition: ChampionDefinition;
    resource: number;
    maxResource: number;
    level: number;
    experience: number;
    experienceToNextLevel: number;
    skillPoints: number;
    inCombat: boolean;
    timeSinceCombat: number;
    respawnTimer: number;
    isRecalling: boolean;
    recallProgress: number;
    private statModifiers;
    private cachedStats;
    abilityRanks: Record<AbilitySlot, number>;
    abilityCooldowns: Record<AbilitySlot, number>;
    abilityStates: Record<AbilitySlot, AbilityState>;
    activeEffects: ActiveEffectState[];
    ccStatus: CrowdControlStatus;
    items: (EquippedItemState | null)[];
    gold: 300;
    totalGoldSpent: number;
    private attackCooldown;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    shields: ActiveShield[];
    forcedMovement: ForcedMovement | null;
    direction: Vector;
    passiveState: PassiveState;
    sightRange: number;
    trinketCharges: number;
    trinketMaxCharges: number;
    trinketCooldown: number;
    trinketRechargeTimer: number;
    trinketRechargeTime: number;
    constructor(config: ServerChampionConfig);
    /**
     * Initialize passive ability.
     */
    private initializePassive;
    private createDefaultAbilityState;
    /**
     * Update champion for one tick.
     */
    update(dt: number, context: ServerGameContext): void;
    /**
     * Update passive ability state.
     */
    private updatePassiveState;
    /**
     * Update while dead (respawn timer).
     */
    private updateDead;
    /**
     * Respawn the champion.
     */
    private respawn;
    /**
     * Update movement.
     */
    private updateMovement;
    /**
     * Update forced movement (dash/knockback).
     */
    private updateForcedMovement;
    /**
     * Check for collisions during dash and apply damage/effects.
     */
    private checkDashCollisions;
    /**
     * Update combat state.
     */
    private updateCombat;
    /**
     * Perform a basic attack on a target.
     */
    private performBasicAttack;
    /**
     * Update abilities (cooldowns).
     */
    private updateAbilities;
    /**
     * Update effects.
     */
    private updateEffects;
    /**
     * Process an over-time effect tick.
     */
    private processOverTimeEffect;
    /**
     * Calculate CC status from active effects.
     */
    private calculateCCStatus;
    /**
     * Update shields.
     */
    private updateShields;
    /**
     * Update recall.
     */
    private updateRecall;
    /**
     * Start recalling.
     */
    startRecall(): boolean;
    /**
     * Cancel recall.
     */
    cancelRecall(): void;
    /**
     * Complete recall (teleport to base).
     */
    private completeRecall;
    /**
     * Update regeneration.
     */
    private updateRegeneration;
    /**
     * Update trinket (ward) charges.
     */
    private updateTrinket;
    /**
     * Check if can place a ward.
     */
    canPlaceWard(): boolean;
    /**
     * Consume a trinket charge when placing a ward.
     * Returns true if successful.
     */
    consumeTrinketCharge(): boolean;
    /**
     * Get trinket recharge progress (0-1).
     */
    getTrinketRechargeProgress(): number;
    /**
     * Enter combat state.
     */
    enterCombat(): void;
    /**
     * Break stealth effect (called when attacking or using abilities).
     */
    breakStealth(): void;
    /**
     * Take damage (override for shields and resistances).
     */
    takeDamage(amount: number, type: DamageType, sourceId?: string, context?: ServerGameContext): number;
    /**
     * Calculate damage after resistances.
     */
    protected calculateDamage(amount: number, type: DamageType): number;
    /**
     * Handle death.
     */
    protected onDeath(killerId?: string, context?: ServerGameContext): void;
    /**
     * Get current stats (with modifiers).
     */
    getStats(): ChampionStats;
    /**
     * Apply a stat modifier.
     */
    private applyStatModifier;
    /**
     * Add a stat modifier.
     */
    addModifier(modifier: StatModifier): void;
    /**
     * Remove a stat modifier by source.
     */
    removeModifier(source: string): void;
    /**
     * Apply item stats to champion stats.
     */
    private applyItemStats;
    /**
     * Apply effect stat modifier to champion stats.
     */
    private applyEffectStatModifier;
    /**
     * Apply an effect to this champion.
     */
    applyEffect(effectId: string, duration: number, sourceId?: string, stacks?: number): void;
    /**
     * Remove an effect from this champion.
     */
    removeEffect(effectId: string): boolean;
    /**
     * Remove all effects matching a category.
     */
    removeEffectsByCategory(category: 'buff' | 'debuff' | 'neutral'): number;
    /**
     * Cleanse all cleansable debuffs.
     */
    cleanse(): number;
    /**
     * Check if champion has a specific effect.
     */
    hasEffect(effectId: string): boolean;
    /**
     * Get an active effect by ID.
     */
    getEffect(effectId: string): ActiveEffectState | undefined;
    /**
     * Set movement target.
     */
    setMoveTarget(position: Vector): void;
    /**
     * Set attack target.
     */
    setAttackTarget(entityId: string): void;
    /**
     * Stop all actions.
     */
    stop(): void;
    /**
     * Level up an ability.
     */
    levelUpAbility(slot: AbilitySlot): boolean;
    /**
     * Grant gold to the champion.
     */
    grantGold(amount: number): void;
    /**
     * Gain experience.
     */
    gainExperience(amount: number): void;
    /**
     * Level up.
     */
    private levelUp;
    /**
     * Buy an item.
     * @returns true if purchase succeeded
     */
    buyItem(itemId: string): boolean;
    /**
     * Sell an item from a specific slot.
     * @returns gold gained, or 0 if failed
     */
    sellItem(slot: number): number;
    /**
     * Check if champion has a specific item.
     */
    hasItem(itemId: string): boolean;
    /**
     * Find first empty inventory slot.
     */
    private findEmptySlot;
    /**
     * Champions participate in collision.
     */
    isCollidable(): boolean;
    /**
     * Champion collision radius.
     * Uses the collision shape from champion definition, defaulting to 25.
     */
    getRadius(): number;
    /**
     * Champion collision mass.
     * Champions are heavier than minions, so they push minions more.
     */
    getMass(): number;
    /**
     * Convert to network snapshot.
     */
    toSnapshot(): ChampionSnapshot;
}
//# sourceMappingURL=ServerChampion.d.ts.map