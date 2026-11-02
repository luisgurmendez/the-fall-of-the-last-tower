/**
 * Item trees: items built from other items (ItemCatalogEntry.buildsFrom).
 *
 * An item's `cost` is its full price. Buying it uses up the parts already in
 * the inventory and takes their cost off the price, so the player only pays
 * for what's missing plus the combine cost. A part that isn't owned is looked
 * for inside its own parts, all the way down.
 *
 * The server charges with planItemPurchase and the shop shows the same price
 * and tree, so both always agree.
 */

import { ITEM_CATALOG, getItemCatalogEntry } from './items';

/** One item in a build tree */
export interface ItemTreeNode {
  itemId: string;
  /** An inventory item stands for this part (and everything under it) */
  owned: boolean;
  parts: ItemTreeNode[];
}

/** What buying an item takes, given the inventory */
export interface PurchasePlan {
  /** Gold to pay: the cost minus the cost of the owned parts used up */
  price: number;
  /** Inventory slots whose items are used up as parts */
  consumedSlots: number[];
  /** The item's build tree, with the parts that come from the inventory marked */
  tree: ItemTreeNode;
}

/**
 * Plan buying an item: its price for this inventory and the parts it uses up.
 * @param inventory item ids by slot (null or undefined for empty slots)
 * @returns null if the item isn't in the catalog
 */
export function planItemPurchase(
  itemId: string,
  inventory: readonly (string | null | undefined)[],
): PurchasePlan | null {
  const item = getItemCatalogEntry(itemId);
  if (!item) return null;

  const consumedSlots: number[] = [];

  // The inventory's value used up for a part, and the part's tree
  const usePart = (partId: string): { value: number; node: ItemTreeNode } => {
    const slot = inventory.findIndex((id, i) => id === partId && !consumedSlots.includes(i));
    if (slot !== -1) {
      consumedSlots.push(slot);
      return { value: getItemCatalogEntry(partId)?.cost ?? 0, node: { ...getItemTree(partId), owned: true } };
    }
    const parts = (getItemCatalogEntry(partId)?.buildsFrom ?? []).map(usePart);
    return {
      value: parts.reduce((sum, part) => sum + part.value, 0),
      node: { itemId: partId, owned: false, parts: parts.map(part => part.node) },
    };
  };

  const parts = (item.buildsFrom ?? []).map(usePart);
  const discount = parts.reduce((sum, part) => sum + part.value, 0);
  return {
    price: item.cost - discount,
    consumedSlots,
    tree: { itemId, owned: false, parts: parts.map(part => part.node) },
  };
}

/** An inventory slot as purchase rules see it */
export type InventoryEntry = { definitionId: string; charges?: number } | null | undefined;

/** Why an item can't be bought, besides gold and room */
export type PurchaseBlock = 'unique_owned' | 'group_owned' | 'stack_full';

/**
 * Why an item can't be bought with this inventory (gold and a free slot
 * aside), or null if it can: a unique item already owned, another item of
 * its group the purchase doesn't use up (a second pair of boots), or a
 * consumable whose stack is full.
 */
export function purchaseBlockReason(itemId: string, inventory: readonly InventoryEntry[]): PurchaseBlock | null {
  const item = getItemCatalogEntry(itemId);
  if (!item) return null;
  const ids = inventory.map(entry => entry?.definitionId);

  if (item.consumable) {
    // One flask is enough (it refills); a stack of potions has a size
    const stack = inventory.find(entry => entry?.definitionId === itemId);
    if (stack && item.consumable.refills) return 'stack_full';
    if (stack && (stack.charges ?? 0) + item.consumable.chargesPerPurchase > item.consumable.maxCharges) return 'stack_full';
    return null;
  }
  if (item.isUnique && ids.includes(itemId)) return 'unique_owned';
  if (item.group) {
    const plan = planItemPurchase(itemId, ids);
    const usedUp = new Set(plan?.consumedSlots ?? []);
    const clash = inventory.some((entry, slot) =>
      entry && !usedUp.has(slot) && getItemCatalogEntry(entry.definitionId)?.group === item.group);
    if (clash) return 'group_owned';
  }
  return null;
}

/**
 * The slot a consumable's purchase adds to (its stack, if there's room), or -1.
 */
export function consumableStackSlot(itemId: string, inventory: readonly InventoryEntry[]): number {
  const item = getItemCatalogEntry(itemId);
  if (!item?.consumable || item.consumable.refills) return -1;
  return inventory.findIndex(entry => entry?.definitionId === itemId &&
    (entry.charges ?? 0) + item.consumable!.chargesPerPurchase <= item.consumable!.maxCharges);
}

/**
 * An item's build tree with nothing owned.
 */
export function getItemTree(itemId: string): ItemTreeNode {
  return {
    itemId,
    owned: false,
    parts: (getItemCatalogEntry(itemId)?.buildsFrom ?? []).map(getItemTree),
  };
}

/**
 * What the item adds on top of its parts' costs.
 */
export function getItemCombineCost(itemId: string): number {
  const item = getItemCatalogEntry(itemId);
  if (!item) return 0;
  const partsCost = (item.buildsFrom ?? []).reduce((sum, partId) => sum + (getItemCatalogEntry(partId)?.cost ?? 0), 0);
  return item.cost - partsCost;
}

/**
 * Items built directly from this one, in catalog order.
 */
export function getItemBuildsInto(itemId: string): string[] {
  return ITEM_CATALOG.filter(item => item.buildsFrom?.includes(itemId)).map(item => item.id);
}

/**
 * Whether `partId` appears anywhere in `itemId`'s build tree (below the item itself).
 */
export function isItemPartOf(partId: string, itemId: string): boolean {
  return (getItemCatalogEntry(itemId)?.buildsFrom ?? []).some(
    id => id === partId || isItemPartOf(partId, id),
  );
}
