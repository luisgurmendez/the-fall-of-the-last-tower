/**
 * OnlineChampionAdapter - Adapts server state to Champion interface for HUD rendering.
 *
 * This adapter wraps ChampionSnapshot data from the server and provides
 * the methods that ChampionHUD expects from a Champion instance.
 */

import Vector from '@/physics/vector';
import type { OnlineStateManager } from '@/core/OnlineStateManager';
import {
  type ChampionSnapshot,
  type AbilityState,
  type AbilityDefinition as SharedAbilityDefinition,
  getAbilityDefinition as getSharedAbilityDefinition,
  getChampionDefinition,
} from '@siege/shared';
import type { ChampionStats, StatModifier } from '@/champions/types';
import type { ChampionInventory, EquippedItem, ItemDefinition, ItemSlot } from '@/items/types';
import type { AbilitySlot } from '@/abilities/types';
import type { HUDTrinket } from '@/ui/ChampionHUD';
import { getEffectDisplayInfo } from '@/effects/EffectDisplayRegistry';

// DEBUG: Log when module loads and verify imports work
console.log('[OnlineChampionAdapter] Module loaded!');
console.log('[OnlineChampionAdapter] getChampionDefinition exists:', typeof getChampionDefinition);
console.log('[OnlineChampionAdapter] getSharedAbilityDefinition exists:', typeof getSharedAbilityDefinition);
const testChampion = getChampionDefinition('elara');
console.log('[OnlineChampionAdapter] Test lookup elara:', testChampion ? `found: ${testChampion.name}` : 'NOT FOUND');

/**
 * Client-side ability definition for tooltips.
 */
interface ClientAbilityDefinition {
  name: string;
  description: string;
  range: number;
}

// Debug: track which champion abilities have been logged to avoid spam
const _loggedAbilities = new Set<string>();

/**
 * Get ability definition for a champion and slot.
 * Uses the shared registry from @siege/shared.
 */
function getAbilityDefinition(championId: string, slot: AbilitySlot): ClientAbilityDefinition {
  const logKey = `${championId}-${slot}`;
  const shouldLog = !_loggedAbilities.has(logKey);
  if (shouldLog) {
    _loggedAbilities.add(logKey);
    console.log(`[getAbilityDefinition] Looking up: championId="${championId}", slot="${slot}"`);
  }

  // Get champion definition to find ability ID
  const championDef = getChampionDefinition(championId);
  if (!championDef) {
    if (shouldLog) console.log(`[getAbilityDefinition] No champion def found for "${championId}"`);
    return {
      name: `Ability ${slot}`,
      description: 'An ability.',
      range: 600,
    };
  }

  // Get ability definition from shared registry
  const abilityId = championDef.abilities[slot];
  if (shouldLog) console.log(`[getAbilityDefinition] Champion "${championId}" ability ${slot} = "${abilityId}"`);

  const abilityDef = getSharedAbilityDefinition(abilityId);

  if (!abilityDef) {
    if (shouldLog) console.log(`[getAbilityDefinition] No ability def found for "${abilityId}"`);
    return {
      name: `Ability ${slot}`,
      description: 'An ability.',
      range: 600,
    };
  }

  if (shouldLog) console.log(`[getAbilityDefinition] Found ability: "${abilityDef.name}"`);
  return {
    name: abilityDef.name,
    description: abilityDef.description,
    range: abilityDef.range ?? 0,
  };
}

/**
 * Ability adapter that wraps AbilityState for HUD rendering.
 * Uses real ability definitions for tooltips.
 */
class OnlineAbilityAdapter {
  private state: AbilityState;
  private abilityDef: ClientAbilityDefinition;
  readonly definition: { name: string; description: string };

  constructor(state: AbilityState, slot: AbilitySlot, championId: string) {
    this.state = state;
    this.abilityDef = getAbilityDefinition(championId, slot);
    this.definition = {
      name: this.abilityDef.name,
      description: this.abilityDef.description,
    };
  }

  get rank(): number {
    return this.state.rank;
  }

  get isReady(): boolean {
    return this.state.cooldownRemaining <= 0 && this.state.rank > 0;
  }

  get cooldownProgress(): number {
    if (this.state.cooldownTotal <= 0) return 1;
    return 1 - (this.state.cooldownRemaining / this.state.cooldownTotal);
  }

  getTargetDescription(): { range: number } | null {
    return { range: this.abilityDef.range };
  }
}

/**
 * Trinket adapter that wraps server trinket state for HUD rendering.
 * Implements HUDTrinket interface for compatibility with ChampionHUD.
 */
class OnlineTrinketAdapter implements HUDTrinket {
  private charges: number;
  private maxCharges: number;
  private cooldown: number;
  private rechargeProgress: number;

  constructor(
    charges: number,
    maxCharges: number,
    cooldown: number,
    rechargeProgress: number
  ) {
    this.charges = charges;
    this.maxCharges = maxCharges;
    this.cooldown = cooldown;
    this.rechargeProgress = rechargeProgress;
  }

