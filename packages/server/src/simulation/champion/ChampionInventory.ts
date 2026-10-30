/**
 * ChampionInventory - Buying and selling items.
 *
 * A champion has six item slots (champion.items). Buying uses up the item's
 * parts in the inventory and charges the rest of its cost (planItemPurchase,
 * shared with the shop). It needs that much gold, a free slot (the used-up
 * parts free theirs) and, for unique items, not owning one already. Selling
 * refunds the item's sell value. Item stats are applied by ChampionStats.
 */

import { planItemPurchase, type ItemSlot } from '@siege/shared';
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

    // Owned parts are used up and taken off the price
    const plan = planItemPurchase(itemId, champion.items.map(item => item?.definitionId));
    if (!plan || champion.gold < plan.price) {
      return false;
    }

    // Check if unique and already owned
    if (itemDef.isUnique && champion.hasItem(itemId)) {
      return false;
    }

    // Find a slot: an empty one, or one a used-up part frees
    const emptySlot = this.findEmptySlot(plan.consumedSlots);
    if (emptySlot === null) {
      return false;
    }

    // Use up the parts, deduct gold and add the item
    for (const slot of plan.consumedSlots) {
      champion.items[slot] = null;
    }
    champion.gold -= plan.price;
    champion.totalGoldSpent += plan.price;
    champion.items[emptySlot] = {
      definitionId: itemId,
      slot: emptySlot as ItemSlot,
      passiveCooldowns: {},
      nextIntervalTick: {},
    };

    // Invalidate cached stats
    champion.invalidateStats();

    Logger.champion.info(`${champion.playerId} bought ${itemDef.name} for ${plan.price}g`);
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
   * First inventory slot that is empty or about to be freed.
   */
  private findEmptySlot(freedSlots: readonly number[] = []): ItemSlot | null {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      if (!this.champion.items[i] || freedSlots.includes(i)) {
        return i as ItemSlot;
      }
    }
    return null;
  }
}
