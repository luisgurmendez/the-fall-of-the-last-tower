/**
 * Item trees: the catalog's build paths are sound, and buying an item uses
 * up its owned parts and charges only the rest.
 */

import { describe, it, expect } from 'bun:test';
import { ITEM_CATALOG, getItemCatalogEntry } from '../config/items';
import {
  planItemPurchase,
  getItemCombineCost,
  getItemBuildsInto,
  isItemPartOf,
} from '../config/itemTrees';

const cost = (id: string) => getItemCatalogEntry(id)!.cost;

describe('item catalog trees', () => {
  it('only builds from items in the catalog', () => {
    for (const item of ITEM_CATALOG) {
      for (const partId of item.buildsFrom ?? []) {
        expect(getItemCatalogEntry(partId), `${item.id} builds from ${partId}`).toBeDefined();
      }
    }
  });

  it('has no item inside its own tree', () => {
    for (const item of ITEM_CATALOG) {
      expect(isItemPartOf(item.id, item.id), item.id).toBe(false);
    }
  });

  it('never makes an item cheaper than its parts', () => {
    for (const item of ITEM_CATALOG) {
      expect(getItemCombineCost(item.id), item.id).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('planItemPurchase', () => {
  it('charges the full cost with no parts owned', () => {
    const plan = planItemPurchase('crimson_fang', [null, null, null, null, null, null])!;
    expect(plan.price).toBe(cost('crimson_fang'));
    expect(plan.consumedSlots).toEqual([]);
  });

  it('uses up an owned part and takes its cost off', () => {
    const plan = planItemPurchase('iron_plate', ['wanderers_boots', 'padded_vest', null, null, null, null])!;
    expect(plan.price).toBe(cost('iron_plate') - cost('padded_vest'));
    expect(plan.consumedSlots).toEqual([1]);
    expect(plan.tree.parts[0]).toMatchObject({ itemId: 'padded_vest', owned: true });
  });

  it('uses each owned copy of a part once', () => {
    // Siege Cleaver builds from two Notched Blades; three are owned
    const plan = planItemPurchase('siege_cleaver', ['notched_blade', 'notched_blade', 'notched_blade'])!;
    expect(plan.consumedSlots).toEqual([0, 1]);
    expect(plan.price).toBe(cost('siege_cleaver') - 2 * cost('notched_blade'));
  });

  it('finds parts of parts that are owned', () => {
    // Crimson Fang = Siege Cleaver (= 2 Notched Blades) + Notched Blade; three Notched Blades owned
    const plan = planItemPurchase('crimson_fang', ['notched_blade', 'notched_blade', 'notched_blade'])!;
    expect(plan.consumedSlots.sort()).toEqual([0, 1, 2]);
    expect(plan.price).toBe(cost('crimson_fang') - 3 * cost('notched_blade'));
    const cleaver = plan.tree.parts[0];
    expect(cleaver).toMatchObject({ itemId: 'siege_cleaver', owned: false });
    expect(cleaver.parts.every(part => part.owned)).toBe(true);
  });

  it('prefers a whole owned part over its pieces', () => {
    const plan = planItemPurchase('crimson_fang', ['notched_blade', 'siege_cleaver'])!;
    // Siege Cleaver covers the first part, the Notched Blade the second
    expect(plan.consumedSlots.sort()).toEqual([0, 1]);
    expect(plan.price).toBe(cost('crimson_fang') - cost('siege_cleaver') - cost('notched_blade'));
  });

  it('returns null for an unknown item', () => {
    expect(planItemPurchase('nope', [])).toBeNull();
  });
});

describe('getItemBuildsInto', () => {
  it('lists the items a part goes into', () => {
    expect(getItemBuildsInto('notched_blade')).toEqual(['siege_cleaver', 'crimson_fang']);
    expect(getItemBuildsInto('crimson_fang')).toEqual([]);
  });
});
