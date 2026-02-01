/**
 * Vex Champion Tests
 *
 * Tests for Vex - a melee assassin with high burst and mobility.
 * Abilities:
 * - Q: Shadow Shuriken - Skillshot that marks targets
 * - W: Shadow Shroud - Stealth and speed buff
 * - E: Shadow Step - Dash
 * - R: Ninja Mode - Attack speed buff with CDR for Q and E
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
    // Note: GameConfig.DEBUG.STARTING_LEVEL is 6, so stats reflect level 6 scaling
    // Base: health=520, resource=260, attackDamage=65
    // Growth per level: health=80, resource=35, attackDamage=4
    // At level 6: health=920, resource=435, attackDamage=85
    let statsArena: TestArena;

    beforeEach(() => {
      statsArena = createTestArena({
        blueChampion: 'vex',
        redChampion: 'magnus',
        bluePosition: new Vector(0, 0),
        redPosition: new Vector(300, 0),
        learnAbilities: false,
      });
    });

    test('should have level 6 health (920 = 520 + 5*80)', () => {
      expect(statsArena.blue.maxHealth).toBe(920);
    });

    test('should have melee attack range (125)', () => {
      expect(statsArena.blue.getStats().attackRange).toBe(125);
    });

    test('should have level 6 attack damage (85 = 65 + 5*4)', () => {
      expect(statsArena.blue.getStats().attackDamage).toBe(85);
    });

    test('should use energy (resourceType)', () => {
      expect(statsArena.blue.definition.resourceType).toBe('energy');
    });

    test('should have level 6 resource (435 = 260 + 5*35)', () => {
      expect(statsArena.blue.maxResource).toBe(435);
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

  describe('R - Ninja Mode', () => {
    test('should cast successfully (self-target)', () => {
      const result = arena.castAbility(arena.blue, 'R');

      expect(result.success).toBe(true);
    });

    test('should have no energy cost (0)', () => {
      const initialEnergy = arena.blue.resource;

      arena.castAbility(arena.blue, 'R');

      expect(arena.blue.resource).toBe(initialEnergy);
    });

    test('should have long cooldown at rank 1 (100s)', () => {
      arena.castAbility(arena.blue, 'R');

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBe(100);
    });

    test('cooldown should decrease at max rank (60s)', () => {
      arena.blue.maxAbility('R');

      arena.castAbility(arena.blue, 'R');

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBe(60);
    });

    test('should apply ninja mode effect to self', () => {
      arena.castAbility(arena.blue, 'R');
      arena.tick();

      expect(arena.blue.hasEffect('vex_ninja_mode')).toBe(true);
    });

    test('should enable ninja mode state', () => {
      arena.castAbility(arena.blue, 'R');
      arena.tick();

      expect(arena.blue.isInNinjaMode()).toBe(true);
    });

    test('should increase attack speed', () => {
      const baseAttackSpeed = arena.blue.getStats().attackSpeed;

      arena.castAbility(arena.blue, 'R');
      arena.tick();

      const buffedAttackSpeed = arena.blue.getStats().attackSpeed;
      expect(buffedAttackSpeed).toBeGreaterThan(baseAttackSpeed);
    });

    test('should apply 30% attack speed bonus at rank 1', () => {
      const baseAttackSpeed = arena.blue.getStats().attackSpeed;

      arena.castAbility(arena.blue, 'R');
      arena.tick();

      const buffedAttackSpeed = arena.blue.getStats().attackSpeed;
      // 30% bonus at rank 1
      const expectedMinBonus = baseAttackSpeed * 1.25; // Allow some tolerance
      expect(buffedAttackSpeed).toBeGreaterThanOrEqual(expectedMinBonus);
    });

    test('should reduce Q cooldown by 50% when cast during Ninja Mode (upfront CDR)', () => {
      // Get base Q cooldown by casting without Ninja Mode
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(700, 0) });
      const baseCooldown = arena.blue.getAbilityCooldown('Q');
      expect(baseCooldown).toBeGreaterThan(0);

      // Reset and activate Ninja Mode first
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'R');
      arena.tick();
      expect(arena.blue.isInNinjaMode()).toBe(true);

      // Now cast Q while in Ninja Mode - should have 50% reduced cooldown
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(700, 0) });
      const reducedCooldown = arena.blue.getAbilityCooldown('Q');

      // Cooldown should be ~50% of base
      expect(reducedCooldown).toBeCloseTo(baseCooldown * 0.5, 1);
    });

    test('should reduce E cooldown by 50% when cast during Ninja Mode (upfront CDR)', () => {
      // Get base E cooldown by casting without Ninja Mode
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(200, 0) });
      const baseCooldown = arena.blue.getAbilityCooldown('E');
      expect(baseCooldown).toBeGreaterThan(0);

      // Reset and activate Ninja Mode first
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'R');
      arena.tick();
      expect(arena.blue.isInNinjaMode()).toBe(true);

      // Now cast E while in Ninja Mode - should have 50% reduced cooldown
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(200, 0) });
      const reducedCooldown = arena.blue.getAbilityCooldown('E');

      // Cooldown should be ~50% of base
      expect(reducedCooldown).toBeCloseTo(baseCooldown * 0.5, 1);
    });

    test('should NOT reduce W cooldown even when cast during Ninja Mode (only Q and E get CDR)', () => {
      // Get base W cooldown by casting without Ninja Mode
      arena.castAbility(arena.blue, 'W');
      const baseCooldown = arena.blue.getAbilityCooldown('W');
      expect(baseCooldown).toBeGreaterThan(0);

      // Reset and activate Ninja Mode first
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'R');
      arena.tick();
      expect(arena.blue.isInNinjaMode()).toBe(true);

      // Now cast W while in Ninja Mode - should have same cooldown (no CDR for W)
      arena.castAbility(arena.blue, 'W');
      const cooldownDuringNinjaMode = arena.blue.getAbilityCooldown('W');

      // W cooldown should be the same (no reduction)
      expect(cooldownDuringNinjaMode).toBeCloseTo(baseCooldown, 1);
    });

    test('should deactivate when duration expires', () => {
      arena.castAbility(arena.blue, 'R');
      arena.tick();
      expect(arena.blue.isInNinjaMode()).toBe(true);

      // Fast forward 15 seconds (tick uses dt=1/60, so 60 ticks per second)
      for (let i = 0; i < 15 * 60; i++) {
        arena.tick();
      }

      expect(arena.blue.isInNinjaMode()).toBe(false);
      expect(arena.blue.hasEffect('vex_ninja_mode')).toBe(false);
    });
  });

  describe('Energy Management', () => {
    test('should be able to cast Q, W, E, R with starting energy', () => {
      // At level 6: Energy pool = 435 (260 base + 5*35 growth)
      // Q: 30, W: 50, E: 40, R: 0 (Ninja Mode)
      const startingEnergy = arena.blue.maxResource;

      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(500, 0) });
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'W');
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(200, 0) });
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'R'); // Ninja Mode is self-targeted

      // Total: 30 + 50 + 40 + 0 = 120 energy used
      expect(arena.blue.resource).toBe(startingEnergy - 120);
    });
  });
});
