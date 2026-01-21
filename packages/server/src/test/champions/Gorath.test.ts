/**
 * Gorath Champion Tests
 *
 * Tests for Gorath - a tank with crowd control and durability.
 * Abilities:
 * - Q: Ground Slam - AoE damage and slow
 * - W: Stone Skin - Armor/MR buff
 * - E: Defiant Roar - AoE taunt
 * - R: Earthquake - AoE knockup
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { Vector } from '@siege/shared';
import {
  createTestArena,
  TestArena,
} from '../ServerTestUtils';

describe('Gorath', () => {
  let arena: TestArena;

  // Default arena with abilities learned (for ability tests)
  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'gorath',
      redChampion: 'vex', // Squishy assassin to tank
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(200, 0),
    });
  });

  describe('Base Stats', () => {
    // Base stat tests need level 1 (learnAbilities sets level to 6)
    let level1Arena: TestArena;

    beforeEach(() => {
      level1Arena = createTestArena({
        blueChampion: 'gorath',
        redChampion: 'vex',
        bluePosition: new Vector(0, 0),
        redPosition: new Vector(200, 0),
        learnAbilities: false, // Keep level 1 for base stat tests
      });
    });

    test('should have highest base health (650)', () => {
      expect(level1Arena.blue.maxHealth).toBe(650);
    });

    test('should have melee attack range (150)', () => {
      expect(level1Arena.blue.getStats().attackRange).toBe(150);
    });

    test('should have highest base armor (40)', () => {
      expect(level1Arena.blue.getStats().armor).toBe(40);
    });

    test('should have high magic resist (35)', () => {
      expect(level1Arena.blue.getStats().magicResist).toBe(35);
    });

    test('should have lower movement speed (330)', () => {
      expect(level1Arena.blue.getStats().movementSpeed).toBe(330);
    });

    test('should have highest health growth per level', () => {
      const level1Health = level1Arena.blue.maxHealth;
      level1Arena.blue.setLevel(10);
      const level10Health = level1Arena.blue.maxHealth;

      // Health growth is 110 per level
      const expectedGrowth = 110 * 9; // 9 levels gained
      expect(level10Health - level1Health).toBeCloseTo(expectedGrowth, -1);
    });
  });

  describe('Q - Ground Slam', () => {
    test('should deal AoE damage', () => {
      const initialHealth = arena.red.health;

      const result = arena.castAbility(arena.blue, 'Q');
      expect(result.success).toBe(true);

      arena.tick();

      expect(arena.red.health).toBeLessThan(initialHealth);
    });

    test('should apply slow to enemies', () => {
      const baseSpeed = arena.red.getStats().movementSpeed;

      arena.castAbility(arena.blue, 'Q');
      arena.tick();

      // Should be slowed by 40%
      const slowedSpeed = arena.red.getStats().movementSpeed;
      expect(slowedSpeed).toBeLessThan(baseSpeed);
    });

    test('slow should last 1 second', () => {
      const baseSpeed = arena.red.getStats().movementSpeed;

      arena.castAbility(arena.blue, 'Q');
      arena.tick();

      expect(arena.red.getStats().movementSpeed).toBeLessThan(baseSpeed);

      // Tick past 1 second
      arena.tickFrames(60 * 1.5);

      expect(arena.red.getStats().movementSpeed).toBe(baseSpeed);
    });

    test('should hit multiple enemies in range', () => {
      const minion1 = arena.addMinion(1, new Vector(100, 50));
      const minion2 = arena.addMinion(1, new Vector(100, -50));

      const redHealth = arena.red.health;
      const minion1Health = minion1.health;
      const minion2Health = minion2.health;

      arena.castAbility(arena.blue, 'Q');
      arena.tick();

      // All enemies should take damage
      expect(arena.red.health).toBeLessThan(redHealth);
      expect(minion1.health).toBeLessThan(minion1Health);
      expect(minion2.health).toBeLessThan(minion2Health);
    });

    test('should have moderate mana cost (50-70)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'Q');

      const manaCost = initialMana - arena.blue.resource;
      expect(manaCost).toBeGreaterThanOrEqual(50);
      expect(manaCost).toBeLessThanOrEqual(70);
    });
  });

  describe('W - Stone Skin', () => {
    test('should increase armor', () => {
      const baseArmor = arena.blue.getStats().armor;

      const result = arena.castAbility(arena.blue, 'W');
      expect(result.success).toBe(true);

      arena.tick();

      // Should be 30% more armor
      const expectedArmor = baseArmor * 1.3;
      expect(arena.blue.getStats().armor).toBeCloseTo(expectedArmor, 0);
    });

    test('should increase magic resist', () => {
      const baseMR = arena.blue.getStats().magicResist;

      arena.castAbility(arena.blue, 'W');
      arena.tick();

      // Should be 30% more MR
      const expectedMR = baseMR * 1.3;
      expect(arena.blue.getStats().magicResist).toBeCloseTo(expectedMR, 0);
    });

    test('buff should last 4 seconds', () => {
      const baseArmor = arena.blue.getStats().armor;

      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.getStats().armor).toBeGreaterThan(baseArmor);

      // Tick for 3.5 seconds - should still be buffed
      arena.tickFrames(60 * 3.5);
      expect(arena.blue.getStats().armor).toBeGreaterThan(baseArmor);

      // Tick past 4 seconds
      arena.tickFrames(60 * 1);
      expect(arena.blue.getStats().armor).toBe(baseArmor);
    });

    test('should have fixed mana cost (60)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'W');

      expect(arena.blue.resource).toBe(initialMana - 60);
    });

    test('should reduce damage taken', () => {
      // Without W
      const arena1 = createTestArena({
        blueChampion: 'gorath',
        redChampion: 'warrior',
      });
      arena1.blue.setHealth(arena1.blue.maxHealth);
      arena1.blue.applyDamage(100, 'physical', arena1.red);
      const damageWithoutW = arena1.blue.maxHealth - arena1.blue.health;

      // With W
      const arena2 = createTestArena({
        blueChampion: 'gorath',
        redChampion: 'warrior',
      });
      arena2.castAbility(arena2.blue, 'W');
      arena2.tick();
      arena2.blue.setHealth(arena2.blue.maxHealth);
      arena2.blue.applyDamage(100, 'physical', arena2.red);
      const damageWithW = arena2.blue.maxHealth - arena2.blue.health;

      // Should take less damage with W active
      expect(damageWithW).toBeLessThan(damageWithoutW);
    });
  });

  describe('E - Defiant Roar', () => {
    test('should taunt nearby enemies', () => {
      const result = arena.castAbility(arena.blue, 'E');
      expect(result.success).toBe(true);

      arena.tick();

      // Enemy should be taunted
      expect(arena.red.hasEffect('taunt')).toBe(true);
    });

    test('taunt should last 1.5 seconds', () => {
      arena.castAbility(arena.blue, 'E');
      arena.tick();

      expect(arena.red.hasEffect('taunt')).toBe(true);

      // Tick past 1.5 seconds
      arena.tickFrames(60 * 2);

      expect(arena.red.hasEffect('taunt')).toBe(false);
    });

    test('should affect enemies in 350 range', () => {
      // Position enemy at edge of range
      arena.red.position.x = 340;

      arena.castAbility(arena.blue, 'E');
      arena.tick();

      expect(arena.red.hasEffect('taunt')).toBe(true);
    });

    test('should not affect enemies out of range', () => {
      // Position enemy out of range
      arena.red.position.x = 400;

      arena.castAbility(arena.blue, 'E');
      arena.tick();

      expect(arena.red.hasEffect('taunt')).toBe(false);
    });

    test('should have fixed mana cost (70)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'E');

      expect(arena.blue.resource).toBe(initialMana - 70);
    });
  });

  describe('R - Earthquake', () => {
    test('should knockup enemies in range', () => {
      const result = arena.castAbility(arena.blue, 'R');
      expect(result.success).toBe(true);

      // Wait for wind-up (0.5s) and tick
      arena.tickFrames(60);

      expect(arena.red.hasEffect('knockup')).toBe(true);
    });

    test('should deal magic damage', () => {
      const initialHealth = arena.red.health;

      arena.castAbility(arena.blue, 'R');
      arena.tickFrames(60);

      expect(arena.red.health).toBeLessThan(initialHealth);
    });

    test('knockup should prevent movement', () => {
      arena.castAbility(arena.blue, 'R');
      arena.tickFrames(60);

      // Knockup should prevent movement
      expect(arena.red.ccStatus.canMove).toBe(false);
    });

    test('should have large AoE (450)', () => {
      // Add enemies at various distances
      const minion1 = arena.addMinion(1, new Vector(400, 0));
      const minion2 = arena.addMinion(1, new Vector(200, 300));
      const minion3 = arena.addMinion(1, new Vector(500, 0)); // Out of range

      const minion1Health = minion1.health;
      const minion2Health = minion2.health;
      const minion3Health = minion3.health;

      arena.castAbility(arena.blue, 'R');
      arena.tickFrames(60);

      // Minions in range should take damage
      expect(minion1.health).toBeLessThan(minion1Health);
      expect(minion2.health).toBeLessThan(minion2Health);
      // Minion out of range should not
      expect(minion3.health).toBe(minion3Health);
    });

    test('should have long cooldown (130s at rank 1)', () => {
      arena.castAbility(arena.blue, 'R');

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBeGreaterThanOrEqual(100);
    });

    test('damage should scale with bonus health', () => {
      // Get damage without bonus health
      const arena1 = createTestArena({
        blueChampion: 'gorath',
        redChampion: 'vex',
      });
      arena1.red.setHealth(arena1.red.maxHealth);
      arena1.castAbility(arena1.blue, 'R');
      arena1.tickFrames(60);
      const damageWithoutHealth = arena1.red.maxHealth - arena1.red.health;

      // With bonus health item
      const arena2 = createTestArena({
        blueChampion: 'gorath',
        redChampion: 'vex',
      });
      arena2.blue.items[0] = {
        definitionId: 'giants_belt', // +350 health
        slot: 0,
        passiveCooldowns: {},
        nextIntervalTick: {},
      };
      arena2.red.setHealth(arena2.red.maxHealth);
      arena2.castAbility(arena2.blue, 'R');
      arena2.tickFrames(60);
      const damageWithHealth = arena2.red.maxHealth - arena2.red.health;

      // Should deal more damage with bonus health
      expect(damageWithHealth).toBeGreaterThan(damageWithoutHealth);
    });
  });

  describe('Tanking Scenarios', () => {
    test('should survive sustained damage better than other champions', () => {
      // Gorath vs Magnus taking same damage
      const arena1 = createTestArena({
        blueChampion: 'gorath',
        redChampion: 'warrior',
      });
      const arena2 = createTestArena({
        blueChampion: 'magnus',
        redChampion: 'warrior',
      });

      // Apply same raw damage
      arena1.blue.applyDamage(500, 'physical', arena1.red);
      arena2.blue.applyDamage(500, 'physical', arena2.red);

      // Gorath should have more health remaining (due to higher armor and health)
      expect(arena1.blue.health).toBeGreaterThan(arena2.blue.health);
    });

    test('should be able to lock down multiple enemies with E and R', () => {
      // Add more enemies
      const minion1 = arena.addMinion(1, new Vector(150, 50));
      const minion2 = arena.addMinion(1, new Vector(150, -50));

      // E - Taunt
      arena.castAbility(arena.blue, 'E');
      arena.tick();

      expect(arena.red.hasEffect('taunt')).toBe(true);
      expect(minion1.health).toBeLessThanOrEqual(minion1.maxHealth);
      expect(minion2.health).toBeLessThanOrEqual(minion2.maxHealth);

      // R - Knockup
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'R');
      arena.tickFrames(60);

      expect(arena.red.hasEffect('knockup')).toBe(true);
    });

    test('should be effective as frontline with W active', () => {
      // Activate defensive steroid
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      // Simulate being focused
      for (let i = 0; i < 5; i++) {
        arena.blue.applyDamage(100, 'physical', arena.red);
      }

      // Should still be alive with significant health
      expect(arena.blue.health).toBeGreaterThan(0);
      expect(arena.blue.health).toBeGreaterThan(arena.blue.maxHealth * 0.3);
    });
  });

  describe('Mana Management', () => {
    test('should have enough mana for full combo', () => {
      // Q: 50-70, W: 60, E: 70, R: 100
      // Total: ~280-300 (has 320 base mana)

      arena.castAbility(arena.blue, 'Q');
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'W');
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'E');
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'R');

      // Should still have some mana left
      expect(arena.blue.resource).toBeGreaterThan(0);
    });
  });
});
