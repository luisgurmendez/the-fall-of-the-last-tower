/**
 * Magnus Champion Tests
 *
 * Tests for Magnus - a ranged mage with burst damage and zone control.
 * Abilities:
 * - Q: Fireball - Skillshot projectile that deals magic damage
 * - W: Arcane Barrier - Self shield that scales with AP
 * - E: Quagmire - Ground target zone that slows enemies
 * - R: Inferno Zone - Ground target zone that deals DoT magic damage
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Vector } from '@siege/shared';
import {
  createTestArena,
  TestArena,
} from '../ServerTestUtils';

describe('Magnus', () => {
  let arena: TestArena;

  // Default arena with abilities learned (for ability tests)
  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'magnus',
      redChampion: 'warrior',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(400, 0),
    });
  });

  describe('Base Stats', () => {
    // Base stat tests need level 1 (learnAbilities sets level to 6)
    let level1Arena: TestArena;

    beforeEach(() => {
      level1Arena = createTestArena({
        blueChampion: 'magnus',
        redChampion: 'warrior',
        bluePosition: new Vector(0, 0),
        redPosition: new Vector(400, 0),
        learnAbilities: false, // Keep level 1 for base stat tests
      });
    });

    test('should have correct base health (425)', () => {
      expect(level1Arena.blue.maxHealth).toBe(425);
    });

    test('should have ranged attack range (550)', () => {
      expect(level1Arena.blue.getStats().attackRange).toBe(550);
    });

    test('should have low base armor (20)', () => {
      expect(level1Arena.blue.getStats().armor).toBe(20);
    });

    test('should have high base mana (375)', () => {
      expect(level1Arena.blue.maxResource).toBe(375);
    });

    test('should have high mana regen (12)', () => {
      // This is set in champion definition
      expect(level1Arena.blue.definition.baseStats.resourceRegen).toBe(12);
    });
  });

  describe('Q - Fireball', () => {
    test('should fire a projectile', () => {
      const result = arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(900, 0),
      });

      expect(result.success).toBe(true);
    });

    test('should have correct mana cost at rank 1 (60)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(900, 0),
      });

      expect(arena.blue.resource).toBe(initialMana - 60);
    });
  });

  describe('W - Arcane Barrier', () => {
    test('should grant a shield', () => {
      expect(arena.blue.getTotalShieldAmount()).toBe(0);

      const result = arena.castAbility(arena.blue, 'W');
      expect(result.success).toBe(true);

      arena.tick();

      expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
    });

    test('should have correct mana cost at rank 1 (80)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'W');

      expect(arena.blue.resource).toBe(initialMana - 80);
    });

    test('shield should last 4 seconds', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);

      // Tick for 3.5 seconds - should still have shield
      arena.tickFrames(60 * 3.5);
      expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);

      // Tick past 4 seconds - shield should expire
      arena.tickFrames(60 * 1);
      expect(arena.blue.getTotalShieldAmount()).toBe(0);
    });

    test('shield should scale with AP', () => {
      // Add AP item
      arena.blue.items[0] = {
        definitionId: 'amplifying_tome', // +20 AP
        slot: 0,
        passiveCooldowns: {},
        nextIntervalTick: {},
      };

      arena.castAbility(arena.blue, 'W');
      arena.tick();

      const shieldWithAP = arena.blue.getTotalShieldAmount();

      // Reset and cast without AP
      const arena2 = createTestArena({
        blueChampion: 'magnus',
        redChampion: 'warrior',
      });
      arena2.castAbility(arena2.blue, 'W');
      arena2.tick();

      const shieldWithoutAP = arena2.blue.getTotalShieldAmount();

      // Shield with AP should be larger
      expect(shieldWithAP).toBeGreaterThan(shieldWithoutAP);
    });
  });

  describe('E - Quagmire', () => {
    test('should cast at target location', () => {
      const result = arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });

      expect(result.success).toBe(true);
    });

    test('should have correct mana cost at rank 1 (70)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });

      expect(arena.blue.resource).toBe(initialMana - 70);
    });

    test('should have medium cooldown (14s at rank 1)', () => {
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 0),
      });

      const cooldown = arena.blue.getAbilityCooldown('E');
      expect(cooldown).toBe(14);
    });
  });

  describe('R - Inferno Zone', () => {
    test('should cast at target location', () => {
      const result = arena.castAbility(arena.blue, 'R', {
        targetPosition: new Vector(300, 0),
      });

      expect(result.success).toBe(true);
    });

    test('should have correct mana cost (100)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'R', {
        targetPosition: new Vector(300, 0),
      });

      expect(arena.blue.resource).toBe(initialMana - 100);
    });

    test('should have very long cooldown (120s at rank 1)', () => {
      arena.castAbility(arena.blue, 'R', {
        targetPosition: new Vector(300, 0),
      });

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBe(120);
    });
  });

  describe('Mana Management', () => {
    test('should have enough mana to cast all abilities once', () => {
      // Q costs 60, W costs 80, E costs 70, R costs 100
      // Total: 310 mana needed, Magnus has 375 base

      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(500, 0) });
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'W');
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(300, 0) });
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(400, 0) });

      // 60 + 80 + 70 + 100 = 310 mana used
      expect(arena.blue.resource).toBe(375 - 310);
    });
  });
});
