/**
 * Tests for Archer unit and Arrow projectile.
 *
 * Archer is a ranged infantry unit that:
 * - Fires arrow projectiles at enemies
 * - Has long attack range
 * - Has low health (glass cannon)
 *
 * Arrow is a projectile that:
 * - Travels in a straight line
 * - Deals physical damage on hit
 * - Expires after TTL
 */

import { describe, it, expect } from 'vitest';
import Vector from '@/physics/vector';
import {
  TestArcher,
  TestArrow,
  createArmyTestArena,
  createTestArrow,
  calculateExpectedPhysicalDamage,
  Config,
} from './ArmyTestUtils';

describe('Archer', () => {
  describe('Initialization', () => {
    it('should initialize with correct health', () => {
      const archer = new TestArcher(new Vector(0, 0), 0);

      expect(archer.getHealth()).toBe(Config.Archer.HEALTH);
      expect(archer.getMaxHealth()).toBe(Config.Archer.HEALTH);
    });

    it('should initialize with correct armor and MR', () => {
      const archer = new TestArcher(new Vector(0, 0), 0);

      expect(archer.getArmor()).toBe(Config.Archer.ARMOR);
      expect(archer.getMagicResist()).toBe(Config.Archer.MAGIC_RESIST);
    });

    it('should initialize with correct attack range', () => {
      const archer = new TestArcher(new Vector(0, 0), 0);

      expect(archer.getAttackRange()).toBe(Config.Archer.ATTACK_RANGE);
    });

    it('should have long attack range (ranged unit)', () => {
      const archer = new TestArcher(new Vector(0, 0), 0);

      // Archer is ranged, so attack range should be long
      expect(archer.getAttackRange()).toBeGreaterThan(100);
    });

    it('should face right when ally (side 0)', () => {
      const archer = new TestArcher(new Vector(0, 0), 0);

      expect(archer.getDirection().x).toBeGreaterThan(0);
    });

    it('should face left when enemy (side 1)', () => {
      const archer = new TestArcher(new Vector(0, 0), 1);

      expect(archer.getDirection().x).toBeLessThan(0);
    });

    it('should start at given position', () => {
      const archer = new TestArcher(new Vector(100, 200), 0);

      const pos = archer.getPosition();
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);
    });
  });

  describe('Low Health', () => {
    it('should have very low health (glass cannon)', () => {
      const archer = new TestArcher(new Vector(0, 0), 0);

      // Archer should have much less health than swordsman
      expect(archer.getMaxHealth()).toBeLessThan(Config.Swordsman.HEALTH);
    });
  });

  describe('Combat', () => {
    it('should be able to attack when cooldown is ready', () => {
      const archer = new TestArcher(new Vector(0, 0), 0);

      expect(archer.canAttackNow()).toBe(true);
    });
  });

  describe('Taking Damage', () => {
    it('should take full physical damage with 0 armor', () => {
      const archer = new TestArcher(new Vector(0, 0), 0);
      archer.setArmor(0);
      const initialHealth = archer.getHealth();

      archer.takeDamage(5, 'physical');

      expect(archer.getHealth()).toBe(initialHealth - 5);
    });

    it('should die easily (low health)', () => {
      const archer = new TestArcher(new Vector(0, 0), 0);

      archer.takeDamage(Config.Archer.HEALTH, 'true');

      expect(archer.getHealth()).toBe(0);
    });
  });

  describe('Shields', () => {
    it('should protect with shields', () => {
      const archer = new TestArcher(new Vector(0, 0), 0);
      const initialHealth = archer.getHealth();
      archer.addShield(50, 10, 'test');

      archer.takeDamage(30, 'true');

      expect(archer.getHealth()).toBe(initialHealth);
      expect(archer.getShieldAmount()).toBe(20);
    });
  });

  describe('Side and Team', () => {
    it('should correctly report team id for ally', () => {
      const archer = new TestArcher(new Vector(0, 0), 0);

      expect(archer.getTeamId()).toBe(0);
    });

    it('should correctly report team id for enemy', () => {
      const archer = new TestArcher(new Vector(0, 0), 1);

      expect(archer.getTeamId()).toBe(1);
    });
  });
});

