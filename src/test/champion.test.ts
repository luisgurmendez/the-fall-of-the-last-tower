/**
 * Champion system tests.
 * Tests damage, healing, shields, and basic combat mechanics.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Vector from '@/physics/vector';
import { createTestArena, TestDummy, calculateExpectedPhysicalDamage } from './ChampionTestUtils';
import { createTestGameContext } from './TestGameContext';

describe('Champion', () => {
  describe('Damage System', () => {
    it('should apply physical damage with armor reduction', () => {
      const { ally, enemy } = createTestArena();
      const initialHealth = enemy.getCurrentHealth();
      const rawDamage = 100;
      const targetArmor = enemy.getStats().armor; // 30

      const expectedDamage = calculateExpectedPhysicalDamage(rawDamage, targetArmor);
      enemy.takeDamage(rawDamage, 'physical', ally);

      expect(enemy.getCurrentHealth()).toBeCloseTo(initialHealth - expectedDamage, 1);
    });

    it('should apply magic damage with magic resist reduction', () => {
      const { ally, enemy } = createTestArena();
      const initialHealth = enemy.getCurrentHealth();
      const rawDamage = 100;
      const targetMR = enemy.getStats().magicResist; // 30

      const expectedDamage = rawDamage * (100 / (100 + targetMR));
      enemy.takeDamage(rawDamage, 'magic', ally);

      expect(enemy.getCurrentHealth()).toBeCloseTo(initialHealth - expectedDamage, 1);
    });

    it('should apply true damage without reduction', () => {
      const { ally, enemy } = createTestArena();
      const initialHealth = enemy.getCurrentHealth();
      const trueDamage = 100;

      enemy.takeDamage(trueDamage, 'true', ally);

      expect(enemy.getCurrentHealth()).toBe(initialHealth - trueDamage);
    });

    it('should kill champion when health reaches 0', () => {
      const { ally, enemy } = createTestArena();
      expect(enemy.isDead()).toBe(false);

      // Deal massive true damage
      enemy.takeDamage(99999, 'true', ally);

      expect(enemy.isDead()).toBe(true);
      expect(enemy.getCurrentHealth()).toBe(0);
    });
  });

  describe('Healing', () => {
    it('should heal champion', () => {
      const { enemy } = createTestArena();
      enemy.setHealth(500);
      const healthBefore = enemy.getCurrentHealth();

      const healed = enemy.heal(100);

      expect(healed).toBe(100);
      expect(enemy.getCurrentHealth()).toBe(healthBefore + 100);
    });

    it('should not heal beyond max health', () => {
      const { enemy } = createTestArena();
      const maxHealth = enemy.getStats().maxHealth;
      enemy.setHealth(maxHealth - 50);

      const healed = enemy.heal(100);

      expect(healed).toBe(50); // Only healed 50
      expect(enemy.getCurrentHealth()).toBe(maxHealth);
    });

    it('should not heal dead champions', () => {
      const { ally, enemy } = createTestArena();
      enemy.takeDamage(99999, 'true', ally);
      expect(enemy.isDead()).toBe(true);

      const healed = enemy.heal(100);

      expect(healed).toBe(0);
    });
  });

  describe('Shields', () => {
    it('should add shields to champion', () => {
      const { enemy } = createTestArena();
      expect(enemy.getTotalShield()).toBe(0);

      enemy.addShield(200, 5);

      expect(enemy.getTotalShield()).toBe(200);
    });

    it('should absorb damage with shields first', () => {
      const { ally, enemy } = createTestArena();
      const initialHealth = enemy.getCurrentHealth();
      enemy.addShield(100, 5);

      // Apply 150 true damage (100 absorbed by shield, 50 to health)
      enemy.takeDamage(150, 'true', ally);

      expect(enemy.getTotalShield()).toBe(0);
      expect(enemy.getCurrentHealth()).toBe(initialHealth - 50);
    });

    it('should stack multiple shields', () => {
      const { ally, enemy } = createTestArena();
      enemy.addShield(100, 5);
      enemy.addShield(100, 5);

      expect(enemy.getTotalShield()).toBe(200);

      // Damage that uses both shields
      enemy.takeDamage(150, 'true', ally);
      expect(enemy.getTotalShield()).toBe(50);
    });
  });

  describe('Stats', () => {
    it('should calculate stats correctly at level 1', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      const stats = dummy.getStats();

      expect(stats.level).toBe(1);
      expect(stats.maxHealth).toBe(1000);
      expect(stats.attackDamage).toBe(50);
    });

    it('should scale stats with level', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      const lvl1Health = dummy.getStats().maxHealth;

      dummy.setLevel(5);
      const lvl5Health = dummy.getStats().maxHealth;

      expect(lvl5Health).toBeGreaterThan(lvl1Health);
    });

    it('should apply stat modifiers', () => {
      const dummy = new TestDummy();
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      const baseDamage = dummy.getStats().attackDamage;

      dummy.addStatModifier('attackDamage', 20); // +20 flat AD
      const newDamage = dummy.getStats().attackDamage;

      expect(newDamage).toBe(baseDamage + 20);
    });
  });

  describe('Immunities', () => {
    it('should add and check immunities', () => {
      const dummy = new TestDummy();

      expect(dummy.hasImmunity('poison')).toBe(false);

      dummy.addImmunity('poison');

      expect(dummy.hasImmunity('poison')).toBe(true);
    });

    it('should remove immunities', () => {
      const dummy = new TestDummy();
      dummy.addImmunity('stun');

      expect(dummy.hasImmunity('stun')).toBe(true);

      dummy.removeImmunity('stun');

      expect(dummy.hasImmunity('stun')).toBe(false);
    });
  });

  describe('Forced Movement', () => {
    it('should apply knockback', () => {
      const dummy = new TestDummy(new Vector(0, 0));
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      const initialPos = dummy.getPosition();

      dummy.applyKnockback(new Vector(1, 0), 100, 0.5);

      expect(dummy.isInForcedMovement()).toBe(true);
      expect(dummy.getForcedMovement()?.type).toBe('knockback');
    });

    it('should not apply knockback if immune', () => {
      const dummy = new TestDummy(new Vector(0, 0));
      const ctx = createTestGameContext();
      dummy.init(ctx as any);

      dummy.addImmunity('knockback');
      dummy.applyKnockback(new Vector(1, 0), 100, 0.5);

      expect(dummy.isInForcedMovement()).toBe(false);
    });
  });

  describe('Basic Attack Modifiers', () => {
    it('should track basic attack modifiers', () => {
      const dummy = new TestDummy();

      dummy.addBasicAttackModifier({
        bonusDamage: 50,
        charges: 1,
      });

      const mods = dummy.getBasicAttackModifiers();
      expect(mods.length).toBe(1);
      expect(mods[0].bonusDamage).toBe(50);
    });

    it('should consume modifiers with charges', () => {
      const dummy = new TestDummy();

      dummy.addBasicAttackModifier({
        bonusDamage: 50,
        charges: 1,
      });

      expect(dummy.getAttackModifiers().length).toBe(1);

      dummy.consumeBasicAttackModifiers();

      expect(dummy.getAttackModifiers().length).toBe(0);
    });
  });
});
