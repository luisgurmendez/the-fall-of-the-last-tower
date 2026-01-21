/**
 * Type definitions for the item system.
 */

import type { ChampionBaseStats } from '@/champions/types';
import type { IEffect } from '@/effects/EffectDescriptor';

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
 * Item passive effect configuration.
 */
export interface ItemPassiveEffect {
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

  /** The effect to apply when triggered */
  effect: IEffect;

  /** For 'on_interval' trigger: interval in seconds */
  interval?: number;

  /** For 'on_low_health' trigger: health threshold (0-1) */
  healthThreshold?: number;
}

/**
 * Complete item definition.
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

  /** Passive effects */
  passives: ItemPassiveEffect[];

  /** Whether the item is unique (can only own one) */
  isUnique: boolean;

  /** Tags for search/filtering */
  tags: string[];
}

/**
 * Runtime state of an equipped item.
 */
export interface EquippedItem {
  /** Reference to item definition */
  definition: ItemDefinition;

  /** Slot the item is in */
  slot: ItemSlot;

  /** Passive cooldowns (id -> remaining cooldown) */
  passiveCooldowns: Map<string, number>;

  /** For interval passives: time until next trigger */
  nextIntervalTick: Map<string, number>;
}

/**
 * Champion inventory interface.
 */
export interface ChampionInventory {
  /** Equipped items by slot */
  items: Map<ItemSlot, EquippedItem>;

  /** Total gold spent on items */
  totalGoldSpent: number;
}

/**
 * Result of an item purchase attempt.
 */
export interface ItemPurchaseResult {
  success: boolean;
  reason?: 'not_enough_gold' | 'inventory_full' | 'unique_owned';
  slot?: ItemSlot;
}