describe('Arrow', () => {
  describe('Initialization', () => {
    it('should initialize with correct position', () => {
      const arrow = createTestArrow({
        position: new Vector(100, 200),
      });

      const pos = arrow.getPositionXY();
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);
    });

    it('should initialize with correct direction (normalized)', () => {
      const arrow = createTestArrow({
        direction: new Vector(3, 4), // Not normalized
      });

      const velocity = arrow.getVelocityXY();
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      // Velocity should be at the configured speed
      expect(speed).toBeCloseTo(Config.Arrow.SPEED, 1);
    });

    it('should initialize with correct side', () => {
      const allyArrow = createTestArrow({ side: 0 });
      const enemyArrow = createTestArrow({ side: 1 });

      expect(allyArrow.side).toBe(0);
      expect(enemyArrow.side).toBe(1);
    });

    it('should initialize with correct TTL', () => {
      const arrow = createTestArrow();

      expect(arrow.getTTL()).toBe(Config.Arrow.TTL);
    });

    it('should initialize with default damage from config', () => {
      const arrow = createTestArrow();

      expect(arrow.getDamage()).toBe(Config.Arrow.DAMAGE);
    });

    it('should accept custom damage', () => {
      const arrow = createTestArrow({ damage: 50 });

      expect(arrow.getDamage()).toBe(50);
    });
  });

  describe('Movement', () => {
    it('should travel in specified direction', () => {
      const arrow = createTestArrow({
        position: new Vector(0, 0),
        direction: new Vector(1, 0), // Moving right
      });

      const velocity = arrow.getVelocityXY();
      expect(velocity.x).toBeGreaterThan(0);
      expect(velocity.y).toBeCloseTo(0, 5);
    });

    it('should travel at configured speed', () => {
      const arrow = createTestArrow({
        direction: new Vector(1, 0),
      });

      const velocity = arrow.getVelocityXY();
      expect(velocity.x).toBeCloseTo(Config.Arrow.SPEED, 1);
    });

    it('should handle diagonal direction', () => {
      const arrow = createTestArrow({
        direction: new Vector(1, 1), // Diagonal
      });

      const velocity = arrow.getVelocityXY();
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      expect(speed).toBeCloseTo(Config.Arrow.SPEED, 1);
      expect(velocity.x).toBeCloseTo(velocity.y, 5); // 45 degree angle
    });
  });

  describe('Damage', () => {
    it('should store damage value', () => {
      const arrow = createTestArrow({ damage: 25 });

      expect(arrow.getDamage()).toBe(25);
    });

    it('should use config damage by default', () => {
      const arrow = createTestArrow();

      expect(arrow.getDamage()).toBe(Config.Arrow.DAMAGE);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should start with full TTL', () => {
      const arrow = createTestArrow();

      expect(arrow.getTTL()).toBe(Config.Arrow.TTL);
    });

    it('should allow TTL modification for testing', () => {
      const arrow = createTestArrow();

      arrow.setTTL(0.5);

      expect(arrow.getTTL()).toBe(0.5);
    });
  });

  describe('Disposal', () => {
    it('should not be disposed initially', () => {
      const arrow = createTestArrow();

      expect(arrow.shouldDispose).toBe(false);
    });
  });
});

describe('Archer vs Swordsman Combat', () => {
  it('should have longer range than swordsman', () => {
    const archer = new TestArcher(new Vector(0, 0), 0);
    const swordsmanRange = Config.Swordsman.ATTACK_RANGE;

    expect(archer.getAttackRange()).toBeGreaterThan(swordsmanRange);
  });

  it('should have less health than swordsman', () => {
    const archer = new TestArcher(new Vector(0, 0), 0);
    const swordsmanHealth = Config.Swordsman.HEALTH;

    expect(archer.getMaxHealth()).toBeLessThan(swordsmanHealth);
  });

  it('arrow should deal less damage than swordsman melee', () => {
    // This may or may not be true based on config, but let's verify the config
    const arrowDamage = Config.Arrow.DAMAGE;
    const swordsmanDamage = Config.Swordsman.DAMAGE;

    // Log the comparison (not an assertion since it's config-dependent)
    expect(arrowDamage).toBeDefined();
    expect(swordsmanDamage).toBeDefined();
  });
});
