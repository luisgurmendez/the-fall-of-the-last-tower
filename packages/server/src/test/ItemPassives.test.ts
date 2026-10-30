/**
 * Item passives (ChampionItemPassives): on-hit damage, lifesteal, the
 * ability-charged attack, thorns and the low-health shield.
 */

import { describe, test, expect } from 'bun:test';
import { GameEventType, Vector, type ItemSlot } from '@siege/shared';
import { createTestArena } from './ServerTestUtils';
import type { ServerChampion } from '../simulation/ServerChampion';

function give(champion: ServerChampion, itemId: string, slot = 0): void {
  champion.items[slot] = {
    definitionId: itemId,
    slot: slot as ItemSlot,
    passiveCooldowns: {},
    nextIntervalTick: {},
  };
  champion.invalidateStats();
}

/** Arena with the two champions in melee range of each other */
function meleeArena() {
  return createTestArena({ learnAbilities: true, bluePosition: new Vector(0, 0), redPosition: new Vector(60, 0) });
}

describe('Item passives', () => {
  test('Barbed Bolts: basic attacks deal bonus physical damage', () => {
    const { blue, red, context } = meleeArena();
    const before = red.health;
    blue.itemPassives.onBasicAttackHit(red, 0, context);
    expect(red.health).toBe(before);

    give(blue, 'repeater_crossbow');
    blue.itemPassives.onBasicAttackHit(red, 0, context);
    expect(red.health).toBeLessThan(before);
    expect(before - red.health).toBeLessThanOrEqual(12);
  });

  test('Feast: basic attacks heal for 15% of the damage dealt, and clients are told', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'crimson_fang');
    blue.health = 100;
    context.flushEvents();
    blue.itemPassives.onBasicAttackHit(red, 100, context);
    expect(blue.health).toBe(115);
    const heal = context.flushEvents().find(event => event.type === GameEventType.HEAL);
    expect(heal?.data).toMatchObject({ entityId: blue.id, amount: 15 });
  });

  test('Feast heals from a real basic attack', () => {
    const arena = meleeArena();
    const { blue, red } = arena;
    give(blue, 'crimson_fang');
    blue.health = 200;
    const heals: number[] = [];
    const heal = blue.heal.bind(blue);
    blue.heal = (amount: number) => { heals.push(amount); return heal(amount); };

    // Damage dealt to red (its health also regenerates, so count the hits)
    let dealt = 0;
    const takeDamage = red.takeDamage.bind(red);
    red.takeDamage = (...args: Parameters<typeof red.takeDamage>) => {
      const amount = takeDamage(...args);
      dealt += amount;
      return amount;
    };
    blue.setAttackTarget(red.id);
    arena.tickFrames(90);

    expect(dealt).toBeGreaterThan(0);
    expect(heals.length).toBeGreaterThan(0);
    expect(heals.reduce((a, b) => a + b, 0)).toBeCloseTo(dealt * 0.15, 1);
  });

  test('Starfall: an ability charges the next basic attack, then it cools down', () => {
    const arena = meleeArena();
    const { blue, red, context } = arena;
    give(blue, 'starfall_diadem');

    // Not charged: nothing extra
    let before = red.health;
    blue.itemPassives.onBasicAttackHit(red, 0, context);
    expect(red.health).toBe(before);

    blue.itemPassives.onAbilityCast(context);
    expect(blue.itemPassives.isCharged('starfall', context)).toBe(true);
    expect(blue.activeEffects.some(effect => effect.definitionId === 'item_starfall')).toBe(true);
    before = red.health;
    blue.itemPassives.onBasicAttackHit(red, 0, context);
    expect(red.health).toBeLessThan(before);
    expect(blue.itemPassives.isCharged('starfall', context)).toBe(false);
    expect(blue.activeEffects.some(effect => effect.definitionId === 'item_starfall')).toBe(false);

    // On cooldown for 1.5s: casting doesn't charge it
    blue.itemPassives.onAbilityCast(context);
    expect(blue.itemPassives.isCharged('starfall', context)).toBe(false);
    arena.tickFrames(100);
    blue.itemPassives.onAbilityCast(context);
    expect(blue.itemPassives.isCharged('starfall', context)).toBe(true);
  });

  test('Starfall charges from a real ability cast', () => {
    const arena = meleeArena();
    give(arena.blue, 'starfall_diadem');
    const result = arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(60, 0) });
    expect(result.success).toBe(true);
    expect(arena.blue.itemPassives.isCharged('starfall', arena.context)).toBe(true);
  });

  test('Barbs: an enemy that lands a basic attack takes damage back', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'spiked_bastion');
    const before = red.health;
    blue.onBasicAttackTaken(red, context);
    expect(red.health).toBeLessThan(before);
  });

  test('Barbs hits a minion that attacks for real', () => {
    const arena = meleeArena();
    const { blue, context } = arena;
    give(blue, 'spiked_bastion');
    const minion = arena.addMinion(1, new Vector(0, 40), 'melee');
    const before = minion.health;
    for (let i = 0; i < 180 && minion.health === before; i++) {
      context.advanceTime(1 / 60);
      minion.update(1 / 60, context);
    }
    expect(minion.health).toBeLessThan(before);
  });

  test('Hold the Line: dropping below 30% health grants a shield, once per cooldown', () => {
    const { blue, context } = meleeArena();
    give(blue, 'ironheart_talisman');
    blue.health = blue.maxHealth * 0.35;

    blue.takeDamage(blue.maxHealth * 0.1, 'true', undefined, context);
    expect(blue.shields.some(shield => shield.sourceId === 'item_hold_the_line')).toBe(true);
    const shield = blue.shields.find(s => s.sourceId === 'item_hold_the_line')!;
    expect(shield.amount).toBeCloseTo(blue.maxHealth * 0.3, 5);
    expect(blue.activeEffects.some(effect => effect.definitionId === 'item_hold_the_line')).toBe(true);

    blue.shields.length = 0;
    blue.takeDamage(10, 'true', undefined, context);
    expect(blue.shields.length).toBe(0);
  });

  test('a passive applies once with two copies of its item', () => {
    const { blue, red, context } = meleeArena();
    give(blue, 'repeater_crossbow', 0);
    const before = red.health;
    blue.itemPassives.onBasicAttackHit(red, 0, context);
    const once = before - red.health;

    give(blue, 'repeater_crossbow', 1);
    const before2 = red.health;
    blue.itemPassives.onBasicAttackHit(red, 0, context);
    expect(before2 - red.health).toBeCloseTo(once, 5);
  });
});