  getCharges(): number {
    return this.charges;
  }

  getMaxCharges(): number {
    return this.maxCharges;
  }

  getRechargeProgress(): number {
    return this.rechargeProgress;
  }

  getCooldownRemaining(): number {
    return this.cooldown;
  }

  isOnCooldown(): boolean {
    return this.cooldown > 0;
  }

  canPlace(): boolean {
    return this.charges > 0 && this.cooldown <= 0;
  }

  // These methods aren't used by the HUD but are part of the Trinket interface
  getWardType(): string {
    return 'stealth';
  }

  getPlacementRange(): number {
    return 600;
  }

  // Return a minimal TrinketDefinition-like object for HUD compatibility
  getDefinition(): { maxCharges: number; name: string; wardType: string } {
    return {
      maxCharges: this.maxCharges,
      name: 'Stealth Ward',
      wardType: 'stealth',
    };
  }

  // Return a minimal TrinketState-like object for HUD compatibility
  getState(): { charges: number; cooldown: number; rechargeTimer: number } {
    return {
      charges: this.charges,
      cooldown: this.cooldown,
      rechargeTimer: 0,
    };
  }
}

/**
 * Mock inventory that wraps item state for HUD rendering.
 */
class OnlineInventoryAdapter implements ChampionInventory {
  items: Map<ItemSlot, EquippedItem> = new Map();
  totalGoldSpent: number = 0;

  constructor(itemStates: (any | null)[]) {
    // Convert item states to EquippedItem format
    if (itemStates) {
      itemStates.forEach((itemState, index) => {
        if (itemState && index < 6) {
          const slot = index as ItemSlot;
          this.items.set(slot, this.createEquippedItem(itemState, slot));
        }
      });
    }
  }

  private createEquippedItem(itemState: any, slot: ItemSlot): EquippedItem {
    // Create a mock equipped item from server state
    const definition: ItemDefinition = {
      id: itemState.definitionId || 'unknown',
      name: itemState.definitionId || 'Item',
      description: 'An item',
      category: 'utility',
      cost: 0,
      sellValue: 0,
      stats: {},
      isUnique: false,
      tags: [],
      passives: [],
    };

    return {
      definition,
      slot,
      passiveCooldowns: new Map(),
      nextIntervalTick: new Map(),
    };
  }
}

/**
 * OnlineChampionAdapter wraps server state to provide Champion interface.
 */
export class OnlineChampionAdapter {
  private stateManager: OnlineStateManager;
  private _position: Vector = new Vector(0, 0);
  private _lastLoggedChampionId: string | null = null;
  private _lastAbilityLogTime: number = 0;
  private _fallbackChampionId: string;

  constructor(stateManager: OnlineStateManager, fallbackChampionId: string = 'warrior') {
    this.stateManager = stateManager;
    this._fallbackChampionId = fallbackChampionId;
    console.log(`[OnlineChampionAdapter] Created with fallbackChampionId="${fallbackChampionId}"`);
  }

  /**
   * Get the local player's champion snapshot from state manager.
   */
  private getSnapshot(): ChampionSnapshot | null {
    const entity = this.stateManager.getLocalPlayerEntity();
    if (!entity) {
      return null;
    }

    const snapshot = entity.snapshot;
    if (!snapshot) {
      return null;
    }

    // EntityType.CHAMPION = 0
    if (snapshot.entityType !== 0) {
      return null;
    }

    return snapshot as ChampionSnapshot;
  }

  /**
   * Get current position.
   */
  getPosition(): Vector {
    const entity = this.stateManager.getLocalPlayerEntity();
    if (entity) {
      this._position.x = entity.position.x;
      this._position.y = entity.position.y;
    }
    return this._position;
  }

  /**
   * Default stats used when no snapshot is available.
   */
  private static readonly DEFAULT_STATS: ChampionStats = {
    health: 100,
    maxHealth: 100,
    healthRegen: 0,
    resource: 100,
    maxResource: 100,
    resourceRegen: 0,
    attackDamage: 50,
    abilityPower: 0,
    attackSpeed: 1.0,
    attackRange: 125,
    armor: 30,
    magicResist: 30,
    movementSpeed: 325,
    critChance: 0,
    critDamage: 2.0,
    level: 1,
  };

  /**
   * Get current stats (from server snapshot).
   */
  getStats(): ChampionStats {
    try {
      const snapshot = this.getSnapshot();

      if (!snapshot) {
        return { ...OnlineChampionAdapter.DEFAULT_STATS };
      }

      return {
        health: Number(snapshot.health) || 100,
        maxHealth: Number(snapshot.maxHealth) || 100,
        healthRegen: 0, // Not sent in snapshot, use default
        resource: Number(snapshot.resource) || 100,
        maxResource: Number(snapshot.maxResource) || 100,
        resourceRegen: 0, // Not sent in snapshot, use default
        attackDamage: Number(snapshot.attackDamage) || 50,
        abilityPower: Number(snapshot.abilityPower) || 0,
        attackSpeed: Number(snapshot.attackSpeed) || 1.0,
        attackRange: 125, // Default, could be sent in snapshot
        armor: Number(snapshot.armor) || 30,
        magicResist: Number(snapshot.magicResist) || 30,
        movementSpeed: Number(snapshot.movementSpeed) || 325,
        critChance: 0,
        critDamage: 2.0,
        level: Number(snapshot.level) || 1,
      };
    } catch (error) {
      console.warn('[OnlineChampionAdapter] Error getting stats:', error);
      return { ...OnlineChampionAdapter.DEFAULT_STATS };
    }
  }

