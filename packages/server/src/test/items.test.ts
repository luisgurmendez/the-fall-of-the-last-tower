/**
 * Tests for server-side item definitions and calculations.
 */

import { describe, test, expect } from 'bun:test';
import {
  ALL_SERVER_ITEMS,
  getServerItemById,
  calculateItemStats,
  type ServerItemDefinition,
} from '../data/items';

describe('Item Definitions', () => {
  test('all items have unique IDs', () => {
    const ids = ALL_SERVER_ITEMS.map(item => item.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('all items have required fields', () => {
    for (const item of ALL_SERVER_ITEMS) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(typeof item.cost).toBe('number');
      expect(typeof item.sellValue).toBe('number');
      expect(item.stats).toBeDefined();
      expect(Array.isArray(item.passives)).toBe(true);
      expect(typeof item.isUnique).toBe('boolean');
    }
  });

  test('sell value is approximately 70% of cost', () => {
    for (const item of ALL_SERVER_ITEMS) {
      const expectedRatio = item.sellValue / item.cost;
      // Allow 69-71% range for rounding variations
      expect(expectedRatio).toBeGreaterThanOrEqual(0.69);
      expect(expectedRatio).toBeLessThanOrEqual(0.71);
    }
  });

  test('passives have required fields', () => {
    for (const item of ALL_SERVER_ITEMS) {
      for (const passive of item.passives) {
        expect(passive.id).toBeTruthy();
        expect(passive.name).toBeTruthy();
        expect(passive.trigger).toBeTruthy();
        expect(typeof passive.cooldown).toBe('number');
        expect(typeof passive.isUnique).toBe('boolean');
        expect(passive.effectType).toBeTruthy();
        expect(passive.effectData).toBeDefined();
      }
    }
  });
});

describe('getServerItemById', () => {
  test('returns item by ID', () => {
    const longSword = getServerItemById('long_sword');
    expect(longSword).toBeDefined();
    expect(longSword?.name).toBe('Long Sword');
    expect(longSword?.stats.attackDamage).toBe(10);
  });

  test('returns undefined for unknown ID', () => {
    const unknown = getServerItemById('unknown_item');
    expect(unknown).toBeUndefined();
  });

  test('all registered items are retrievable', () => {
    for (const item of ALL_SERVER_ITEMS) {
      const retrieved = getServerItemById(item.id);
      expect(retrieved).toBe(item);
    }
  });
});

describe('calculateItemStats', () => {
  test('returns empty stats for empty array', () => {
    const stats = calculateItemStats([]);
    expect(Object.keys(stats).length).toBe(0);
  });

  test('calculates single item stats', () => {
    const stats = calculateItemStats([{ definitionId: 'long_sword' }]);
    expect(stats.attackDamage).toBe(10);
  });

  test('sums stats from multiple items', () => {
    const stats = calculateItemStats([
      { definitionId: 'long_sword' },
      { definitionId: 'bf_sword' },
    ]);
    expect(stats.attackDamage).toBe(50); // 10 + 40
  });

  test('handles multiple stat types', () => {
    const stats = calculateItemStats([
      { definitionId: 'thornmail' }, // 70 armor, 350 health
    ]);
    expect(stats.armor).toBe(70);
    expect(stats.health).toBe(350);
  });

  test('ignores null items', () => {
    const items = [
      { definitionId: 'long_sword' },
      null as any,
      { definitionId: 'bf_sword' },
    ];
    const stats = calculateItemStats(items.filter(Boolean));
    expect(stats.attackDamage).toBe(50);
  });

  test('ignores unknown item IDs', () => {
    const stats = calculateItemStats([
      { definitionId: 'long_sword' },
      { definitionId: 'unknown_item' },
    ]);
    expect(stats.attackDamage).toBe(10);
  });

  test('combines all stat types correctly', () => {
    const stats = calculateItemStats([
      { definitionId: 'bloodthirster' },  // 55 AD, 0.20 crit
      { definitionId: 'thornmail' },       // 70 armor, 350 health
      { definitionId: 'boots_of_speed' },  // 25 movementSpeed
    ]);
    expect(stats.attackDamage).toBe(55);
    expect(stats.critChance).toBe(0.20);
    expect(stats.armor).toBe(70);
    expect(stats.health).toBe(350);
    expect(stats.movementSpeed).toBe(25);
  });
});

describe('Item Categories', () => {
  test('has attack damage items', () => {
    const adItems = ALL_SERVER_ITEMS.filter(i => i.category === 'attack_damage');
    expect(adItems.length).toBeGreaterThan(0);
    for (const item of adItems) {
      expect(item.stats.attackDamage).toBeGreaterThan(0);
    }
  });

  test('has ability power items', () => {
    const apItems = ALL_SERVER_ITEMS.filter(i => i.category === 'ability_power');
    expect(apItems.length).toBeGreaterThan(0);
    for (const item of apItems) {
      expect(item.stats.abilityPower).toBeGreaterThan(0);
    }
  });

  test('has armor items', () => {
    const armorItems = ALL_SERVER_ITEMS.filter(i => i.category === 'armor');
    expect(armorItems.length).toBeGreaterThan(0);
    for (const item of armorItems) {
      expect(item.stats.armor).toBeGreaterThan(0);
    }
  });

  test('has health items', () => {
    const healthItems = ALL_SERVER_ITEMS.filter(i => i.category === 'health');
    expect(healthItems.length).toBeGreaterThan(0);
    for (const item of healthItems) {
      expect(item.stats.health).toBeGreaterThan(0);
    }
  });
});

describe('Item Passives', () => {
  test('bloodthirster has lifesteal passive', () => {
    const bt = getServerItemById('bloodthirster');
    expect(bt?.passives.length).toBe(1);
    expect(bt?.passives[0].effectType).toBe('lifesteal');
    expect(bt?.passives[0].effectData.percent).toBe(0.15);
  });

  test('thornmail has thorns passive', () => {
    const thornmail = getServerItemById('thornmail');
    expect(thornmail?.passives.length).toBe(1);
    expect(thornmail?.passives[0].effectType).toBe('thorns');
    expect(thornmail?.passives[0].effectData.damage).toBe(25);
  });

  test('sheen has spellblade passive', () => {
    const sheen = getServerItemById('sheen');
    expect(sheen?.passives.length).toBe(1);
    expect(sheen?.passives[0].effectType).toBe('spellblade');
    expect(sheen?.passives[0].cooldown).toBe(1.5);
  });

  test('steraks gage has shield passive', () => {
    const steraks = getServerItemById('steraks_gage');
    expect(steraks?.passives.length).toBe(1);
    expect(steraks?.passives[0].effectType).toBe('shield');
    expect(steraks?.passives[0].healthThreshold).toBe(0.3);
  });
});
