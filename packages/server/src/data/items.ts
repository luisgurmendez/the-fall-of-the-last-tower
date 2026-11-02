/**
 * Server-side access to the item catalog (@siege/shared config/items.ts):
 * lookups and the stat totals of equipped items.
 */

import {
  ITEM_CATALOG,
  getItemCatalogEntry,
  type ItemStats,
  type ItemCatalogEntry,
  type ItemPassiveData,
} from '@siege/shared';

export type { ItemPassiveTrigger } from '@siege/shared';
export type ServerItemDefinition = ItemCatalogEntry;
export type ServerItemPassive = ItemPassiveData;

export const ALL_SERVER_ITEMS: ServerItemDefinition[] = ITEM_CATALOG;

/**
 * Get an item definition by ID.
 */
export function getServerItemById(id: string): ServerItemDefinition | undefined {
  return getItemCatalogEntry(id);
}

/**
 * Calculate total stats from equipped items.
 */
export function calculateItemStats(
  items: { definitionId: string }[]
): ItemStats {
  const totalStats: ItemStats = {};

  for (const item of items) {
    if (!item) continue;

    const def = getServerItemById(item.definitionId);
    if (!def) continue;

    for (const [stat, value] of Object.entries(def.stats)) {
      const key = stat as keyof ItemStats;
      totalStats[key] = (totalStats[key] || 0) + (value as number);
    }
  }

  return totalStats;
}
