/**
 * Tests for ArmyUnit base class functionality.
 *
 * Tests the IGameUnit implementation shared by all army units:
 * - Damage calculation (physical, magic, true)
 * - Shields
 * - Healing
 * - Effects
 * - Immunities
 * - Knockback/forced movement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Vector from '@/physics/vector';
import {
  TestSwordsman,
  createArmyTestArena,
  calculateExpectedPhysicalDamage,
  calculateExpectedMagicDamage,
  Config,
} from './ArmyTestUtils';
import { ActiveEffect } from '@/effects/types';

describe('ArmyUnit', () => {
  describe('Damage System', () => {
    describe('Physical Damage', () => {
      it('should deal full damage with 0 armor', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        unit.setArmor(0);
        const initialHealth = unit.getHealth();

        unit.takeDamage(50, 'physical');

        expect(unit.getHealth()).toBe(initialHealth - 50);
      });

      it('should reduce physical damage based on armor', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        unit.setArmor(50);
        const initialHealth = unit.getHealth();

        const rawDamage = 100;
        unit.takeDamage(rawDamage, 'physical');

        const expectedDamage = calculateExpectedPhysicalDamage(rawDamage, 50);
        expect(unit.getHealth()).toBeCloseTo(initialHealth - expectedDamage, 1);
      });

      it('should return actual damage dealt', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        unit.setArmor(100);

        const actualDamage = unit.takeDamage(100, 'physical');

        // With 100 armor: 100 * (100 / 200) = 50
        expect(actualDamage).toBeCloseTo(50, 1);
      });
    });

    describe('Magic Damage', () => {
      it('should deal full damage with 0 magic resist', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        unit.setMagicResist(0);
        const initialHealth = unit.getHealth();

        unit.takeDamage(50, 'magic');

        expect(unit.getHealth()).toBe(initialHealth - 50);
      });

      it('should reduce magic damage based on magic resist', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        unit.setMagicResist(50);
        const initialHealth = unit.getHealth();

        const rawDamage = 100;
        unit.takeDamage(rawDamage, 'magic');

        const expectedDamage = calculateExpectedMagicDamage(rawDamage, 50);
        expect(unit.getHealth()).toBeCloseTo(initialHealth - expectedDamage, 1);
      });
    });

    describe('True Damage', () => {
      it('should ignore armor for true damage', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        unit.setArmor(100);
        const initialHealth = unit.getHealth();

        unit.takeDamage(50, 'true');

        expect(unit.getHealth()).toBe(initialHealth - 50);
      });

      it('should ignore magic resist for true damage', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        unit.setMagicResist(100);
        const initialHealth = unit.getHealth();

        unit.takeDamage(50, 'true');

        expect(unit.getHealth()).toBe(initialHealth - 50);
      });
    });

    describe('Death', () => {
      it('should not go below 0 health', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        unit.setArmor(0);

        unit.takeDamage(9999, 'true');

        expect(unit.getHealth()).toBe(0);
      });

      it('should not take damage when already dead', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        unit.setHealth(0);
        // Manually mark as dead (normally happens in beforeStep)
        (unit as any)._isDead = true;

        const damageDealt = unit.takeDamage(100, 'true');

        expect(damageDealt).toBe(0);
      });
    });
  });

  describe('Shield System', () => {
    it('should add a shield', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);

      unit.addShield(100, 5, 'test');

      expect(unit.getShieldAmount()).toBe(100);
      expect(unit.getShields()).toHaveLength(1);
    });

    it('should stack multiple shields', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);

      unit.addShield(50, 5, 'shield1');
      unit.addShield(30, 5, 'shield2');

      expect(unit.getShieldAmount()).toBe(80);
      expect(unit.getShields()).toHaveLength(2);
    });

    it('should absorb damage with shields', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      const initialHealth = unit.getHealth();
      unit.addShield(50, 5, 'test');

      unit.takeDamage(30, 'true');

      expect(unit.getHealth()).toBe(initialHealth); // Health unchanged
      expect(unit.getShieldAmount()).toBe(20); // Shield reduced
    });

    it('should consume shields fully before taking health damage', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      const initialHealth = unit.getHealth();
      unit.addShield(30, 5, 'test');

      unit.takeDamage(50, 'true');

      expect(unit.getHealth()).toBe(initialHealth - 20); // Remaining after shield
      expect(unit.getShieldAmount()).toBe(0);
    });

    it('should consume shields in order', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      unit.addShield(20, 5, 'first');
      unit.addShield(30, 5, 'second');

      unit.takeDamage(25, 'true');

      const shields = unit.getShields();
      expect(shields).toHaveLength(1);
      expect(shields[0].source).toBe('second');
      expect(shields[0].amount).toBe(25); // 50 - 25 = 25
    });
  });

  describe('Healing', () => {
    it('should heal up to max health', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      const maxHealth = unit.getMaxHealth();
      unit.setHealth(50);

      unit.heal(100);

      expect(unit.getHealth()).toBe(maxHealth);
    });

    it('should return actual healing done', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      const maxHealth = unit.getMaxHealth();
      unit.setHealth(maxHealth - 20);

      const healed = unit.heal(50);

      expect(healed).toBe(20); // Only healed 20 to reach max
    });

    it('should not heal when dead', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      unit.setHealth(0);
      (unit as any)._isDead = true;

      const healed = unit.heal(100);

      expect(healed).toBe(0);
      expect(unit.getHealth()).toBe(0);
    });
  });

  describe('Effect System', () => {
    const createTestEffect = (id: string, duration: number = 5): ActiveEffect => ({
      definition: {
        id,
        name: `Test Effect ${id}`,
        stackBehavior: 'refresh',
        category: 'debuff',
        cleansable: true,
        persistsThroughDeath: false,
      },
      source: undefined,
      timeRemaining: duration,
      stacks: 1,
    });

    it('should apply an effect', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);

      unit.applyEffect(createTestEffect('slow'));

      expect(unit.getActiveEffects()).toHaveLength(1);
      expect(unit.getActiveEffects()[0].definition.id).toBe('slow');
    });

    it('should remove an effect by id', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      unit.applyEffect(createTestEffect('slow'));

      unit.removeEffect('slow');

      expect(unit.getActiveEffects()).toHaveLength(0);
    });

    describe('Stack Behaviors', () => {
      it('should refresh duration with "refresh" behavior', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        const effect1 = createTestEffect('dot');
        effect1.definition.stackBehavior = 'refresh';
        effect1.timeRemaining = 3;
        unit.applyEffect(effect1);

        const effect2 = createTestEffect('dot');
        effect2.definition.stackBehavior = 'refresh';
        effect2.timeRemaining = 5;
        unit.applyEffect(effect2);

        expect(unit.getActiveEffects()).toHaveLength(1);
        expect(unit.getActiveEffects()[0].timeRemaining).toBe(5);
      });

      it('should extend duration with "extend" behavior', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        const effect1: ActiveEffect = {
          definition: { id: 'poison', name: 'Poison', stackBehavior: 'extend', category: 'debuff', cleansable: true, persistsThroughDeath: false },
          source: undefined,
          timeRemaining: 3,
          stacks: 1,
        };
        unit.applyEffect(effect1);

        const effect2: ActiveEffect = {
          definition: { id: 'poison', name: 'Poison', stackBehavior: 'extend', category: 'debuff', cleansable: true, persistsThroughDeath: false },
          source: undefined,
          timeRemaining: 2,
          stacks: 1,
        };
        unit.applyEffect(effect2);

        expect(unit.getActiveEffects()).toHaveLength(1);
        expect(unit.getActiveEffects()[0].timeRemaining).toBe(5); // 3 + 2
      });

      it('should ignore duplicates with "ignore" behavior', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        const effect1: ActiveEffect = {
          definition: { id: 'unique', name: 'Unique', stackBehavior: 'ignore', category: 'buff', cleansable: true, persistsThroughDeath: false },
          source: undefined,
          timeRemaining: 3,
          stacks: 1,
        };
        unit.applyEffect(effect1);

        const effect2: ActiveEffect = {
          definition: { id: 'unique', name: 'Unique', stackBehavior: 'ignore', category: 'buff', cleansable: true, persistsThroughDeath: false },
          source: undefined,
          timeRemaining: 10,
          stacks: 1,
        };
        unit.applyEffect(effect2);

        expect(unit.getActiveEffects()).toHaveLength(1);
        expect(unit.getActiveEffects()[0].timeRemaining).toBe(3); // Original unchanged
      });

      it('should replace with "replace" behavior', () => {
        const unit = new TestSwordsman(new Vector(0, 0), 0);
        const effect1: ActiveEffect = {
          definition: { id: 'buff', name: 'Buff', stackBehavior: 'replace', category: 'buff', cleansable: true, persistsThroughDeath: false },
          source: undefined,
          timeRemaining: 3,
          stacks: 1,
        };
        unit.applyEffect(effect1);

        const effect2: ActiveEffect = {
          definition: { id: 'buff', name: 'Buff', stackBehavior: 'replace', category: 'buff', cleansable: true, persistsThroughDeath: false },
          source: undefined,
          timeRemaining: 10,
          stacks: 1,
        };
        unit.applyEffect(effect2);

        expect(unit.getActiveEffects()).toHaveLength(1);
        expect(unit.getActiveEffects()[0].timeRemaining).toBe(10);
      });
    });
  });

  describe('Immunity System', () => {
    it('should add an immunity', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);

      unit.addImmunity('stun');

      expect(unit.hasImmunity('stun')).toBe(true);
    });

    it('should remove an immunity', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      unit.addImmunity('stun');

      unit.removeImmunity('stun');

      expect(unit.hasImmunity('stun')).toBe(false);
    });

    it('should check immunity correctly', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      unit.addImmunity('knockback');

      expect(unit.hasImmunity('knockback')).toBe(true);
      expect(unit.hasImmunity('stun')).toBe(false);
    });
  });

  describe('Knockback', () => {
    it('should apply knockback when not immune', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);

      unit.applyKnockback(new Vector(1, 0), 100, 0.5);

      expect(unit.isInForcedMovement()).toBe(true);
    });

    it('should not apply knockback when immune', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      unit.addImmunity('knockback');

      unit.applyKnockback(new Vector(1, 0), 100, 0.5);

      expect(unit.isInForcedMovement()).toBe(false);
    });
  });

  describe('IGameUnit Interface', () => {
    it('should return correct team id', () => {
      const ally = new TestSwordsman(new Vector(0, 0), 0);
      const enemy = new TestSwordsman(new Vector(0, 0), 1);

      expect(ally.getTeamId()).toBe(0);
      expect(enemy.getTeamId()).toBe(1);
    });

    it('should return current health', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      unit.setHealth(75);

      expect(unit.getCurrentHealth()).toBe(75);
    });

    it('should return base stats', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);

      const stats = unit.getBaseStats();

      expect(stats.health).toBe(Config.Swordsman.HEALTH);
      expect(stats.maxHealth).toBe(Config.Swordsman.HEALTH);
      expect(stats.armor).toBe(Config.Swordsman.ARMOR);
    });

    it('should clone position when getting', () => {
      const unit = new TestSwordsman(new Vector(100, 200), 0);

      const pos = unit.getPosition();
      pos.x = 999;

      expect(unit.getPosition().x).toBe(100); // Original unchanged
    });

    it('should clone position when setting', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);
      const pos = new Vector(100, 200);

      unit.setPosition(pos);
      pos.x = 999;

      expect(unit.getPosition().x).toBe(100); // Unit position unchanged
    });

    it('should report dead status correctly', () => {
      const unit = new TestSwordsman(new Vector(0, 0), 0);

      expect(unit.isDead()).toBe(false);

      unit.setHealth(0);
      (unit as any)._isDead = true;

      expect(unit.isDead()).toBe(true);
    });
  });
});
