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
    const plan = planItemPurchase('bloodthirster', [null, null, null, null, null, null])!;
    expect(plan.price).toBe(cost('bloodthirster'));
    expect(plan.consumedSlots).toEqual([]);
  });

  it('uses up an owned part and takes its cost off', () => {
    const plan = planItemPurchase('chain_vest', ['boots_of_speed', 'cloth_armor', null, null, null, null])!;
    expect(plan.price).toBe(cost('chain_vest') - cost('cloth_armor'));
    expect(plan.consumedSlots).toEqual([1]);
    expect(plan.tree.parts[0]).toMatchObject({ itemId: 'cloth_armor', owned: true });
  });

  it('uses each owned copy of a part once', () => {
    // B.F. Sword builds from two Long Swords; three are owned
    const plan = planItemPurchase('bf_sword', ['long_sword', 'long_sword', 'long_sword'])!;
    expect(plan.consumedSlots).toEqual([0, 1]);
    expect(plan.price).toBe(cost('bf_sword') - 2 * cost('long_sword'));
  });

  it('finds parts of parts that are owned', () => {
    // Bloodthirster = B.F. Sword (= 2 Long Swords) + Long Sword; three Long Swords owned
    const plan = planItemPurchase('bloodthirster', ['long_sword', 'long_sword', 'long_sword'])!;
    expect(plan.consumedSlots.sort()).toEqual([0, 1, 2]);
    expect(plan.price).toBe(cost('bloodthirster') - 3 * cost('long_sword'));
    const bfSword = plan.tree.parts[0];
    expect(bfSword).toMatchObject({ itemId: 'bf_sword', owned: false });
    expect(bfSword.parts.every(part => part.owned)).toBe(true);
  });

  it('prefers a whole owned part over its pieces', () => {
    const plan = planItemPurchase('bloodthirster', ['long_sword', 'bf_sword'])!;
    // B.F. Sword covers the first part, the Long Sword the second
    expect(plan.consumedSlots.sort()).toEqual([0, 1]);
    expect(plan.price).toBe(cost('bloodthirster') - cost('bf_sword') - cost('long_sword'));
  });

  it('returns null for an unknown item', () => {
    expect(planItemPurchase('nope', [])).toBeNull();
  });
});

describe('getItemBuildsInto', () => {
  it('lists the items a part goes into', () => {
    expect(getItemBuildsInto('long_sword')).toEqual(['bf_sword', 'bloodthirster']);
    expect(getItemBuildsInto('bloodthirster')).toEqual([]);
  });
});
