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
  purchaseBlockReason,
  consumableStackSlot,
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
    expect(getItemBuildsInto('padded_vest')).toEqual(['sandglass_bracer', 'iron_plate', 'bramble_vest', 'wardens_standard']);
    expect(getItemBuildsInto('crimson_fang')).toEqual([]);
  });
});

describe('item catalog design', () => {
  it('has many more items than the first 18', () => {
    expect(ITEM_CATALOG.length).toBeGreaterThanOrEqual(80);
  });

  it('gives every item a unique id', () => {
    expect(new Set(ITEM_CATALOG.map(item => item.id)).size).toBe(ITEM_CATALOG.length);
  });

  it('builds legendary items from parts, and nothing from a legendary', () => {
    for (const item of ITEM_CATALOG) {
      if (item.tier === 'legendary') expect(item.buildsFrom?.length ?? 0, item.id).toBeGreaterThan(0);
      for (const partId of item.buildsFrom ?? []) {
        expect(getItemCatalogEntry(partId)!.tier, `${item.id} from ${partId}`).not.toBe('legendary');
      }
    }
  });

  it('keeps every pair of boots in the boots group', () => {
    for (const item of ITEM_CATALOG.filter(item => item.tier === 'boots')) {
      expect(item.group, item.id).toBe('boots');
    }
  });

  it('gives consumables an active, and point actives a range', () => {
    for (const item of ITEM_CATALOG) {
      if (item.consumable) expect(item.active, item.id).toBeDefined();
      if (item.active?.targeting === 'point') expect(item.active.range, item.id).toBeGreaterThan(0);
    }
  });

  it('starts with a starter and a potion for the starting gold', () => {
    for (const item of ITEM_CATALOG.filter(item => item.tier === 'starter')) {
      expect(item.cost + cost('healing_draught'), item.id).toBeLessThanOrEqual(300);
    }
  });
});

describe('purchaseBlockReason', () => {
  const slot = (definitionId: string, charges?: number) => ({ definitionId, charges });

  it('allows one pair of boots, and building it into better boots', () => {
    expect(purchaseBlockReason('wanderers_boots', [slot('wanderers_boots')])).toBe('unique_owned');
    expect(purchaseBlockReason('mystic_treads', [slot('wanderers_boots')])).toBeNull();
    expect(purchaseBlockReason('wanderers_boots', [slot('mystic_treads')])).toBe('group_owned');
    expect(purchaseBlockReason('ironshod_boots', [slot('mystic_treads')])).toBe('group_owned');
  });

  it('allows one starter', () => {
    expect(purchaseBlockReason('kindling_wand', [slot('forager_blade')])).toBe('group_owned');
    expect(purchaseBlockReason('kindling_wand', [null, null])).toBeNull();
  });

  it('stacks potions up to the stack size', () => {
    expect(purchaseBlockReason('healing_draught', [slot('healing_draught', 4)])).toBeNull();
    expect(consumableStackSlot('healing_draught', [null, slot('healing_draught', 4)])).toBe(1);
    expect(purchaseBlockReason('healing_draught', [slot('healing_draught', 5)])).toBe('stack_full');
    expect(purchaseBlockReason('wayfarer_flask', [slot('wayfarer_flask', 0)])).toBe('stack_full');
  });

  it('allows a second copy of an item that isn\'t unique', () => {
    expect(purchaseBlockReason('notched_blade', [slot('notched_blade')])).toBeNull();
  });
});
