/**
 * Gorath Champion Tests
 *
 * Tests for Gorath - a tank with crowd control and durability.
 * - Passive: Immovable - armor stacks from damage taken, gone 4 s after the last
 * - Q: Ground Slam - AoE damage and slow
 * - W: Stone Skin - Armor/MR buff
 * - E: Defiant Roar - AoE taunt: enemy champions and jungle monsters are made
 *   to walk to Gorath and attack him (nothing else) while it lasts
 * - R: Earthquake - AoE knockup
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  getAbilityDefinition,
  getCastTime,
  getPassiveDefinition,
  InputType,
  TEAM_RED,
  type AbilitySlot,
} from '@siege/shared';
import {
  createTestArena,
  TestArena,
  calculateMagicDamage,
  calculatePhysicalDamage,
} from '../ServerTestUtils';
import { Simulation } from '../../sim';
import { LaneBot } from '../../bots/LaneBot';

const BASE_STATS = CHAMPION_DEFINITIONS.gorath.baseStats;
const SLAM = getAbilityDefinition('gorath_slam')!;
const FORTIFY = getAbilityDefinition('gorath_fortify')!;
const ROAR = getAbilityDefinition('gorath_taunt')!;
const QUAKE = getAbilityDefinition('gorath_earthquake')!;
const PASSIVE = getPassiveDefinition('gorath_passive')!;
const SLAM_RADIUS = SLAM.aoeRadius!;
const ROAR_RADIUS = ROAR.aoeRadius!;
const QUAKE_RADIUS = QUAKE.aoeRadius!;
/** Inside every one of his areas */
const NEAR = Math.min(SLAM_RADIUS, ROAR_RADIUS, QUAKE_RADIUS) * 0.6;
/** Armor per stack of Immovable */
const ARMOR_PER_STACK = PASSIVE.statModifiers![0].flatValue!;
const FRAMES_PER_SECOND = 60;

/** Gorath's bonus health, as his abilities' scaling reads it */
function bonusHealth(arena: TestArena): number {
  return arena.blue.getStats().maxHealth - BASE_STATS.health;
}

/** An ability's damage before resistances at a rank, with Gorath's bonus health */
function rawDamage(arena: TestArena, abilityId: string, rank: number): number {
  const scaling = getAbilityDefinition(abilityId)!.damage!.scaling;
  return scaling.base[rank - 1] + bonusHealth(arena) * (scaling.bonusHealthRatio ?? 0);
}

