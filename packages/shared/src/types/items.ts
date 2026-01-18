/**
 * Type definitions for the item system.
 * Shared between client and server.
 */

import type { ChampionBaseStats } from './champions';

/**
 * Item slot types (6 slots like LoL).
 */
export type ItemSlot = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Item categories for shop organization.
 */
export type ItemCategory =
  | 'attack_damage'
  | 'ability_power'
  | 'attack_speed'
  | 'critical'
  | 'armor'
  | 'magic_resist'
  | 'health'
  | 'mana'
  | 'movement'
  | 'utility';

/**
 * Passive effect trigger for items.
 */
export type ItemPassiveTrigger =
  | 'always'           // Always active (pure stat bonuses)
  | 'on_attack'        // When starting a basic attack
  | 'on_hit'           // When basic attack lands
  | 'on_ability_cast'  // When casting any ability
  | 'on_ability_hit'   // When ability damages enemy
  | 'on_take_damage'   // When receiving damage
  | 'on_kill'          // When killing a unit
  | 'on_low_health'    // When health drops below threshold
  | 'on_interval';     // Every X seconds (like Sunfire)

/**
 * Item passive effect definition.
 */
export interface ItemPassiveDef {
  /** Unique ID for tracking (prevents stacking same unique) */
  id: string;

  /** Display name for tooltip */
  name: string;

  /** Description of the passive */
  description: string;

  /** What triggers this passive */
  trigger: ItemPassiveTrigger;

  /** Internal cooldown in seconds (0 = no cooldown) */
  cooldown: number;

  /** Whether this passive is unique (only one instance active across all items) */
  isUnique: boolean;

  /** For 'on_interval' trigger: interval in seconds */
  interval?: number;

  /** For 'on_low_health' trigger: health threshold (0-1) */
  healthThreshold?: number;
}

/**
 * Complete item definition (static data).
 */
export interface ItemDefinition {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description for tooltip */
  description: string;

  /** Shop category */
  category: ItemCategory;

  /** Gold cost */
  cost: number;

  /** Sell value (typically 70% of cost) */
  sellValue: number;

  /** Stat bonuses (flat values) */
  stats: Partial<ChampionBaseStats>;

  /** Passive effect IDs */
  passiveIds: string[];

  /** Whether the item is unique (can only own one) */
  isUnique: boolean;

  /** Items required to build this item */
  buildsFrom?: string[];

  /** Items this can be built into */
  buildsInto?: string[];

  /** Tags for search/filtering */
  tags: string[];
}

/**
 * Runtime state of an equipped item (for network sync).
 */
export interface EquippedItemState {
  /** Item definition ID */
  definitionId: string;

  /** Slot the item is in */
  slot: ItemSlot;

  /** Passive cooldowns (id -> remaining cooldown) */
  passiveCooldowns: Record<string, number>;

  /** For interval passives: time until next trigger */
  nextIntervalTick: Record<string, number>;
}

/**
 * Champion inventory state (for network sync).
 */
export interface InventoryState {
  /** Equipped items by slot */
  items: (EquippedItemState | null)[];

  /** Current gold */
  gold: number;

  /** Total gold spent on items */
  totalGoldSpent: number;
}

/**
 * Result of an item purchase attempt.
 */
export interface ItemPurchaseResult {
  success: boolean;
  reason?: 'not_enough_gold' | 'inventory_full' | 'unique_owned' | 'item_not_found';
  slot?: ItemSlot;
  goldSpent?: number;
}

/**
 * Result of an item sell attempt.
 */
export interface ItemSellResult {
  success: boolean;
  reason?: 'slot_empty' | 'cannot_sell';
  goldGained?: number;
}

/**
 * Calculate total stats from equipped items.
 */
export function calculateItemStats(
  items: (EquippedItemState | null)[],
  getDefinition: (id: string) => ItemDefinition | undefined
): Partial<ChampionBaseStats> {
  const totalStats: Partial<ChampionBaseStats> = {};

  for (const item of items) {
    if (!item) continue;

    const def = getDefinition(item.definitionId);
    if (!def) continue;

    for (const [stat, value] of Object.entries(def.stats)) {
      const key = stat as keyof ChampionBaseStats;
      totalStats[key] = (totalStats[key] || 0) + (value as number);
    }
  }

  return totalStats;
}

/**
 * Find first empty item slot.
 */
export function findEmptySlot(items: (EquippedItemState | null)[]): ItemSlot | null {
  for (let i = 0; i < 6; i++) {
    if (!items[i]) {
      return i as ItemSlot;
    }
  }
  return null;
}

/**
 * Check if inventory contains a specific item.
 */
export function hasItem(
  items: (EquippedItemState | null)[],
  itemId: string
): boolean {
  return items.some(item => item?.definitionId === itemId);
}
