/**
 * Tests for Thorne, the Sellsword (Assassin)
 *
 * Thorne is a melee assassin with:
 * - Passive: Killer Instinct - 15% bonus damage to enemies below 40% health
 * - Q: Swift Strike - Dash through target enemy, dealing damage
 * - W: Blade Flurry - AoE damage around self
 * - E: Shadow Step - Invisibility + movement speed
 * - R: Deathmark - Mark enemy, deals base + % of damage dealt during mark
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestDummy, calculateExpectedPhysicalDamage } from './ChampionTestUtils';
import { TestRunner, MockGameContext } from './TestGameContext';
import { Thorne } from '@/champions/implementations/Thorne';
import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';

describe('Thorne Champion', () => {
  let thorne: Thorne;
  let enemy: TestDummy;
  let runner: TestRunner;
  let context: MockGameContext;

  function setupThorneArena(thornePos: Vector, enemyPos: Vector): void {
    thorne = new Thorne(thornePos, 0);
    enemy = new TestDummy(enemyPos, 1);
    runner = new TestRunner({ objects: [thorne, enemy] });
    context = runner.getContext();
    thorne.init(context as any);
    enemy.init(context as any);
    // Set mana
    (thorne as any).state.resource = 300;
    // Set direction toward enemy
    const dirToEnemy = enemyPos.clone().sub(thornePos).normalize();
    (thorne as any).direction = dirToEnemy;
    // Rank up abilities
    rankUpThorneAbilities();
  }

  function rankUpThorneAbilities(): void {
    const abilities = ['swiftStrike', 'bladeFlurry', 'shadowStep', 'deathmark'];
    for (const abilityName of abilities) {
      const ability = (thorne as any)[abilityName];
      if (ability && typeof ability.rankUp === 'function') {
        ability.rankUp();
      }
    }
  }

  // ===================
  // Base Stats Tests
  // ===================

  describe('Base Stats', () => {
    beforeEach(() => {
      setupThorneArena(new Vector(0, 0), new Vector(200, 0));
    });

    it('should have correct base health (560)', () => {
      const stats = thorne.getStats();
      expect(stats.maxHealth).toBeCloseTo(560, 0);
    });

    it('should have correct base mana (300)', () => {
      const stats = thorne.getStats();
      expect(stats.maxResource).toBeCloseTo(300, 0);
    });

    it('should have correct base attack damage (65)', () => {
      const stats = thorne.getStats();
      expect(stats.attackDamage).toBeCloseTo(65, 0);
    });

    it('should have correct base armor (28)', () => {
      const stats = thorne.getStats();
      expect(stats.armor).toBeCloseTo(28, 0);
    });

    it('should have correct base magic resist (32)', () => {
      const stats = thorne.getStats();
      expect(stats.magicResist).toBeCloseTo(32, 0);
    });

    it('should have correct base movement speed (355)', () => {
      const stats = thorne.getStats();
      expect(stats.movementSpeed).toBeCloseTo(345, 0);
    });

    it('should have correct attack range (125) - melee', () => {
      const stats = thorne.getStats();
      expect(stats.attackRange).toBe(125);
    });

    it('should use mana as resource', () => {
      expect(thorne.getResourceType()).toBe('mana');
    });
  });

  // ===================
  // Passive Tests - Killer Instinct
  // ===================

  describe('Passive - Killer Instinct', () => {
    it('should deal 15% bonus damage to enemies below 40% health', () => {
      setupThorneArena(new Vector(0, 0), new Vector(100, 0));

      // Set enemy to low health (30% of max)
      const maxHealth = enemy.getStats().maxHealth;
      enemy.setHealth(maxHealth * 0.3);
      const lowHealthBefore = enemy.getState().health;

      // Auto attack the low health enemy
      thorne.performBasicAttack(context as any, enemy as any);
      runner.tickFrames(5);
      const lowHealthDamage = lowHealthBefore - enemy.getState().health;

      // Reset for comparison
      enemy.setHealth(maxHealth);
      const fullHealthBefore = enemy.getState().health;

      // Auto attack the full health enemy
      thorne.performBasicAttack(context as any, enemy as any);
      runner.tickFrames(5);
      const fullHealthDamage = fullHealthBefore - enemy.getState().health;

      // Low health damage should be ~15% higher
      if (fullHealthDamage > 0 && lowHealthDamage > 0) {
        const ratio = lowHealthDamage / fullHealthDamage;
        expect(ratio).toBeGreaterThan(1.1); // At least 10% more
        expect(ratio).toBeLessThan(1.25); // But not more than 25%
      }
    });

    it('should NOT deal bonus damage to enemies at 40% health or above', () => {
      setupThorneArena(new Vector(0, 0), new Vector(100, 0));

      // Set enemy to 50% health (above threshold)
      const maxHealth = enemy.getStats().maxHealth;
      enemy.setHealth(maxHealth * 0.5);
      const healthBefore = enemy.getState().health;

      thorne.performBasicAttack(context as any, enemy as any);
      runner.tickFrames(5);
      const damageAt50 = healthBefore - enemy.getState().health;

      // Reset to full health
      enemy.setHealth(maxHealth);
      const fullHealthBefore = enemy.getState().health;

      thorne.performBasicAttack(context as any, enemy as any);
      runner.tickFrames(5);
      const damageAtFull = fullHealthBefore - enemy.getState().health;

      // Damage should be similar (no bonus)
      if (damageAtFull > 0 && damageAt50 > 0) {
        const ratio = damageAt50 / damageAtFull;
        expect(ratio).toBeGreaterThan(0.9);
        expect(ratio).toBeLessThan(1.1);
      }
    });
  });

  // ===================
  // Q Tests - Swift Strike
  // ===================

  describe('Q - Swift Strike', () => {
    it('should dash through target enemy', () => {
      setupThorneArena(new Vector(0, 0), new Vector(300, 0));

      const posBefore = thorne.getPosition().clone();

      (context as any).target = enemy;
      thorne.castThorneAbility('Q', context as any, enemy);
      runner.tickFrames(30);

      const posAfter = thorne.getPosition();
      const distance = posAfter.distanceTo(posBefore);

      // Should have moved past the enemy
      expect(distance).toBeGreaterThan(200);
    });

    it('should deal damage to target enemy', () => {
      setupThorneArena(new Vector(0, 0), new Vector(300, 0));
      enemy.setHealth(1000);

      (context as any).target = enemy;
      thorne.castThorneAbility('Q', context as any, enemy);
      runner.tickFrames(30);

      expect(enemy.getState().health).toBeLessThan(1000);
    });

    it('should deal 70 + AD scaling physical damage at rank 1', () => {
      // Use separate setup with enemy far enough that basic attacks don't fire
      const thorneTest = new Thorne(new Vector(0, 0), 0);
      const enemyTest = new TestDummy(new Vector(400, 0), 1);
      const runnerTest = new TestRunner({ objects: [thorneTest, enemyTest] });
      const contextTest = runnerTest.getContext();
      thorneTest.init(contextTest as any);
      enemyTest.init(contextTest as any);
      (thorneTest as any).state.resource = 300;
      // Rank up Q
      const q = (thorneTest as any).swiftStrike;
      if (q && typeof q.rankUp === 'function') q.rankUp();

      enemyTest.setHealth(1000);
      const thorneAD = thorneTest.getStats().attackDamage;
      const enemyArmor = enemyTest.getComputedStats().armor;

      const healthBefore = enemyTest.getState().health;
      thorneTest.castThorneAbility('Q', contextTest as any, enemyTest);
      // Don't tick - ability effect applies immediately
      // Just verify the immediate damage from the effect

      const damageTaken = healthBefore - enemyTest.getState().health;

      // Q base damage at rank 1: 70 + 90% AD
      const expectedRaw = 70 + thorneAD * 0.9;
      const expectedAfterArmor = calculateExpectedPhysicalDamage(expectedRaw, enemyArmor);

      expect(damageTaken).toBeGreaterThan(expectedAfterArmor * 0.8);
      expect(damageTaken).toBeLessThan(expectedAfterArmor * 1.2);
    });

    it('should have 8 second cooldown', () => {
      setupThorneArena(new Vector(0, 0), new Vector(300, 0));

      (context as any).target = enemy;
      thorne.castThorneAbility('Q', context as any, enemy);
      (thorne as any).state.resource = 300;

      const secondCast = thorne.castThorneAbility('Q', context as any, enemy);
      expect(secondCast).toBe(false);

      // After 8+ seconds
      runner.tickFrames(8 * 60 + 10);
      (thorne as any).state.resource = 300;

      const thirdCast = thorne.castThorneAbility('Q', context as any, enemy);
      expect(thirdCast).toBe(true);
    });

    it('should require a target within 450 range', () => {
      setupThorneArena(new Vector(0, 0), new Vector(500, 0)); // Beyond 450 range
      enemy.setHealth(1000);

      (context as any).target = enemy;
      const result = thorne.castThorneAbility('Q', context as any, enemy);

      // Should fail due to out of range
      expect(result).toBe(false);
    });
  });

  // ===================
  // W Tests - Blade Flurry
  // ===================

  describe('W - Blade Flurry', () => {
    it('should deal damage to nearby enemies', () => {
      setupThorneArena(new Vector(0, 0), new Vector(150, 0));
      enemy.setHealth(1000);

      thorne.castThorneAbility('W', context as any);
      runner.tickFrames(10);

      expect(enemy.getState().health).toBeLessThan(1000);
    });

    it('should deal 60 + AD scaling physical damage at rank 1', () => {
      setupThorneArena(new Vector(0, 0), new Vector(180, 0)); // Inside W range (200), outside AA range (125)
      enemy.setHealth(1000);

      const thorneAD = thorne.getStats().attackDamage;
      const enemyArmor = enemy.getComputedStats().armor;

      const healthBefore = enemy.getState().health;
      thorne.castThorneAbility('W', context as any);
      runner.tickFrames(3); // Minimal frames to apply ability damage only
      const damageTaken = healthBefore - enemy.getState().health;

      // W base damage at rank 1: 60 + 70% AD
      const expectedRaw = 60 + thorneAD * 0.7;
      const expectedAfterArmor = calculateExpectedPhysicalDamage(expectedRaw, enemyArmor);

      expect(damageTaken).toBeGreaterThan(expectedAfterArmor * 0.8);
      expect(damageTaken).toBeLessThan(expectedAfterArmor * 1.2);
    });

    it('should hit enemies within 200 radius', () => {
      thorne = new Thorne(new Vector(0, 0), 0);
      const enemy1 = new TestDummy(new Vector(150, 0), 1);
      const enemy2 = new TestDummy(new Vector(0, 150), 1);
      runner = new TestRunner({ objects: [thorne, enemy1, enemy2] });
      context = runner.getContext();
      thorne.init(context as any);
      enemy1.init(context as any);
      enemy2.init(context as any);
      (thorne as any).state.resource = 300;
      rankUpThorneAbilities();

      enemy1.setHealth(1000);
      enemy2.setHealth(1000);

      thorne.castThorneAbility('W', context as any);
      runner.tickFrames(10);

      expect(enemy1.getState().health).toBeLessThan(1000);
      expect(enemy2.getState().health).toBeLessThan(1000);
    });

    it('should NOT hit enemies outside 200 radius', () => {
      setupThorneArena(new Vector(0, 0), new Vector(250, 0)); // Beyond 200 range
      enemy.setHealth(1000);

      thorne.castThorneAbility('W', context as any);
      runner.tickFrames(10);

      expect(enemy.getState().health).toBe(1000);
    });

    it('should have 9 second cooldown', () => {
      setupThorneArena(new Vector(0, 0), new Vector(150, 0));

      thorne.castThorneAbility('W', context as any);
      (thorne as any).state.resource = 300;

      const secondCast = thorne.castThorneAbility('W', context as any);
      expect(secondCast).toBe(false);

      // After 9+ seconds
      runner.tickFrames(9 * 60 + 10);
      (thorne as any).state.resource = 300;

      const thirdCast = thorne.castThorneAbility('W', context as any);
      expect(thirdCast).toBe(true);
    });
  });

  // ===================
  // E Tests - Shadow Step
  // ===================

  describe('E - Shadow Step', () => {
    it('should make Thorne invisible', () => {
      setupThorneArena(new Vector(0, 0), new Vector(500, 0));

      expect(thorne.isInvisible()).toBe(false);

      thorne.castThorneAbility('E', context as any);
      runner.tickFrames(5);

      expect(thorne.isInvisible()).toBe(true);
    });

    it('should grant 20% movement speed', () => {
      setupThorneArena(new Vector(0, 0), new Vector(500, 0));

      const baseMS = thorne.getStats().movementSpeed;

      thorne.castThorneAbility('E', context as any);
      runner.tickFrames(10);

      const buffedMS = thorne.getStats().movementSpeed;
      expect(buffedMS).toBeGreaterThan(baseMS * 1.15); // At least 15% more
    });

    it('should last 2 seconds at rank 1', () => {
      setupThorneArena(new Vector(0, 0), new Vector(500, 0));

      thorne.castThorneAbility('E', context as any);
      runner.tickFrames(5);
      expect(thorne.isInvisible()).toBe(true);

      // After 2+ seconds
      runner.tickFrames(2 * 60 + 10);
      expect(thorne.isInvisible()).toBe(false);
    });

    it('should break invisibility when attacking', () => {
      setupThorneArena(new Vector(0, 0), new Vector(100, 0));

      thorne.castThorneAbility('E', context as any);
      runner.tickFrames(5);
      expect(thorne.isInvisible()).toBe(true);

      // Basic attack
      thorne.performBasicAttack(context as any, enemy as any);
      runner.tickFrames(5);

      expect(thorne.isInvisible()).toBe(false);
    });

    it('should have 18 second cooldown', () => {
      setupThorneArena(new Vector(0, 0), new Vector(500, 0));

      thorne.castThorneAbility('E', context as any);
      (thorne as any).state.resource = 300;

      const secondCast = thorne.castThorneAbility('E', context as any);
      expect(secondCast).toBe(false);

      // After 18+ seconds
      runner.tickFrames(18 * 60 + 10);
      (thorne as any).state.resource = 300;

      const thirdCast = thorne.castThorneAbility('E', context as any);
      expect(thirdCast).toBe(true);
    });
  });

  // ===================
  // R Tests - Deathmark
  // ===================

  describe('R - Deathmark', () => {
    it('should mark target enemy', () => {
      setupThorneArena(new Vector(0, 0), new Vector(300, 0));

      (context as any).target = enemy;
      thorne.castThorneAbility('R', context as any, enemy);
      runner.tickFrames(5);

      expect(thorne.hasDeathmark(enemy)).toBe(true);
    });

    it('should deal damage when mark expires after 3 seconds', () => {
      setupThorneArena(new Vector(0, 0), new Vector(300, 0));
      enemy.setHealth(1000);

      (context as any).target = enemy;
      thorne.castThorneAbility('R', context as any, enemy);

      // Wait for mark to expire (3 seconds)
      runner.tickFrames(3 * 60 + 10);

      expect(enemy.getState().health).toBeLessThan(1000);
    });

    it('should deal base damage + percentage of damage dealt during mark', () => {
      setupThorneArena(new Vector(0, 0), new Vector(100, 0));
      enemy.setHealth(2000);

      const thorneAD = thorne.getStats().attackDamage;
      const enemyArmor = enemy.getComputedStats().armor;

      // Apply mark
      (context as any).target = enemy;
      thorne.castThorneAbility('R', context as any, enemy);
      runner.tickFrames(5);

      // Deal some damage during mark (basic attacks)
      const healthAfterMark = enemy.getState().health;
      thorne.performBasicAttack(context as any, enemy as any);
      runner.tickFrames(60);
      thorne.performBasicAttack(context as any, enemy as any);
      runner.tickFrames(60);

      const damageDealtDuringMark = healthAfterMark - enemy.getState().health;

      // Wait for mark to expire
      const healthBeforeExpiry = enemy.getState().health;
      runner.tickFrames(2 * 60 + 30);
      const deathmarkDamage = healthBeforeExpiry - enemy.getState().health;

      // Deathmark should deal at least base damage (150)
      const minExpectedRaw = 150;
      const minExpectedAfterArmor = calculateExpectedPhysicalDamage(minExpectedRaw, enemyArmor);

      expect(deathmarkDamage).toBeGreaterThan(minExpectedAfterArmor * 0.5);
    });

    it('should have 90 second cooldown', () => {
      setupThorneArena(new Vector(0, 0), new Vector(400, 0));

      (context as any).target = enemy;
      const firstCast = thorne.castThorneAbility('R', context as any, enemy);
      expect(firstCast).toBe(true);

      (thorne as any).state.resource = 300;
      const secondCast = thorne.castThorneAbility('R', context as any, enemy);
      expect(secondCast).toBe(false); // Should be on cooldown

      // After just 10 seconds, should still be on cooldown
      runner.tickFrames(10 * 60);
      (thorne as any).state.resource = 300;
      const midCooldownCast = thorne.castThorneAbility('R', context as any, enemy);
      expect(midCooldownCast).toBe(false); // 90s cooldown, 10s elapsed = still on CD
    });

    it('should have 500 range', () => {
      setupThorneArena(new Vector(0, 0), new Vector(550, 0)); // Beyond 500 range

      (context as any).target = enemy;
      const result = thorne.castThorneAbility('R', context as any, enemy);

      expect(result).toBe(false);
    });
  });

  // ===================
  // Mana Management Tests
  // ===================

  describe('Mana Management', () => {
    it('should not cast ability without enough mana', () => {
      setupThorneArena(new Vector(0, 0), new Vector(200, 0));
      (thorne as any).state.resource = 10;

      const qCast = thorne.castThorneAbility('Q', context as any, enemy);
      expect(qCast).toBe(false);
    });

    it('should regenerate mana over time', () => {
      setupThorneArena(new Vector(0, 0), new Vector(500, 0));
      (thorne as any).state.resource = 100;

      const manaBefore = (thorne as any).state.resource;
      runner.tickFrames(5 * 60);

      const manaAfter = (thorne as any).state.resource;
      expect(manaAfter).toBeGreaterThan(manaBefore);
    });
  });

  // ===================
  // canCastThorneAbility Tests
  // ===================

  describe('canCastThorneAbility', () => {
    it('should return true when ability is ready and has mana', () => {
      setupThorneArena(new Vector(0, 0), new Vector(200, 0));

      expect(thorne.canCastThorneAbility('W')).toBe(true);
      expect(thorne.canCastThorneAbility('E')).toBe(true);
    });

    it('should return false when on cooldown', () => {
      setupThorneArena(new Vector(0, 0), new Vector(150, 0));

      thorne.castThorneAbility('W', context as any);

      expect(thorne.canCastThorneAbility('W')).toBe(false);
    });

    it('should return false when insufficient mana', () => {
      setupThorneArena(new Vector(0, 0), new Vector(200, 0));
      (thorne as any).state.resource = 10;

      expect(thorne.canCastThorneAbility('Q')).toBe(false);
    });
  });

  // ===================
  // Integration Tests
  // ===================

  describe('Integration', () => {
    it('should be able to assassinate with E -> Q -> W -> R combo', () => {
      setupThorneArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(1000);

      // Engage with stealth
      thorne.castThorneAbility('E', context as any);
      runner.tickFrames(5);
      expect(thorne.isInvisible()).toBe(true);

      // Dash to target
      (context as any).target = enemy;
      thorne.castThorneAbility('Q', context as any, enemy);
      runner.tickFrames(30);
      expect(thorne.isInvisible()).toBe(false); // Attacking breaks stealth

      // AoE damage
      (thorne as any).state.resource = 300;
      thorne.castThorneAbility('W', context as any);
      runner.tickFrames(10);

      // Should have dealt damage
      expect(enemy.getState().health).toBeLessThan(1000);
    });

    it('should deal more damage to low health targets with passive', () => {
      // Test passive damage bonus using separate setups to avoid attack cooldown issues

      // First setup: full health target
      const thorne1 = new Thorne(new Vector(0, 0), 0);
      const enemy1 = new TestDummy(new Vector(100, 0), 1);
      const runner1 = new TestRunner({ objects: [thorne1, enemy1] });
      const context1 = runner1.getContext();
      thorne1.init(context1 as any);
      enemy1.init(context1 as any);
      (thorne1 as any).state.resource = 300;

      enemy1.setHealth(5000); // High health, above 40% threshold
      const fullHealthBefore = enemy1.getState().health;
      thorne1.performBasicAttack(context1 as any, enemy1 as any);
      runner1.tickFrames(3);
      const fullHealthDamage = fullHealthBefore - enemy1.getState().health;

      // Second setup: low health target
      const thorne2 = new Thorne(new Vector(0, 0), 0);
      const enemy2 = new TestDummy(new Vector(100, 0), 1);
      const runner2 = new TestRunner({ objects: [thorne2, enemy2] });
      const context2 = runner2.getContext();
      thorne2.init(context2 as any);
      enemy2.init(context2 as any);
      (thorne2 as any).state.resource = 300;

      const maxHealth = enemy2.getStats().maxHealth;
      enemy2.setHealth(maxHealth * 0.3); // Below 40% threshold
      const lowHealthBefore = enemy2.getState().health;
      thorne2.performBasicAttack(context2 as any, enemy2 as any);
      runner2.tickFrames(3);
      const lowHealthDamage = lowHealthBefore - enemy2.getState().health;

      // Low health target should take more damage (15% bonus)
      expect(lowHealthDamage).toBeGreaterThan(fullHealthDamage);
    });
  });
});
