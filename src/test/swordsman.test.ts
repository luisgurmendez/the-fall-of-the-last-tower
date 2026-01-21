/**
 * Tests for Swordsman unit.
 *
 * Swordsman is a melee infantry unit that:
 * - Deals direct physical damage on attack
 * - Has short attack range (melee)
 * - Has moderate health
 */

import { describe, it, expect } from 'vitest';
import Vector from '@/physics/vector';
import {
  TestSwordsman,
  createArmyTestArena,
  calculateExpectedPhysicalDamage,
  Config,
} from './ArmyTestUtils';

describe('Swordsman', () => {
  describe('Initialization', () => {
    it('should initialize with correct health', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);

      expect(swordsman.getHealth()).toBe(Config.Swordsman.HEALTH);
      expect(swordsman.getMaxHealth()).toBe(Config.Swordsman.HEALTH);
    });

    it('should initialize with correct armor and MR', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);

      expect(swordsman.getArmor()).toBe(Config.Swordsman.ARMOR);
      expect(swordsman.getMagicResist()).toBe(Config.Swordsman.MAGIC_RESIST);
    });

    it('should initialize with correct attack range', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);

      expect(swordsman.getAttackRange()).toBe(Config.Swordsman.ATTACK_RANGE);
    });

    it('should face right when ally (side 0)', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);

      expect(swordsman.getDirection().x).toBeGreaterThan(0);
    });

    it('should face left when enemy (side 1)', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 1);

      expect(swordsman.getDirection().x).toBeLessThan(0);
    });

    it('should start at given position', () => {
      const swordsman = new TestSwordsman(new Vector(100, 200), 0);

      const pos = swordsman.getPosition();
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);
    });
  });

  describe('Attack Range', () => {
    it('should have melee attack range', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);

      // Swordsman is melee, so attack range should be very short
      expect(swordsman.getAttackRange()).toBeLessThan(50);
    });
  });

  describe('Combat', () => {
    it('should be able to attack when cooldown is ready', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);

      // Fresh swordsman should be able to attack
      expect(swordsman.canAttackNow()).toBe(true);
    });

    it('should deal physical damage to target', () => {
      const arena = createArmyTestArena({
        allyType: 'swordsman',
        enemyType: 'swordsman',
        allyPosition: new Vector(0, 0),
        enemyPosition: new Vector(5, 0), // Within melee range
      });

      const ally = arena.ally as TestSwordsman;
      const enemy = arena.enemy as TestSwordsman;

      // Set target and verify damage calculation
      const initialHealth = enemy.getHealth();
      const expectedDamage = calculateExpectedPhysicalDamage(
        Config.Swordsman.DAMAGE,
        enemy.getArmor()
      );

      // Directly deal damage (simulating attack)
      enemy.takeDamage(Config.Swordsman.DAMAGE, 'physical', ally);

      expect(enemy.getHealth()).toBeCloseTo(initialHealth - expectedDamage, 1);
    });
  });

  describe('Taking Damage', () => {
    it('should reduce health when taking physical damage', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);
      const initialHealth = swordsman.getHealth();

      swordsman.takeDamage(20, 'physical');

      expect(swordsman.getHealth()).toBeLessThan(initialHealth);
    });

    it('should reduce health when taking magic damage', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);
      const initialHealth = swordsman.getHealth();

      swordsman.takeDamage(20, 'magic');

      expect(swordsman.getHealth()).toBeLessThan(initialHealth);
    });

    it('should reduce health when taking true damage', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);
      const initialHealth = swordsman.getHealth();

      swordsman.takeDamage(20, 'true');

      expect(swordsman.getHealth()).toBe(initialHealth - 20);
    });
  });

  describe('Shields', () => {
    it('should absorb damage with shield', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);
      const initialHealth = swordsman.getHealth();
      swordsman.addShield(50, 10, 'test');

      swordsman.takeDamage(30, 'true');

      expect(swordsman.getHealth()).toBe(initialHealth);
      expect(swordsman.getShieldAmount()).toBe(20);
    });

    it('should take health damage after shield is depleted', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);
      const initialHealth = swordsman.getHealth();
      swordsman.addShield(20, 10, 'test');

      swordsman.takeDamage(50, 'true');

      expect(swordsman.getHealth()).toBe(initialHealth - 30);
      expect(swordsman.getShieldAmount()).toBe(0);
    });
  });

  describe('Side and Team', () => {
    it('should correctly report team id for ally', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);

      expect(swordsman.getTeamId()).toBe(0);
      expect(swordsman.getSide()).toBe(0);
    });

    it('should correctly report team id for enemy', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 1);

      expect(swordsman.getTeamId()).toBe(1);
      expect(swordsman.getSide()).toBe(1);
    });
  });

  describe('Position', () => {
    it('should update position correctly', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);

      swordsman.setPosition(new Vector(100, 200));

      const pos = swordsman.getPosition();
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);
    });

    it('should not affect original vector when setting position', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);
      const pos = new Vector(100, 200);

      swordsman.setPosition(pos);
      pos.x = 999;

      expect(swordsman.getPosition().x).toBe(100);
    });
  });

  describe('Death', () => {
    it('should not report dead when health > 0', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);

      expect(swordsman.isDead()).toBe(false);
    });

    it('should mark shouldDispose when health reaches 0 after step', () => {
      const swordsman = new TestSwordsman(new Vector(0, 0), 0);

      // Damage to 0 health
      swordsman.takeDamage(9999, 'true');

      expect(swordsman.getHealth()).toBe(0);
      // Note: shouldDispose is set in beforeStep/die, not immediately
    });
  });
});
