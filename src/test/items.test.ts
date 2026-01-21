/**
 * Item system tests.
 * Tests item purchasing, stat bonuses, and passive effects.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Vector from '@/physics/vector';
import { createTestArena, TestDummy, calculateExpectedPhysicalDamage } from './ChampionTestUtils';
import { createTestGameContext } from './TestGameContext';

// Import item definitions
import {
  LongSword,
  BFSword,
  Bloodthirster,
  Thornmail,
  SteraksGage,
  BootsOfSpeed,
  Sheen,
} from '@/items/definitions';

describe('Item System', () => {
  describe('Item Purchasing', () => {
    it('should purchase an item successfully', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      const result = dummy.canPurchaseItem(LongSword, 1000);
      expect(result.success).toBe(true);

      const slot = dummy.purchaseItem(LongSword);
      expect(slot).toBe(0); // First slot
      expect(dummy.getInventory().items.size).toBe(1);
    });

    it('should fail to purchase with insufficient gold', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      const result = dummy.canPurchaseItem(LongSword, 100); // LongSword costs 350
      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_enough_gold');
    });

    it('should fail to purchase duplicate unique items', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      // BootsOfSpeed is unique
      dummy.purchaseItem(BootsOfSpeed);

      const result = dummy.canPurchaseItem(BootsOfSpeed, 1000);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('unique_owned');
    });

    it('should fail when inventory is full', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      // Fill 6 slots
      for (let i = 0; i < 6; i++) {
        dummy.purchaseItem(LongSword);
      }

      const result = dummy.canPurchaseItem(LongSword, 1000);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('inventory_full');
    });
  });

  describe('Item Stats', () => {
    it('should apply flat stat bonuses', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      const baseDamage = dummy.getStats().attackDamage;

      dummy.purchaseItem(LongSword); // +10 AD

      expect(dummy.getStats().attackDamage).toBe(baseDamage + 10);
    });

    it('should stack multiple item stats', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      const baseDamage = dummy.getStats().attackDamage;

      dummy.purchaseItem(LongSword); // +10 AD
      dummy.purchaseItem(LongSword); // +10 AD
      dummy.purchaseItem(BFSword);   // +40 AD

      expect(dummy.getStats().attackDamage).toBe(baseDamage + 10 + 10 + 40);
    });

    it('should remove stats when selling item', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      const baseDamage = dummy.getStats().attackDamage;

      const slot = dummy.purchaseItem(LongSword);
      expect(dummy.getStats().attackDamage).toBe(baseDamage + 10);

      const goldGained = dummy.sellItem(slot as any);
      expect(goldGained).toBe(LongSword.sellValue);
      expect(dummy.getStats().attackDamage).toBe(baseDamage);
    });
  });

  describe('Item Passives', () => {
    it('should track item stats correctly', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      dummy.purchaseItem(Thornmail); // +70 armor, +350 health

      const itemStats = dummy.getItemStats();
      expect(itemStats.armor).toBe(70);
      expect(itemStats.health).toBe(350);
    });

    it('should have Sterak\'s Gage passive trigger setup', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      dummy.purchaseItem(SteraksGage);

      const inventory = dummy.getInventory();
      const equipped = inventory.items.get(0);

      expect(equipped).toBeDefined();
      expect(equipped?.definition.passives.length).toBe(1);
      expect(equipped?.definition.passives[0].name).toBe('Lifeline');
      expect(equipped?.definition.passives[0].trigger).toBe('on_low_health');
    });
  });

  describe('Selling Items', () => {
    it('should return sell value when selling', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      const slot = dummy.purchaseItem(BFSword);
      const goldGained = dummy.sellItem(slot as any);

      expect(goldGained).toBe(BFSword.sellValue); // 910
    });

    it('should return 0 when selling empty slot', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      const goldGained = dummy.sellItem(0);

      expect(goldGained).toBe(0);
    });
  });

  describe('Item Definitions', () => {
    it('should have correct LongSword definition', () => {
      expect(LongSword.id).toBe('long_sword');
      expect(LongSword.cost).toBe(350);
      expect(LongSword.stats.attackDamage).toBe(10);
    });

    it('should have correct BFSword definition', () => {
      expect(BFSword.id).toBe('bf_sword');
      expect(BFSword.cost).toBe(1300);
      expect(BFSword.stats.attackDamage).toBe(40);
    });

    it('should have correct Bloodthirster definition', () => {
      expect(Bloodthirster.id).toBe('bloodthirster');
      expect(Bloodthirster.stats.attackDamage).toBe(55);
      expect(Bloodthirster.stats.critChance).toBe(0.20);
      expect(Bloodthirster.passives.length).toBe(1);
      expect(Bloodthirster.passives[0].trigger).toBe('on_hit');
    });

    it('should have correct Thornmail definition', () => {
      expect(Thornmail.id).toBe('thornmail');
      expect(Thornmail.stats.armor).toBe(70);
      expect(Thornmail.stats.health).toBe(350);
      expect(Thornmail.passives.length).toBe(1);
      expect(Thornmail.passives[0].trigger).toBe('on_take_damage');
    });
  });
});