  /**
   * Get current health.
   */
  getCurrentHealth(): number {
    const snapshot = this.getSnapshot();
    return snapshot?.health ?? 100;
  }

  /**
   * Get current resource (mana/energy).
   */
  getCurrentResource(): number {
    const snapshot = this.getSnapshot();
    return snapshot?.resource ?? 100;
  }

  /**
   * Get an ability by slot.
   * Returns an adapter with real server data if available, or fallback client-side data.
   */
  getAbility(slot: AbilitySlot): OnlineAbilityAdapter | undefined {
    const snapshot = this.getSnapshot();
    // Use snapshot championId if available, otherwise use the fallback from matchmaking
    const championId = snapshot?.championId || this._fallbackChampionId;

    // DEBUG: Always log (throttled per second)
    const now = Date.now();
    if (!this._lastAbilityLogTime || now - this._lastAbilityLogTime > 1000) {
      console.log(`[OnlineChampionAdapter.getAbility] slot=${slot}, snapshot=${!!snapshot}, championId="${championId}", fallback="${this._fallbackChampionId}"`);
      this._lastAbilityLogTime = now;
    }

    // If we have server ability data, use it
    if (snapshot?.abilities?.[slot]) {
      return new OnlineAbilityAdapter(snapshot.abilities[slot], slot, championId);
    }

    // Fallback: create a default ability state for tooltip display
    // This ensures tooltips work even before server sends ability data
    const defaultAbilityState: AbilityState = {
      rank: 1,
      cooldownRemaining: 0,
      cooldownTotal: 0,
      isCasting: false,
      castTimeRemaining: 0,
      isToggled: false,
      passiveCooldownRemaining: 0,
    };

    return new OnlineAbilityAdapter(defaultAbilityState, slot, championId);
  }

  /**
   * Get active buffs/modifiers.
   * Converts server effect state to StatModifier format.
   */
  getBuffs(): StatModifier[] {
    const snapshot = this.getSnapshot();
    if (!snapshot?.activeEffects) return [];

    // Convert active effects to StatModifier format for HUD display
    return snapshot.activeEffects.map(effect => {
      const displayInfo = getEffectDisplayInfo(effect.definitionId);

      // Map effect stat values to ChampionBaseStats keys
      // The effect registry uses ChampionBaseStats keys directly
      const flat: Partial<Record<string, number>> = {};
      const percent: Partial<Record<string, number>> = {};

      if (displayInfo?.flat) {
        Object.assign(flat, displayInfo.flat);
        // Apply stacks if the effect stacks
        if (effect.stacks > 1) {
          for (const key of Object.keys(flat)) {
            flat[key] = (flat[key] ?? 0) * effect.stacks;
          }
        }
      }

      if (displayInfo?.percent) {
        Object.assign(percent, displayInfo.percent);
        // For stacking percent effects, the value should compound per stack
        // E.g., 10% per stack at 3 stacks = 1.1^3 = 1.331
        if (effect.stacks > 1) {
          for (const key of Object.keys(percent)) {
            const basePercent = percent[key] ?? 1;
            // Convert from multiplier back to change, compound, then back to multiplier
            const change = basePercent - 1;
            percent[key] = 1 + (change * effect.stacks);
          }
        }
      }

      return {
        source: displayInfo?.name ?? effect.definitionId,
        duration: effect.timeRemaining,
        timeRemaining: effect.timeRemaining,
        flat: flat as any,
        percent: percent as any,
      };
    });
  }

  /**
   * Get inventory.
   */
  getInventory(): ChampionInventory {
    const snapshot = this.getSnapshot();
    return new OnlineInventoryAdapter(snapshot?.items ?? []);
  }

  /**
   * Get trinket state from server snapshot.
   * Returns an adapter that provides the same interface as the local Trinket class.
   */
  getTrinket(): HUDTrinket | null {
    const snapshot = this.getSnapshot();
    if (!snapshot) {
      return null;
    }

    // Return adapter with trinket data from server
    return new OnlineTrinketAdapter(
      snapshot.trinketCharges ?? 0,
      snapshot.trinketMaxCharges ?? 2,
      snapshot.trinketCooldown ?? 0,
      snapshot.trinketRechargeProgress ?? 0
    );
  }

  /**
   * Check if the adapter has valid state.
   */
  hasValidState(): boolean {
    return this.getSnapshot() !== null;
  }
}

export default OnlineChampionAdapter;
