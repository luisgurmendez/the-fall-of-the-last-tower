/**
 * Tests for Elara, the Bowmaiden - A ranged marksman with precision and mobility.
 *
 * Elara's Kit:
 * - Passive (Steady Aim): Basic attacks deal 10% bonus damage to targets > 500 units away
 * - Q (Piercing Arrow): 70/110/150/190/230 physical damage, line skillshot (pierces), 800 range
 * - W (Quick Step): Dash 300 units + 30% movement speed for 2s
 * - E (Crippling Shot): 50/80/110/140/170 physical damage + 30/35/40/45/50% slow for 2s
 * - R (Arrow Storm): 200/300/400 physical damage AoE after 1s delay, 250 radius
 *
 * Base Stats:
 * - Health: 550
 * - Mana: 300
 * - Attack Damage: 55
 * - Attack Speed: 0.7
 * - Attack Range: 550 (ranged)
 * - Armor: 25
 * - Magic Resist: 30
 * - Movement Speed: 325
 *
 * All tests are deterministic and headless.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestDummy, calculateExpectedPhysicalDamage } from './ChampionTestUtils';
import { TestRunner, MockGameContext } from './TestGameContext';
import { Elara } from '@/champions/implementations/Elara';
import Vector from '@/physics/vector';

describe('Elara Champion', () => {
  let runner: TestRunner;
  let context: MockGameContext;
  let elara: Elara;
  let enemy: TestDummy;

  /**
   * Helper to set up Elara and enemy at specific positions.
   */
  function setupElaraArena(elaraPos: Vector, enemyPos: Vector): void {
    elara = new Elara(elaraPos, 0);
    enemy = new TestDummy(enemyPos, 1);

    runner = new TestRunner({
      objects: [elara, enemy],
    });

    context = runner.getContext();

    // Initialize both champions
    elara.init(context as any);
    enemy.init(context as any);

    // Give Elara full mana for testing
    (elara as any).state.resource = 300;

    // Set Elara's direction to face the enemy
    const dirToEnemy = enemyPos.clone().sub(elaraPos).normalize();
    (elara as any).direction = dirToEnemy;

    // Rank up abilities so they can be cast
    rankUpElaraAbilities();
  }

  /**
   * Rank up all of Elara's abilities to rank 1 for testing.
   */
  function rankUpElaraAbilities(): void {
    const abilities = ['piercingArrow', 'quickStep', 'cripplingShot', 'arrowStorm'];
    abilities.forEach(abilityName => {
      const ability = (elara as any)[abilityName];
      if (ability) {
        const isLearned = typeof ability.isLearned === 'function'
          ? ability.isLearned()
          : ability.isLearned;
        if (!isLearned) {
          ability.rankUp?.();
        }
      }
    });
  }

  // ===================
  // Base Stats Tests
  // ===================

  describe('Base Stats', () => {
    beforeEach(() => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));
    });

    it('should have correct base health (550)', () => {
      const stats = elara.getStats();
      expect(stats.maxHealth).toBe(550);
    });

    it('should have correct base mana (300)', () => {
      const stats = elara.getStats();
      expect(stats.maxResource).toBe(300);
    });

    it('should have correct base attack damage (55)', () => {
      const stats = elara.getStats();
      expect(stats.attackDamage).toBe(55);
    });

    it('should have correct base attack speed (0.7)', () => {
      const stats = elara.getStats();
      expect(stats.attackSpeed).toBeCloseTo(0.7, 2);
    });

    it('should have ranged attack range (550)', () => {
      const stats = elara.getStats();
      expect(stats.attackRange).toBe(550);
    });

    it('should have correct base armor (25)', () => {
      const stats = elara.getStats();
      expect(stats.armor).toBe(25);
    });

    it('should have correct base magic resist (30)', () => {
      const stats = elara.getStats();
      expect(stats.magicResist).toBe(30);
    });

    it('should have correct base movement speed (325)', () => {
      const stats = elara.getStats();
      expect(stats.movementSpeed).toBe(325);
    });

    it('should be a ranged champion', () => {
      // Ranged champions have attack range > 200
      const stats = elara.getStats();
      expect(stats.attackRange).toBeGreaterThan(200);
    });

    it('should use mana as resource', () => {
      const resource = (elara as any).state.resource;
      expect(resource).toBeGreaterThan(0);
    });
  });

  // ===================
  // Passive Tests - Steady Aim
  // ===================

  describe('Passive - Steady Aim', () => {
    it('should deal 10% bonus damage to targets more than 500 units away', () => {
      // Setup with enemy at 600 units (beyond 500)
      setupElaraArena(new Vector(0, 0), new Vector(600, 0));
      enemy.setHealth(1000);

      const elaraAD = elara.getStats().attackDamage;
      const enemyArmor = enemy.getComputedStats().armor;

      // Trigger basic attack
      elara.performBasicAttack(context as any, enemy);
      runner.tickFrames(60); // Let projectile hit

      const damageTaken = 1000 - enemy.getState().health;

      // Should be 110% of normal damage after armor
      const normalRaw = elaraAD;
      const bonusRaw = normalRaw * 1.1;
      const expectedAfterArmor = calculateExpectedPhysicalDamage(bonusRaw, enemyArmor);

      expect(damageTaken).toBeGreaterThan(expectedAfterArmor * 0.9);
      expect(damageTaken).toBeLessThan(expectedAfterArmor * 1.1);
    });

    it('should NOT deal bonus damage to targets within 500 units', () => {
      // Setup with enemy at 400 units (within 500)
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(1000);

      const elaraAD = elara.getStats().attackDamage;
      const enemyArmor = enemy.getComputedStats().armor;

      // Trigger basic attack
      elara.performBasicAttack(context as any, enemy);
      runner.tickFrames(60);

      const damageTaken = 1000 - enemy.getState().health;

      // Should be normal damage (no bonus)
      const expectedAfterArmor = calculateExpectedPhysicalDamage(elaraAD, enemyArmor);

      expect(damageTaken).toBeGreaterThan(expectedAfterArmor * 0.9);
      expect(damageTaken).toBeLessThan(expectedAfterArmor * 1.1);
    });
  });

  // ===================
  // Q Tests - Piercing Arrow
  // ===================

  describe('Q - Piercing Arrow', () => {
    it('should deal damage to enemy in range', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(1000);

      elara.castElaraAbility('Q', context as any);
      runner.tickFrames(30); // Let projectile travel

      const healthAfter = enemy.getState().health;
      expect(healthAfter).toBeLessThan(1000);
    });

    it('should pierce through multiple enemies', () => {
      // Set up Elara with two enemies in a line
      elara = new Elara(new Vector(0, 0), 0);
      const enemy1 = new TestDummy(new Vector(200, 0), 1);
      const enemy2 = new TestDummy(new Vector(400, 0), 1);

      runner = new TestRunner({
        objects: [elara, enemy1, enemy2],
      });

      context = runner.getContext();
      elara.init(context as any);
      enemy1.init(context as any);
      enemy2.init(context as any);

      (elara as any).state.resource = 300;
      (elara as any).direction = new Vector(1, 0);
      rankUpElaraAbilities();

      enemy1.setHealth(1000);
      enemy2.setHealth(1000);

      elara.castElaraAbility('Q', context as any);
      runner.tickFrames(60);

      // Both enemies should take damage
      expect(enemy1.getState().health).toBeLessThan(1000);
      expect(enemy2.getState().health).toBeLessThan(1000);
    });

    it('should deal 70 + AD scaling physical damage at rank 1', () => {
      // Place enemy at 750 units - inside Q range (800) but far outside basic attack range (550)
      // to avoid any basic attacks during the tick frames
      setupElaraArena(new Vector(0, 0), new Vector(750, 0));
      enemy.setHealth(1000);

      const elaraAD = elara.getStats().attackDamage;
      const enemyArmor = enemy.getComputedStats().armor;

      // Capture health before ability
      const healthBefore = enemy.getState().health;

      elara.castElaraAbility('Q', context as any);
      runner.tickFrames(5); // Just enough to apply the damage, not enough for movement/auto

      const damageTaken = healthBefore - enemy.getState().health;

      // Q base damage at rank 1: 70 + AD ratio (assume 0.7 AD)
      const expectedRaw = 70 + elaraAD * 0.7;
      const expectedAfterArmor = calculateExpectedPhysicalDamage(expectedRaw, enemyArmor);

      expect(damageTaken).toBeGreaterThan(expectedAfterArmor * 0.7);
      expect(damageTaken).toBeLessThan(expectedAfterArmor * 1.3);
    });

    it('should have 7 second cooldown', () => {
      setupElaraArena(new Vector(0, 0), new Vector(300, 0));

      // First cast
      elara.castElaraAbility('Q', context as any);
      (elara as any).state.resource = 300;

      // Immediate second cast should fail
      const secondCast = elara.castElaraAbility('Q', context as any);
      expect(secondCast).toBe(false);

      // After 7+ seconds
      runner.tickFrames(7 * 60 + 10);
      (elara as any).state.resource = 300;

      const thirdCast = elara.castElaraAbility('Q', context as any);
      expect(thirdCast).toBe(true);
    });

    it('should consume mana when cast', () => {
      setupElaraArena(new Vector(0, 0), new Vector(300, 0));
      const manaBefore = (elara as any).state.resource;

      elara.castElaraAbility('Q', context as any);

      const manaAfter = (elara as any).state.resource;
      expect(manaAfter).toBeLessThan(manaBefore);
    });
  });

  // ===================
  // W Tests - Quick Step
  // ===================

  describe('W - Quick Step', () => {
    it('should dash in the target direction', () => {
      setupElaraArena(new Vector(0, 0), new Vector(500, 0));

      const posBefore = elara.getPosition().clone();

      elara.castElaraAbility('W', context as any);
      runner.tickFrames(30); // Let dash complete

      const posAfter = elara.getPosition();
      const distanceMoved = posAfter.distanceTo(posBefore);

      // Should have moved approximately 300 units (dash distance)
      expect(distanceMoved).toBeGreaterThan(200);
      expect(distanceMoved).toBeLessThan(400);
    });

    it('should grant 30% movement speed for 2 seconds', () => {
      setupElaraArena(new Vector(0, 0), new Vector(500, 0));

      const baseMS = elara.getStats().movementSpeed;

      elara.castElaraAbility('W', context as any);
      runner.tickFrames(20); // After dash

      const buffedMS = elara.getStats().movementSpeed;
      expect(buffedMS).toBeGreaterThan(baseMS * 1.2);

      // After 2+ seconds, speed should return to normal
      runner.tickFrames(2 * 60 + 10);
      const afterBuffMS = elara.getStats().movementSpeed;
      expect(afterBuffMS).toBeCloseTo(baseMS, 1);
    });

    it('should have 14 second cooldown', () => {
      // Place enemy at 900 units - far outside attack range (550) even after 300 unit dash
      // This prevents basic attacks and Elara dying during the cooldown wait
      setupElaraArena(new Vector(0, 0), new Vector(900, 0));

      // First cast
      elara.castElaraAbility('W', context as any);
      (elara as any).state.resource = 300;

      // Immediate second cast should fail
      const secondCast = elara.castElaraAbility('W', context as any);
      expect(secondCast).toBe(false);

      // After 14+ seconds
      runner.tickFrames(14 * 60 + 10);
      (elara as any).state.resource = 300;

      const thirdCast = elara.castElaraAbility('W', context as any);
      expect(thirdCast).toBe(true);
    });

    it('should be self-targeted (no target required)', () => {
      setupElaraArena(new Vector(0, 0), new Vector(500, 0));

      // Cast without target
      const result = elara.castElaraAbility('W', context as any);
      expect(result).toBe(true);
    });
  });

  // ===================
  // E Tests - Crippling Shot
  // ===================

  describe('E - Crippling Shot', () => {
    it('should deal damage to target enemy', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(1000);

      elara.castElaraAbility('E', context as any, enemy);
      runner.tickFrames(30);

      const healthAfter = enemy.getState().health;
      expect(healthAfter).toBeLessThan(1000);
    });

    it('should deal 50 + AD scaling physical damage at rank 1', () => {
      // Place enemy at 580 units - inside E range (600) but outside basic attack range (550)
      setupElaraArena(new Vector(0, 0), new Vector(580, 0));
      enemy.setHealth(1000);

      const elaraAD = elara.getStats().attackDamage;
      const enemyArmor = enemy.getComputedStats().armor;

      elara.castElaraAbility('E', context as any, enemy);
      runner.tickFrames(1); // E applies damage instantly

      const damageTaken = 1000 - enemy.getState().health;

      // E base damage at rank 1: 50 + AD ratio (assume 0.5 AD)
      const expectedRaw = 50 + elaraAD * 0.5;
      const expectedAfterArmor = calculateExpectedPhysicalDamage(expectedRaw, enemyArmor);

      expect(damageTaken).toBeGreaterThan(expectedAfterArmor * 0.8);
      expect(damageTaken).toBeLessThan(expectedAfterArmor * 1.3);
    });

    it('should slow enemy by 30% at rank 1 for 2 seconds', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));

      const baseMS = enemy.getComputedStats().movementSpeed;

      elara.castElaraAbility('E', context as any, enemy);
      runner.tickFrames(5);

      // Enemy should be slowed
      const slowedMS = enemy.getComputedStats().movementSpeed;
      expect(slowedMS).toBeLessThan(baseMS * 0.8);

      // After 2+ seconds, slow should wear off
      runner.tickFrames(2 * 60 + 10);
      const afterSlowMS = enemy.getComputedStats().movementSpeed;
      expect(afterSlowMS).toBeCloseTo(baseMS, 1);
    });

    it('should have 10 second cooldown', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));

      // First cast
      elara.castElaraAbility('E', context as any, enemy);
      (elara as any).state.resource = 300;

      // Immediate second cast should fail
      const secondCast = elara.castElaraAbility('E', context as any, enemy);
      expect(secondCast).toBe(false);

      // After 10+ seconds
      runner.tickFrames(10 * 60 + 10);
      (elara as any).state.resource = 300;

      const thirdCast = elara.castElaraAbility('E', context as any, enemy);
      expect(thirdCast).toBe(true);
    });

    it('should NOT cast when enemy is out of range (600 units)', () => {
      setupElaraArena(new Vector(0, 0), new Vector(700, 0)); // Beyond 600 range

      const castResult = elara.castElaraAbility('E', context as any, enemy);
      expect(castResult).toBe(false);
    });

    it('should require a target', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));

      // Cast without target
      const result = elara.castElaraAbility('E', context as any);
      expect(result).toBe(false);
    });
  });

  // ===================
  // R Tests - Arrow Storm
  // ===================

  describe('R - Arrow Storm', () => {
    it('should deal damage to enemies in area', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(1000);

      const targetPos = enemy.getPosition().clone();
      elara.castElaraAbility('R', context as any, targetPos);
      runner.tickFrames(5);

      const healthAfter = enemy.getState().health;
      expect(healthAfter).toBeLessThan(1000);
    });

    it('should deal 200 physical damage at rank 1', () => {
      // Place enemy farther to avoid basic attacks
      setupElaraArena(new Vector(0, 0), new Vector(600, 0));
      enemy.setHealth(1000);

      const enemyArmor = enemy.getComputedStats().armor;

      const targetPos = enemy.getPosition().clone();
      elara.castElaraAbility('R', context as any, targetPos);
      runner.tickFrames(1); // R applies damage immediately

      const damageTaken = 1000 - enemy.getState().health;

      // R base damage at rank 1: 200
      const expectedRaw = 200;
      const expectedAfterArmor = calculateExpectedPhysicalDamage(expectedRaw, enemyArmor);

      expect(damageTaken).toBeGreaterThan(expectedAfterArmor * 0.8);
      expect(damageTaken).toBeLessThan(expectedAfterArmor * 1.3);
    });

    it('should hit multiple enemies in area', () => {
      elara = new Elara(new Vector(0, 0), 0);
      const enemy1 = new TestDummy(new Vector(400, 50), 1);
      const enemy2 = new TestDummy(new Vector(400, -50), 1);

      runner = new TestRunner({
        objects: [elara, enemy1, enemy2],
      });

      context = runner.getContext();
      elara.init(context as any);
      enemy1.init(context as any);
      enemy2.init(context as any);

      (elara as any).state.resource = 300;
      rankUpElaraAbilities();

      enemy1.setHealth(1000);
      enemy2.setHealth(1000);

      const targetPos = new Vector(400, 0);
      elara.castElaraAbility('R', context as any, targetPos);
      runner.tickFrames(5);

      // Both enemies should be damaged
      expect(enemy1.getState().health).toBeLessThan(1000);
      expect(enemy2.getState().health).toBeLessThan(1000);
    });

    it('should have 90 second cooldown', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));

      const targetPos = enemy.getPosition().clone();
      elara.castElaraAbility('R', context as any, targetPos);
      (elara as any).state.resource = 300;

      // Immediate second cast should fail
      const secondCast = elara.castElaraAbility('R', context as any, targetPos);
      expect(secondCast).toBe(false);

      // After 90+ seconds
      runner.tickFrames(90 * 60 + 10);
      (elara as any).state.resource = 300;

      const thirdCast = elara.castElaraAbility('R', context as any, targetPos);
      expect(thirdCast).toBe(true);
    });

    it('should NOT cast beyond maximum range (700 units)', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));

      const farTargetPos = new Vector(800, 0); // Beyond 700 range
      const castResult = elara.castElaraAbility('R', context as any, farTargetPos);
      expect(castResult).toBe(false);
    });
  });

  // ===================
  // Mana Management Tests
  // ===================

  describe('Mana Management', () => {
    it('should not cast ability without enough mana', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));

      // Drain all mana
      (elara as any).state.resource = 0;

      const result = elara.castElaraAbility('Q', context as any);
      expect(result).toBe(false);
    });

    it('should regenerate mana over time', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));

      // Set mana to 50
      (elara as any).state.resource = 50;
      const manaBefore = (elara as any).state.resource;

      // Wait a few seconds for regen
      runner.tickFrames(5 * 60);

      const manaAfter = (elara as any).state.resource;
      expect(manaAfter).toBeGreaterThan(manaBefore);
    });
  });

  // ===================
  // canCastElaraAbility Tests
  // ===================

  describe('canCastElaraAbility', () => {
    it('should return true when ability is ready and has mana', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));

      expect(elara.canCastElaraAbility('Q')).toBe(true);
      expect(elara.canCastElaraAbility('W')).toBe(true);
      expect(elara.canCastElaraAbility('E')).toBe(true);
      expect(elara.canCastElaraAbility('R')).toBe(true);
    });

    it('should return false when on cooldown', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));

      elara.castElaraAbility('Q', context as any);

      expect(elara.canCastElaraAbility('Q')).toBe(false);
    });

    it('should return false when insufficient mana', () => {
      setupElaraArena(new Vector(0, 0), new Vector(400, 0));

      (elara as any).state.resource = 0;

      expect(elara.canCastElaraAbility('Q')).toBe(false);
    });

    it('should return false for E when target is out of range', () => {
      setupElaraArena(new Vector(0, 0), new Vector(700, 0)); // Beyond 600 range

      expect(elara.canCastElaraAbility('E', enemy)).toBe(false);
    });
  });

  // ===================
  // Integration Tests
  // ===================

  describe('Integration', () => {
    it('should be able to kite with W -> E -> Q combo', () => {
      setupElaraArena(new Vector(0, 0), new Vector(500, 0));
      enemy.setHealth(1000);

      // W to dash back
      elara.castElaraAbility('W', context as any);
      runner.tickFrames(10);

      // E to slow enemy
      (elara as any).state.resource = 300;
      elara.castElaraAbility('E', context as any, enemy);
      runner.tickFrames(5);

      // Enemy should be slowed
      expect(enemy.getComputedStats().movementSpeed).toBeLessThan(300);

      // Q for damage
      (elara as any).state.resource = 300;
      (elara as any).direction = enemy.getPosition().clone().sub(elara.getPosition()).normalize();
      elara.castElaraAbility('Q', context as any);
      runner.tickFrames(30);

      // Enemy should have taken significant damage
      expect(enemy.getState().health).toBeLessThan(900);
    });

    it('should deal more damage from long range with passive', () => {
      // Test at close range
      setupElaraArena(new Vector(0, 0), new Vector(300, 0));
      enemy.setHealth(1000);

      elara.performBasicAttack(context as any, enemy);
      runner.tickFrames(60);
      const closeRangeDamage = 1000 - enemy.getState().health;

      // Test at long range (> 500 units)
      setupElaraArena(new Vector(0, 0), new Vector(550, 0));
      enemy.setHealth(1000);

      elara.performBasicAttack(context as any, enemy);
      runner.tickFrames(60);
      const longRangeDamage = 1000 - enemy.getState().health;

      // Long range damage should be approximately 10% higher
      expect(longRangeDamage).toBeGreaterThan(closeRangeDamage * 1.05);
    });
  });
});
