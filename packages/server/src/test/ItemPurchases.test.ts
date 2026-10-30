/**
 * Buying items through a champion: owned parts are used up and taken off
 * the price (item trees, @siege/shared itemTrees.ts).
 */

import { describe, test, expect } from 'bun:test';
import { createTestArena } from './ServerTestUtils';
import { getServerItemById } from '../data/items';

const cost = (id: string) => getServerItemById(id)!.cost;
const inventory = (items: ({ definitionId: string } | null)[]) => items.map(item => item?.definitionId ?? null);

describe('Item purchases', () => {
  test('buying an item with its parts owned charges only the rest', () => {
    const champion = createTestArena().blue;
    champion.gold = 5000;
    expect(champion.buyItem('long_sword')).toBe(true);
    expect(champion.buyItem('long_sword')).toBe(true);
    const goldBefore = champion.gold;

    expect(champion.buyItem('bf_sword')).toBe(true);

    expect(goldBefore - champion.gold).toBe(cost('bf_sword') - 2 * cost('long_sword'));
    expect(inventory(champion.items)).toEqual(['bf_sword', null, null, null, null, null]);
  });

  test('a full inventory can still build an item from a part it holds', () => {
    const champion = createTestArena().blue;
    champion.gold = 10000;
    for (const id of ['cloth_armor', 'dagger', 'dagger', 'boots_of_speed', 'rubys_crystal', 'long_sword']) {
      expect(champion.buyItem(id)).toBe(true);
    }

    expect(champion.buyItem('chain_vest')).toBe(true);
    expect(champion.items[0]?.definitionId).toBe('chain_vest');

    // Nothing in the inventory goes into a Null-Magic Mantle
    expect(champion.buyItem('null_magic_mantle')).toBe(false);
  });

  test('the discounted price is what the gold has to cover', () => {
    const champion = createTestArena().blue;
    champion.gold = cost('rubys_crystal');
    expect(champion.buyItem('rubys_crystal')).toBe(true);
    champion.gold = cost('giants_belt') - cost('rubys_crystal');

    expect(champion.buyItem('giants_belt')).toBe(true);
    expect(champion.gold).toBe(0);
  });
});
