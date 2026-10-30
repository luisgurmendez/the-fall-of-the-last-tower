/**
 * The item catalog (@siege/shared ITEM_CATALOG, the same one the server
 * sells from) as ItemDefinitions for the shop and the HUD.
 */

import {
  ITEM_CATALOG,
  type ItemCatalogEntry,
  type ItemDefinition,
  type ItemPassiveData,
} from '@siege/shared';

function toItemDefinition(entry: ItemCatalogEntry): ItemDefinition {
  return {
    id: entry.id,
    name: entry.name,
    // What the item does is in its stats and passives
    description: '',
    category: entry.category,
    cost: entry.cost,
    sellValue: entry.sellValue,
    stats: entry.stats,
    passiveIds: entry.passives.map(passive => passive.id),
    isUnique: entry.isUnique,
    tags: [],
  };
}

/** Every item the shop sells, in catalog order */
export const SHOP_ITEMS: ItemDefinition[] = ITEM_CATALOG.map(toItemDefinition);

const ITEMS_BY_ID = new Map(SHOP_ITEMS.map(item => [item.id, item]));
const PASSIVES_BY_ID = new Map(
  ITEM_CATALOG.flatMap(entry => entry.passives.map(passive => [passive.id, passive] as const)),
);

/**
 * An item's definition by ID.
 */
export function getItemDefinition(itemId: string): ItemDefinition | undefined {
  return ITEMS_BY_ID.get(itemId);
}

/**
 * An item passive by ID.
 */
export function getItemPassive(passiveId: string): ItemPassiveData | undefined {
  return PASSIVES_BY_ID.get(passiveId);
}
