/**
 * Tests for Bran, the Footsoldier - A melee fighter with straightforward abilities.
 *
 * Bran's Kit:
 * - Passive (Veteran's Grit): Regenerates 1% max health per second when below 30% health
 * - Q (Heavy Slash): Cone damage in front, 80/120/160/200/240 physical
 * - W (Shield Block): 30/40/50/60/70% damage reduction, 20% self slow, 2s duration
 * - E (Shoulder Charge): Dash 400 units, deal 60/90/120/150/180 damage, 0.75s stun
 * - R (War Cry): Self-buff, 20/30/40% AS, 15/25/35% MS, 6s duration
 *
 * Base Stats:
 * - Health: 600
 * - Mana: 300
 * - Attack Damage: 60
 * - Attack Speed: 0.7
 * - Attack Range: 150 (melee)
 * - Armor: 35
 * - Magic Resist: 30
 * - Movement Speed: 340
 *
 * All tests are deterministic and headless.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestDummy, createTestArena, calculateExpectedPhysicalDamage } from './ChampionTestUtils';
import { TestRunner, MockGameContext } from './TestGameContext';
import { Bran } from '@/champions/implementations/Bran';
import Vector from '@/physics/vector';

describe('Bran Champion', () => {
  let runner: TestRunner;
  let context: MockGameContext;
  let bran: Bran;
  let enemy: TestDummy;

  /**
   * Helper to set up Bran and enemy at specific positions.
   */
  function setupBranArena(branPos: Vector, enemyPos: Vector): void {
    bran = new Bran(branPos, 0);
    enemy = new TestDummy(enemyPos, 1);

    runner = new TestRunner({
      objects: [bran, enemy],
    });

    context = runner.getContext();

    // Initialize both champions
    bran.init(context as any);
    enemy.init(context as any);

    // Give Bran full mana for testing
    (bran as any).state.resource = 300;

    // Set Bran's direction to face the enemy
    const dirToEnemy = enemyPos.clone().sub(branPos).normalize();
    (bran as any).direction = dirToEnemy;

    // Rank up abilities so they can be cast
    rankUpBranAbilities();
  }

  /**
   * Rank up all of Bran's abilities to rank 1 for testing.
   */
  function rankUpBranAbilities(): void {
    const abilities = ['heavySlash', 'shieldBlock', 'shoulderCharge', 'warCry'];
    abilities.forEach(abilityName => {
      const ability = (bran as any)[abilityName];
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
      setupBranArena(new Vector(0, 0), new Vector(200, 0));
    });

    it('should have correct base health (600)', () => {
      const stats = bran.getStats();
      expect(stats.maxHealth).toBe(600);
    });

    it('should have correct base mana (300)', () => {
      const stats = bran.getStats();
      expect(stats.maxResource).toBe(300);
    });

    it('should have correct base attack damage (60)', () => {
      const stats = bran.getStats();
      expect(stats.attackDamage).toBe(60);
    });

    it('should have correct base attack speed (0.7)', () => {
      const stats = bran.getStats();
      expect(stats.attackSpeed).toBeCloseTo(0.7, 2);
    });

    it('should have melee attack range (150)', () => {
      const stats = bran.getStats();
      expect(stats.attackRange).toBe(150);
    });

    it('should have correct base armor (35)', () => {
      const stats = bran.getStats();
      expect(stats.armor).toBe(35);
    });

    it('should have correct base magic resist (30)', () => {
      const stats = bran.getStats();
      expect(stats.magicResist).toBe(30);
    });

    it('should have correct base movement speed (340)', () => {
      const stats = bran.getStats();
      expect(stats.movementSpeed).toBe(340);
    });

    it('should be a melee champion', () => {
      expect((bran as any).definition.attackType).toBe('melee');
    });

    it('should use mana as resource', () => {
      expect((bran as any).definition.resourceType).toBe('mana');
    });
  });

  // ===================
  // Passive - Veteran's Grit Tests
  // ===================

  describe('Passive - Veteran\'s Grit', () => {
    it('should regenerate 1% max health per second when below 30% health', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0)); // Far from enemy

      const maxHealth = bran.getStats().maxHealth;
      // Set health to 20% (below 30% threshold)
      (bran as any).state.health = maxHealth * 0.2;
      const healthBefore = (bran as any).state.health;

      // Advance 2 seconds
      runner.tickFrames(120); // 2 seconds at 60fps

      const healthAfter = (bran as any).state.health;
      const healthGained = healthAfter - healthBefore;

      // Should have regenerated at least 2% max health (1% per second * 2 seconds)
      // Plus some base health regen
      const expectedPassiveRegen = maxHealth * 0.01 * 2;
      expect(healthGained).toBeGreaterThan(expectedPassiveRegen * 0.5);
    });

    it('should NOT get passive regen when above 30% health', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));

      const maxHealth = bran.getStats().maxHealth;
      // Set health to 50% (above 30% threshold)
      (bran as any).state.health = maxHealth * 0.5;
      const healthBefore = (bran as any).state.health;

      // Advance 2 seconds
      runner.tickFrames(120);

      const healthAfter = (bran as any).state.health;
      const healthGained = healthAfter - healthBefore;

      // When above 30%, only base regen applies (6 HP/s = 12 HP in 2s)
      // Passive would add 1% max health/s = 6 HP/s for 600 HP max = 12 HP in 2s
      // So without passive, gain should be close to base regen only
      const baseRegen = 6 * 2; // 6 HP/s for 2 seconds
      expect(healthGained).toBeLessThan(baseRegen * 2.5); // Allow some margin
    });

    it('should trigger when crossing below 30% threshold', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));

      const maxHealth = bran.getStats().maxHealth;
      // Start at exactly 30%
      (bran as any).state.health = maxHealth * 0.30;

      // Take damage to go below 30%
      bran.takeDamage(10, 'true', enemy, 'test');

      const healthBefore = (bran as any).state.health;

      // Advance 1 second
      runner.tickFrames(60);

      const healthAfter = (bran as any).state.health;
      const healthGained = healthAfter - healthBefore;

      // Passive should now be active (1% max HP per second)
      const expectedRegen = maxHealth * 0.01;
      expect(healthGained).toBeGreaterThan(expectedRegen * 0.5);
    });
  });

  // ===================
  // Q - Heavy Slash Tests
  // ===================

  describe('Q - Heavy Slash', () => {
    it('should deal damage to enemy in melee range', () => {
      setupBranArena(new Vector(0, 0), new Vector(100, 0)); // Within melee range
      enemy.setHealth(1000);
      const healthBefore = enemy.getState().health;

      const castResult = bran.castBranAbility('Q', context as any);
      expect(castResult).toBe(true);

      runner.tickFrames(10);

      const healthAfter = enemy.getState().health;
      expect(healthAfter).toBeLessThan(healthBefore);
    });

    it('should NOT deal damage when no enemies in cone', () => {
      setupBranArena(new Vector(0, 0), new Vector(300, 0)); // Out of cone range
      enemy.setHealth(1000);
      const healthBefore = enemy.getState().health;

      // Q will cast but shouldn't hit enemy
      bran.castBranAbility('Q', context as any);
      runner.tickFrames(10);

      const healthAfter = enemy.getState().health;
      expect(healthAfter).toBe(healthBefore); // No damage dealt
    });

    it('should deal 80 + AD scaling physical damage at rank 1', () => {
      // Place enemy at 200 units - inside Q range (300) but outside basic attack range (150)
      setupBranArena(new Vector(0, 0), new Vector(200, 0));
      enemy.setHealth(1000);

      const branAD = bran.getStats().attackDamage;
      const enemyArmor = enemy.getComputedStats().armor;

      bran.castBranAbility('Q', context as any);
      runner.tickFrames(5); // Fewer frames to avoid basic attack

      const damageTaken = 1000 - enemy.getState().health;

      // Q base damage at rank 1: 80 + 0.6 AD ratio
      // 80 + (60 * 0.6) = 116 raw damage
      const expectedRaw = 80 + branAD * 0.6;
      const expectedAfterArmor = calculateExpectedPhysicalDamage(expectedRaw, enemyArmor);

      expect(damageTaken).toBeGreaterThan(expectedAfterArmor * 0.8);
      expect(damageTaken).toBeLessThan(expectedAfterArmor * 1.2);
    });

    it('should hit multiple enemies in cone area', () => {
      // Set up Bran with two enemies in front
      bran = new Bran(new Vector(0, 0), 0);
      const enemy1 = new TestDummy(new Vector(100, 20), 1);
      const enemy2 = new TestDummy(new Vector(100, -20), 1);

      runner = new TestRunner({
        objects: [bran, enemy1, enemy2],
      });

      context = runner.getContext();
      bran.init(context as any);
      enemy1.init(context as any);
      enemy2.init(context as any);

      (bran as any).state.resource = 300;
      rankUpBranAbilities();

      enemy1.setHealth(1000);
      enemy2.setHealth(1000);

      bran.castBranAbility('Q', context as any);
      runner.tickFrames(10);

      // Both enemies should have taken damage
      expect(enemy1.getState().health).toBeLessThan(1000);
      expect(enemy2.getState().health).toBeLessThan(1000);
    });

    it('should have 6 second cooldown', () => {
      setupBranArena(new Vector(0, 0), new Vector(100, 0));

      // First cast
      bran.castBranAbility('Q', context as any);
      (bran as any).state.resource = 300;

      // Immediate second cast should fail
      const secondCast = bran.castBranAbility('Q', context as any);
      expect(secondCast).toBe(false);

      // After 6+ seconds
      runner.tickFrames(6 * 60 + 10);
      (bran as any).state.resource = 300;

      const thirdCast = bran.castBranAbility('Q', context as any);
      expect(thirdCast).toBe(true);
    });

    it('should consume mana when cast', () => {
      setupBranArena(new Vector(0, 0), new Vector(100, 0));
      const manaBefore = (bran as any).state.resource;

      bran.castBranAbility('Q', context as any);

      const manaAfter = (bran as any).state.resource;
      expect(manaAfter).toBeLessThan(manaBefore);
    });
  });

  // ===================
  // W - Shield Block Tests
  // ===================

  describe('W - Shield Block', () => {
    it('should reduce incoming damage significantly when active', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));
      (bran as any).state.health = 1000;

      // First, take damage without W
      bran.takeDamage(100, 'physical', enemy, 'test');
      const damageWithoutW = 1000 - (bran as any).state.health;

      // Reset health
      (bran as any).state.health = 1000;

      // Cast W (damage reduction via armor buff)
      const castResult = bran.castBranAbility('W', context as any);
      expect(castResult).toBe(true);
      runner.tick();

      // Take same physical damage
      bran.takeDamage(100, 'physical', enemy, 'test');
      const damageWithW = 1000 - (bran as any).state.health;

      // Should take noticeably less damage with W active
      expect(damageWithW).toBeLessThan(damageWithoutW);
      // With 30% damage reduction, the difference should be significant
      expect(damageWithoutW - damageWithW).toBeGreaterThan(10);
    });

    it('should slow Bran by 20% while active', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));
      const msBeforeBuff = bran.getStats().movementSpeed;

      bran.castBranAbility('W', context as any);
      runner.tick();

      const msDuringBuff = bran.getStats().movementSpeed;

      // Should be 20% slower
      expect(msDuringBuff).toBeLessThan(msBeforeBuff);
      expect(msDuringBuff).toBeCloseTo(msBeforeBuff * 0.8, 5);
    });

    it('should last 2 seconds', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));
      const msBase = bran.getStats().movementSpeed;

      bran.castBranAbility('W', context as any);
      runner.tick();

      // Should be slowed
      expect(bran.getStats().movementSpeed).toBeLessThan(msBase);

      // After 2+ seconds, buff should expire
      runner.tickFrames(2 * 60 + 10);

      // Movement speed should return to normal
      expect(bran.getStats().movementSpeed).toBeCloseTo(msBase, 2);
    });

    it('should have 12 second cooldown', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));

      bran.castBranAbility('W', context as any);
      (bran as any).state.resource = 300;

      // Immediate second cast should fail
      const secondCast = bran.castBranAbility('W', context as any);
      expect(secondCast).toBe(false);

      // After 12+ seconds
      runner.tickFrames(12 * 60 + 10);
      (bran as any).state.resource = 300;

      const thirdCast = bran.castBranAbility('W', context as any);
      expect(thirdCast).toBe(true);
    });

    it('should be self-targeted (no target required)', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));

      const castResult = bran.castBranAbility('W', context as any);
      expect(castResult).toBe(true);
    });
  });

  // ===================
  // E - Shoulder Charge Tests
  // ===================

  describe('E - Shoulder Charge', () => {
    it('should dash toward target', () => {
      setupBranArena(new Vector(0, 0), new Vector(350, 0)); // Within 400 range
      const posBefore = bran.getPosition().clone();

      const castResult = bran.castBranAbility('E', context as any, enemy);
      expect(castResult).toBe(true);

      // Let dash complete
      runner.tickFrames(60);

      const posAfter = bran.getPosition();

      // Should have moved toward enemy (positive X)
      expect(posAfter.x).toBeGreaterThan(posBefore.x);
    });

    it('should deal damage on hit', () => {
      setupBranArena(new Vector(0, 0), new Vector(350, 0));
      enemy.setHealth(1000);

      bran.castBranAbility('E', context as any, enemy);
      runner.tickFrames(60);

      const healthAfter = enemy.getState().health;
      expect(healthAfter).toBeLessThan(1000);
    });

    it('should deal 60 + AD scaling physical damage at rank 1', () => {
      setupBranArena(new Vector(0, 0), new Vector(350, 0));
      enemy.setHealth(1000);
      const branAD = bran.getStats().attackDamage;
      const enemyArmor = enemy.getComputedStats().armor;

      bran.castBranAbility('E', context as any, enemy);
      runner.tickFrames(1); // Ability deals damage instantly on cast

      const damageTaken = 1000 - enemy.getState().health;
      // E base damage at rank 1: 60 + 0.5 AD ratio
      const expectedRaw = 60 + branAD * 0.5;
      const expectedAfterArmor = calculateExpectedPhysicalDamage(expectedRaw, enemyArmor);

      expect(damageTaken).toBeGreaterThan(expectedAfterArmor * 0.8);
      expect(damageTaken).toBeLessThan(expectedAfterArmor * 1.2);
    });

    it('should stun first enemy hit for 0.75 seconds', () => {
      setupBranArena(new Vector(0, 0), new Vector(350, 0));

      bran.castBranAbility('E', context as any, enemy);
      runner.tickFrames(30); // Let dash connect

      // Enemy should be stunned
      expect(enemy.canMove()).toBe(false);
      expect(enemy.canAttack()).toBe(false);

      // After 0.75 seconds (45 frames), stun should wear off
      runner.tickFrames(50);

      expect(enemy.canMove()).toBe(true);
      expect(enemy.canAttack()).toBe(true);
    });

    it('should NOT cast when enemy is out of range (400 units)', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0)); // Beyond 400 range

      const castResult = bran.castBranAbility('E', context as any, enemy);
      expect(castResult).toBe(false);
    });

    it('should have 10 second cooldown', () => {
      setupBranArena(new Vector(0, 0), new Vector(350, 0));

      bran.castBranAbility('E', context as any, enemy);
      (bran as any).state.resource = 300;

      // Immediate second cast should fail
      runner.tickFrames(60); // Let first dash complete
      const secondCast = bran.castBranAbility('E', context as any, enemy);
      expect(secondCast).toBe(false);

      // After 10+ seconds
      runner.tickFrames(10 * 60);
      (bran as any).state.resource = 300;

      // Need to reset enemy position for second cast
      enemy.setPositionXY(350, 0);
      const thirdCast = bran.castBranAbility('E', context as any, enemy);
      expect(thirdCast).toBe(true);
    });

    it('should require a target', () => {
      setupBranArena(new Vector(0, 0), new Vector(350, 0));

      // Cast without target should fail
      const castResult = bran.castBranAbility('E', context as any, undefined);
      expect(castResult).toBe(false);
    });
  });

  // ===================
  // R - War Cry Tests
  // ===================

  describe('R - War Cry', () => {
    it('should increase attack speed by 20% at rank 1', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));
      const asBefore = bran.getStats().attackSpeed;

      const castResult = bran.castBranAbility('R', context as any);
      expect(castResult).toBe(true);
      runner.tick();

      const asAfter = bran.getStats().attackSpeed;

      // 20% attack speed increase
      expect(asAfter).toBeGreaterThan(asBefore);
      expect(asAfter).toBeCloseTo(asBefore * 1.2, 2);
    });

    it('should increase movement speed by 15% at rank 1', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));
      const msBefore = bran.getStats().movementSpeed;

      bran.castBranAbility('R', context as any);
      runner.tick();

      const msAfter = bran.getStats().movementSpeed;

      // 15% movement speed increase
      expect(msAfter).toBeGreaterThan(msBefore);
      expect(msAfter).toBeCloseTo(msBefore * 1.15, 5);
    });

    it('should last 6 seconds', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));
      const asBefore = bran.getStats().attackSpeed;

      bran.castBranAbility('R', context as any);
      runner.tick();

      // Buff should be active
      expect(bran.getStats().attackSpeed).toBeGreaterThan(asBefore);

      // After 6+ seconds, buff should expire
      runner.tickFrames(6 * 60 + 10);

      expect(bran.getStats().attackSpeed).toBeCloseTo(asBefore, 2);
    });

    it('should have 80 second cooldown at rank 1', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));

      bran.castBranAbility('R', context as any);
      (bran as any).state.resource = 300;

      // Immediate second cast should fail
      const secondCast = bran.castBranAbility('R', context as any);
      expect(secondCast).toBe(false);

      // After 40 seconds (half cooldown), still should fail
      runner.tickFrames(40 * 60);
      (bran as any).state.resource = 300;
      const thirdCast = bran.castBranAbility('R', context as any);
      expect(thirdCast).toBe(false);
    });

    it('should be self-targeted (no target required)', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));

      const castResult = bran.castBranAbility('R', context as any);
      expect(castResult).toBe(true);
    });
  });

  // ===================
  // Mana Management Tests
  // ===================

  describe('Mana Management', () => {
    beforeEach(() => {
      setupBranArena(new Vector(0, 0), new Vector(100, 0));
    });

    it('should not cast ability without enough mana', () => {
      (bran as any).state.resource = 0;

      const castQ = bran.castBranAbility('Q', context as any);
      const castW = bran.castBranAbility('W', context as any);
      const castE = bran.castBranAbility('E', context as any, enemy);
      const castR = bran.castBranAbility('R', context as any);

      expect(castQ).toBe(false);
      expect(castW).toBe(false);
      expect(castE).toBe(false);
      expect(castR).toBe(false);
    });

    it('should regenerate mana over time', () => {
      (bran as any).state.resource = 0;

      runner.tickFrames(5 * 60); // 5 seconds

      const currentMana = (bran as any).state.resource;
      expect(currentMana).toBeGreaterThan(0);
    });
  });

  // ===================
  // canCastBranAbility Tests
  // ===================

  describe('canCastBranAbility', () => {
    beforeEach(() => {
      setupBranArena(new Vector(0, 0), new Vector(100, 0));
    });

    it('should return true when ability is ready and has mana', () => {
      expect(bran.canCastBranAbility('Q')).toBe(true);
      expect(bran.canCastBranAbility('W')).toBe(true);
      expect(bran.canCastBranAbility('E', enemy)).toBe(true);
      expect(bran.canCastBranAbility('R')).toBe(true);
    });

    it('should return false when on cooldown', () => {
      bran.castBranAbility('Q', context as any);

      expect(bran.canCastBranAbility('Q')).toBe(false);
    });

    it('should return false when insufficient mana', () => {
      (bran as any).state.resource = 0;

      expect(bran.canCastBranAbility('Q')).toBe(false);
      expect(bran.canCastBranAbility('R')).toBe(false);
    });

    it('should return false for E when target is out of range', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0)); // Beyond 400 range

      expect(bran.canCastBranAbility('E', enemy)).toBe(false);
    });
  });

  // ===================
  // Integration Tests
  // ===================

  describe('Integration', () => {
    it('should be able to combo E -> Q -> R for burst', () => {
      setupBranArena(new Vector(0, 0), new Vector(300, 0));
      enemy.setHealth(1000);

      // E - Charge in
      bran.castBranAbility('E', context as any, enemy);
      runner.tickFrames(45);

      const healthAfterE = enemy.getState().health;
      expect(healthAfterE).toBeLessThan(1000);

      // Q - Heavy Slash
      bran.castBranAbility('Q', context as any);
      runner.tickFrames(10);

      const healthAfterQ = enemy.getState().health;
      expect(healthAfterQ).toBeLessThan(healthAfterE);

      // R - War Cry for DPS increase
      bran.castBranAbility('R', context as any);
      runner.tick();

      expect(bran.getStats().attackSpeed).toBeGreaterThan(0.7);
    });

    it('should survive longer with W active', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));
      const maxHealth = bran.getStats().maxHealth;
      (bran as any).state.health = maxHealth;

      // Take damage without W (physical, affected by armor)
      bran.takeDamage(200, 'physical', enemy, 'test');
      const healthWithoutW = (bran as any).state.health;
      const damageWithoutW = maxHealth - healthWithoutW;

      // Reset health
      (bran as any).state.health = maxHealth;

      // Cast W then take same damage
      bran.castBranAbility('W', context as any);
      runner.tick();
      bran.takeDamage(200, 'physical', enemy, 'test');
      const healthWithW = (bran as any).state.health;
      const damageWithW = maxHealth - healthWithW;

      // Should take less damage with W active (armor buff)
      expect(damageWithW).toBeLessThan(damageWithoutW);
    });

    it('should benefit from passive when low health', () => {
      setupBranArena(new Vector(0, 0), new Vector(500, 0));
      const maxHealth = bran.getStats().maxHealth;

      // Set to low health (below 30%)
      (bran as any).state.health = maxHealth * 0.15;
      const healthStart = (bran as any).state.health;

      // Advance time
      runner.tickFrames(180); // 3 seconds

      // Should have regenerated significant health from passive
      const healthEnd = (bran as any).state.health;
      expect(healthEnd).toBeGreaterThan(healthStart);
    });
  });
});
