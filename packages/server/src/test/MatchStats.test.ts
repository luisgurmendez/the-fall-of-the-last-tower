/**
 * Post-match stats: what each champion dealt, took, healed, earned and
 * warded over the match, and its longest killing spree (GAME_END's totals).
 */

import { describe, test, expect } from 'bun:test';
import { Vector } from '@siege/shared';
import { createTestArena } from './ServerTestUtils';

describe('Match stats', () => {
  test('damage dealt to and taken from a champion, healing and gold earned add up', () => {
    const { blue, red, context } = createTestArena();
    const dealt = red.takeDamage(100, 'true', blue.id, context);
    blue.grantGold(300);
    blue.health = 100;
    const healed = blue.heal(50, context, blue.id);

    const bluesTotals = blue.matchStats.toTotals();
    expect(bluesTotals.damageToChampions).toBe(Math.round(dealt));
    expect(bluesTotals.damageDealt).toBe(Math.round(dealt));
    expect(bluesTotals.goldEarned).toBe(300);
    expect(bluesTotals.healing).toBe(Math.round(healed));
    expect(red.matchStats.toTotals().damageTaken).toBe(Math.round(dealt));
    expect(red.matchStats.toTotals().damageToChampions).toBe(0);
  });

  test('wards placed and destroyed count for their champions', () => {
    const { blue, red, context } = createTestArena();
    const ward = context.placeWard(red.playerId, 'stealth', new Vector(400, 0))!;
    expect(red.matchStats.toTotals().wardsPlaced).toBe(1);

    ward.takeDamage(ward.health + 100, 'true', blue.id, context);
    expect(blue.matchStats.toTotals().wardsDestroyed).toBe(1);
  });

  test('a killing spree ends with a death, but the largest one is kept', () => {
    const { blue, red, context } = createTestArena();
    const kill = () => {
      red.takeDamage(100000, 'true', blue.id, context);
      red.isDead = false;
      red.health = red.maxHealth;
    };
    kill();
    kill();
    blue.takeDamage(100000, 'true', red.id, context);
    blue.isDead = false;
    blue.health = blue.maxHealth;
    kill();

    expect(blue.kills).toBe(3);
    expect(blue.matchStats.toTotals().largestKillingSpree).toBe(2);
  });
});
