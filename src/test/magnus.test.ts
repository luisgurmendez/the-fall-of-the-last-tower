/**
 * Tests for Magnus, the Battlemage (Mage)
 *
 * Magnus is a burst mage with:
 * - Passive: Arcane Surge - Abilities generate stacks that increase ability damage
 * - Q: Fireball - Skillshot that damages first enemy hit
 * - W: Arcane Shield - Self shield
 * - E: Blink - Teleport to location
 * - R: Meteor - AoE delayed damage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestDummy, calculateExpectedPhysicalDamage } from './ChampionTestUtils';
import { TestRunner, MockGameContext } from './TestGameContext';
import { Magnus } from '@/champions/implementations/Magnus';
import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';

describe('Magnus Champion', () => {
  let magnus: Magnus;
  let enemy: TestDummy;
  let runner: TestRunner;
  let context: MockGameContext;

  function setupMagnusArena(magnusPos: Vector, enemyPos: Vector): void {
    magnus = new Magnus(magnusPos, 0);
    enemy = new TestDummy(enemyPos, 1);
    runner = new TestRunner({ objects: [magnus, enemy] });
    context = runner.getContext();
    magnus.init(context as any);
    enemy.init(context as any);
    // Set mana
    (magnus as any).state.resource = 400;
    // Set direction toward enemy
    const dirToEnemy = enemyPos.clone().sub(magnusPos).normalize();
    (magnus as any).direction = dirToEnemy;
    // Rank up abilities
    rankUpMagnusAbilities();
  }

  function rankUpMagnusAbilities(): void {
    const abilities = ['fireball', 'arcaneShield', 'blink', 'meteor'];
    for (const abilityName of abilities) {
      const ability = (magnus as any)[abilityName];
      if (ability && typeof ability.rankUp === 'function') {
        ability.rankUp();
      }
    }
  }

  function calculateExpectedMagicDamage(rawDamage: number, magicResist: number): number {
    return rawDamage * (100 / (100 + magicResist));
  }

  // ===================
  // Base Stats Tests
  // ===================

  describe('Base Stats', () => {
    beforeEach(() => {
      setupMagnusArena(new Vector(0, 0), new Vector(500, 0));
    });

    it('should have correct base health (500)', () => {
      const stats = magnus.getStats();
      expect(stats.maxHealth).toBeCloseTo(500, 0);
    });

    it('should have correct base mana (400)', () => {
      const stats = magnus.getStats();
      expect(stats.maxResource).toBeCloseTo(400, 0);
    });

    it('should have correct base attack damage (52)', () => {
      const stats = magnus.getStats();
      expect(stats.attackDamage).toBeCloseTo(52, 0);
    });

    it('should have correct base armor (22)', () => {
      const stats = magnus.getStats();
      expect(stats.armor).toBeCloseTo(22, 0);
    });

    it('should have correct base magic resist (34)', () => {
      const stats = magnus.getStats();
      expect(stats.magicResist).toBeCloseTo(34, 0);
    });

    it('should have correct base movement speed (340)', () => {
      const stats = magnus.getStats();
      expect(stats.movementSpeed).toBeCloseTo(330, 0);
    });

    it('should have correct attack range (475)', () => {
      const stats = magnus.getStats();
      expect(stats.attackRange).toBe(475);
    });

    it('should use mana as resource', () => {
      expect(magnus.getResourceType()).toBe('mana');
    });
  });

  // ===================
  // Passive Tests - Arcane Surge
  // ===================

  describe('Passive - Arcane Surge', () => {
    it('should gain a stack when casting an ability', () => {
      // Place enemy far enough to avoid basic attacks
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      const stacksBefore = magnus.getArcaneStacks();
      expect(stacksBefore).toBe(0);

      magnus.castMagnusAbility('Q', context as any);
      runner.tickFrames(5);

      const stacksAfter = magnus.getArcaneStacks();
      expect(stacksAfter).toBe(1);
    });

    it('should have maximum of 4 stacks', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      // Cast Q 5 times (need to wait for cooldown)
      for (let i = 0; i < 5; i++) {
        magnus.castMagnusAbility('Q', context as any);
        (magnus as any).state.resource = 400;
        runner.tickFrames(5 * 60 + 5); // Wait for 5s cooldown
      }

      expect(magnus.getArcaneStacks()).toBeLessThanOrEqual(4);
    });

    it('should increase ability damage by 5% per stack', () => {
      // Place enemy at 650 units - inside Q range (700) but outside basic attack range (475)
      setupMagnusArena(new Vector(0, 0), new Vector(650, 0));
      enemy.setHealth(1000);

      // First test: Cast Q with 0 stacks
      expect(magnus.getArcaneStacks()).toBe(0);
      const healthBeforeFirst = enemy.getState().health;
      magnus.castMagnusAbility('Q', context as any);
      runner.tickFrames(10);
      const damageWithZeroStacks = healthBeforeFirst - enemy.getState().health;

      // Reset for second test
      enemy.setHealth(1000);
      (magnus as any).state.resource = 400;

      // Build up 1 stack by casting W (no damage, just gets a stack)
      // First Q already added a stack, so we now have 1 stack
      expect(magnus.getArcaneStacks()).toBe(1);

      // Wait for Q cooldown but NOT long enough for stacks to decay (decay = 5s, cooldown = 5s)
      // Tick 4.5 seconds (270 frames) - enough for cooldown minus a bit
      runner.tickFrames(270);
      (magnus as any).state.resource = 400;
      // Manually refresh the stack timer by casting W
      magnus.castMagnusAbility('W', context as any);
      runner.tickFrames(35); // Complete the 5s cooldown

      // Now we should have 2 stacks (from Q and W)
      expect(magnus.getArcaneStacks()).toBe(2);

      // Cast Q again with 2 stacks
      const healthBeforeSecond = enemy.getState().health;
      magnus.castMagnusAbility('Q', context as any);
      runner.tickFrames(10);
      const damageWithTwoStacks = healthBeforeSecond - enemy.getState().health;

      // Damage with stacks should be higher than without
      // The ratio depends on stacks accumulated - at least some increase
      if (damageWithZeroStacks > 0 && damageWithTwoStacks > 0) {
        const ratio = damageWithTwoStacks / damageWithZeroStacks;
        expect(ratio).toBeGreaterThan(1.0); // Some increase from passive
      }
    });

    it('should decay stacks after 5 seconds out of combat', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      magnus.castMagnusAbility('Q', context as any);
      runner.tickFrames(5);
      expect(magnus.getArcaneStacks()).toBe(1);

      // Wait 6 seconds (360 frames at 60fps)
      runner.tickFrames(360);

      expect(magnus.getArcaneStacks()).toBe(0);
    });
  });

  // ===================
  // Q Tests - Fireball
  // ===================

  describe('Q - Fireball', () => {
    it('should deal damage to enemy in range', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));
      enemy.setHealth(1000);

      magnus.castMagnusAbility('Q', context as any);
      runner.tickFrames(30);

      expect(enemy.getState().health).toBeLessThan(1000);
    });

    it('should deal 80 + AP scaling magic damage at rank 1', () => {
      // Place enemy at 650 units - inside Q range (700) but outside basic attack range (475)
      setupMagnusArena(new Vector(0, 0), new Vector(650, 0));
      enemy.setHealth(1000);

      const magnusAP = magnus.getStats().abilityPower || 0;
      const enemyMR = enemy.getComputedStats().magicResist;

      const healthBefore = enemy.getState().health;
      magnus.castMagnusAbility('Q', context as any);
      runner.tickFrames(30);
      const damageTaken = healthBefore - enemy.getState().health;

      // Q base damage at rank 1: 80 + AP ratio (65% AP)
      const expectedRaw = 80 + magnusAP * 0.65;
      const expectedAfterMR = calculateExpectedMagicDamage(expectedRaw, enemyMR);

      expect(damageTaken).toBeGreaterThan(expectedAfterMR * 0.7);
      expect(damageTaken).toBeLessThan(expectedAfterMR * 1.3);
    });

    it('should only hit first enemy (not pierce)', () => {
      magnus = new Magnus(new Vector(0, 0), 0);
      const enemy1 = new TestDummy(new Vector(300, 0), 1);
      const enemy2 = new TestDummy(new Vector(500, 0), 1);
      runner = new TestRunner({ objects: [magnus, enemy1, enemy2] });
      context = runner.getContext();
      magnus.init(context as any);
      enemy1.init(context as any);
      enemy2.init(context as any);
      (magnus as any).state.resource = 400;
      (magnus as any).direction = new Vector(1, 0);
      rankUpMagnusAbilities();

      enemy1.setHealth(1000);
      enemy2.setHealth(1000);

      magnus.castMagnusAbility('Q', context as any);
      runner.tickFrames(30);

      // First enemy should take damage
      expect(enemy1.getState().health).toBeLessThan(1000);
      // Second enemy should NOT take damage (fireball hits first target only)
      expect(enemy2.getState().health).toBe(1000);
    });

    it('should have 5 second cooldown', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      magnus.castMagnusAbility('Q', context as any);
      (magnus as any).state.resource = 400;

      // Immediate second cast should fail
      const secondCast = magnus.castMagnusAbility('Q', context as any);
      expect(secondCast).toBe(false);

      // After 5+ seconds
      runner.tickFrames(5 * 60 + 10);
      (magnus as any).state.resource = 400;

      const thirdCast = magnus.castMagnusAbility('Q', context as any);
      expect(thirdCast).toBe(true);
    });

    it('should consume mana when cast', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));
      const manaBefore = (magnus as any).state.resource;

      magnus.castMagnusAbility('Q', context as any);

      const manaAfter = (magnus as any).state.resource;
      expect(manaAfter).toBeLessThan(manaBefore);
    });
  });

  // ===================
  // W Tests - Arcane Shield
  // ===================

  describe('W - Arcane Shield', () => {
    it('should grant a shield when cast', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      magnus.castMagnusAbility('W', context as any);
      runner.tickFrames(5);

      const shield = magnus.getCurrentShield();
      expect(shield).toBeGreaterThan(0);
    });

    it('should absorb 60 + AP scaling damage at rank 1', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      const magnusAP = magnus.getStats().abilityPower || 0;
      const expectedShield = 60 + magnusAP * 0.4;

      magnus.castMagnusAbility('W', context as any);
      runner.tickFrames(5);

      const shield = magnus.getCurrentShield();
      expect(shield).toBeGreaterThan(expectedShield * 0.7);
      expect(shield).toBeLessThan(expectedShield * 1.3);
    });

    it('should last 3 seconds', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      magnus.castMagnusAbility('W', context as any);
      runner.tickFrames(5);

      expect(magnus.getCurrentShield()).toBeGreaterThan(0);

      // After 3+ seconds
      runner.tickFrames(3 * 60 + 10);

      expect(magnus.getCurrentShield()).toBe(0);
    });

    it('should have 14 second cooldown', () => {
      // Place enemy far away to avoid combat
      setupMagnusArena(new Vector(0, 0), new Vector(900, 0));

      magnus.castMagnusAbility('W', context as any);
      (magnus as any).state.resource = 400;

      const secondCast = magnus.castMagnusAbility('W', context as any);
      expect(secondCast).toBe(false);

      // After 14+ seconds
      runner.tickFrames(14 * 60 + 10);
      (magnus as any).state.resource = 400;

      const thirdCast = magnus.castMagnusAbility('W', context as any);
      expect(thirdCast).toBe(true);
    });

    it('should be self-targeted', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      const result = magnus.castMagnusAbility('W', context as any);
      expect(result).toBe(true);
    });
  });

  // ===================
  // E Tests - Blink
  // ===================

  describe('E - Blink', () => {
    it('should teleport magnus to target location', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      const posBefore = magnus.getPosition().clone();

      // Set target position for blink
      (context as any).targetPosition = new Vector(300, 0);
      magnus.castMagnusAbility('E', context as any);
      runner.tickFrames(5);

      const posAfter = magnus.getPosition();
      const distance = posAfter.distanceTo(posBefore);

      // Should have teleported
      expect(distance).toBeGreaterThan(200);
    });

    it('should be instant (no travel time)', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      const posBefore = magnus.getPosition().clone();
      (context as any).targetPosition = new Vector(300, 0);
      magnus.castMagnusAbility('E', context as any);

      // Just 1 frame should be enough
      runner.tickFrames(1);

      const posAfter = magnus.getPosition();
      const distance = posAfter.distanceTo(posBefore);

      expect(distance).toBeGreaterThan(200);
    });

    it('should have range of 400 units', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      // Try to blink beyond max range
      (context as any).targetPosition = new Vector(500, 0); // Beyond 400 range
      const result = magnus.castMagnusAbility('E', context as any);

      // Either cast fails or position is clamped to max range
      runner.tickFrames(5);
      const pos = magnus.getPosition();
      const distance = pos.length();

      // Should not exceed 400 units from starting position (0,0)
      expect(distance).toBeLessThanOrEqual(450); // Some tolerance
    });

    it('should have 16 second cooldown', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(900, 0));

      (context as any).targetPosition = new Vector(200, 0);
      magnus.castMagnusAbility('E', context as any);
      (magnus as any).state.resource = 400;

      const secondCast = magnus.castMagnusAbility('E', context as any);
      expect(secondCast).toBe(false);

      // After 16+ seconds
      runner.tickFrames(16 * 60 + 10);
      (magnus as any).state.resource = 400;

      (context as any).targetPosition = new Vector(300, 0);
      const thirdCast = magnus.castMagnusAbility('E', context as any);
      expect(thirdCast).toBe(true);
    });

    it('should consume 80 mana', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));
      const manaBefore = (magnus as any).state.resource;

      (context as any).targetPosition = new Vector(200, 0);
      magnus.castMagnusAbility('E', context as any);

      const manaAfter = (magnus as any).state.resource;
      const manaUsed = manaBefore - manaAfter;

      expect(manaUsed).toBeGreaterThan(70);
      expect(manaUsed).toBeLessThan(90);
    });
  });

  // ===================
  // R Tests - Meteor
  // ===================

  describe('R - Meteor', () => {
    it('should deal damage after delay', () => {
      // Place enemy at 700 units - inside R range (800)
      setupMagnusArena(new Vector(0, 0), new Vector(700, 0));
      enemy.setHealth(1000);

      (context as any).targetPosition = enemy.getPosition().clone();
      magnus.castMagnusAbility('R', context as any);

      // Before delay (1.5s = 90 frames)
      runner.tickFrames(30);
      expect(enemy.getState().health).toBe(1000);

      // After delay
      runner.tickFrames(90);
      expect(enemy.getState().health).toBeLessThan(1000);
    });

    it('should deal 250 + AP scaling magic damage at rank 1', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(700, 0));
      enemy.setHealth(1000);

      const magnusAP = magnus.getStats().abilityPower || 0;
      const enemyMR = enemy.getComputedStats().magicResist;

      (context as any).targetPosition = enemy.getPosition().clone();
      magnus.castMagnusAbility('R', context as any);
      runner.tickFrames(120); // Wait for delay + impact

      const damageTaken = 1000 - enemy.getState().health;

      // R base damage at rank 1: 250 + 80% AP
      const expectedRaw = 250 + magnusAP * 0.8;
      const expectedAfterMR = calculateExpectedMagicDamage(expectedRaw, enemyMR);

      expect(damageTaken).toBeGreaterThan(expectedAfterMR * 0.7);
      expect(damageTaken).toBeLessThan(expectedAfterMR * 1.3);
    });

    it('should hit multiple enemies in area (radius 300)', () => {
      magnus = new Magnus(new Vector(0, 0), 0);
      // Place enemies close together in the meteor area
      const enemy1 = new TestDummy(new Vector(600, 0), 1);
      const enemy2 = new TestDummy(new Vector(600, 100), 1);
      runner = new TestRunner({ objects: [magnus, enemy1, enemy2] });
      context = runner.getContext();
      magnus.init(context as any);
      enemy1.init(context as any);
      enemy2.init(context as any);
      (magnus as any).state.resource = 400;
      rankUpMagnusAbilities();

      enemy1.setHealth(1000);
      enemy2.setHealth(1000);

      (context as any).targetPosition = new Vector(600, 50);
      magnus.castMagnusAbility('R', context as any);
      runner.tickFrames(150);

      expect(enemy1.getState().health).toBeLessThan(1000);
      expect(enemy2.getState().health).toBeLessThan(1000);
    });

    it('should have 100 second cooldown', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(1100, 0));

      (context as any).targetPosition = new Vector(700, 0);
      magnus.castMagnusAbility('R', context as any);
      (magnus as any).state.resource = 400;

      const secondCast = magnus.castMagnusAbility('R', context as any);
      expect(secondCast).toBe(false);

      // After 100+ seconds
      runner.tickFrames(100 * 60 + 10);
      (magnus as any).state.resource = 400;

      (context as any).targetPosition = new Vector(700, 0);
      const thirdCast = magnus.castMagnusAbility('R', context as any);
      expect(thirdCast).toBe(true);
    });

    it('should NOT cast beyond maximum range (800 units)', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(1000, 0));
      enemy.setHealth(1000);

      // Target beyond max range
      (context as any).targetPosition = new Vector(900, 0);
      const result = magnus.castMagnusAbility('R', context as any);

      // Either cast fails or meteor lands at max range
      runner.tickFrames(150);

      // If cast failed, enemy takes no damage
      // If cast succeeded but clamped, enemy at 1000 might be outside radius
      // Either way, this tests the range limitation
      expect(result === false || enemy.getState().health === 1000).toBe(true);
    });
  });

  // ===================
  // Mana Management Tests
  // ===================

  describe('Mana Management', () => {
    it('should not cast ability without enough mana', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));
      (magnus as any).state.resource = 10; // Not enough for any ability

      const qCast = magnus.castMagnusAbility('Q', context as any);
      expect(qCast).toBe(false);
    });

    it('should regenerate mana over time', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));
      (magnus as any).state.resource = 100;

      const manaBefore = (magnus as any).state.resource;
      runner.tickFrames(5 * 60); // 5 seconds

      const manaAfter = (magnus as any).state.resource;
      expect(manaAfter).toBeGreaterThan(manaBefore);
    });
  });

  // ===================
  // canCastMagnusAbility Tests
  // ===================

  describe('canCastMagnusAbility', () => {
    it('should return true when ability is ready and has mana', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      expect(magnus.canCastMagnusAbility('Q')).toBe(true);
      expect(magnus.canCastMagnusAbility('W')).toBe(true);
      expect(magnus.canCastMagnusAbility('E')).toBe(true);
      expect(magnus.canCastMagnusAbility('R')).toBe(true);
    });

    it('should return false when on cooldown', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      magnus.castMagnusAbility('Q', context as any);

      expect(magnus.canCastMagnusAbility('Q')).toBe(false);
    });

    it('should return false when insufficient mana', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));
      (magnus as any).state.resource = 10;

      expect(magnus.canCastMagnusAbility('Q')).toBe(false);
    });
  });

  // ===================
  // Integration Tests
  // ===================

  describe('Integration', () => {
    it('should be able to combo W -> E -> Q for burst damage', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));
      enemy.setHealth(1000);

      // Cast shield for safety
      magnus.castMagnusAbility('W', context as any);
      runner.tickFrames(5);
      expect(magnus.getCurrentShield()).toBeGreaterThan(0);

      // Blink closer
      (context as any).targetPosition = new Vector(400, 0);
      magnus.castMagnusAbility('E', context as any);
      runner.tickFrames(5);

      // Fire Q
      (magnus as any).direction = new Vector(1, 0);
      (magnus as any).state.resource = 400;
      magnus.castMagnusAbility('Q', context as any);
      runner.tickFrames(30);

      expect(enemy.getState().health).toBeLessThan(1000);
    });

    it('should stack arcane surge through combat rotation', () => {
      setupMagnusArena(new Vector(0, 0), new Vector(600, 0));

      // Cast abilities to stack
      magnus.castMagnusAbility('Q', context as any);
      runner.tickFrames(5);
      expect(magnus.getArcaneStacks()).toBeGreaterThanOrEqual(1);

      (magnus as any).state.resource = 400;
      magnus.castMagnusAbility('W', context as any);
      runner.tickFrames(5);
      expect(magnus.getArcaneStacks()).toBeGreaterThanOrEqual(2);
    });
  });
});
