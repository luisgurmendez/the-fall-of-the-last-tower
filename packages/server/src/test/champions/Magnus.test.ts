/**
 * Magnus Champion Tests
 *
 * Tests for Magnus - a ranged mage with burst damage and zone control.
 * - Passive: Arcane Surge - every cast adds a stack; at 4, the next cast is
 *   30% stronger (whatever it is) and counts as the first stack again;
 *   the stacks fade 10 s after the last cast
 * - Q: Fireball - Skillshot projectile that deals magic damage
 * - W: Arcane Barrier - Self shield that scales with AP
 * - E: Quagmire - Ground target zone that slows enemies
 * - R: Inferno Zone - Ground target zone that deals DoT magic damage
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  EntityType,
  GameConfig,
  getAbilityDefinition,
  getPassiveDefinition,
  TEAM_BLUE,
  TEAM_RED,
  type AbilitySlot,
} from '@siege/shared';
import {
  createTestArena,
  TestArena,
  calculateMagicDamage,
} from '../ServerTestUtils';
import type { ServerEntity } from '../../simulation/ServerEntity';

const FIREBALL = getAbilityDefinition('magnus_fireball')!;
const BARRIER = getAbilityDefinition('magnus_shield')!;
const MUD = getAbilityDefinition('magnus_mud')!;
const METEOR = getAbilityDefinition('magnus_meteor')!;
const PASSIVE = getPassiveDefinition('magnus_passive')!;
/** Arcane Surge's damage multiplier (its description: 30% bonus damage) */
const SURGE = 1.3;
const FPS = 60;

/** An AP ability's damage at a rank before resistances, with Magnus's AP */
function rawDamage(arena: TestArena, abilityId: string, rank: number): number {
  const scaling = getAbilityDefinition(abilityId)!.damage!.scaling;
  return scaling.base[rank - 1] + arena.blue.getStats().abilityPower * (scaling.apRatio ?? 0);
}

function rawFireball(arena: TestArena, rank: number): number {
  return rawDamage(arena, 'magnus_fireball', rank);
}

/** Each hit Magnus lands on red (after resistances) while `run` runs */
function hitsOn(arena: TestArena, run: () => void): number[] {
  const hits: number[] = [];
  const takeDamage = arena.red.takeDamage.bind(arena.red);
  arena.red.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
    const damage = takeDamage(...args);
    if (args[2] === arena.blue.id) hits.push(damage);
    return damage;
  }) as typeof takeDamage;
  run();
  arena.red.takeDamage = takeDamage;
  return hits;
}

/** The damage of a fireball thrown at red */
function fireballDamage(arena: TestArena): number {
  const hits = hitsOn(arena, () => {
    expect(arena.castAbility(arena.blue, 'Q', { targetPosition: arena.red.position.clone() }).success).toBe(true);
    arena.tickAllFrames(2 * FPS);
  });
  expect(hits.length).toBe(1);
  return hits[0];
}

/** Burns of a zone on red while `run` runs */
const zoneHits = hitsOn;

function entitiesOf(arena: TestArena, type: EntityType): ServerEntity[] {
  return arena.context.getAllEntities().filter(entity => entity.entityType === type && !entity.isDead);
}

function projectiles(arena: TestArena): ServerEntity[] {
  return entitiesOf(arena, EntityType.PROJECTILE);
}

