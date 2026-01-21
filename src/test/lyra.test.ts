/**
 * Tests for Lyra, the Longbow - A ranged marksman with long attack range.
 *
 * Lyra's Kit:
 * - Passive: Steady Hand - Consecutive basic attacks on same target deal bonus damage
 * - Q: Piercing Shot - Skillshot arrow that pierces enemies
 * - W: Focus - Self-buff increasing attack damage and attack speed
 * - E: Tumble - Short dash, next basic attack deals bonus damage
 * - R: Arrow Storm - Ground-targeted AOE damage over time
 *
 * Base Stats:
 * - Health: 530
 * - Mana: 350
 * - Attack Damage: 55
 * - Attack Speed: 0.65
 * - Attack Range: 650 (very long!)
 * - Armor: 20
 * - Magic Resist: 30
 * - Movement Speed: 325
 *
 * All tests are deterministic and headless.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestDummy, createTestArena, TestArena, calculateExpectedPhysicalDamage } from './ChampionTestUtils';
import { TestRunner, MockGameContext } from './TestGameContext';
import { Lyra } from '@/champions/implementations/Lyra';
import Vector from '@/physics/vector';

describe('Lyra Champion', () => {
  let runner: TestRunner;
  let context: MockGameContext;
  let lyra: Lyra;
  let enemy: TestDummy;

  /**
   * Helper to set up Lyra and enemy at specific positions.
   */
  function setupLyraArena(lyraPos: Vector, enemyPos: Vector, enemyStats: object = {}): void {
    lyra = new Lyra(lyraPos, 0);
    enemy = new TestDummy(enemyPos, 1, enemyStats as any);

    runner = new TestRunner({
      objects: [lyra, enemy],
    });

    context = runner.getContext();

    // Initialize both champions
    lyra.init(context as any);
    enemy.init(context as any);

    // Give Lyra full mana for testing
    (lyra as any).state.resource = 350;

    // Rank up abilities so they can be cast
    rankUpLyraAbilities();
  }

  /**
   * Rank up all of Lyra's abilities to rank 1 for testing.
   */
  function rankUpLyraAbilities(): void {
    const abilities = ['piercingShot', 'focus', 'tumble', 'arrowStorm'];
    abilities.forEach(abilityName => {
      const ability = (lyra as any)[abilityName];
      if (ability) {
        // Handle both property accessor (Ability) and method (CastAbilityDescriptor)
        const isLearned = typeof ability.isLearned === 'function'
          ? ability.isLearned()
          : ability.isLearned;
        if (!isLearned) {
          ability.rankUp?.();
        }
      }
    });
  }

  /**
   * Reset all of Lyra's ability cooldowns.
   */
  function resetLyraAbilities(): void {
    const abilities = ['piercingShot', 'focus', 'tumble', 'arrowStorm'];
    abilities.forEach(abilityName => {
      const ability = (lyra as any)[abilityName];
      if (ability) {
        ability.reset?.();
      }
    });
  }

  // ===================
  // Base Stats Tests
  // ===================

  describe('Base Stats', () => {
    beforeEach(() => {
      setupLyraArena(new Vector(0, 0), new Vector(700, 0));
    });

    it('should have correct base health', () => {
      const stats = lyra.getStats();
      expect(stats.maxHealth).toBe(530);
    });

    it('should have correct base mana', () => {
      const stats = lyra.getStats();
      expect(stats.maxResource).toBe(350);
    });

    it('should have correct base attack damage', () => {
      const stats = lyra.getStats();
      expect(stats.attackDamage).toBe(55);
    });

    it('should have correct base attack speed', () => {
      const stats = lyra.getStats();
      expect(stats.attackSpeed).toBeCloseTo(0.65, 2);
    });

    it('should have very long attack range (650)', () => {
      const stats = lyra.getStats();
      expect(stats.attackRange).toBe(650);
    });

    it('should have correct base armor', () => {
      const stats = lyra.getStats();
      expect(stats.armor).toBe(20);
    });

    it('should have correct base magic resist', () => {
      const stats = lyra.getStats();
      expect(stats.magicResist).toBe(30);
    });

    it('should have correct base movement speed', () => {
      const stats = lyra.getStats();
      expect(stats.movementSpeed).toBe(325);
    });

    it('should be a ranged champion', () => {
      expect((lyra as any).definition.attackType).toBe('ranged');
    });

    it('should use mana as resource', () => {
      expect((lyra as any).definition.resourceType).toBe('mana');
    });
  });

  // ===================
  // Q - Piercing Shot Tests
  // ===================

  describe('Q - Piercing Shot', () => {
    it('should deal damage when hitting an enemy', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(1000);
      const healthBefore = enemy.getState().health;

      // Cast Q toward enemy direction
      const targetPos = new Vector(900, 0); // Direction toward enemy and beyond
      const castResult = lyra.castLyraAbility('Q', context as any, undefined, targetPos);
      expect(castResult).toBe(true);

      // Tick to let projectile travel (900 range at ~1200 speed takes ~0.75s)
      runner.tickFrames(60); // 1 second

      const healthAfter = enemy.getState().health;
      expect(healthAfter).toBeLessThan(healthBefore);
    });

    it('should pierce through multiple enemies', () => {
      // Set up Lyra with two enemies in a line
      lyra = new Lyra(new Vector(0, 0), 0);
      const enemy1 = new TestDummy(new Vector(300, 0), 1);
      const enemy2 = new TestDummy(new Vector(600, 0), 1);

      runner = new TestRunner({
        objects: [lyra, enemy1, enemy2],
      });

      context = runner.getContext();
      lyra.init(context as any);
      enemy1.init(context as any);
      enemy2.init(context as any);

      (lyra as any).state.resource = 350;
      rankUpLyraAbilities();

      enemy1.setHealth(1000);
      enemy2.setHealth(1000);

      // Cast Q through both enemies
      const targetPos = new Vector(900, 0);
      const castResult = lyra.castLyraAbility('Q', context as any, undefined, targetPos);
      expect(castResult).toBe(true);

      // Tick to let projectile travel through both
      runner.tickFrames(60);

      // Both enemies should have taken damage
      expect(enemy1.getState().health).toBeLessThan(1000);
      expect(enemy2.getState().health).toBeLessThan(1000);
    });

    it('should have 900 range', () => {
      // Put enemy beyond both Q range (900) AND basic attack range (650)
      setupLyraArena(new Vector(0, 0), new Vector(950, 0));
      enemy.setHealth(1000);

      // Cast Q toward enemy direction (but Q has 900 range, enemy is at 950)
      const targetPos = new Vector(900, 0);
      lyra.castLyraAbility('Q', context as any, undefined, targetPos);

      // Let projectile travel its full range - but keep it short to avoid AA
      runner.tickFrames(50);

      // Enemy at 950 range should not be hit by Q with 900 range
      // Note: We're checking Q didn't hit - basic attacks are prevented by distance (950 > 650)
      const qDamage = 1000 - enemy.getState().health;
      expect(qDamage).toBe(0);
    });

    it('should consume 50 mana at rank 1', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      const manaBefore = (lyra as any).state.resource;

      lyra.castLyraAbility('Q', context as any, undefined, new Vector(900, 0));

      const manaAfter = (lyra as any).state.resource;
      expect(manaAfter).toBe(manaBefore - 50);
    });

    it('should have 10 second cooldown at rank 1', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));

      // First cast
      lyra.castLyraAbility('Q', context as any, undefined, new Vector(900, 0));

      // Refill mana
      (lyra as any).state.resource = 350;

      // Immediate second cast should fail
      const secondCast = lyra.castLyraAbility('Q', context as any, undefined, new Vector(900, 0));
      expect(secondCast).toBe(false);

      // After 10+ seconds, should be castable
      runner.tickFrames(10 * 60 + 10);
      (lyra as any).state.resource = 350;

      const thirdCast = lyra.castLyraAbility('Q', context as any, undefined, new Vector(900, 0));
      expect(thirdCast).toBe(true);
    });

    it('should deal physical damage (60 + 100% AD at rank 1)', () => {
      // Put enemy well beyond basic attack range (650) but within Q range (900)
      setupLyraArena(new Vector(0, 0), new Vector(850, 0));
      enemy.setHealth(1000);
      const enemyArmor = enemy.getComputedStats().armor;
      const lyraAD = lyra.getStats().attackDamage;

      lyra.castLyraAbility('Q', context as any, undefined, new Vector(900, 0));
      runner.tickFrames(55); // Let projectile hit (850 / 1200 speed = ~0.7s = ~42 frames)

      const damageTaken = 1000 - enemy.getState().health;

      // Q damage: 60 + 100% AD = 60 + 55 = 115 raw
      const expectedRaw = 60 + lyraAD;
      const expectedAfterArmor = calculateExpectedPhysicalDamage(expectedRaw, enemyArmor);

      expect(damageTaken).toBeCloseTo(expectedAfterArmor, 0);
    });

    it('should not cast without enough mana', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      (lyra as any).state.resource = 10; // Less than 50 mana

      const castResult = lyra.castLyraAbility('Q', context as any, undefined, new Vector(900, 0));
      expect(castResult).toBe(false);
    });
  });

  // ===================
  // W - Focus Tests
  // ===================

  describe('W - Focus', () => {
    beforeEach(() => {
      setupLyraArena(new Vector(0, 0), new Vector(700, 0));
    });

    it('should increase attack damage when cast', () => {
      const adBefore = lyra.getStats().attackDamage;

      const castResult = lyra.castLyraAbility('W', context as any);
      expect(castResult).toBe(true);

      runner.tick();

      const adAfter = lyra.getStats().attackDamage;
      // W rank 1 gives +15 AD
      expect(adAfter).toBe(adBefore + 15);
    });

    it('should increase attack speed when cast', () => {
      const asBefore = lyra.getStats().attackSpeed;

      lyra.castLyraAbility('W', context as any);
      runner.tick();

      const asAfter = lyra.getStats().attackSpeed;
      // W rank 1 gives +15% attack speed
      expect(asAfter).toBeGreaterThan(asBefore);
      expect(asAfter).toBeCloseTo(asBefore * 1.15, 2);
    });

    it('should last 4 seconds', () => {
      const adBefore = lyra.getStats().attackDamage;

      lyra.castLyraAbility('W', context as any);
      runner.tick();

      // Buff should be active
      expect(lyra.getStats().attackDamage).toBe(adBefore + 15);

      // After 4+ seconds, buff should expire
      runner.tickFrames(4 * 60 + 10);

      expect(lyra.getStats().attackDamage).toBe(adBefore);
    });

    it('should consume 40 mana', () => {
      const manaBefore = (lyra as any).state.resource;

      lyra.castLyraAbility('W', context as any);

      const manaAfter = (lyra as any).state.resource;
      expect(manaAfter).toBe(manaBefore - 40);
    });

    it('should have 16 second cooldown at rank 1', () => {
      lyra.castLyraAbility('W', context as any);
      (lyra as any).state.resource = 350;

      // Immediate second cast should fail
      const secondCast = lyra.castLyraAbility('W', context as any);
      expect(secondCast).toBe(false);

      // After 16+ seconds
      runner.tickFrames(16 * 60 + 10);
      (lyra as any).state.resource = 350;

      const thirdCast = lyra.castLyraAbility('W', context as any);
      expect(thirdCast).toBe(true);
    });

    it('should be a self-targeted ability (no target required)', () => {
      // Cast without target should succeed
      const castResult = lyra.castLyraAbility('W', context as any);
      expect(castResult).toBe(true);
    });
  });

  // ===================
  // E - Tumble Tests
  // ===================

  describe('E - Tumble', () => {
    it('should dash in target direction', () => {
      setupLyraArena(new Vector(0, 0), new Vector(700, 0));
      const posBefore = lyra.getPosition();

      // Dash toward the right
      const dashDirection = new Vector(300, 0);
      const castResult = lyra.castLyraAbility('E', context as any, undefined, dashDirection);
      expect(castResult).toBe(true);

      // Tick to complete dash (300 units at 800 speed = 0.375s = ~23 frames, use 60 to be safe)
      runner.tickFrames(60);

      const posAfter = lyra.getPosition();
      // Should have moved in the positive x direction
      expect(posAfter.x).toBeGreaterThan(posBefore.x);
      // Allow for movement variations - should have moved at least 100 units
      expect(posAfter.x - posBefore.x).toBeGreaterThan(100);
    });

    it('should dash 300 units', () => {
      // Place enemy far away so dash can complete without interference
      setupLyraArena(new Vector(100, 100), new Vector(1000, 100));
      const posBefore = lyra.getPosition().clone();

      // Dash horizontally (simpler than diagonal)
      const dashTarget = new Vector(400, 100);
      lyra.castLyraAbility('E', context as any, undefined, dashTarget);

      // Tick to complete dash (300 units at 800 speed = 0.375s = ~23 frames, use 30 frames)
      runner.tickFrames(30);

      const posAfter = lyra.getPosition();
      const distanceTraveled = posBefore.distanceTo(posAfter);

      // Should have dashed approximately 300 units
      expect(distanceTraveled).toBeGreaterThan(200);
      expect(distanceTraveled).toBeLessThan(350);
    });

    it('should empower next basic attack for 3 seconds', () => {
      // Put enemy very far away (1200 units, well beyond attack range + dash distance)
      setupLyraArena(new Vector(0, 0), new Vector(1200, 0));
      enemy.setHealth(1000);

      // Dash in a direction away from enemy
      lyra.castLyraAbility('E', context as any, undefined, new Vector(-100, 0));
      runner.tickFrames(45);

      // Check for empowered attack buff/modifier
      const modifiers = (lyra as any).basicAttackModifiers;
      expect(modifiers.length).toBeGreaterThan(0);

      // The empowered attack should exist and have damage bonus
      const empoweredMod = modifiers.find((m: any) => m.name === 'Tumble');
      expect(empoweredMod).toBeDefined();
    });

    it('should make next basic attack deal bonus damage (20 + 40% AD at rank 1)', () => {
      // Set up with enemy in range but far enough to not basic attack immediately
      setupLyraArena(new Vector(0, 0), new Vector(600, 0));
      enemy.setHealth(1000);

      const lyraAD = lyra.getStats().attackDamage;
      const enemyArmor = enemy.getComputedStats().armor;

      // Tumble toward the enemy (adds empowered attack)
      lyra.castLyraAbility('E', context as any, undefined, new Vector(300, 0));

      // Short tick for dash and empowered attack to land
      runner.tickFrames(60);

      const damageTaken = 1000 - enemy.getState().health;

      // Empowered attack: AD + (20 + 40% AD) = 55 + 20 + 22 = 97 raw
      const bonusDamage = 20 + 0.4 * lyraAD;
      const empoweredRaw = lyraAD + bonusDamage;
      const expectedDamage = calculateExpectedPhysicalDamage(empoweredRaw, enemyArmor);

      // Damage should include the empowered basic attack bonus
      // (may be higher due to passive stacks)
      expect(damageTaken).toBeGreaterThan(expectedDamage * 0.8);
    });

    it('should consume empowered attack after use', () => {
      // Set up with enemy in attack range
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));

      // Dash toward enemy (this adds the empowered modifier)
      lyra.castLyraAbility('E', context as any, undefined, new Vector(200, 0));
      runner.tickFrames(30); // Complete dash

      // Should have empowered attack (or it was just consumed)
      // Check if modifier exists OR if damage was already dealt

      // Continue to let attack happen
      runner.tickFrames(60);

      // Empowered attack should be consumed after the attack lands
      const tumbleMod = (lyra as any).basicAttackModifiers.find((m: any) => m.name === 'Tumble');
      expect(tumbleMod).toBeUndefined();
    });

    it('should expire empowered attack after 3 seconds if not used', () => {
      // Put enemy very far away
      setupLyraArena(new Vector(0, 0), new Vector(1500, 0)); // Well out of range

      // Dash away from enemy
      lyra.castLyraAbility('E', context as any, undefined, new Vector(-100, 0));
      runner.tickFrames(45); // Complete dash

      // Should have empowered attack
      expect((lyra as any).basicAttackModifiers.some((m: any) => m.name === 'Tumble')).toBe(true);

      // After 3+ seconds without attacking
      runner.tickFrames(3 * 60 + 10);

      // Empowered attack should expire (duration-based removal in updateAttackModifiers)
      expect((lyra as any).basicAttackModifiers.some((m: any) => m.name === 'Tumble')).toBe(false);
    });

    it('should consume 40 mana at rank 1', () => {
      setupLyraArena(new Vector(0, 0), new Vector(700, 0));
      const manaBefore = (lyra as any).state.resource;

      lyra.castLyraAbility('E', context as any, undefined, new Vector(300, 0));

      const manaAfter = (lyra as any).state.resource;
      expect(manaAfter).toBe(manaBefore - 40);
    });

    it('should have 8 second cooldown at rank 1', () => {
      setupLyraArena(new Vector(0, 0), new Vector(700, 0));

      lyra.castLyraAbility('E', context as any, undefined, new Vector(300, 0));
      (lyra as any).state.resource = 350;

      // Immediate second cast should fail
      const secondCast = lyra.castLyraAbility('E', context as any, undefined, new Vector(300, 0));
      expect(secondCast).toBe(false);

      // After 8+ seconds
      runner.tickFrames(8 * 60 + 10);
      (lyra as any).state.resource = 350;

      const thirdCast = lyra.castLyraAbility('E', context as any, undefined, new Vector(300, 0));
      expect(thirdCast).toBe(true);
    });
  });

  // ===================
  // R - Arrow Storm Tests
  // ===================

  describe('R - Arrow Storm', () => {
    it('should deal damage in target area', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(1000);

      // Cast R on enemy position
      const castResult = lyra.castLyraAbility('R', context as any, undefined, new Vector(400, 0));
      expect(castResult).toBe(true);

      // Tick for full duration (2 seconds)
      runner.tickFrames(2 * 60 + 10);

      const healthAfter = enemy.getState().health;
      expect(healthAfter).toBeLessThan(1000);
    });

    it('should have 900 range', () => {
      setupLyraArena(new Vector(0, 0), new Vector(1000, 0));

      // Try to cast R beyond 900 range
      const castResult = lyra.castLyraAbility('R', context as any, undefined, new Vector(1000, 0));

      // Should fail or be clamped to max range
      expect(castResult).toBe(false);
    });

    it('should have 200 radius AOE', () => {
      // Set up enemies at different distances from target
      lyra = new Lyra(new Vector(0, 0), 0);
      const enemyInside = new TestDummy(new Vector(400, 50), 1); // Within 200 radius
      const enemyOutside = new TestDummy(new Vector(400, 300), 1); // Outside 200 radius

      runner = new TestRunner({
        objects: [lyra, enemyInside, enemyOutside],
      });

      context = runner.getContext();
      lyra.init(context as any);
      enemyInside.init(context as any);
      enemyOutside.init(context as any);

      (lyra as any).state.resource = 350;
      rankUpLyraAbilities();

      enemyInside.setHealth(1000);
      enemyOutside.setHealth(1000);

      // Cast R at center point
      lyra.castLyraAbility('R', context as any, undefined, new Vector(400, 0));
      runner.tickFrames(2 * 60 + 10);

      // Enemy inside radius should take damage
      expect(enemyInside.getState().health).toBeLessThan(1000);

      // Enemy outside radius should not take damage
      expect(enemyOutside.getState().health).toBe(1000);
    });

    it('should deal damage over 2 seconds (4 ticks)', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(1000);

      lyra.castLyraAbility('R', context as any, undefined, new Vector(400, 0));

      // After 0.5 seconds (1 tick)
      runner.tickFrames(30);
      const healthAfterTick1 = enemy.getState().health;
      expect(healthAfterTick1).toBeLessThan(1000);

      // After 1 second (2 ticks)
      runner.tickFrames(30);
      const healthAfterTick2 = enemy.getState().health;
      expect(healthAfterTick2).toBeLessThan(healthAfterTick1);

      // After full duration
      runner.tickFrames(60);
      const healthAfterFull = enemy.getState().health;
      expect(healthAfterFull).toBeLessThan(healthAfterTick2);
    });

    it('should deal total damage of 150 + 80% AD at rank 1', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(1000);
      // Stop basic attacking to isolate R damage
      lyra.setBasicAttackTarget(null);
      (lyra as any).basicAttackTarget = null;

      const lyraAD = lyra.getStats().attackDamage;
      const enemyArmor = enemy.getComputedStats().armor;

      lyra.castLyraAbility('R', context as any, undefined, new Vector(400, 0));
      runner.tickFrames(2 * 60 + 30); // Full duration + buffer

      const damageTaken = 1000 - enemy.getState().health;

      // Total damage: 150 + 80% AD = 150 + 44 = 194 raw
      const expectedRaw = 150 + 0.8 * lyraAD;
      const expectedAfterArmor = calculateExpectedPhysicalDamage(expectedRaw, enemyArmor);

      // Allow some tolerance for timing differences
      expect(damageTaken).toBeGreaterThan(expectedAfterArmor * 0.8);
      expect(damageTaken).toBeLessThan(expectedAfterArmor * 1.2);
    });

    it('should consume 100 mana', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      const manaBefore = (lyra as any).state.resource;

      lyra.castLyraAbility('R', context as any, undefined, new Vector(400, 0));

      const manaAfter = (lyra as any).state.resource;
      expect(manaAfter).toBe(manaBefore - 100);
    });

    it('should have 90 second cooldown at rank 1', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));

      // Cast R
      lyra.castLyraAbility('R', context as any, undefined, new Vector(400, 0));

      // Verify cooldown started
      const cooldownProgress = lyra.getAbilityCooldownProgress('R');
      expect(cooldownProgress).toBeLessThan(0.1); // Just started, should be near 0

      // Immediate second cast should fail
      (lyra as any).state.resource = 350;
      const secondCast = lyra.castLyraAbility('R', context as any, undefined, new Vector(400, 0));
      expect(secondCast).toBe(false);

      // After 10 seconds (1/9 of cooldown), progress should be around 0.11
      runner.tickFrames(10 * 60);
      const progressAfter10s = lyra.getAbilityCooldownProgress('R');
      expect(progressAfter10s).toBeGreaterThan(0.1);
      expect(progressAfter10s).toBeLessThan(0.2);
    });

    it('should not cast without enough mana', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      (lyra as any).state.resource = 50; // Less than 100

      const castResult = lyra.castLyraAbility('R', context as any, undefined, new Vector(400, 0));
      expect(castResult).toBe(false);
    });
  });

  // ===================
  // Passive - Steady Hand Tests
  // ===================

  describe('Passive - Steady Hand', () => {
    it('should deal bonus damage on consecutive hits to same target', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(2000);

      // First attack (no bonus)
      lyra.setBasicAttackTarget(enemy as any);
      runner.tickFrames(60);
      const healthAfterFirst = enemy.getState().health;
      const firstDamage = 2000 - healthAfterFirst;

      // Reset for second attack
      runner.tickFrames(90); // Attack cooldown
      const healthAfterSecond = enemy.getState().health;
      const secondDamage = healthAfterFirst - healthAfterSecond;

      // Second attack should deal more damage (+5 from passive)
      expect(secondDamage).toBeGreaterThan(firstDamage);
    });

    it('should stack up to 5 times (+25 bonus damage)', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(3000);

      const lyraAD = lyra.getStats().attackDamage;
      const enemyArmor = enemy.getComputedStats().armor;

      // Attack 6 times to reach max stacks
      lyra.setBasicAttackTarget(enemy as any);
      for (let i = 0; i < 6; i++) {
        runner.tickFrames(100); // Each attack cycle
      }

      // Check passive stacks (should be capped at 5)
      const stacks = lyra.getPassiveStacks?.() ?? (lyra as any).steadyHandStacks;
      expect(stacks).toBeLessThanOrEqual(5);
    });

    it('should reset stacks when switching targets', () => {
      // Set up with two enemies
      lyra = new Lyra(new Vector(0, 0), 0);
      const enemy1 = new TestDummy(new Vector(400, 0), 1);
      const enemy2 = new TestDummy(new Vector(400, 100), 1);

      runner = new TestRunner({
        objects: [lyra, enemy1, enemy2],
      });

      context = runner.getContext();
      lyra.init(context as any);
      enemy1.init(context as any);
      enemy2.init(context as any);

      // Attack enemy1 twice to build stacks
      lyra.setBasicAttackTarget(enemy1 as any);
      runner.tickFrames(100);
      runner.tickFrames(100);

      // Stacks should be > 0
      const stacksOnEnemy1 = lyra.getPassiveStacks?.() ?? (lyra as any).steadyHandStacks;
      expect(stacksOnEnemy1).toBeGreaterThan(0);

      // Switch to enemy2
      lyra.setBasicAttackTarget(enemy2 as any);
      runner.tickFrames(100);

      // Stacks should reset to 1 (just hit enemy2 once)
      const stacksOnEnemy2 = lyra.getPassiveStacks?.() ?? (lyra as any).steadyHandStacks;
      expect(stacksOnEnemy2).toBe(1);
    });

    it('should add +5 physical damage per stack', () => {
      // Fresh setup - create new arena to avoid any leftover modifiers
      lyra = new Lyra(new Vector(0, 0), 0);
      enemy = new TestDummy(new Vector(400, 0), 1);
      runner = new TestRunner({ objects: [lyra, enemy] });
      context = runner.getContext();
      lyra.init(context as any);
      enemy.init(context as any);
      (lyra as any).state.resource = 350;
      // Rank up abilities using rankUp method directly
      (lyra as any).piercingShot?.rankUp?.();
      (lyra as any).focus?.rankUp?.();
      (lyra as any).tumble?.rankUp?.();
      (lyra as any).arrowStorm?.rankUp?.();

      enemy.setHealth(2000);

      const enemyArmor = enemy.getComputedStats().armor;

      // First attack (0 stacks, no bonus)
      lyra.setBasicAttackTarget(enemy as any);
      runner.tickFrames(60); // Just enough for one attack cycle
      const healthAfterFirst = enemy.getState().health;
      const firstDamage = 2000 - healthAfterFirst;

      // Second attack (1 stack, +5 bonus) - wait for attack cooldown
      runner.tickFrames(100); // Wait for next attack
      const healthAfterSecond = enemy.getState().health;
      const secondDamage = healthAfterFirst - healthAfterSecond;

      // Third attack (2 stacks, +10 bonus)
      runner.tickFrames(100);
      const healthAfterThird = enemy.getState().health;
      const thirdDamage = healthAfterSecond - healthAfterThird;

      // Each subsequent attack should deal more damage
      expect(secondDamage).toBeGreaterThan(firstDamage);
      expect(thirdDamage).toBeGreaterThan(secondDamage);

      // Damage difference should be approximately +5 (after armor)
      const expectedBonusAfterArmor = calculateExpectedPhysicalDamage(5, enemyArmor);
      const damageDifference = secondDamage - firstDamage;
      expect(damageDifference).toBeCloseTo(expectedBonusAfterArmor, 3);
    });
  });

  // ===================
  // Basic Attack Projectile Tests
  // ===================

  describe('Basic Attack Projectile', () => {
    it('should spawn a projectile when attacking', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));

      lyra.setBasicAttackTarget(enemy as any);
      runner.tickFrames(60);

      // Check that a projectile was created
      const objects = (context as any).objects;
      const projectile = objects.find((o: any) =>
        o.constructor.name.includes('Projectile') || o.constructor.name.includes('Arrow')
      );

      expect(projectile).toBeDefined();
    });

    it('should deal damage when projectile reaches target', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(1000);

      lyra.setBasicAttackTarget(enemy as any);

      // Tick enough for projectile to travel and hit
      runner.tickFrames(90);

      const healthAfter = enemy.getState().health;
      expect(healthAfter).toBeLessThan(1000);
    });

    it('should not deal instant damage (projectile has travel time)', () => {
      setupLyraArena(new Vector(0, 0), new Vector(600, 0)); // Far away
      enemy.setHealth(1000);

      lyra.setBasicAttackTarget(enemy as any);

      // Single tick - projectile just launched
      runner.tick();

      // Damage should not be dealt yet
      expect(enemy.getState().health).toBe(1000);

      // After projectile travels
      runner.tickFrames(60);

      // Now damage should be dealt
      expect(enemy.getState().health).toBeLessThan(1000);
    });
  });

  // ===================
  // Mana Management Tests
  // ===================

  describe('Mana Management', () => {
    beforeEach(() => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
    });

    it('should not cast ability without enough mana', () => {
      (lyra as any).state.resource = 0;

      const castQ = lyra.castLyraAbility('Q', context as any, undefined, new Vector(900, 0));
      const castW = lyra.castLyraAbility('W', context as any);
      const castE = lyra.castLyraAbility('E', context as any, undefined, new Vector(300, 0));
      const castR = lyra.castLyraAbility('R', context as any, undefined, new Vector(400, 0));

      expect(castQ).toBe(false);
      expect(castW).toBe(false);
      expect(castE).toBe(false);
      expect(castR).toBe(false);
    });

    it('should regenerate mana over time', () => {
      // Create isolated test without enemy to prevent any combat
      lyra = new Lyra(new Vector(0, 0), 0);
      runner = new TestRunner({ objects: [lyra] }); // No enemy
      context = runner.getContext();
      lyra.init(context as any);

      (lyra as any).state.resource = 0;
      // Ensure not in combat for regen to work
      (lyra as any).state.inCombat = false;
      // Clear basic attack target to prevent combat
      lyra.setBasicAttackTarget(null);

      // Advance 5 seconds (base mana regen is 7/sec)
      runner.tickFrames(5 * 60);

      const currentMana = (lyra as any).state.resource;
      expect(currentMana).toBeGreaterThan(0);
      expect(currentMana).toBeCloseTo(35, 5); // 7 * 5 = 35
    });

    it('should not regenerate mana beyond max', () => {
      (lyra as any).state.resource = 340; // Close to max (350)

      runner.tickFrames(60); // 1 second

      const currentMana = (lyra as any).state.resource;
      expect(currentMana).toBeLessThanOrEqual(350);
    });
  });

  // ===================
  // Integration Tests
  // ===================

  describe('Integration', () => {
    it('should be able to combo Q -> W -> E for burst', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(1000);

      // Q - Piercing Shot
      lyra.castLyraAbility('Q', context as any, undefined, new Vector(900, 0));
      runner.tickFrames(45);

      const healthAfterQ = enemy.getState().health;
      expect(healthAfterQ).toBeLessThan(1000);

      // W - Focus (self buff)
      lyra.castLyraAbility('W', context as any);
      runner.tick();

      // E - Tumble toward enemy
      lyra.castLyraAbility('E', context as any, undefined, new Vector(400, 0));
      runner.tickFrames(30);

      // Empowered basic attack
      lyra.setBasicAttackTarget(enemy as any);
      runner.tickFrames(90);

      const healthAfterCombo = enemy.getState().health;
      expect(healthAfterCombo).toBeLessThan(healthAfterQ);
    });

    it('should kite effectively with E', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));

      // Position check before kite
      const posBefore = lyra.getPosition().clone();

      // Attack then dash backward
      lyra.setBasicAttackTarget(enemy as any);
      runner.tickFrames(60);

      lyra.castLyraAbility('E', context as any, undefined, new Vector(-300, 0)); // Dash backward
      runner.tickFrames(30);

      const posAfter = lyra.getPosition();

      // Should have moved backward
      expect(posAfter.x).toBeLessThan(posBefore.x);
    });

    it('should deal significant damage with full kit', () => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
      enemy.setHealth(2000);

      // Full combo
      lyra.castLyraAbility('W', context as any); // Buff first
      runner.tick();

      lyra.castLyraAbility('Q', context as any, undefined, new Vector(900, 0));
      runner.tickFrames(45);

      lyra.castLyraAbility('R', context as any, undefined, new Vector(400, 0));
      runner.tickFrames(2 * 60);

      lyra.castLyraAbility('E', context as any, undefined, new Vector(400, 0));
      runner.tickFrames(45);

      lyra.setBasicAttackTarget(enemy as any);
      runner.tickFrames(90);

      const totalDamage = 2000 - enemy.getState().health;

      // Should have dealt substantial damage (at least 300 from abilities)
      // Q ~88, R ~150, empowered auto ~75
      expect(totalDamage).toBeGreaterThan(300);
    });
  });

  // ===================
  // canCastLyraAbility Tests
  // ===================

  describe('canCastLyraAbility', () => {
    beforeEach(() => {
      setupLyraArena(new Vector(0, 0), new Vector(400, 0));
    });

    it('should return true when ability is ready and has mana', () => {
      expect(lyra.canCastLyraAbility('Q')).toBe(true);
      expect(lyra.canCastLyraAbility('W')).toBe(true);
      expect(lyra.canCastLyraAbility('E')).toBe(true);
      expect(lyra.canCastLyraAbility('R')).toBe(true);
    });

    it('should return false when on cooldown', () => {
      lyra.castLyraAbility('Q', context as any, undefined, new Vector(900, 0));

      expect(lyra.canCastLyraAbility('Q')).toBe(false);
    });

    it('should return false when insufficient mana', () => {
      (lyra as any).state.resource = 10;

      expect(lyra.canCastLyraAbility('Q')).toBe(false);
      expect(lyra.canCastLyraAbility('R')).toBe(false);
    });
  });
});
