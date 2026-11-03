/**
 * Buying items through a champion: owned parts are used up and taken off
 * the price (item trees, @siege/shared itemTrees.ts). The shop is at the
 * fountain, or anywhere while dead.
 */

import { describe, test, expect } from 'bun:test';
import { InputType } from '@siege/shared';
import { createTestArena } from './ServerTestUtils';
import { getServerItemById } from '../data/items';
import { Simulation } from '../sim';

const cost = (id: string) => getServerItemById(id)!.cost;
const inventory = (items: ({ definitionId: string } | null)[]) => items.map(item => item?.definitionId ?? null);

describe('Item purchases', () => {
  test('buying an item with its parts owned charges only the rest', () => {
    const champion = createTestArena().blue;
    champion.gold = 5000;
    expect(champion.buyItem('notched_blade')).toBe(true);
    expect(champion.buyItem('notched_blade')).toBe(true);
    const goldBefore = champion.gold;

    expect(champion.buyItem('siege_cleaver')).toBe(true);

    expect(goldBefore - champion.gold).toBe(cost('siege_cleaver') - 2 * cost('notched_blade'));
    expect(inventory(champion.items)).toEqual(['siege_cleaver', null, null, null, null, null]);
  });

  test('a full inventory can still build an item from a part it holds', () => {
    const champion = createTestArena().blue;
    champion.gold = 10000;
    for (const id of ['padded_vest', 'quickdraw_gloves', 'quickdraw_gloves', 'wanderers_boots', 'heartstone', 'notched_blade']) {
      expect(champion.buyItem(id)).toBe(true);
    }

    expect(champion.buyItem('iron_plate')).toBe(true);
    expect(champion.items[0]?.definitionId).toBe('iron_plate');

    // Nothing in the inventory goes into a Warding Charm
    expect(champion.buyItem('warding_charm')).toBe(false);
  });

  test('the discounted price is what the gold has to cover', () => {
    const champion = createTestArena().blue;
    champion.gold = cost('heartstone');
    expect(champion.buyItem('heartstone')).toBe(true);
    champion.gold = cost('bulwark_belt') - cost('heartstone');

    expect(champion.buyItem('bulwark_belt')).toBe(true);
    expect(champion.gold).toBe(0);
  });
});

describe('Shopping while dead', () => {
  test('away from the fountain a champion buys nothing, but dead it buys and sells where it fell', () => {
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    sim.addChampion({ playerId: 'p1', championId: 'warrior', side: 'blue', at: { x: 0, y: 0 } });
    const champion = sim.champion('p1');
    champion.gold = 1000;
    const buy = () => {
      sim.input('p1', { type: InputType.BUY_ITEM, itemId: 'notched_blade' });
      sim.run(0.05);
    };

    buy();
    expect(champion.hasItem('notched_blade')).toBe(false);

    champion.takeDamage(100000, 'true', undefined, sim.context);
    expect(champion.isDead).toBe(true);
    buy();
    expect(champion.hasItem('notched_blade')).toBe(true);
    expect(champion.gold).toBeLessThan(1000);

    sim.input('p1', { type: InputType.SELL_ITEM, slot: 0 });
    sim.run(0.05);
    expect(champion.hasItem('notched_blade')).toBe(false);

    // Nothing else goes through while dead
    sim.input('p1', { type: InputType.MOVE, targetX: 300, targetY: 0 });
    sim.run(0.05);
    expect(champion.isDead).toBe(true);
    expect(champion.targetPosition).toBeNull();
    sim.dispose();
  });
});