describe('Gorath', () => {
  let arena: TestArena;

  // Default arena with abilities learned (for ability tests)
  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'gorath',
      redChampion: 'vex', // Squishy assassin to tank
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(NEAR, 0),
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

    test('should have highest base health (700)', () => {
      expect(level1Arena.blue.maxHealth).toBe(700);
    });

    test('should have melee attack range', () => {
      expect(level1Arena.blue.getStats().attackRange).toBe(BASE_STATS.attackRange);
      expect(BASE_STATS.attackRange).toBeLessThan(100);
    });

    test('should have highest base armor (40)', () => {
      expect(level1Arena.blue.getStats().armor).toBe(40);
    });

    test('should have high magic resist (35)', () => {
      expect(level1Arena.blue.getStats().magicResist).toBe(35);
    });

    test('should have the lowest movement speed', () => {
      expect(level1Arena.blue.getStats().movementSpeed).toBe(BASE_STATS.movementSpeed);
      const others = Object.values(CHAMPION_DEFINITIONS).filter(def => def.id !== 'gorath').map(def => def.baseStats.movementSpeed);
      expect(BASE_STATS.movementSpeed).toBeLessThan(Math.min(...others));
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

  // ===========================================================================
  // Passive - Immovable
  // ===========================================================================

  describe('Passive - Immovable', () => {
    /** One hit on Gorath, then the passive's internal cooldown passes */
    function hit(amount = 10, type: 'physical' | 'magic' = 'physical'): void {
      arena.blue.takeDamage(amount, type, arena.red.id, arena.context);
      arena.tickFrames(Math.ceil(PASSIVE.internalCooldown! * FRAMES_PER_SECOND) + 1);
    }

    test('a hit gives a stack and its armor', () => {
      const armor = arena.blue.getStats().armor;
      hit();
      expect(arena.blue.passiveState.stacks).toBe(1);
      expect(arena.blue.getStats().armor).toBeCloseTo(armor + ARMOR_PER_STACK, 5);
    });

    test('hits within its internal cooldown give one stack', () => {
      arena.blue.takeDamage(10, 'physical', arena.red.id, arena.context);
      arena.blue.takeDamage(10, 'physical', arena.red.id, arena.context);
      arena.blue.takeDamage(10, 'magic', arena.red.id, arena.context);
      expect(arena.blue.passiveState.stacks).toBe(1);
    });

    test(`stacks stop at ${PASSIVE.maxStacks}`, () => {
      const armor = arena.blue.getStats().armor;
      for (let i = 0; i < PASSIVE.maxStacks! + 3; i++) hit();
      expect(arena.blue.passiveState.stacks).toBe(PASSIVE.maxStacks!);
      expect(arena.blue.getStats().armor).toBeCloseTo(armor + ARMOR_PER_STACK * PASSIVE.maxStacks!, 5);
    });

    test('magic damage and damage from minions stack it too', () => {
      hit(10, 'magic');
      const minion = arena.addMinion(TEAM_RED, new Vector(60, 0));
      arena.blue.takeDamage(10, 'physical', minion.id, arena.context);
      expect(arena.blue.passiveState.stacks).toBe(2);
    });

    test('BUG: when the stacks run out, the armor goes back down', () => {
      const armor = arena.blue.getStats().armor;
      for (let i = 0; i < PASSIVE.maxStacks!; i++) hit();
      expect(arena.blue.getStats().armor).toBeGreaterThan(armor);

      arena.tickFrames((PASSIVE.stackDuration! + 0.5) * FRAMES_PER_SECOND);

      expect(arena.blue.passiveState.stacks).toBe(0);
      expect(arena.blue.getStats().armor).toBeCloseTo(armor, 5);
    });

    test('a hit before they run out keeps them (and the armor)', () => {
      const armor = arena.blue.getStats().armor;
      hit();
      arena.tickFrames((PASSIVE.stackDuration! - 1) * FRAMES_PER_SECOND);
      hit();
      arena.tickFrames((PASSIVE.stackDuration! - 1) * FRAMES_PER_SECOND);
      expect(arena.blue.passiveState.stacks).toBe(2);
      expect(arena.blue.getStats().armor).toBeCloseTo(armor + 2 * ARMOR_PER_STACK, 5);
    });

    test('stacks gained again after they ran out start from one', () => {
      const armor = arena.blue.getStats().armor;
      for (let i = 0; i < 4; i++) hit();
      arena.tickFrames((PASSIVE.stackDuration! + 0.5) * FRAMES_PER_SECOND);
      hit();
      expect(arena.blue.passiveState.stacks).toBe(1);
      expect(arena.blue.getStats().armor).toBeCloseTo(armor + ARMOR_PER_STACK, 5);
    });

    test('its armor cuts the physical damage he takes', () => {
      for (let i = 0; i < PASSIVE.maxStacks!; i++) hit();
      const armor = arena.blue.getStats().armor;
      arena.blue.setHealth(arena.blue.maxHealth);
      const before = arena.blue.health;
      arena.blue.takeDamage(100, 'physical', arena.red.id, arena.context);
      expect(before - arena.blue.health).toBeCloseTo(calculatePhysicalDamage(100, armor), 5);
    });
  });

  // ===========================================================================
  // Q - Ground Slam
  // ===========================================================================

  describe('Q - Ground Slam', () => {
    test('should deal AoE damage', () => {
      const initialHealth = arena.red.health;

      const result = arena.castAbility(arena.blue, 'Q');
      expect(result.success).toBe(true);

      arena.tick();

      expect(arena.red.health).toBeLessThan(initialHealth);
    });

    test('rank 1: its base plus 4% bonus health, as magic damage', () => {
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q');
      const expected = calculateMagicDamage(rawDamage(arena, 'gorath_slam', 1), arena.red.getStats().magicResist);
      expect(health - arena.red.health).toBeCloseTo(expected, 5);
    });

    test('max rank at level 18: its top base plus the bonus health', () => {
      arena.blue.setLevel(18);
      arena.blue.maxAbility('Q');
      arena.red.setLevel(18);
      arena.red.setHealth(arena.red.maxHealth);
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q');
      const expected = calculateMagicDamage(rawDamage(arena, 'gorath_slam', SLAM.maxRank), arena.red.getStats().magicResist);
      expect(health - arena.red.health).toBeCloseTo(expected, 5);
    });

    test('bonus health from items adds to it', () => {
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q');
      const without = health - arena.red.health;

      const withItem = createTestArena({ blueChampion: 'gorath', redChampion: 'vex', redPosition: new Vector(NEAR, 0) });
      withItem.blue.items[0] = { definitionId: 'bulwark_belt', slot: 0, passiveCooldowns: {}, nextIntervalTick: {} };
      withItem.blue.invalidateStats();
      const healthBefore = withItem.red.health;
      withItem.castAbility(withItem.blue, 'Q');
      const extra = calculateMagicDamage(350 * SLAM.damage!.scaling.bonusHealthRatio!, withItem.red.getStats().magicResist);
      expect(healthBefore - withItem.red.health - without).toBeCloseTo(extra, 5);
    });

    test('should apply slow to enemies', () => {
      const baseSpeed = arena.red.getStats().movementSpeed;

      arena.castAbility(arena.blue, 'Q');
      arena.tick();

      // Should be slowed by 40%
      const slowedSpeed = arena.red.getStats().movementSpeed;
      expect(slowedSpeed).toBeLessThan(baseSpeed);
    });

    test(`slows by 40% for ${SLAM.effectDuration} seconds`, () => {
      const baseSpeed = arena.red.getStats().movementSpeed;
      arena.castAbility(arena.blue, 'Q');
      expect(arena.red.getStats().movementSpeed).toBeCloseTo(baseSpeed * 0.6, 5);
      expect(arena.red.getEffect('slow_40')!.timeRemaining).toBeCloseTo(SLAM.effectDuration!, 5);

      arena.tickFrames((SLAM.effectDuration! - 0.1) * FRAMES_PER_SECOND);
      expect(arena.red.hasEffect('slow_40')).toBe(true);
      arena.tickFrames(0.2 * FRAMES_PER_SECOND);
      expect(arena.red.hasEffect('slow_40')).toBe(false);
      expect(arena.red.getStats().movementSpeed).toBe(baseSpeed);
    });

    test("doesn't slow Gorath", () => {
      arena.castAbility(arena.blue, 'Q');
      expect(arena.blue.hasEffect('slow_40')).toBe(false);
    });

    test('hits just inside its radius, not just outside', () => {
      arena.red.position.x = SLAM_RADIUS - 1;
      const inside = arena.red.health;
      arena.castAbility(arena.blue, 'Q');
      expect(arena.red.health).toBeLessThan(inside);

      const outside = createTestArena({ blueChampion: 'gorath', redChampion: 'vex', redPosition: new Vector(SLAM_RADIUS + 1, 0) });
      const health = outside.red.health;
      outside.castAbility(outside.blue, 'Q');
      expect(outside.red.health).toBe(health);
      expect(outside.red.hasEffect('slow_40')).toBe(false);
    });

    test('nothing lands before its windup ends', () => {
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { windup: true });
      arena.context.advanceTime(SLAM.aoeDelay! - 0.05);
      expect(arena.red.health).toBe(health);
      arena.context.advanceTime(0.05 + 1e-6);
      expect(arena.red.health).toBeLessThan(health);
    });

    test('it lands where Gorath stood when he cast it', () => {
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { windup: true });
      arena.blue.position.setFrom(new Vector(-1000, 0));
      arena.context.advanceTime(SLAM.aoeDelay! + 1e-6);
      expect(arena.red.health).toBeLessThan(health);
    });

    test('an enemy that steps out in the windup is missed', () => {
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { windup: true });
      arena.red.position.x = SLAM_RADIUS + 30;
      arena.context.advanceTime(SLAM.aoeDelay! + 1e-6);
      expect(arena.red.health).toBe(health);
    });

    test('Gorath dying in the windup: it never lands', () => {
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { windup: true });
      arena.blue.takeDamage(1e9, 'true');
      arena.context.advanceTime(SLAM.aoeDelay! + 1e-6);
      expect(arena.red.health).toBe(health);
    });

    test('should hit multiple enemies in range', () => {
      const minion1 = arena.addMinion(1, new Vector(SLAM_RADIUS * 0.6, 40));
      const minion2 = arena.addMinion(1, new Vector(SLAM_RADIUS * 0.6, -40));

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

    test("hits and slows a jungle monster, doesn't touch a tower", () => {
      const creature = arena.addJungleCreature(new Vector(0, SLAM_RADIUS * 0.6), 'wolf');
      const tower = arena.addTower(TEAM_RED, new Vector(-SLAM_RADIUS * 0.6, 0));
      const creatureHealth = creature.health;
      const towerHealth = tower.health;
      arena.castAbility(arena.blue, 'Q');
      expect(creature.health).toBeLessThan(creatureHealth);
      expect(creature.activeEffects.some(effect => effect.definitionId === 'slow_40')).toBe(true);
      expect(tower.health).toBe(towerHealth);
    });

    test('mana and cooldown at rank 1 and at max rank', () => {
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'Q');
      expect(arena.blue.resource).toBe(mana - SLAM.manaCost![0]);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(SLAM.cooldown![0]);

      arena.blue.resetCooldowns();
      arena.blue.maxAbility('Q');
      arena.blue.setResource(arena.blue.maxResource);
      const full = arena.blue.resource;
      arena.castAbility(arena.blue, 'Q');
      expect(arena.blue.resource).toBe(full - SLAM.manaCost![SLAM.maxRank - 1]);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(SLAM.cooldown![SLAM.maxRank - 1]);
    });

    test('should have moderate mana cost (50-70)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'Q');

      const manaCost = initialMana - arena.blue.resource;
      expect(manaCost).toBeGreaterThanOrEqual(50);
      expect(manaCost).toBeLessThanOrEqual(70);
    });

    test('on cooldown: fails', () => {
      arena.castAbility(arena.blue, 'Q');
      const mana = arena.blue.resource;
      const result = arena.castAbility(arena.blue, 'Q');
      expect(result.success).toBe(false);
      expect(result.failReason).toBe('on_cooldown');
      expect(arena.blue.resource).toBe(mana);
    });

    for (const [cc, reason] of [['stun', 'stunned'], ['silence', 'silenced']] as const) {
      test(`${cc}: fails, nothing spent, nothing lands`, () => {
        arena.blue.applyEffect(cc, 1, arena.red.id);
        const mana = arena.blue.resource;
        const health = arena.red.health;
        const result = arena.castAbility(arena.blue, 'Q');
        expect(result.success).toBe(false);
        expect(result.failReason).toBe(reason);
        expect(arena.blue.resource).toBe(mana);
        expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
        expect(arena.red.health).toBe(health);
      });
    }

    test('not enough mana: fails, nothing spent', () => {
      arena.blue.setResource(SLAM.manaCost![0] - 1);
      const result = arena.castAbility(arena.blue, 'Q');
      expect(result.success).toBe(false);
      expect(result.failReason).toBe('not_enough_mana');
      expect(arena.blue.resource).toBe(SLAM.manaCost![0] - 1);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
    });

    test('rooted: still castable (it moves no one)', () => {
      arena.blue.applyEffect('root', 1, arena.red.id);
      expect(arena.castAbility(arena.blue, 'Q').success).toBe(true);
    });
  });

  // ===========================================================================
  // W - Stone Skin
  // ===========================================================================

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

    test('max rank: the same 30%, the same mana, a shorter cooldown', () => {
      arena.blue.maxAbility('W');
      const armor = arena.blue.getStats().armor;
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.getStats().armor).toBeCloseTo(armor * 1.3, 5);
      expect(arena.blue.resource).toBe(mana - FORTIFY.manaCost![FORTIFY.maxRank - 1]);
      expect(arena.blue.getAbilityCooldown('W')).toBe(FORTIFY.cooldown![FORTIFY.maxRank - 1]);
    });

    test('casting it again refreshes it, without stacking', () => {
      const armor = arena.blue.getStats().armor;
      arena.castAbility(arena.blue, 'W');
      arena.tickFrames(2 * FRAMES_PER_SECOND);
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.getStats().armor).toBeCloseTo(armor * 1.3, 5);
      arena.tickFrames(3 * FRAMES_PER_SECOND);
      expect(arena.blue.getStats().armor).toBeCloseTo(armor * 1.3, 5);
    });

    test("it multiplies Immovable's armor too", () => {
      const armor = arena.blue.getStats().armor;
      for (let i = 0; i < PASSIVE.maxStacks!; i++) {
        arena.blue.takeDamage(1, 'physical', arena.red.id, arena.context);
        arena.tickFrames(Math.ceil(PASSIVE.internalCooldown! * FRAMES_PER_SECOND) + 1);
      }
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.getStats().armor).toBeCloseTo((armor + ARMOR_PER_STACK * PASSIVE.maxStacks!) * 1.3, 5);
    });

    test("silenced: fails, nothing spent; an enemy doesn't get it", () => {
      arena.blue.applyEffect('silence', 1, arena.red.id);
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, 'W').success).toBe(false);
      expect(arena.blue.resource).toBe(mana);

      arena.blue.removeEffect('silence');
      arena.castAbility(arena.blue, 'W');
      expect(arena.red.hasEffect('gorath_fortify_buff')).toBe(false);
    });

    test('should reduce damage taken', () => {
      // Without W
      const arena1 = createTestArena({
        blueChampion: 'gorath',
        redChampion: 'warrior',
      });
      arena1.blue.setHealth(arena1.blue.maxHealth);
      arena1.blue.takeDamage(100, 'physical', arena1.red.id, arena1.context);
      const damageWithoutW = arena1.blue.maxHealth - arena1.blue.health;

      // With W
      const arena2 = createTestArena({
        blueChampion: 'gorath',
        redChampion: 'warrior',
      });
      arena2.castAbility(arena2.blue, 'W');
      arena2.tick();
      arena2.blue.setHealth(arena2.blue.maxHealth);
      arena2.blue.takeDamage(100, 'physical', arena2.red.id, arena2.context);
      const damageWithW = arena2.blue.maxHealth - arena2.blue.health;

      // Should take less damage with W active
      expect(damageWithW).toBeLessThan(damageWithoutW);
    });
  });

  // ===========================================================================
  // E - Defiant Roar
  // ===========================================================================

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

    test('the taunt is toward Gorath, for its full duration', () => {
      arena.castAbility(arena.blue, 'E');
      const taunt = arena.red.getEffect('taunt')!;
      expect(taunt.sourceId).toBe(arena.blue.id);
      expect(taunt.timeRemaining).toBeCloseTo(ROAR.effectDuration!, 5);
    });

    test('should affect enemies at the edge of its range', () => {
      // Position enemy at edge of range
      arena.red.position.x = ROAR_RADIUS - 10;

      arena.castAbility(arena.blue, 'E');
      arena.tick();

      expect(arena.red.hasEffect('taunt')).toBe(true);
    });

    test('should not affect enemies out of range', () => {
      // Position enemy out of range
      arena.red.position.x = ROAR_RADIUS + 50;

      arena.castAbility(arena.blue, 'E');
      arena.tick();

      expect(arena.red.hasEffect('taunt')).toBe(false);
    });

    test('nothing until its windup ends', () => {
      arena.castAbility(arena.blue, 'E', { windup: true });
      expect(arena.red.hasEffect('taunt')).toBe(false);
      arena.context.advanceTime(ROAR.aoeDelay! + 1e-6);
      expect(arena.red.hasEffect('taunt')).toBe(true);
    });

    test("minions aren't taunted", () => {
      const minion = arena.addMinion(TEAM_RED, new Vector(0, ROAR_RADIUS * 0.5));
      arena.castAbility(arena.blue, 'E');
      expect(minion.activeEffects.some(effect => effect.definitionId === 'taunt')).toBe(false);
    });

    test('should have fixed mana cost (70)', () => {
      const initialMana = arena.blue.resource;

      arena.castAbility(arena.blue, 'E');

      expect(arena.blue.resource).toBe(initialMana - 70);
    });

    test('cooldown at rank 1 and at max rank', () => {
      arena.castAbility(arena.blue, 'E');
      expect(arena.blue.getAbilityCooldown('E')).toBe(ROAR.cooldown![0]);
      arena.blue.resetCooldowns();
      arena.blue.maxAbility('E');
      arena.castAbility(arena.blue, 'E');
      expect(arena.blue.getAbilityCooldown('E')).toBe(ROAR.cooldown![ROAR.maxRank - 1]);
    });

    describe('a taunted champion', () => {
      /** Kael within the roar, walking somewhere else */
      function tauntKael(): TestArena {
        const tauntArena = createTestArena({
          blueChampion: 'gorath',
          redChampion: 'warrior',
          bluePosition: new Vector(0, 0),
          redPosition: new Vector(ROAR_RADIUS - 10, 0),
        });
        tauntArena.red.setMoveTarget(new Vector(600, 0));
        tauntArena.castAbility(tauntArena.blue, 'E');
        return tauntArena;
      }

      test('BUG: walks to Gorath and attacks him', () => {
        const tauntArena = tauntKael();
        const { blue, red } = tauntArena;
        const startGap = red.position.distanceTo(blue.position);
        let attackedGorath = false;
        const takeDamage = blue.takeDamage.bind(blue);
        blue.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
          if (args[2] === red.id) attackedGorath = true;
          return takeDamage(...args);
        }) as typeof takeDamage;

        tauntArena.tickFrames((ROAR.effectDuration! - 0.1) * FRAMES_PER_SECOND);

        expect(red.targetEntityId).toBe(blue.id);
        expect(red.position.distanceTo(blue.position)).toBeLessThan(startGap - 20);
        expect(red.isInAttackRange(blue, red.getAttackRange())).toBe(true);
        expect(attackedGorath).toBe(true);
      });

      test('BUG: an order to walk elsewhere is overruled', () => {
        const tauntArena = tauntKael();
        tauntArena.tick();
        tauntArena.red.setMoveTarget(new Vector(600, 0));
        const x = tauntArena.red.position.x;
        tauntArena.tickFrames(10);
        expect(tauntArena.red.targetEntityId).toBe(tauntArena.blue.id);
        expect(tauntArena.red.position.x).toBeLessThanOrEqual(x);
      });

      test("BUG: can't cast abilities (nothing spent)", () => {
        const tauntArena = tauntKael();
        const mana = tauntArena.red.resource;
        for (const slot of ['Q', 'W', 'E'] as AbilitySlot[]) {
          const result = tauntArena.castAbility(tauntArena.red, slot, { targetPosition: new Vector(0, 0) });
          expect(result.success).toBe(false);
          expect(result.failReason).toBe('taunted');
        }
        expect(tauntArena.red.resource).toBe(mana);
        expect(tauntArena.red.getTotalShieldAmount()).toBe(0);
      });

      test("BUG: can't use summoner spells", () => {
        const tauntArena = tauntKael();
        tauntArena.red.summoners.set(['blink', 'haste']);
        const at = tauntArena.red.position.clone();
        expect(tauntArena.red.summoners.cast(0, { x: 600, y: 0 }, tauntArena.context)).toBe(false);
        expect(tauntArena.red.summoners.cast(1, {}, tauntArena.context)).toBe(false);
        expect(tauntArena.red.position.distanceTo(at)).toBeLessThan(1);
        expect(tauntArena.red.hasEffect('summoner_haste')).toBe(false);
      });

      test('BUG: a cast in its cast time is interrupted', () => {
        const castArena = createTestArena({
          blueChampion: 'gorath',
          redChampion: 'magnus',
          bluePosition: new Vector(0, 0),
          redPosition: new Vector(ROAR_RADIUS - 10, 0),
        });
        const mana = castArena.red.resource;
        expect(castArena.castAbility(castArena.red, 'Q', { targetPosition: new Vector(600, 0), casting: true }).success).toBe(true);
        expect(castArena.red.isCasting()).toBe(true);
        castArena.castAbility(castArena.blue, 'E');
        castArena.tick();
        expect(castArena.red.isCasting()).toBe(false);
        expect(castArena.red.resource).toBeGreaterThanOrEqual(mana);
        expect(castArena.red.getAbilityCooldown('Q')).toBe(0);
      });

      test('BUG: Gorath dying ends it: it can cast again', () => {
        const tauntArena = tauntKael();
        tauntArena.blue.takeDamage(1e9, 'true');
        tauntArena.tick();
        expect(tauntArena.red.hasEffect('taunt')).toBe(false);
        expect(tauntArena.castAbility(tauntArena.red, 'W').success).toBe(true);
      });

      test("BUG: a Gorath it can't see (in a bush) still pulls it in", () => {
        // Kael was out of sight when vision was last computed: Gorath is unseen
        const unseen = createTestArena({
          blueChampion: 'gorath',
          redChampion: 'warrior',
          redPosition: new Vector(3000, 3000),
        });
        expect(unseen.context.isVisibleTo(unseen.blue, unseen.red.side)).toBe(false);
        unseen.red.position.setFrom(new Vector(ROAR_RADIUS - 10, 0));
        unseen.castAbility(unseen.blue, 'E');
        unseen.tickFrames(30);
        expect(unseen.red.hasEffect('taunt')).toBe(true);
        expect(unseen.red.targetEntityId).toBe(unseen.blue.id);
        expect(unseen.red.position.x).toBeLessThan(ROAR_RADIUS - 30);
      });

      test('Gorath blinking a little away: it follows him', () => {
        const tauntArena = tauntKael();
        tauntArena.blue.position.setFrom(new Vector(-300, 0));
        tauntArena.tickFrames(30);
        expect(tauntArena.red.hasEffect('taunt')).toBe(true);
        expect(tauntArena.red.targetEntityId).toBe(tauntArena.blue.id);
        expect(tauntArena.red.position.x).toBeLessThan(ROAR_RADIUS - 30);
      });

      test('after the taunt it can cast again', () => {
        const tauntArena = tauntKael();
        tauntArena.tickFrames((ROAR.effectDuration! + 0.1) * FRAMES_PER_SECOND);
        expect(tauntArena.red.hasEffect('taunt')).toBe(false);
        expect(tauntArena.castAbility(tauntArena.red, 'W').success).toBe(true);
      });

      test('tenacity shortens it', () => {
        const tenacious = createTestArena({
          blueChampion: 'gorath',
          redChampion: 'warrior',
          redPosition: new Vector(ROAR_RADIUS - 10, 0),
        });
        tenacious.red.items[0] = { definitionId: 'mystic_treads', slot: 0, passiveCooldowns: {}, nextIntervalTick: {} };
        tenacious.red.invalidateStats();
        tenacious.castAbility(tenacious.blue, 'E');
        expect(tenacious.red.getEffect('taunt')!.timeRemaining).toBeCloseTo(ROAR.effectDuration! * (1 - 0.3), 5);
      });
    });

    describe('a taunted champion, played (orders through the input handler)', () => {
      /** Gorath and Kael side by side; Gorath roars */
      function roar() {
        const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
        const ranks = { Q: 1, W: 1, E: 1, R: 1 };
        const gorath = sim.addChampion({ playerId: 'gorath', championId: 'gorath', side: 'blue', at: { x: 0, y: 0 }, level: 6, ranks });
        const kael = sim.addChampion({
          playerId: 'kael', championId: 'warrior', side: 'red', at: { x: ROAR_RADIUS - 10, y: 0 },
          level: 6, ranks, summoners: ['blink', 'haste'],
        });
        sim.run(0.1);
        sim.cast('gorath', 'E');
        // He draws breath (cast time), then roars (its delay)
        sim.run(getCastTime(ROAR) + ROAR.aoeDelay! + 0.1);
        expect(kael.hasEffect('taunt')).toBe(true);
        return { sim, gorath, kael };
      }

      test('BUG: move, stop and recall orders are ignored; after it, they work', () => {
        const { sim, gorath, kael } = roar();
        sim.move('kael', 800, 0);
        sim.run(0.3);
        sim.stop('kael');
        sim.recall('kael');
        sim.run(0.3);
        expect(kael.targetEntityId).toBe(gorath.id);
        expect(kael.isRecalling).toBe(false);
        expect(kael.position.x).toBeLessThan(ROAR_RADIUS);

        sim.run(ROAR.effectDuration!);
        expect(kael.hasEffect('taunt')).toBe(false);
        const x = kael.position.x;
        sim.move('kael', 800, 0);
        sim.run(1);
        expect(kael.position.x).toBeGreaterThan(x + 50);
        sim.dispose();
      });

      test('BUG: ability and summoner spell orders are ignored', () => {
        const { sim, kael } = roar();
        const mana = kael.resource;
        const at = kael.position.clone();
        sim.cast('kael', 'W');
        sim.cast('kael', 'E', { x: 800, y: 0 });
        sim.input('kael', { type: InputType.SUMMONER_SPELL, slot: 0, targetX: 800, targetY: 0 });
        sim.run(0.2);
        expect(kael.shields.length).toBe(0);
        expect(kael.resource).toBeGreaterThanOrEqual(mana);
        expect(kael.abilityStates.E.cooldownRemaining).toBe(0);
        expect(kael.summoners.getState()[0].cooldownRemaining).toBe(0);
        expect(kael.position.distanceTo(at)).toBeLessThan(100);
        sim.dispose();
      });

      test('BUG: a practice bot taunted only attacks Gorath', () => {
        const { sim, gorath, kael } = roar();
        sim.addBot(new LaneBot({ playerId: 'kael' }));
        const slots: AbilitySlot[] = ['Q', 'W', 'E', 'R'];
        let cooldowns = slots.map(slot => kael.abilityStates[slot].cooldownRemaining);
        const targets = new Set<string | null>();
        let cast = false;
        for (let t = 0; t < ROAR.effectDuration! - 0.4; t += sim.dt) {
          sim.tick();
          if (!kael.hasEffect('taunt')) continue;
          targets.add(kael.targetEntityId);
          const now = slots.map(slot => kael.abilityStates[slot].cooldownRemaining);
          if (now.some((cooldown, i) => cooldown > cooldowns[i] + 1e-6)) cast = true;
          cooldowns = now;
        }
        expect([...targets]).toEqual([gorath.id]);
        expect(cast).toBe(false);
        sim.dispose();
      });

      test('BUG: Gorath out of reach (carried far away) ends it', () => {
        const { sim, gorath, kael } = roar();
        gorath.position.setFrom(new Vector(1500, 0));
        sim.run(0.2);
        expect(kael.hasEffect('taunt')).toBe(false);
        expect(kael.ccStatus.canCast).toBe(true);
        sim.dispose();
      });
    });

    describe('a taunted jungle monster', () => {
      test('BUG: an idle camp taunted turns on Gorath and bites him', () => {
        const creature = arena.addJungleCreature(new Vector(0, ROAR_RADIUS * 0.5), 'wolf');
        arena.red.position.setFrom(new Vector(3000, 3000));
        arena.castAbility(arena.blue, 'E');
        expect(creature.activeEffects.some(effect => effect.definitionId === 'taunt')).toBe(true);
        const health = arena.blue.health;
        arena.tickAllFrames(FRAMES_PER_SECOND);
        expect(creature.toSnapshot().targetEntityId).toBe(arena.blue.id);
        expect(arena.blue.health).toBeLessThan(health);
      });

      test('BUG: a monster fighting someone else switches to Gorath, and stays on him', () => {
        const fight = createTestArena({
          blueChampion: 'gorath',
          redChampion: 'warrior',
          bluePosition: new Vector(0, 0),
          redPosition: new Vector(0, -60),
        });
        const creature = fight.addJungleCreature(new Vector(0, 0), 'wolf');
        creature.takeDamage(1, 'true', fight.red.id, fight.context);
        expect(creature.toSnapshot().targetEntityId).toBe(fight.red.id);
        fight.castAbility(fight.blue, 'E');
        fight.tickAll();
        expect(creature.toSnapshot().targetEntityId).toBe(fight.blue.id);
        fight.tickAllFrames((ROAR.effectDuration! + 0.5) * FRAMES_PER_SECOND);
        expect(creature.toSnapshot().targetEntityId).toBe(fight.blue.id);
      });
    });
  });

  // ===========================================================================
  // R - Earthquake
  // ===========================================================================

  describe('R - Earthquake', () => {
    test('should knockup enemies in range', () => {
      const result = arena.castAbility(arena.blue, 'R');
      expect(result.success).toBe(true);

      // Tick 30 frames (0.5s) - effect lasts 1s so should still be active
      arena.tickAllFrames(30);

      expect(arena.red.hasEffect('knockup')).toBe(true);
    });

    test('should deal magic damage', () => {
      const initialHealth = arena.red.health;

      arena.castAbility(arena.blue, 'R');
      arena.tickAllFrames(30);

      expect(arena.red.health).toBeLessThan(initialHealth);
    });

    test('rank 1 and max rank: its base plus 6% bonus health, as magic damage', () => {
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'R');
      expect(health - arena.red.health).toBeCloseTo(
        calculateMagicDamage(rawDamage(arena, 'gorath_earthquake', 1), arena.red.getStats().magicResist), 5);

      const max = createTestArena({ blueChampion: 'gorath', redChampion: 'vex', redPosition: new Vector(NEAR, 0) });
      max.blue.maxAbility('R');
      max.blue.setLevel(18);
      max.red.setLevel(18);
      max.red.setHealth(max.red.maxHealth);
      const maxHealth = max.red.health;
      max.castAbility(max.blue, 'R');
      expect(maxHealth - max.red.health).toBeCloseTo(
        calculateMagicDamage(rawDamage(max, 'gorath_earthquake', QUAKE.maxRank), max.red.getStats().magicResist), 5);
    });

    test('knockup should prevent movement', () => {
      arena.castAbility(arena.blue, 'R');
      arena.tickAllFrames(30);

      // Knockup should prevent movement
      expect(arena.red.ccStatus.canMove).toBe(false);
    });

    test(`the knockup holds for ${QUAKE.effectDuration} s: no move, attack or cast, then free`, () => {
      arena.castAbility(arena.blue, 'R');
      expect(arena.red.getEffect('knockup')!.timeRemaining).toBeCloseTo(QUAKE.effectDuration!, 5);
      expect(arena.red.ccStatus.canMove).toBe(false);
      expect(arena.red.ccStatus.canAttack).toBe(false);
      expect(arena.castAbility(arena.red, 'W').failReason).toBe('stunned');

      arena.tickFrames((QUAKE.effectDuration! + 0.1) * FRAMES_PER_SECOND);
      expect(arena.red.ccStatus.canMove).toBe(true);
      expect(arena.red.ccStatus.canAttack).toBe(true);
      expect(arena.castAbility(arena.red, 'W').success).toBe(true);
    });

    test("tenacity doesn't shorten the knockup", () => {
      arena.red.items[0] = { definitionId: 'mystic_treads', slot: 0, passiveCooldowns: {}, nextIntervalTick: {} };
      arena.red.invalidateStats();
      arena.castAbility(arena.blue, 'R');
      expect(arena.red.getEffect('knockup')!.timeRemaining).toBeCloseTo(QUAKE.effectDuration!, 5);
    });

    test('nothing until the ground has rumbled; who steps out in time is spared', () => {
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'R', { windup: true });
      arena.context.advanceTime(QUAKE.aoeDelay! - 0.05);
      expect(arena.red.health).toBe(health);
      arena.red.position.x = QUAKE_RADIUS + 30;
      arena.context.advanceTime(0.05 + 1e-6);
      expect(arena.red.health).toBe(health);
      expect(arena.red.hasEffect('knockup')).toBe(false);
    });

    test('should hit everything within its radius', () => {
      // Add enemies at various distances
      const minion1 = arena.addMinion(1, new Vector(QUAKE_RADIUS * 0.9, 0));
      const minion2 = arena.addMinion(1, new Vector(QUAKE_RADIUS * 0.45, QUAKE_RADIUS * 0.65));
      const minion3 = arena.addMinion(1, new Vector(QUAKE_RADIUS + 60, 0)); // Out of range

      const minion1Health = minion1.health;
      const minion2Health = minion2.health;
      const minion3Health = minion3.health;

      arena.castAbility(arena.blue, 'R');
      arena.tickAllFrames(30);

      // Minions in range should take damage
      expect(minion1.health).toBeLessThan(minion1Health);
      expect(minion2.health).toBeLessThan(minion2Health);
      // Minion out of range should not
      expect(minion3.health).toBe(minion3Health);
    });

    test('just inside its radius is hit, just outside is not', () => {
      const inside = arena.addMinion(TEAM_RED, new Vector(0, QUAKE_RADIUS - 1));
      const outside = arena.addMinion(TEAM_RED, new Vector(0, -(QUAKE_RADIUS + 1)));
      const insideHealth = inside.health;
      const outsideHealth = outside.health;
      arena.castAbility(arena.blue, 'R');
      expect(inside.health).toBeLessThan(insideHealth);
      expect(outside.health).toBe(outsideHealth);
    });

    test('should have long cooldown (130s at rank 1)', () => {
      arena.castAbility(arena.blue, 'R');

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBeGreaterThanOrEqual(100);
    });

    test('mana and cooldown at rank 1 and max rank', () => {
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'R');
      expect(arena.blue.resource).toBe(mana - QUAKE.manaCost![0]);
      expect(arena.blue.getAbilityCooldown('R')).toBe(QUAKE.cooldown![0]);
      arena.blue.resetCooldowns();
      arena.blue.maxAbility('R');
      arena.castAbility(arena.blue, 'R');
      expect(arena.blue.getAbilityCooldown('R')).toBe(QUAKE.cooldown![QUAKE.maxRank - 1]);
    });

    test('not learned before level 6', () => {
      const level1 = createTestArena({ blueChampion: 'gorath', redChampion: 'vex', redPosition: new Vector(NEAR, 0), learnAbilities: false });
      const result = level1.castAbility(level1.blue, 'R');
      expect(result.success).toBe(false);
      expect(result.failReason).toBe('not_learned');
    });

    test('damage should scale with bonus health', () => {
      // Get damage without bonus health
      const arena1 = createTestArena({
        blueChampion: 'gorath',
        redChampion: 'vex',
      });
      arena1.red.setHealth(arena1.red.maxHealth);
      arena1.castAbility(arena1.blue, 'R');
      arena1.tickAllFrames(30);
      const damageWithoutHealth = arena1.red.maxHealth - arena1.red.health;

      // With bonus health item
      const arena2 = createTestArena({
        blueChampion: 'gorath',
        redChampion: 'vex',
      });
      arena2.blue.items[0] = {
        definitionId: 'bulwark_belt', // +350 health
        slot: 0,
        passiveCooldowns: {},
        nextIntervalTick: {},
      };
      arena2.red.setHealth(arena2.red.maxHealth);
      arena2.castAbility(arena2.blue, 'R');
      arena2.tickAllFrames(30);
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
      arena1.blue.takeDamage(500, 'physical', arena1.red.id, arena1.context);
      arena2.blue.takeDamage(500, 'physical', arena2.red.id, arena2.context);

      // Gorath should have more health remaining (due to higher armor and health)
      expect(arena1.blue.health).toBeGreaterThan(arena2.blue.health);
    });

    test('should be able to lock down multiple enemies with E and R', () => {
      // Add more enemies
      const minion1 = arena.addMinion(1, new Vector(NEAR, 40));
      const minion2 = arena.addMinion(1, new Vector(NEAR, -40));

      // E - Taunt
      arena.castAbility(arena.blue, 'E');
      arena.tick();

      expect(arena.red.hasEffect('taunt')).toBe(true);
      expect(minion1.health).toBeLessThanOrEqual(minion1.maxHealth);
      expect(minion2.health).toBeLessThanOrEqual(minion2.maxHealth);

      // R - Knockup (tick 30 frames - 0.5s, effect lasts 1s)
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'R');
      arena.tickAllFrames(30);

      expect(arena.red.hasEffect('knockup')).toBe(true);
    });

    test('should be effective as frontline with W active', () => {
      // Activate defensive steroid
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      // Simulate being focused
      for (let i = 0; i < 5; i++) {
        arena.blue.takeDamage(100, 'physical', arena.red.id, arena.context);
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