function zones(arena: TestArena): ServerEntity[] {
  return entitiesOf(arena, EntityType.ZONE);
}

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

    test('should have correct base health (550)', () => {
      expect(level1Arena.blue.maxHealth).toBe(550);
    });

    test('should have ranged attack range', () => {
      const { attackRange } = CHAMPION_DEFINITIONS.magnus.baseStats;
      expect(level1Arena.blue.getStats().attackRange).toBe(attackRange);
      expect(attackRange).toBeGreaterThan(100);
    });

    test('should have low base armor (24)', () => {
      expect(level1Arena.blue.getStats().armor).toBe(24);
    });

    test('should have high base mana (375)', () => {
      expect(level1Arena.blue.maxResource).toBe(375);
    });

    test('should have high mana regen (4)', () => {
      // This is set in champion definition
      expect(level1Arena.blue.definition.baseStats.resourceRegen).toBe(4);
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
        definitionId: 'ember_shard', // +20 AP
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

  // ===========================================================================
  // Edge cases, ability by ability
  // ===========================================================================

  describe('Passive - Arcane Surge', () => {
    /** Cast W (an ability that deals no damage) `times` times, cooldown and mana reset each time */
    function castW(target: TestArena, times: number): void {
      for (let i = 0; i < times; i++) {
        target.blue.resetCooldowns();
        target.blue.setResource(target.blue.maxResource);
        expect(target.castAbility(target.blue, 'W').success).toBe(true);
      }
    }

    test('each cast of any ability adds a stack, up to 4', () => {
      const slots: Array<[AbilitySlot, Vector | undefined]> = [['Q', new Vector(400, 0)], ['W', undefined], ['E', new Vector(300, 0)], ['R', new Vector(300, 0)]];
      slots.forEach(([slot, targetPosition], i) => {
        arena.blue.setResource(arena.blue.maxResource);
        arena.castAbility(arena.blue, slot, { targetPosition });
        expect(arena.blue.passiveState.stacks).toBe(i + 1);
      });
      expect(arena.blue.passiveState.isActive).toBe(true);
      castW(arena, 1);
      expect(arena.blue.passiveState.stacks).toBeLessThanOrEqual(PASSIVE.maxStacks!);
    });

    test('at 4 stacks the next ability deals 30% more damage', () => {
      const plain = fireballDamage(arena);
      const surged = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(400, 0) });
      castW(surged, PASSIVE.requiredStacks!);
      expect(surged.blue.passiveState.isActive).toBe(true);
      const surgedDamage = fireballDamage(surged);
      expect(surgedDamage).toBeCloseTo(calculateMagicDamage(rawFireball(surged, 1) * SURGE, surged.red.getStats().magicResist), 5);
      expect(surgedDamage).toBeGreaterThan(plain);
    });

    test('three stacks are not enough', () => {
      castW(arena, PASSIVE.requiredStacks! - 1);
      expect(arena.blue.passiveState.isActive).toBe(false);
      expect(fireballDamage(arena)).toBeCloseTo(calculateMagicDamage(rawFireball(arena, 1), arena.red.getStats().magicResist), 5);
    });

    test('the surge goes on whatever is cast next, even W (no damage), and that cast counts as the first stack again', () => {
      castW(arena, PASSIVE.requiredStacks!);
      const shieldBefore = arena.blue.getTotalShieldAmount();
      arena.blue.shields = [];
      castW(arena, 1);
      // The shield isn't amplified
      expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(shieldBefore / PASSIVE.requiredStacks!, 5);
      expect(arena.blue.passiveState.isActive).toBe(false);
      expect(arena.blue.passiveState.stacks).toBe(1);
      expect(fireballDamage(arena)).toBeCloseTo(calculateMagicDamage(rawFireball(arena, 1), arena.red.getStats().magicResist), 5);
    });

    test('so after the first surge, every fourth cast is surged', () => {
      castW(arena, PASSIVE.requiredStacks!);
      castW(arena, 1); // surged, and the first stack again
      castW(arena, PASSIVE.requiredStacks! - 2);
      expect(arena.blue.passiveState.isActive).toBe(false);
      castW(arena, 1);
      expect(arena.blue.passiveState.isActive).toBe(true);
    });

    test(`the stacks fade ${PASSIVE.stackDuration} s after the last cast, a ready surge too`, () => {
      castW(arena, PASSIVE.requiredStacks!);
      arena.tickFrames((PASSIVE.stackDuration! - 0.5) * FPS);
      expect(arena.blue.passiveState.isActive).toBe(true);
      arena.tickFrames(1 * FPS);
      expect(arena.blue.passiveState.stacks).toBe(0);
      expect(arena.blue.passiveState.isActive).toBe(false);
    });

    test('a cast refreshes how long they last', () => {
      castW(arena, 2);
      arena.tickFrames((PASSIVE.stackDuration! - 2) * FPS);
      castW(arena, 1);
      arena.tickFrames((PASSIVE.stackDuration! - 2) * FPS);
      expect(arena.blue.passiveState.stacks).toBe(3);
    });

    test('a failed cast neither adds a stack nor spends the surge', () => {
      castW(arena, PASSIVE.requiredStacks!);
      arena.blue.setResource(0);
      arena.blue.resetCooldowns();
      expect(arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0) }).success).toBe(false);
      expect(arena.blue.passiveState.isActive).toBe(true);
      expect(arena.blue.passiveState.stacks).toBe(PASSIVE.requiredStacks!);

      const fresh = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(400, 0) });
      fresh.blue.setResource(0);
      fresh.castAbility(fresh.blue, 'W');
      expect(fresh.blue.passiveState.stacks).toBe(0);
    });

    test('a cast stunned in its cast time adds no stack', () => {
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0), casting: true });
      arena.blue.applyEffect('stun', 1, arena.red.id);
      arena.tick();
      expect(arena.blue.isCasting()).toBe(false);
      expect(arena.blue.passiveState.stacks).toBe(0);
    });

    test("the surge raises every tick of Inferno Zone's burn", () => {
      castW(arena, PASSIVE.requiredStacks!);
      arena.blue.resetCooldowns();
      arena.red.position.x = 300;
      const ticks = zoneHits(arena, () => {
        arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(300, 0) });
        arena.tickAllFrames(2.5 * FPS);
      });
      const perTick = calculateMagicDamage(rawDamage(arena, 'magnus_meteor', 1) * SURGE, arena.red.getStats().magicResist);
      expect(ticks.length).toBeGreaterThan(1);
      for (const hit of ticks) expect(hit).toBeCloseTo(perTick, 5);
    });
  });

  describe('Q - Fireball, edge cases', () => {
    test('rank 1 and max rank: its base plus 75% AP, magic, after resist', () => {
      expect(fireballDamage(arena)).toBeCloseTo(calculateMagicDamage(rawFireball(arena, 1), arena.red.getStats().magicResist), 5);

      const max = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(400, 0) });
      max.blue.maxAbility('Q');
      max.blue.items[0] = { definitionId: 'cinder_rod', slot: 0, passiveCooldowns: {}, nextIntervalTick: {} };
      max.blue.setLevel(18);
      expect(max.blue.getStats().abilityPower).toBe(50);
      expect(fireballDamage(max)).toBeCloseTo(calculateMagicDamage(rawFireball(max, FIREBALL.maxRank), max.red.getStats().magicResist), 5);
    });

    test('it flies after the cast time, at its speed', () => {
      const result = arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0), casting: true });
      expect(result.success).toBe(true);
      expect(projectiles(arena).length).toBe(0);
      arena.blue.advanceCast(10, arena.context);
      const [fireball] = projectiles(arena);
      expect(fireball).toBeDefined();
      const at = fireball.position.x;
      arena.tickAllFrames(30);
      expect(fireball.position.x - at).toBeCloseTo(FIREBALL.projectileSpeed! * 0.5, 0);
    });

    test('it stops at the first enemy: a minion in front shields the champion behind', () => {
      const minion = arena.addMinion(TEAM_RED, new Vector(200, 0));
      const minionHealth = minion.health;
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0) });
      arena.tickAllFrames(2 * FPS);
      expect(minion.health).toBeLessThan(minionHealth);
      expect(arena.red.health).toBeGreaterThanOrEqual(health);
    });

    test("it passes allies and towers by, and hits a jungle monster", () => {
      arena.red.position.setFrom(new Vector(3000, 3000));
      const ally = arena.addMinion(TEAM_BLUE, new Vector(100, 0));
      const tower = arena.addTower(TEAM_RED, new Vector(200, 0));
      const creature = arena.addJungleCreature(new Vector(320, 0), 'wolf');
      // (The tower shoots the minion: only Magnus's hits count here)
      const hitBy = new Map<string, string[]>();
      for (const entity of [ally, tower, creature] as ServerEntity[]) {
        const takeDamage = entity.takeDamage.bind(entity);
        hitBy.set(entity.id, []);
        entity.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
          if (args[2]) hitBy.get(entity.id)!.push(args[2]);
          return takeDamage(...args);
        }) as typeof takeDamage;
      }
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0) });
      arena.tickAllFrames(2 * FPS);
      expect(hitBy.get(ally.id)).not.toContain(arena.blue.id);
      expect(hitBy.get(tower.id)).not.toContain(arena.blue.id);
      expect(hitBy.get(creature.id)).toContain(arena.blue.id);
    });

    test('it fades at its range: an enemy past it is missed', () => {
      arena.red.position.x = FIREBALL.range! + 120;
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(900, 0) });
      arena.tickAllFrames(3 * FPS);
      expect(arena.red.health).toBeGreaterThanOrEqual(health);
      expect(projectiles(arena).length).toBe(0);
    });

    test('an enemy that steps out of its line is missed', () => {
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0) });
      arena.red.position.y = FIREBALL.projectileRadius! + arena.red.getRadius() + 10;
      arena.tickAllFrames(2 * FPS);
      expect(arena.red.health).toBeGreaterThanOrEqual(health);
    });

    test('silenced or stunned: fails, nothing spent', () => {
      for (const cc of ['silence', 'stun']) {
        const ccArena = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(400, 0) });
        ccArena.blue.applyEffect(cc, 1, ccArena.red.id);
        const mana = ccArena.blue.resource;
        expect(ccArena.castAbility(ccArena.blue, 'Q', { targetPosition: new Vector(400, 0) }).success).toBe(false);
        expect(ccArena.blue.resource).toBe(mana);
        expect(projectiles(ccArena).length).toBe(0);
      }
    });

    test('mana and cooldown at rank 1 and max rank', () => {
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0) });
      expect(arena.blue.getAbilityCooldown('Q')).toBe(FIREBALL.cooldown![0]);
      arena.blue.resetCooldowns();
      arena.blue.maxAbility('Q');
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0) });
      expect(arena.blue.resource).toBe(mana - FIREBALL.manaCost![FIREBALL.maxRank - 1]);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(FIREBALL.cooldown![FIREBALL.maxRank - 1]);
    });
  });

  describe('W - Arcane Barrier, edge cases', () => {
    test('rank 1 and max rank: its base plus 40% AP', () => {
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(BARRIER.shield!.scaling.base[0], 5);

      const max = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior' });
      max.blue.maxAbility('W');
      max.blue.items[0] = { definitionId: 'cinder_rod', slot: 0, passiveCooldowns: {}, nextIntervalTick: {} };
      max.blue.invalidateStats();
      max.blue.setResource(max.blue.maxResource);
      max.castAbility(max.blue, 'W');
      expect(max.blue.getTotalShieldAmount()).toBeCloseTo(BARRIER.shield!.scaling.base[BARRIER.maxRank - 1] + 50 * BARRIER.shield!.scaling.apRatio!, 5);
    });

    test('instant, and it soaks damage of every kind', () => {
      arena.castAbility(arena.blue, 'W', { casting: true });
      expect(arena.blue.isCasting()).toBe(false);
      const health = arena.blue.health;
      arena.blue.takeDamage(20, 'magic', arena.red.id, arena.context);
      arena.blue.takeDamage(20, 'physical', arena.red.id, arena.context);
      arena.blue.takeDamage(20, 'true', arena.red.id, arena.context);
      expect(arena.blue.health).toBe(health);
    });

    test('mana and cooldown at max rank', () => {
      arena.blue.maxAbility('W');
      arena.blue.setResource(arena.blue.maxResource);
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.resource).toBe(mana - BARRIER.manaCost![BARRIER.maxRank - 1]);
      expect(arena.blue.getAbilityCooldown('W')).toBe(BARRIER.cooldown![BARRIER.maxRank - 1]);
    });

    test('silenced: fails, nothing spent', () => {
      arena.blue.applyEffect('silence', 1, arena.red.id);
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, 'W').failReason).toBe('silenced');
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.getTotalShieldAmount()).toBe(0);
    });
  });

  describe('E - Quagmire, edge cases', () => {
    test('a pool at the spot after its cast time and windup, slowing enemies in it by 20%', () => {
      arena.red.position.x = 300;
      const speed = arena.red.getStats().movementSpeed;
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(300, 0), windup: true });
      expect(zones(arena).length).toBe(0);
      arena.context.advanceTime(MUD.aoeDelay! + 1e-6);
      expect(zones(arena).length).toBe(1);
      arena.tickAll();
      expect(arena.red.hasEffect('slow_20')).toBe(true);
      expect(arena.red.getStats().movementSpeed).toBeCloseTo(speed * 0.8, 5);
    });

    test("it deals no damage, and doesn't slow Magnus or his allies", () => {
      arena.red.position.x = 300;
      const ally = arena.addMinion(TEAM_BLUE, new Vector(310, 20));
      arena.blue.position.setFrom(new Vector(250, 0));
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(300, 0) });
      arena.tickAllFrames(10);
      expect(arena.red.health).toBeGreaterThanOrEqual(health);
      expect(arena.blue.hasEffect('slow_20')).toBe(false);
      expect(ally.activeEffects.length).toBe(0);
    });

    test(`its radius: slowed at ${MUD.aoeRadius! - 1} from the middle, not at ${MUD.aoeRadius! + 1}`, () => {
      arena.red.position.setFrom(new Vector(300 + MUD.aoeRadius! - 1, 0));
      const outside = arena.addMinion(TEAM_RED, new Vector(300, MUD.aoeRadius! + 1));
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(300, 0) });
      arena.tickAll();
      expect(arena.red.hasEffect('slow_20')).toBe(true);
      expect(outside.activeEffects.length).toBe(0);
    });

    test('an enemy walking in later is slowed; the slow lingers after it leaves, then ends', () => {
      arena.red.position.x = 600;
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(300, 0) });
      arena.tickAll();
      expect(arena.red.hasEffect('slow_20')).toBe(false);
      arena.red.position.x = 300;
      arena.tickAll();
      expect(arena.red.hasEffect('slow_20')).toBe(true);
      arena.red.position.x = 600;
      arena.tickAllFrames(0.5 * FPS);
      expect(arena.red.hasEffect('slow_20')).toBe(true);
      arena.tickAllFrames((MUD.effectDuration! + 0.5) * FPS);
      expect(arena.red.hasEffect('slow_20')).toBe(false);
    });

    test(`the pool lasts ${MUD.zoneDuration} s`, () => {
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(300, 0) });
      arena.tickAllFrames((MUD.zoneDuration! - 0.1) * FPS);
      expect(zones(arena).filter(zone => !zone.isDead).length).toBe(1);
      arena.tickAllFrames(0.2 * FPS);
      expect(zones(arena).filter(zone => !zone.isDead).length).toBe(0);
    });

    test(`aimed past its range (${MUD.range}), it lands at its range toward the aim`, () => {
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(2000, 0) });
      const [zone] = zones(arena);
      expect(zone.position.x).toBeCloseTo(MUD.range!, 5);
      expect(zone.position.y).toBeCloseTo(0, 5);
    });

    test("it stays where it was cast when Magnus moves", () => {
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(300, 0) });
      arena.blue.position.setFrom(new Vector(-500, 0));
      arena.tickAll();
      expect(zones(arena)[0].position.x).toBeCloseTo(300, 5);
    });

    test('mana and cooldown at max rank', () => {
      arena.blue.maxAbility('E');
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(300, 0) });
      expect(arena.blue.resource).toBe(mana - MUD.manaCost![MUD.maxRank - 1]);
      expect(arena.blue.getAbilityCooldown('E')).toBe(MUD.cooldown![MUD.maxRank - 1]);
    });
  });

  describe('R - Inferno Zone, edge cases', () => {
    test(`nothing until the meteor falls (${METEOR.aoeDelay} s after the cast time)`, () => {
      arena.red.position.x = 300;
      const health = arena.red.health;
      arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(300, 0), windup: true });
      arena.context.advanceTime(METEOR.aoeDelay! - 0.05);
      arena.tickAll();
      expect(arena.red.health).toBeGreaterThanOrEqual(health);
      expect(zones(arena).length).toBe(0);
    });

    test(`it burns ${METEOR.zoneDuration} times, once a second, its base plus 25% AP each`, () => {
      arena.red.position.x = 300;
      const hits = zoneHits(arena, () => {
        arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(300, 0) });
        arena.tickAllFrames((METEOR.zoneDuration! + 1) * FPS);
      });
      expect(hits.length).toBe(METEOR.zoneDuration! / METEOR.zoneTickRate!);
      const perTick = calculateMagicDamage(rawDamage(arena, 'magnus_meteor', 1), arena.red.getStats().magicResist);
      for (const hit of hits) expect(hit).toBeCloseTo(perTick, 5);
    });

    test('BUG: the same number of burns whatever the server tick rate (60 Hz burned 6 times)', () => {
      for (const hz of [30, 60, 125, GameConfig.TICK.SERVER_TICK_RATE]) {
        const rate = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(300, 0) });
        const hits = zoneHits(rate, () => {
          rate.castAbility(rate.blue, 'R', { targetPosition: new Vector(300, 0) });
          rate.tickAllFrames((METEOR.zoneDuration! + 1) * hz, 1 / hz);
        });
        expect(hits.length).toBe(METEOR.zoneDuration! / METEOR.zoneTickRate!);
      }
    });

    test('max rank with AP burns harder', () => {
      const max = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', redPosition: new Vector(300, 0) });
      max.blue.maxAbility('R');
      max.blue.items[0] = { definitionId: 'cinder_rod', slot: 0, passiveCooldowns: {}, nextIntervalTick: {} };
      max.blue.setLevel(18);
      const [first] = zoneHits(max, () => {
        max.castAbility(max.blue, 'R', { targetPosition: new Vector(300, 0) });
        max.tickAllFrames(0.5 * FPS);
      });
      expect(first).toBeCloseTo(calculateMagicDamage(rawDamage(max, 'magnus_meteor', METEOR.maxRank), max.red.getStats().magicResist), 5);
    });

    test('each burn slows by 20% for a second; out of the zone it wears off', () => {
      arena.red.position.x = 300;
      arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(300, 0) });
      arena.tickAll();
      expect(arena.red.hasEffect('slow_20')).toBe(true);
      arena.red.position.x = 1000;
      arena.tickAllFrames((METEOR.effectDuration! + 0.2) * FPS);
      expect(arena.red.hasEffect('slow_20')).toBe(false);
    });

    test(`its radius: burned at ${METEOR.aoeRadius! - 1}, not at ${METEOR.aoeRadius! + 1}; towers never`, () => {
      arena.red.position.setFrom(new Vector(300 + METEOR.aoeRadius! - 1, 0));
      const outside = arena.addMinion(TEAM_RED, new Vector(300, -(METEOR.aoeRadius! + 1)));
      const tower = arena.addTower(TEAM_RED, new Vector(300, 60));
      const healths = [arena.red.health, outside.health, tower.health];
      arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(300, 0) });
      arena.tickAll();
      expect(arena.red.health).toBeLessThan(healths[0]);
      expect(outside.health).toBe(healths[1]);
      expect(tower.health).toBe(healths[2]);
    });

    test(`aimed past its range (${METEOR.range}), it lands at its range`, () => {
      arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(0, -3000) });
      const [zone] = zones(arena);
      expect(zone.position.y).toBeCloseTo(-METEOR.range!, 5);
    });

    test('an enemy walking in later burns from its next tick', () => {
      arena.red.position.x = 1000;
      const hits = zoneHits(arena, () => {
        arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(300, 0) });
        arena.tickAllFrames(0.5 * FPS);
        arena.red.position.x = 300;
        arena.tickAllFrames(1 * FPS);
      });
      expect(hits.length).toBe(1);
    });

    test('mana and cooldown by rank', () => {
      arena.blue.maxAbility('R');
      arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(300, 0) });
      expect(arena.blue.getAbilityCooldown('R')).toBe(METEOR.cooldown![METEOR.maxRank - 1]);
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
