/**
 * Magnus Champion Tests
 *
 * Tests for Magnus - a ranged mage with burst damage.
 * Abilities:
 * - Q: Fireball - Skillshot projectile
 * - W: Arcane Barrier - Self shield
 * - E: Blink - Teleport
 * - R: Meteor Strike - Delayed AoE damage
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Vector } from '@siege/shared';
import {
  createTestArena,
  TestArena,
  calculateMagicDamage,
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

    test('should deal magic damage on hit', () => {
      const initialHealth = arena.red.health;

      // Position red in line with fireball
      arena.red.position.x = 400;
      arena.red.position.y = 0;

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(900, 0),
      });

      // Tick to allow projectile to travel and hit
      arena.tickFrames(30);

      expect(arena.red.health).toBeLessThan(initialHealth);
    });

    test('should have correct mana cost at rank 1 (60)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(900, 0),
      });

      expect(arena.blue.resource).toBe(initialMana - 60);
    });

    test('should not hit allies', () => {
      // Add an allied minion in the path
      const ally = arena.addMinion(0, new Vector(200, 0)); // Blue team minion
      const allyHealth = ally.health;

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(900, 0),
      });

      arena.tickFrames(30);

      // Ally should not be damaged
      expect(ally.health).toBe(allyHealth);
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

    test('should have higher mana cost than warrior shield (80)', () => {
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

  describe('E - Blink', () => {
    test('should teleport to target location', () => {
      const targetPos = new Vector(300, 100);

      const result = arena.castAbility(arena.blue, 'E', {
        targetPosition: targetPos,
      });

      expect(result.success).toBe(true);

      arena.tick();

      // Should be at or near the target position
      const distance = arena.blue.position.distanceTo(targetPos);
      expect(distance).toBeLessThan(50); // Allow some tolerance
    });

    test('should have high mana cost at rank 1 (90)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 100),
      });

      expect(arena.blue.resource).toBe(initialMana - 90);
    });

    test('should have long cooldown (22s at rank 1)', () => {
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(300, 100),
      });

      const cooldown = arena.blue.getAbilityCooldown('E');
      expect(cooldown).toBeGreaterThanOrEqual(20);
    });

    test('should not teleport beyond max range', () => {
      const startPos = arena.blue.position.clone();
      const farTarget = new Vector(1000, 0); // Beyond 450 range

      arena.castAbility(arena.blue, 'E', {
        targetPosition: farTarget,
      });

      arena.tick();

      // Should have teleported, but not to the full distance
      const distanceTraveled = arena.blue.position.distanceTo(startPos);
      expect(distanceTraveled).toBeLessThanOrEqual(500); // Max range + tolerance
    });
  });

  describe('R - Meteor Strike', () => {
    test('should have a delay before damage', () => {
      const initialHealth = arena.red.health;

      // Position red in the impact zone
      arena.red.position.x = 300;
      arena.red.position.y = 0;

      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
      });

      // Immediately after cast, no damage yet
      arena.tick();
      expect(arena.red.health).toBe(initialHealth);

      // After delay (1 second), damage should apply
      arena.tickFrames(60 * 1.5);
      expect(arena.red.health).toBeLessThan(initialHealth);
    });

    test('should deal AoE damage', () => {
      // Position multiple enemies in the impact zone
      arena.red.position.x = 300;
      arena.red.position.y = 0;

      const minion1 = arena.addMinion(1, new Vector(320, 50));
      const minion2 = arena.addMinion(1, new Vector(280, -50));

      const redHealth = arena.red.health;
      const minion1Health = minion1.health;
      const minion2Health = minion2.health;

      arena.castAbility(arena.blue, 'R', {
        targetPosition: new Vector(300, 0),
      });

      // Wait for meteor to land
      arena.tickFrames(90);

      // All enemies in range should take damage
      expect(arena.red.health).toBeLessThan(redHealth);
      expect(minion1.health).toBeLessThan(minion1Health);
      expect(minion2.health).toBeLessThan(minion2Health);
    });

    test('should deal massive damage (200 base at rank 1)', () => {
      const initialHealth = arena.red.health;

      arena.red.position.x = 300;

      arena.castAbility(arena.blue, 'R', {
        targetPosition: arena.red.position.clone(),
      });

      arena.tickFrames(90);

      const damageTaken = initialHealth - arena.red.health;
      // After magic resist reduction, should still be significant
      expect(damageTaken).toBeGreaterThan(100);
    });

    test('should have very long cooldown (120s)', () => {
      arena.castAbility(arena.blue, 'R', {
        targetPosition: new Vector(300, 0),
      });

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Combo Patterns', () => {
    test('should be able to blink and then burst', () => {
      // Start far away
      arena.red.position.x = 600;

      // Blink into range
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(400, 0),
      });
      arena.tick();

      // Reset cooldowns for combo test
      arena.blue.resetCooldowns();

      // Fire Q
      const initialHealth = arena.red.health;
      arena.castAbility(arena.blue, 'Q', {
        targetPosition: arena.red.position.clone(),
      });

      arena.tickFrames(30);

      expect(arena.red.health).toBeLessThan(initialHealth);
    });
  });

  describe('Mana Management', () => {
    test('should go OOM after several ability casts', () => {
      // Q costs 60, W costs 80, E costs 90, R costs 100
      // Total mana: 375

      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(500, 0) });
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'W');
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(300, 0) });
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(400, 0) });

      // 60 + 80 + 90 + 100 = 330 mana used
      expect(arena.blue.resource).toBe(375 - 330);

      // Try to cast Q again - should fail (only 45 mana left, Q costs 60)
      arena.blue.resetCooldowns();
      const result = arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(500, 0) });
      expect(result.success).toBe(false);
      expect(result.failReason).toBe('not_enough_mana');
    });
  });
});
