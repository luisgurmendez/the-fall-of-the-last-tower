/**
 * Tests for Greta, the Warden (Support)
 *
 * Greta is a ranged support with:
 * - Passive: Guardian's Blessing - Gains 10% of healing/shielding done as self-shield
 * - Q: Holy Light - Heals ally or damages enemy for 60/90/120/150/180 (+40% AP)
 * - W: Protective Barrier - Shields ally for 80/115/150/185/220 (+50% AP) for 2.5s
 * - E: Binding Light - Roots first enemy hit for 1/1.25/1.5/1.75/2 seconds
 * - R: Divine Grace - AoE heal around self for 150/250/350 (+60% AP)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestDummy, calculateExpectedMagicDamage } from './ChampionTestUtils';
import { TestRunner, MockGameContext } from './TestGameContext';
import { Greta } from '@/champions/implementations/Greta';
import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';

describe('Greta Champion', () => {
  let greta: Greta;
  let ally: TestDummy;
  let enemy: TestDummy;
  let runner: TestRunner;
  let context: MockGameContext;

  function setupGretaArena(gretaPos: Vector, allyPos: Vector, enemyPos: Vector): void {
    greta = new Greta(gretaPos, 0);
    ally = new TestDummy(allyPos, 0); // Same team as Greta
    enemy = new TestDummy(enemyPos, 1);
    runner = new TestRunner({ objects: [greta, ally, enemy] });
    context = runner.getContext();
    greta.init(context as any);
    ally.init(context as any);
    enemy.init(context as any);
    // Set mana
    (greta as any).state.resource = 400;
    // Set direction toward enemy
    const dirToEnemy = enemyPos.clone().sub(gretaPos).normalize();
    (greta as any).direction = dirToEnemy;
    // Rank up abilities
    rankUpGretaAbilities();
  }

  function rankUpGretaAbilities(): void {
    const abilities = ['holyLight', 'protectiveBarrier', 'bindingLight', 'divineGrace'];
    for (const abilityName of abilities) {
      const ability = (greta as any)[abilityName];
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
      setupGretaArena(new Vector(0, 0), new Vector(100, 0), new Vector(300, 0));
    });

    it('should have correct base health (500)', () => {
      const stats = greta.getStats();
      expect(stats.maxHealth).toBeCloseTo(500, 0);
    });

    it('should have correct base mana (400)', () => {
      const stats = greta.getStats();
      expect(stats.maxResource).toBeCloseTo(400, 0);
    });

    it('should have correct base attack damage (48)', () => {
      const stats = greta.getStats();
      expect(stats.attackDamage).toBeCloseTo(48, 0);
    });

    it('should have correct base armor (22)', () => {
      const stats = greta.getStats();
      expect(stats.armor).toBeCloseTo(22, 0);
    });

    it('should have correct base magic resist (30)', () => {
      const stats = greta.getStats();
      expect(stats.magicResist).toBeCloseTo(30, 0);
    });

    it('should have correct base movement speed (335)', () => {
      const stats = greta.getStats();
      expect(stats.movementSpeed).toBeCloseTo(335, 0);
    });

    it('should have correct attack range (500) - ranged', () => {
      const stats = greta.getStats();
      expect(stats.attackRange).toBe(500);
    });

    it('should use mana as resource', () => {
      expect(greta.getResourceType()).toBe('mana');
    });
  });

  // ===================
  // Passive Tests - Guardian's Blessing
  // ===================

  describe('Passive - Guardian\'s Blessing', () => {
    it('should gain self-shield when healing an ally (10% of heal amount)', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      // Damage ally first so healing is effective
      ally.setHealth(ally.getStats().maxHealth - 200);

      const shieldBefore = greta.getTotalShield();
      expect(shieldBefore).toBe(0);

      // Heal ally with Q
      (context as any).target = ally;
      greta.castGretaAbility('Q', context as any, ally);
      runner.tickFrames(5);

      const shieldAfter = greta.getTotalShield();
      expect(shieldAfter).toBeGreaterThan(0);
    });

    it('should gain self-shield when shielding an ally (10% of shield amount)', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      const shieldBefore = greta.getTotalShield();
      expect(shieldBefore).toBe(0);

      // Shield ally with W
      (context as any).target = ally;
      greta.castGretaAbility('W', context as any, ally);
      runner.tickFrames(5);

      const shieldAfter = greta.getTotalShield();
      expect(shieldAfter).toBeGreaterThan(0);
    });

    it('should NOT gain self-shield when damaging enemies', () => {
      setupGretaArena(new Vector(0, 0), new Vector(600, 0), new Vector(300, 0));

      const shieldBefore = greta.getTotalShield();

      // Damage enemy with Q
      (context as any).target = enemy;
      greta.castGretaAbility('Q', context as any, enemy);
      runner.tickFrames(5);

      const shieldAfter = greta.getTotalShield();
      expect(shieldAfter).toBe(shieldBefore);
    });
  });

  // ===================
  // Q Tests - Holy Light
  // ===================

  describe('Q - Holy Light', () => {
    it('should heal an ally', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      // Damage ally first
      const maxHealth = ally.getStats().maxHealth;
      ally.setHealth(maxHealth - 200);
      const healthBefore = ally.getState().health;

      (context as any).target = ally;
      greta.castGretaAbility('Q', context as any, ally);
      runner.tickFrames(5);

      const healthAfter = ally.getState().health;
      expect(healthAfter).toBeGreaterThan(healthBefore);
    });

    it('should damage an enemy', () => {
      setupGretaArena(new Vector(0, 0), new Vector(600, 0), new Vector(300, 0));
      enemy.setHealth(1000);

      const healthBefore = enemy.getState().health;

      (context as any).target = enemy;
      greta.castGretaAbility('Q', context as any, enemy);
      runner.tickFrames(5);

      const healthAfter = enemy.getState().health;
      expect(healthAfter).toBeLessThan(healthBefore);
    });

    it('should heal for 60 + AP scaling at rank 1', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      const maxHealth = ally.getStats().maxHealth;
      ally.setHealth(maxHealth - 500); // Plenty of room to heal
      const healthBefore = ally.getState().health;

      const gretaAP = greta.getStats().abilityPower;

      (context as any).target = ally;
      greta.castGretaAbility('Q', context as any, ally);
      runner.tickFrames(5);

      const healAmount = ally.getState().health - healthBefore;
      const expectedHeal = 60 + gretaAP * 0.4;

      expect(healAmount).toBeGreaterThan(expectedHeal * 0.8);
      expect(healAmount).toBeLessThan(expectedHeal * 1.2);
    });

    it('should deal 60 + AP scaling magic damage at rank 1', () => {
      // Place enemy at 550 (beyond Greta's 500 attack range) to avoid basic attacks
      setupGretaArena(new Vector(0, 0), new Vector(700, 0), new Vector(550, 0));
      enemy.setHealth(1000);

      const gretaAP = greta.getStats().abilityPower;
      const enemyMR = enemy.getComputedStats().magicResist;

      const healthBefore = enemy.getState().health;
      (context as any).target = enemy;
      greta.castGretaAbility('Q', context as any, enemy);
      // Don't tick to avoid any basic attacks - effect is immediate

      const damageTaken = healthBefore - enemy.getState().health;
      const expectedRaw = 60 + gretaAP * 0.4;
      const expectedAfterMR = calculateExpectedMagicDamage(expectedRaw, enemyMR);

      expect(damageTaken).toBeGreaterThan(expectedAfterMR * 0.8);
      expect(damageTaken).toBeLessThan(expectedAfterMR * 1.2);
    });

    it('should have 8 second cooldown', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));
      ally.setHealth(ally.getStats().maxHealth - 200);

      (context as any).target = ally;
      greta.castGretaAbility('Q', context as any, ally);
      (greta as any).state.resource = 400;

      const secondCast = greta.castGretaAbility('Q', context as any, ally);
      expect(secondCast).toBe(false);

      // After 8+ seconds
      runner.tickFrames(8 * 60 + 10);
      (greta as any).state.resource = 400;

      const thirdCast = greta.castGretaAbility('Q', context as any, ally);
      expect(thirdCast).toBe(true);
    });

    it('should have 600 range', () => {
      setupGretaArena(new Vector(0, 0), new Vector(700, 0), new Vector(300, 0)); // Ally beyond range
      ally.setHealth(ally.getStats().maxHealth - 200);

      (context as any).target = ally;
      const result = greta.castGretaAbility('Q', context as any, ally);
      expect(result).toBe(false);
    });
  });

  // ===================
  // W Tests - Protective Barrier
  // ===================

  describe('W - Protective Barrier', () => {
    it('should shield an ally', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      const shieldBefore = ally.getTotalShield();
      expect(shieldBefore).toBe(0);

      (context as any).target = ally;
      greta.castGretaAbility('W', context as any, ally);
      runner.tickFrames(5);

      const shieldAfter = ally.getTotalShield();
      expect(shieldAfter).toBeGreaterThan(0);
    });

    it('should shield for 80 + AP scaling at rank 1', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      const gretaAP = greta.getStats().abilityPower;

      (context as any).target = ally;
      greta.castGretaAbility('W', context as any, ally);
      runner.tickFrames(5);

      const shieldAmount = ally.getTotalShield();
      const expectedShield = 80 + gretaAP * 0.5;

      expect(shieldAmount).toBeGreaterThan(expectedShield * 0.8);
      expect(shieldAmount).toBeLessThan(expectedShield * 1.2);
    });

    it('should last 2.5 seconds', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      (context as any).target = ally;
      greta.castGretaAbility('W', context as any, ally);
      runner.tickFrames(5);

      expect(ally.getTotalShield()).toBeGreaterThan(0);

      // After 2.5+ seconds
      runner.tickFrames(2.5 * 60 + 10);

      expect(ally.getTotalShield()).toBe(0);
    });

    it('should have 10 second cooldown', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      (context as any).target = ally;
      greta.castGretaAbility('W', context as any, ally);
      (greta as any).state.resource = 400;

      const secondCast = greta.castGretaAbility('W', context as any, ally);
      expect(secondCast).toBe(false);

      // After 10+ seconds
      runner.tickFrames(10 * 60 + 10);
      (greta as any).state.resource = 400;

      const thirdCast = greta.castGretaAbility('W', context as any, ally);
      expect(thirdCast).toBe(true);
    });

    it('should have 700 range', () => {
      setupGretaArena(new Vector(0, 0), new Vector(800, 0), new Vector(300, 0)); // Ally beyond range

      (context as any).target = ally;
      const result = greta.castGretaAbility('W', context as any, ally);
      expect(result).toBe(false);
    });
  });

  // ===================
  // E Tests - Binding Light
  // ===================

  describe('E - Binding Light', () => {
    it('should root enemy on hit', () => {
      setupGretaArena(new Vector(0, 0), new Vector(600, 0), new Vector(400, 0));

      const movementSpeedBefore = enemy.getStats().movementSpeed;
      expect(movementSpeedBefore).toBeGreaterThan(0);

      // Cast on enemy
      (context as any).target = enemy;
      greta.castGretaAbility('E', context as any, enemy);
      runner.tickFrames(5);

      // Root reduces movement speed to 0
      const movementSpeedAfter = enemy.getStats().movementSpeed;
      expect(movementSpeedAfter).toBe(0);
    });

    it('should root for 1 second at rank 1', () => {
      setupGretaArena(new Vector(0, 0), new Vector(600, 0), new Vector(400, 0));

      (context as any).target = enemy;
      greta.castGretaAbility('E', context as any, enemy);
      runner.tickFrames(5);

      // Rooted
      expect(enemy.getStats().movementSpeed).toBe(0);

      // After 1+ second
      runner.tickFrames(1 * 60 + 10);

      // Root should expire
      expect(enemy.getStats().movementSpeed).toBeGreaterThan(0);
    });

    it('should have 12 second cooldown', () => {
      setupGretaArena(new Vector(0, 0), new Vector(900, 0), new Vector(400, 0)); // Ally far to avoid AA

      (context as any).target = enemy;
      greta.castGretaAbility('E', context as any, enemy);
      (greta as any).state.resource = 400;

      const secondCast = greta.castGretaAbility('E', context as any, enemy);
      expect(secondCast).toBe(false);

      // After 12+ seconds
      runner.tickFrames(12 * 60 + 10);
      (greta as any).state.resource = 400;

      const thirdCast = greta.castGretaAbility('E', context as any, enemy);
      expect(thirdCast).toBe(true);
    });

    it('should have 800 range', () => {
      setupGretaArena(new Vector(0, 0), new Vector(600, 0), new Vector(900, 0)); // Enemy beyond max range

      const result = greta.castGretaAbility('E', context as any, enemy);
      // Should fail due to out of range
      expect(result).toBe(false);
    });
  });

  // ===================
  // R Tests - Divine Grace
  // ===================

  describe('R - Divine Grace', () => {
    it('should heal nearby allies', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      // Damage ally and Greta
      ally.setHealth(ally.getStats().maxHealth - 300);
      (greta as any).state.health = 300;

      const allyHealthBefore = ally.getState().health;
      const gretaHealthBefore = (greta as any).state.health;

      greta.castGretaAbility('R', context as any);
      runner.tickFrames(10);

      const allyHealthAfter = ally.getState().health;
      const gretaHealthAfter = (greta as any).state.health;

      expect(allyHealthAfter).toBeGreaterThan(allyHealthBefore);
      expect(gretaHealthAfter).toBeGreaterThan(gretaHealthBefore);
    });

    it('should heal for 150 + AP scaling at rank 1', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      ally.setHealth(ally.getStats().maxHealth - 500);
      const healthBefore = ally.getState().health;

      const gretaAP = greta.getStats().abilityPower;

      greta.castGretaAbility('R', context as any);
      runner.tickFrames(10);

      const healAmount = ally.getState().health - healthBefore;
      const expectedHeal = 150 + gretaAP * 0.6;

      expect(healAmount).toBeGreaterThan(expectedHeal * 0.8);
      expect(healAmount).toBeLessThan(expectedHeal * 1.2);
    });

    it('should NOT heal enemies', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(200, 100)); // Enemy close

      enemy.setHealth(enemy.getStats().maxHealth - 200);
      const enemyHealthBefore = enemy.getState().health;

      greta.castGretaAbility('R', context as any);
      runner.tickFrames(10);

      const enemyHealthAfter = enemy.getState().health;
      expect(enemyHealthAfter).toBeLessThanOrEqual(enemyHealthBefore);
    });

    it('should have 400 radius', () => {
      // Create a clean test setup with no basic attack interference
      const gretaTest = new Greta(new Vector(0, 0), 0);
      const closeAlly = new TestDummy(new Vector(350, 0), 0); // Inside 400 radius
      const farAlly = new TestDummy(new Vector(450, 0), 0); // Outside 400 radius
      const runnerTest = new TestRunner({ objects: [gretaTest, closeAlly, farAlly] });
      const contextTest = runnerTest.getContext();
      gretaTest.init(contextTest as any);
      closeAlly.init(contextTest as any);
      farAlly.init(contextTest as any);
      (gretaTest as any).state.resource = 400;

      // Rank up abilities
      const r = (gretaTest as any).divineGrace;
      if (r && typeof r.rankUp === 'function') r.rankUp();

      closeAlly.setHealth(closeAlly.getStats().maxHealth - 300);
      farAlly.setHealth(farAlly.getStats().maxHealth - 300);

      const closeAllyHealthBefore = closeAlly.getState().health;
      const farAllyHealthBefore = farAlly.getState().health;

      gretaTest.castGretaAbility('R', contextTest as any);
      runnerTest.tickFrames(3); // Minimal frames to apply effect

      // Close ally (350 units) should be healed
      expect(closeAlly.getState().health).toBeGreaterThan(closeAllyHealthBefore);
      // Far ally (450 units) should NOT be healed (outside 400 radius)
      // Use toBeCloseTo to account for tiny health regen
      expect(farAlly.getState().health).toBeCloseTo(farAllyHealthBefore, 0);
    });

    it('should have 100 second cooldown', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      greta.castGretaAbility('R', context as any);
      (greta as any).state.resource = 400;

      const secondCast = greta.castGretaAbility('R', context as any);
      expect(secondCast).toBe(false);

      // After just 10 seconds, should still be on cooldown
      runner.tickFrames(10 * 60);
      (greta as any).state.resource = 400;

      const midCooldownCast = greta.castGretaAbility('R', context as any);
      expect(midCooldownCast).toBe(false);
    });
  });

  // ===================
  // Mana Management Tests
  // ===================

  describe('Mana Management', () => {
    it('should not cast ability without enough mana', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));
      (greta as any).state.resource = 10;

      const qCast = greta.castGretaAbility('Q', context as any, ally);
      expect(qCast).toBe(false);
    });

    it('should regenerate mana over time', () => {
      setupGretaArena(new Vector(0, 0), new Vector(600, 0), new Vector(800, 0));
      (greta as any).state.resource = 100;

      const manaBefore = (greta as any).state.resource;
      runner.tickFrames(5 * 60);

      const manaAfter = (greta as any).state.resource;
      expect(manaAfter).toBeGreaterThan(manaBefore);
    });
  });

  // ===================
  // canCastGretaAbility Tests
  // ===================

  describe('canCastGretaAbility', () => {
    it('should return true when ability is ready and has mana', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      expect(greta.canCastGretaAbility('Q')).toBe(true);
      expect(greta.canCastGretaAbility('W')).toBe(true);
      expect(greta.canCastGretaAbility('E')).toBe(true);
      expect(greta.canCastGretaAbility('R')).toBe(true);
    });

    it('should return false when on cooldown', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));
      ally.setHealth(ally.getStats().maxHealth - 200);

      greta.castGretaAbility('Q', context as any, ally);

      expect(greta.canCastGretaAbility('Q')).toBe(false);
    });

    it('should return false when insufficient mana', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));
      (greta as any).state.resource = 10;

      expect(greta.canCastGretaAbility('R')).toBe(false);
    });
  });

  // ===================
  // Integration Tests
  // ===================

  describe('Integration', () => {
    it('should support ally with Q heal -> W shield combo', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      // Damage ally
      ally.setHealth(ally.getStats().maxHealth - 300);
      const healthBefore = ally.getState().health;

      // Heal with Q
      (context as any).target = ally;
      greta.castGretaAbility('Q', context as any, ally);
      runner.tickFrames(5);

      expect(ally.getState().health).toBeGreaterThan(healthBefore);

      // Shield with W
      (greta as any).state.resource = 400;
      greta.castGretaAbility('W', context as any, ally);
      runner.tickFrames(5);

      expect(ally.getTotalShield()).toBeGreaterThan(0);
    });

    it('should trigger passive when healing/shielding allies', () => {
      setupGretaArena(new Vector(0, 0), new Vector(200, 0), new Vector(600, 0));

      ally.setHealth(ally.getStats().maxHealth - 300);

      const gretaShieldBefore = greta.getTotalShield();
      expect(gretaShieldBefore).toBe(0);

      // Heal ally triggers passive
      (context as any).target = ally;
      greta.castGretaAbility('Q', context as any, ally);
      runner.tickFrames(5);

      expect(greta.getTotalShield()).toBeGreaterThan(0);
    });
  });
});
