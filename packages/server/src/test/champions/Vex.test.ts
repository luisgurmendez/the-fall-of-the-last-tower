/**
 * Vex Champion Tests
 *
 * Tests for Vex - a melee assassin with high burst and mobility.
 * Abilities:
 * - Q: Shadow Shuriken - Skillshot that marks targets
 * - W: Shadow Shroud - Stealth and speed buff
 * - E: Shadow Step - Dash
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

  // Default arena with abilities learned (for ability tests)
  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'vex',
      redChampion: 'magnus',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(300, 0),
    });
  });

  describe('Base Stats', () => {
    // Base stat tests need level 1 (learnAbilities sets level to 6)
    let level1Arena: TestArena;

    beforeEach(() => {
      level1Arena = createTestArena({
        blueChampion: 'vex',
        redChampion: 'magnus',
        bluePosition: new Vector(0, 0),
        redPosition: new Vector(300, 0),
        learnAbilities: false, // Keep level 1 for base stat tests
      });
    });

    test('should have moderate health (520)', () => {
      expect(level1Arena.blue.maxHealth).toBe(520);
    });

    test('should have melee attack range (125)', () => {
      expect(level1Arena.blue.getStats().attackRange).toBe(125);
    });

    test('should have high base attack damage (65)', () => {
      expect(level1Arena.blue.getStats().attackDamage).toBe(65);
    });

    test('should have high movement speed (350)', () => {
      expect(level1Arena.blue.getStats().movementSpeed).toBe(350);
    });

    test('should use energy (260 resource)', () => {
      expect(level1Arena.blue.maxResource).toBe(260);
      expect(level1Arena.blue.definition.resourceType).toBe('energy');
    });
  });

  describe('Q - Shadow Shuriken', () => {
    test('should fire a projectile', () => {
      const result = arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(700, 0),
      });

      expect(result.success).toBe(true);
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
    test('should cast successfully', () => {
      const result = arena.castAbility(arena.blue, 'W');
      expect(result.success).toBe(true);
    });

    test('should have correct energy cost at rank 1 (50)', () => {
      const initialEnergy = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.resource).toBe(initialEnergy - 50);
    });

    test('energy cost should decrease with rank', () => {
      arena.blue.maxAbility('W');
      arena.blue.resetCooldowns();

      const initialEnergy = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.resource).toBe(initialEnergy - 30);
    });

    test('should apply stealth effect', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.hasEffect('vex_stealth')).toBe(true);
    });

    test('should apply speed buff', () => {
      const baseSpeed = arena.blue.getStats().movementSpeed;

      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.getStats().movementSpeed).toBeGreaterThan(baseSpeed);
    });
  });

  describe('E - Shadow Step', () => {
    test('should cast successfully', () => {
      const result = arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(200, 0),
      });

      expect(result.success).toBe(true);
    });

    test('should have fixed energy cost (40)', () => {
      const initialEnergy = arena.blue.resource;

      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(200, 0),
      });

      expect(arena.blue.resource).toBe(initialEnergy - 40);
    });

    test('cooldown should decrease with rank', () => {
      // Rank 1: 14s
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(200, 0),
      });
      expect(arena.blue.getAbilityCooldown('E')).toBeGreaterThanOrEqual(12);

      // Max rank: 6s
      arena.blue.resetCooldowns();
      arena.blue.maxAbility('E');
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(200, 0),
      });
      expect(arena.blue.getAbilityCooldown('E')).toBeLessThanOrEqual(8);
    });

    test('should apply empowered attack buff', () => {
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(200, 0),
      });
      arena.tick();

      expect(arena.blue.hasEffect('vex_empowered')).toBe(true);
    });
  });

  describe('R - Death Mark', () => {
    test('should cast on enemy champion', () => {
      const result = arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      expect(result.success).toBe(true);
    });

    test('should have no energy cost (0)', () => {
      const initialEnergy = arena.blue.resource;

      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      expect(arena.blue.resource).toBe(initialEnergy);
    });

    test('should have long cooldown at rank 1 (100s)', () => {
      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBe(100);
    });

    test('cooldown should decrease at max rank (60s)', () => {
      arena.blue.maxAbility('R');

      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBe(60);
    });

    test('should apply death mark effect to target', () => {
      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });
      arena.tick();

      expect(arena.red.hasEffect('vex_death_mark')).toBe(true);
    });
  });

  describe('Energy Management', () => {
    test('should be able to cast Q, W, E, R with base energy', () => {
      // Energy pool: 260
      // Q: 30, W: 50, E: 40, R: 0

      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(500, 0) });
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'W');
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(200, 0) });
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
        targetId: arena.red.id,
      });

      // Total: 30 + 50 + 40 + 0 = 120 energy used
      expect(arena.blue.resource).toBe(260 - 120);
    });
  });
});
