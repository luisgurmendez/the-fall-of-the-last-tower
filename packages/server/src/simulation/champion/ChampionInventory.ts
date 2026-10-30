/**
 * ChampionInventory - Buying and selling items.
 *
 * A champion has six item slots (champion.items). Buying needs enough gold,
 * a free slot and, for unique items, not owning one already. Selling
 * refunds the item's sell value. Item stats are applied by ChampionStats.
 */

import type { ItemSlot } from '@siege/shared';
import { getServerItemById } from '../../data/items';
import { Logger } from '../../utils/Logger';
import type { ServerChampion } from '../ServerChampion';

/** Number of item slots */
const INVENTORY_SIZE = 6;

export class ChampionInventory {
  constructor(private readonly champion: ServerChampion) {}

  /**
   * Buy an item.
   * @returns true if purchase succeeded
   */
  buy(itemId: string): boolean {
    const champion = this.champion;
    const itemDef = getServerItemById(itemId);
    if (!itemDef) {
      return false;
    }

    // Check gold
    if (champion.gold < itemDef.cost) {
      return false;
    }

    // Check if unique and already owned
    if (itemDef.isUnique && champion.hasItem(itemId)) {
      return false;
    }

    // Find empty slot
    const emptySlot = this.findEmptySlot();
    if (emptySlot === null) {
      return false;
    }

    // Deduct gold and add item
    champion.gold -= itemDef.cost;
    champion.totalGoldSpent += itemDef.cost;
    champion.items[emptySlot] = {
      definitionId: itemId,
      slot: emptySlot as ItemSlot,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };

    // Invalidate cached stats
    champion.invalidateStats();

    Logger.champion.info(`${champion.playerId} bought ${itemDef.name} for ${itemDef.cost}g`);
    return true;
  }

  /**
   * Sell an item from a specific slot.
   * @returns gold gained, or 0 if failed
   */
  sell(slot: number): number {
    const champion = this.champion;
    if (slot < 0 || slot >= INVENTORY_SIZE) {
      return 0;
    }

    const item = champion.items[slot];
    if (!item) {
      return 0;
    }

    const itemDef = getServerItemById(item.definitionId);
    if (!itemDef) {
      return 0;
    }

    // Add gold and remove item
    const goldGained = itemDef.sellValue;
    champion.gold += goldGained;
    champion.items[slot] = null;

    // Invalidate cached stats
    champion.invalidateStats();

    Logger.champion.info(`${champion.playerId} sold ${itemDef.name} for ${goldGained}g`);
    return goldGained;
  }

  /**
   * Check if the champion has a specific item.
   */
  has(itemId: string): boolean {
    return this.champion.items.some(item => item?.definitionId === itemId);
  }

  /**
   * Find first empty inventory slot.
   */
  private findEmptySlot(): ItemSlot | null {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      if (!this.champion.items[i]) {
        return i as ItemSlot;
      }
    }
    return null;
  }
}
