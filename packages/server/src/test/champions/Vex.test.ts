/**
 * Vex Champion Tests
 *
 * Tests for Vex - a melee assassin with high burst and mobility.
 * Abilities:
 * - Q: Shadow Shuriken - Skillshot that marks targets
 * - W: Shadow Shroud - Stealth and speed buff
 * - E: Shadow Step - Dash (resets on marked target)
 * - R: Death Mark - Execute damage
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Vector } from '@siege/shared';
import {
  createTestArena,
  TestArena,
} from '../ServerTestUtils';

describe('Vex', () => {
  let arena: TestArena;

  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'vex',
      redChampion: 'magnus', // Squishy target
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(300, 0),
    });
  });

  describe('Base Stats', () => {
    test('should have moderate health (520)', () => {
      expect(arena.blue.maxHealth).toBe(520);
    });

    test('should have melee attack range (125)', () => {
      expect(arena.blue.getStats().attackRange).toBe(125);
    });

    test('should have high base attack damage (65)', () => {
      expect(arena.blue.getStats().attackDamage).toBe(65);
    });

    test('should have high movement speed (350)', () => {
      expect(arena.blue.getStats().movementSpeed).toBe(350);
    });

    test('should use energy (260 resource)', () => {
      expect(arena.blue.maxResource).toBe(260);
      expect(arena.blue.definition.resourceType).toBe('energy');
    });
  });

  describe('Q - Shadow Shuriken', () => {
    test('should fire a fast projectile', () => {
      const result = arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(700, 0),
      });

      expect(result.success).toBe(true);
    });

    test('should deal physical damage on hit', () => {
      const initialHealth = arena.red.health;

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(700, 0),
      });

      // Fast projectile (1500 speed) should hit quickly
      arena.tickFrames(20);

      expect(arena.red.health).toBeLessThan(initialHealth);
    });

    test('should mark the target', () => {
      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(700, 0),
      });

      arena.tickFrames(20);

      // Target should have vex_mark effect
      expect(arena.red.hasEffect('vex_mark')).toBe(true);
    });

    test('should have low energy cost (30)', () => {
      const initialEnergy = arena.blue.resource;

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(700, 0),
      });

      expect(arena.blue.resource).toBe(initialEnergy - 30);
    });

    test('should have short cooldown at max rank', () => {
      arena.blue.maxAbility('Q');

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(700, 0),
      });

      const cooldown = arena.blue.getAbilityCooldown('Q');
      expect(cooldown).toBeLessThanOrEqual(4);
    });
  });

  describe('W - Shadow Shroud', () => {
    test('should grant stealth', () => {
      const result = arena.castAbility(arena.blue, 'W');
      expect(result.success).toBe(true);

      arena.tick();

      expect(arena.blue.hasEffect('vex_stealth')).toBe(true);
    });

    test('should grant movement speed buff', () => {
      const baseSpeed = arena.blue.getStats().movementSpeed;

      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.getStats().movementSpeed).toBeGreaterThan(baseSpeed);
    });

    test('stealth should expire after 1.5 seconds', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.hasEffect('vex_stealth')).toBe(true);

      // Tick past 1.5 seconds
      arena.tickFrames(60 * 2);

      expect(arena.blue.hasEffect('vex_stealth')).toBe(false);
    });

    test('energy cost should decrease with rank', () => {
      // Rank 1 cost: 50
      const initialEnergy = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.resource).toBe(initialEnergy - 50);

      // Max rank cost: 30
      arena.blue.setResource(arena.blue.maxResource);
      arena.blue.resetCooldowns();
      arena.blue.maxAbility('W');

      const newEnergy = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.resource).toBe(newEnergy - 30);
    });
  });

  describe('E - Shadow Step', () => {
    test('should dash to target location', () => {
      const startPos = arena.blue.position.clone();

      const result = arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });

      expect(result.success).toBe(true);

      arena.tickFrames(20);

      expect(arena.blue.position.distanceTo(startPos)).toBeGreaterThan(100);
    });

    test('should have fixed energy cost (40)', () => {
      const initialEnergy = arena.blue.resource;

      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });

      expect(arena.blue.resource).toBe(initialEnergy - 40);
    });

    test('cooldown should decrease with rank', () => {
      // Rank 1: 14s
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });
      expect(arena.blue.getAbilityCooldown('E')).toBeGreaterThanOrEqual(12);

      // Max rank: 6s
      arena.blue.resetCooldowns();
      arena.blue.maxAbility('E');
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });
      expect(arena.blue.getAbilityCooldown('E')).toBeLessThanOrEqual(8);
    });
  });

  describe('R - Death Mark', () => {
    test('should mark enemy champion', () => {
      arena.red.position.x = 200; // Within 400 range

      const result = arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      expect(result.success).toBe(true);

      arena.tick();

      expect(arena.red.hasEffect('vex_death_mark')).toBe(true);
    });

    test('should deal damage after mark detonates', () => {
      arena.red.position.x = 200;
      const initialHealth = arena.red.health;

      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      // Tick for 2+ seconds to detonate
      arena.tickFrames(60 * 2.5);

      expect(arena.red.health).toBeLessThan(initialHealth);
    });

    test('should have no energy cost (0)', () => {
      arena.red.position.x = 200;
      const initialEnergy = arena.blue.resource;

      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      expect(arena.blue.resource).toBe(initialEnergy);
    });

    test('should have moderate cooldown at max rank (60s)', () => {
      arena.red.position.x = 200;
      arena.blue.maxAbility('R');

      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBeLessThanOrEqual(70);
    });
  });

  describe('Assassination Combo', () => {
    test('should be able to execute full combo: Q > E > R', () => {
      arena.red.position.x = 500;
      const initialHealth = arena.red.health;

      // Q - Mark target from range
      arena.castAbility(arena.blue, 'Q', {
        targetPosition: arena.red.position.clone(),
      });
      arena.tickFrames(30);

      // Verify mark landed
      expect(arena.red.hasEffect('vex_mark')).toBe(true);

      // E - Dash in
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(400, 0),
      });
      arena.tickFrames(20);

      // R - Execute
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });
      arena.tickFrames(60 * 2.5);

      // Should have dealt significant damage
      const damageTaken = initialHealth - arena.red.health;
      expect(damageTaken).toBeGreaterThan(150);
    });

    test('should be able to use W for safe engage', () => {
      arena.red.position.x = 400;

      // W - Stealth approach
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.hasEffect('vex_stealth')).toBe(true);

      // Simulate movement during stealth
      arena.blue.position.x = 200;

      // Q from close range
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'Q', {
        targetPosition: arena.red.position.clone(),
      });

      arena.tickFrames(10);
      expect(arena.red.health).toBeLessThan(arena.red.maxHealth);
    });
  });

  describe('Energy Management', () => {
    test('should be able to cast multiple abilities quickly', () => {
      // Energy pool: 260
      // Q: 30, W: 50, E: 40, R: 0

      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(500, 0) });
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'W');
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(300, 0) });
      arena.blue.resetCooldowns();

      arena.red.position.x = 200;
      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      // Total: 30 + 50 + 40 + 0 = 120 energy used
      expect(arena.blue.resource).toBe(260 - 120);
    });
  });
});
