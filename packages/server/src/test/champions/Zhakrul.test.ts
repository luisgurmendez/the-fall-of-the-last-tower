/**
 * Zhak'rul Champion Tests
 *
 * Zhak'rul - The Ancient Scorpion, a melee fighter on ability power:
 * - Passive (Ancient Venom): basic attacks, Toxic Cloud and Death Stinger
 *   poison (magic damage each second per dose, up to 3; at 3 it's ancient)
 * - Q (Deadly Pincers): a cone, harder on the poisoned
 * - W (Toxic Cloud): a cloud that slows and hurts more each second an enemy stays
 * - E (Burrowed Ambush): underground to a spot, under walls too, then a knock-up
 * - R (Death Stinger): a stun and a deadly dose
 */

import { describe, test, expect } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  EntityType,
  GameEventType,
  TEAM_BLUE,
  TEAM_RED,
  ZHAKRUL_KIT,
  ZHAKRUL_VENOM,
  calculateMagicDamage,
  getAbilityDefinition,
  getCastTime,
  type ItemSlot,
  type Side,
} from '@siege/shared';
import { createTestArena, TestChampion, type TestArena } from '../ServerTestUtils';
import type { ServerEntity } from '../../simulation/ServerEntity';
import { ServerZone } from '../../simulation/ServerZone';
import { poison, venomStacks, venomTickDamage } from '../../abilities/handlers/zhakrul/venom';
import { findWallCrossing } from '../wallSpots';

const DT = 1 / 30;
const Q = getAbilityDefinition('zhakrul_q')!;
const W = getAbilityDefinition('zhakrul_w')!;
const E = getAbilityDefinition('zhakrul_e')!;
const R = getAbilityDefinition('zhakrul_r')!;

/** Open ground (the middle of the map has walls within 400): red's base, clear of its nexus (an obstacle) */
const O = new Vector(2075, -1950);
const at = (x: number, y: number) => new Vector(O.x + x, O.y + y);

/** Zhak'rul (blue, at O) and Magnus (red), both at `level`, healthy and with full mana */
function zhakrulArena(redAt = at(80, 0), level = 6): TestArena {
  const arena = createTestArena({ blueChampion: 'zhakrul', redChampion: 'magnus', bluePosition: O, redPosition: redAt });
  for (const champion of [arena.blue, arena.red]) {
    champion.setLevel(level);
    // (Leveling up raises max health, not health)
    champion.setHealth(champion.maxHealth);
    champion.setResource(champion.maxResource);
  }
  arena.context.flushEvents();
  return arena;
}

/** The damage blue dealt `target` since the last flush, one entry per hit */
function hitsOn(arena: TestArena, target: ServerEntity, source: ServerEntity = arena.blue): number[] {
  return arena.context.flushEvents()
    .filter(e => e.type === GameEventType.DAMAGE && e.data.entityId === target.id && e.data.sourceId === source.id)
    .map(e => e.data.amount as number);
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function tickFor(arena: TestArena, seconds: number): void {
  arena.tickFrames(Math.round(seconds / DT), DT);
}

function tickAllFor(arena: TestArena, seconds: number): void {
  arena.tickAllFrames(Math.round(seconds / DT), DT);
}

/** Tick (everything when `all`) for `seconds`, collecting blue's hits on `target` */
function hitsOver(arena: TestArena, target: ServerEntity, seconds: number, all = false): number[] {
  const hits: number[] = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    if (all) arena.tickAll(DT);
    else arena.tick(DT);
    hits.push(...hitsOn(arena, target));
  }
  return hits;
}

function castFresh(arena: TestArena, slot: 'Q' | 'W' | 'E' | 'R', options: { targetPosition?: Vector; targetId?: string; windup?: boolean; casting?: boolean } = {}) {
  arena.blue.resetCooldowns();
  arena.blue.setResource(arena.blue.maxResource);
  return arena.castAbility(arena.blue, slot, options);
}

function give(champion: TestChampion, itemId: string, slot = 0): void {
  champion.items[slot] = { definitionId: itemId, slot: slot as ItemSlot, passiveCooldowns: {}, nextIntervalTick: {} };
  champion.invalidateStats();
  champion.getStats();
}

function addChampion(arena: TestArena, id: string, side: Side, position: Vector, championId = 'magnus'): TestChampion {
  const champion = new TestChampion({ id, position, side, playerId: `player-${id}`, definition: CHAMPION_DEFINITIONS[championId] });
  arena.context.addChampion(champion, `player-${id}`);
  champion.setLevel(6);
  champion.setHealth(champion.maxHealth);
  champion.setResource(champion.maxResource);
  return champion;
}

function rankUp(champion: TestChampion, slot: 'Q' | 'W' | 'E' | 'R', rank: number): void {
  champion.setLevel(Math.max(champion.level, 16));
  while (champion.abilityStates[slot].rank < rank) {
    champion.skillPoints++;
    champion.levelUpAbility(slot);
  }
  champion.setResource(champion.maxResource);
}

const magicOn = (target: TestChampion, raw: number) => calculateMagicDamage(raw, target.getStats().magicResist);

/** One venom tick per dose (before magic resist), not ancient */
function perDose(zhakrul: TestChampion): number {
  return ZHAKRUL_VENOM.perStackBase + ZHAKRUL_VENOM.perStackPerLevel * zhakrul.level
    + ZHAKRUL_VENOM.perStackApRatio * zhakrul.getStats().abilityPower;
}

/** Tick until blue's next basic attack hits red */
function untilAttackLands(arena: TestArena): void {
  arena.blue.setAttackTarget(arena.red.id);
  for (let t = 0; t < 3; t += DT) {
    arena.tick(DT);
    if (venomStacks(arena.blue, arena.red, arena.context) > 0 && arena.red.getEffect('zhakrul_venom')) {
      const stacks = venomStacks(arena.blue, arena.red, arena.context);
      if (stacks > 0) return;
    }
  }
}

// =============================================================================
// Passive: Ancient Venom
// =============================================================================

describe("Zhak'rul passive: Ancient Venom", () => {
  test('a basic attack gives its target a dose: zhakrul_venom, for 3 seconds', () => {
    const arena = zhakrulArena();
    untilAttackLands(arena);
    expect(venomStacks(arena.blue, arena.red, arena.context)).toBe(1);
    const mark = arena.red.getEffect('zhakrul_venom')!;
    expect(mark.stacks).toBe(1);
    expect(mark.timeRemaining).toBeGreaterThan(ZHAKRUL_VENOM.duration - 0.1);
  });

  test('each dose ticks once a second for 2 + 0.5 per level + 3% AP, magic: 2.5 a dose at level 1', () => {
    const arena = zhakrulArena(at(80, 0), 1);
    expect(perDose(arena.blue)).toBeCloseTo(2.5, 5);
    poison(arena.blue, arena.red, 1, arena.context);
    const ticks = hitsOver(arena, arena.red, ZHAKRUL_VENOM.duration + 0.5);
    expect(ticks.length).toBe(ZHAKRUL_VENOM.duration / ZHAKRUL_VENOM.tickEvery);
    for (const tick of ticks) expect(tick).toBeCloseTo(magicOn(arena.red, 2.5), 3);
  });

  test('at level 18: 11 a dose', () => {
    const arena = zhakrulArena(at(80, 0), 18);
    expect(perDose(arena.blue)).toBeCloseTo(11, 5);
    expect(venomTickDamage(arena.blue, 1)).toBeCloseTo(11, 5);
  });

  test('ability power raises it 3% per dose', () => {
    const arena = zhakrulArena();
    give(arena.blue, 'cinder_rod');
    expect(venomTickDamage(arena.blue, 1)).toBeCloseTo(2 + 0.5 * 6 + 0.03 * 50, 5);
  });

  test('doses add up to 3; at 3 the venom is ancient: 40% more, and its own effect', () => {
    const arena = zhakrulArena();
    poison(arena.blue, arena.red, 2, arena.context);
    expect(venomStacks(arena.blue, arena.red, arena.context)).toBe(2);
    expect(arena.red.hasEffect('zhakrul_ancient_venom')).toBe(false);
    expect(venomTickDamage(arena.blue, 2)).toBeCloseTo(perDose(arena.blue) * 2, 5);
    poison(arena.blue, arena.red, 5, arena.context);
    expect(venomStacks(arena.blue, arena.red, arena.context)).toBe(ZHAKRUL_VENOM.maxStacks);
    expect(arena.red.getEffect('zhakrul_venom')!.stacks).toBe(3);
    expect(arena.red.hasEffect('zhakrul_ancient_venom')).toBe(true);
    expect(venomTickDamage(arena.blue, 3)).toBeCloseTo(perDose(arena.blue) * 3 * ZHAKRUL_VENOM.ancientMultiplier, 5);
    const tick = hitsOver(arena, arena.red, 1.05)[0];
    expect(tick).toBeCloseTo(magicOn(arena.red, venomTickDamage(arena.blue, 3)), 3);
  });

  test('a new dose makes it last 3 seconds from then', () => {
    const arena = zhakrulArena();
    poison(arena.blue, arena.red, 1, arena.context);
    tickFor(arena, 2);
    poison(arena.blue, arena.red, 1, arena.context);
    tickFor(arena, 2.5);
    expect(venomStacks(arena.blue, arena.red, arena.context)).toBe(2);
    tickFor(arena, 1);
    expect(venomStacks(arena.blue, arena.red, arena.context)).toBe(0);
    expect(arena.red.hasEffect('zhakrul_venom')).toBe(false);
  });

  test('it wears off 3 seconds after the last dose: no more ticks', () => {
    const arena = zhakrulArena();
    poison(arena.blue, arena.red, 1, arena.context);
    tickFor(arena, ZHAKRUL_VENOM.duration + 0.3);
    arena.context.flushEvents();
    expect(hitsOver(arena, arena.red, 2).length).toBe(0);
  });

  test('a cleanse cures it', () => {
    const arena = zhakrulArena();
    poison(arena.blue, arena.red, 3, arena.context);
    tickFor(arena, 0.5);
    arena.red.cleanse();
    expect(hitsOver(arena, arena.red, 3).length).toBe(0);
    expect(venomStacks(arena.blue, arena.red, arena.context)).toBe(0);
  });

  test('the ticks keep going after he dies', () => {
    const arena = zhakrulArena();
    poison(arena.blue, arena.red, 1, arena.context);
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    expect(hitsOver(arena, arena.red, ZHAKRUL_VENOM.duration + 0.5).length).toBe(3);
  });

  test('jungle monsters are poisoned too (kept on him: they hold no effects)', () => {
    const arena = zhakrulArena(at(600, 0));
    const monster = arena.addJungleCreature(at(60, 0));
    poison(arena.blue, monster, 2, arena.context);
    expect(venomStacks(arena.blue, monster, arena.context)).toBe(2);
    const health = monster.health;
    arena.tickAllFrames(Math.round(1.1 / DT), DT);
    expect(monster.health).toBeLessThan(health);
  });

  test('minions are marked; towers, allies and himself are never poisoned', () => {
    const arena = zhakrulArena(at(600, 0));
    const minion = arena.addMinion(TEAM_RED, at(60, 0));
    const tower = arena.addTower(TEAM_RED, at(-100, 0));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(0, 60));
    poison(arena.blue, minion, 1, arena.context);
    poison(arena.blue, tower, 1, arena.context);
    poison(arena.blue, ally, 1, arena.context);
    poison(arena.blue, arena.blue, 1, arena.context);
    expect(minion.activeEffects.some(e => e.definitionId === 'zhakrul_venom')).toBe(true);
    expect(venomStacks(arena.blue, tower, arena.context)).toBe(0);
    expect(venomStacks(arena.blue, ally, arena.context)).toBe(0);
    expect(venomStacks(arena.blue, arena.blue, arena.context)).toBe(0);
  });

  test('a basic attack on a tower poisons nothing', () => {
    const arena = zhakrulArena(at(600, 0));
    const tower = arena.addTower(TEAM_RED, at(70, 0));
    arena.blue.setAttackTarget(tower.id);
    tickFor(arena, 2);
    expect(tower.health).toBeLessThan(tower.maxHealth);
    expect(venomStacks(arena.blue, tower, arena.context)).toBe(0);
  });

  test('three attacks in a row make it ancient', () => {
    const arena = zhakrulArena();
    arena.blue.setAttackTarget(arena.red.id);
    for (let t = 0; t < 8 && venomStacks(arena.blue, arena.red, arena.context) < 3; t += DT) arena.tick(DT);
    expect(venomStacks(arena.blue, arena.red, arena.context)).toBe(3);
    expect(arena.red.hasEffect('zhakrul_ancient_venom')).toBe(true);
  });

  test("the venom is his ability damage (a design choice: Veil blocks its first tick, not the attack)", () => {
    const arena = zhakrulArena();
    give(arena.red, 'stormward_veil');
    poison(arena.blue, arena.red, 1, arena.context);
    const ticks = hitsOver(arena, arena.red, 3.2);
    expect(ticks.length).toBe(2);
  });
});

// =============================================================================
// Q: Deadly Pincers
// =============================================================================

describe("Zhak'rul Q: Deadly Pincers", () => {
  const snap = (arena: TestArena, aim = at(200, 0)) => castFresh(arena, 'Q', { targetPosition: aim });

  test('rank 1: 50 + 50% AP magic to the enemies in front of him', () => {
    const arena = zhakrulArena(at(100, 0));
    give(arena.blue, 'cinder_rod');
    const ap = arena.blue.getStats().abilityPower;
    expect(snap(arena).success).toBe(true);
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 50 + 0.5 * ap), 3);
  });

  test('10% more per dose of venom on the target, as the pincers close', () => {
    for (const doses of [1, 2, 3]) {
      const arena = zhakrulArena(at(100, 0));
      poison(arena.blue, arena.red, doses, arena.context);
      arena.context.flushEvents();
      snap(arena);
      expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 50 * (1 + ZHAKRUL_KIT.pincerBonusPerStack * doses)), 3);
    }
  });

  test('rank 5: 170, 5 s cooldown; 40 mana', () => {
    const arena = zhakrulArena(at(100, 0));
    rankUp(arena.blue, 'Q', 5);
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'Q', { targetPosition: at(200, 0) });
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 170), 3);
    expect(arena.blue.getAbilityCooldown('Q')).toBeCloseTo(5, 5);
    expect(arena.blue.resource).toBeCloseTo(mana - 40, 5);
  });

  test('the aimed cast time, then the 0.2 s snap', () => {
    const arena = zhakrulArena(at(100, 0));
    castFresh(arena, 'Q', { targetPosition: at(200, 0), casting: true });
    expect(arena.blue.isCasting()).toBe(true);
    tickFor(arena, 0.25 + 0.1);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    tickFor(arena, 0.15);
    expect(hitsOn(arena, arena.red).length).toBe(1);
  });

  test('150 reach: just inside hit, just outside missed', () => {
    const inside = zhakrulArena(at(Q.range! - 1, 0));
    snap(inside);
    expect(hitsOn(inside, inside.red).length).toBe(1);
    const outside = zhakrulArena(at(Q.range! + 2, 0));
    snap(outside);
    expect(hitsOn(outside, outside.red).length).toBe(0);
  });

  test('a 90 degree cone: inside its edge hit, outside missed, behind missed', () => {
    const angle = Q.coneAngle! / 2;
    const inside = zhakrulArena(at(Math.cos(angle - 0.05) * 100, Math.sin(angle - 0.05) * 100));
    snap(inside);
    expect(hitsOn(inside, inside.red).length).toBe(1);
    const outside = zhakrulArena(at(Math.cos(angle + 0.05) * 100, Math.sin(angle + 0.05) * 100));
    snap(outside);
    expect(hitsOn(outside, outside.red).length).toBe(0);
    const behind = zhakrulArena(at(-80, 0));
    snap(behind);
    expect(hitsOn(behind, behind.red).length).toBe(0);
  });

  test('minions and monsters too; never allies or towers', () => {
    const arena = zhakrulArena(at(0, 600));
    const minion = arena.addMinion(TEAM_RED, at(100, 20));
    const monster = arena.addJungleCreature(at(100, -30));
    const tower = arena.addTower(TEAM_RED, at(120, 0));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(60, 0));
    const towerHealth = tower.health;
    snap(arena);
    expect(minion.health).toBeLessThan(minion.maxHealth);
    expect(monster.health).toBeLessThan(monster.maxHealth);
    expect(tower.health).toBe(towerHealth);
    expect(ally.health).toBe(ally.maxHealth);
  });

  test("it doesn't poison", () => {
    const arena = zhakrulArena(at(100, 0));
    snap(arena);
    expect(venomStacks(arena.blue, arena.red, arena.context)).toBe(0);
  });

  test('killed before the snap: nothing', () => {
    const arena = zhakrulArena(at(100, 0));
    castFresh(arena, 'Q', { targetPosition: at(200, 0), windup: true });
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    arena.context.flushEvents();
    tickFor(arena, 0.3);
    expect(hitsOn(arena, arena.red).length).toBe(0);
  });
});

// =============================================================================
// W: Toxic Cloud
// =============================================================================

describe("Zhak'rul W: Toxic Cloud", () => {
  const cloudOf = (arena: TestArena) => arena.context.getAllEntities()
    .find((e): e is ServerZone => e.entityType === EntityType.ZONE && e instanceof ServerZone && e.abilityId === 'zhakrul_w' && !e.isDead);

  test('a cloud of 190 around him for 4 seconds', () => {
    const arena = zhakrulArena(at(600, 0));
    expect(castFresh(arena, 'W').success).toBe(true);
    const cloud = cloudOf(arena)!;
    expect(cloud.radius).toBe(W.aoeRadius!);
    expect(cloud.position.distanceTo(O)).toBeLessThan(0.01);
    tickAllFor(arena, ZHAKRUL_KIT.cloudDuration - 0.2);
    expect(cloudOf(arena)).toBeDefined();
    tickAllFor(arena, 0.4);
    expect(cloudOf(arena)).toBeUndefined();
  });

  test('an enemy staying in it takes 10 + 10% AP each second, 25% more each second: 1, 1.25, 1.5, 1.75', () => {
    const arena = zhakrulArena(at(100, 0));
    castFresh(arena, 'W');
    // (The venom's own ticks come at the same moments: look for each of the cloud's)
    const hits = hitsOver(arena, arena.red, 3.6, true);
    for (let seconds = 0; seconds < 4; seconds++) {
      const expected = magicOn(arena.red, 10 * (1 + ZHAKRUL_KIT.cloudGrowth * seconds));
      expect(hits.some(hit => Math.abs(hit - expected) < 0.01)).toBe(true);
    }
    // ...and nothing past its 4 seconds
    expect(hits.some(hit => Math.abs(hit - magicOn(arena.red, 10 * (1 + ZHAKRUL_KIT.cloudGrowth * 4))) < 0.01)).toBe(false);
  });

  test('each second in it is a dose of venom: ancient after three', () => {
    const arena = zhakrulArena(at(100, 0));
    castFresh(arena, 'W');
    arena.tickAll(DT);
    expect(venomStacks(arena.blue, arena.red, arena.context)).toBe(1);
    tickAllFor(arena, 2.05);
    expect(venomStacks(arena.blue, arena.red, arena.context)).toBe(3);
    expect(arena.red.hasEffect('zhakrul_ancient_venom')).toBe(true);
  });

  test('enemies in it are slowed 30%, a second after they leave too', () => {
    const arena = zhakrulArena(at(100, 0));
    castFresh(arena, 'W');
    arena.tickAll(DT);
    expect(arena.red.hasEffect('slow_30')).toBe(true);
    arena.red.position.setFrom(at(W.aoeRadius! + 50, 0));
    tickAllFor(arena, 0.8);
    expect(arena.red.hasEffect('slow_30')).toBe(true);
    tickAllFor(arena, 0.4);
    expect(arena.red.hasEffect('slow_30')).toBe(false);
  });

  test('leaving the cloud starts the count over', () => {
    const arena = zhakrulArena(at(100, 0));
    castFresh(arena, 'W');
    tickAllFor(arena, 1.5);
    arena.red.position.setFrom(at(W.aoeRadius! + 100, 0));
    tickAllFor(arena, 1);
    arena.red.position.setFrom(at(100, 0));
    const hits = hitsOver(arena, arena.red, 1, true);
    // Its third second in the cloud would have been 50% more; it's a first second again
    expect(hits.some(hit => Math.abs(hit - magicOn(arena.red, 10)) < 0.01)).toBe(true);
    expect(hits.some(hit => Math.abs(hit - magicOn(arena.red, 15)) < 0.01)).toBe(false);
  });

  test('the cloud stays where he breathed it out', () => {
    const arena = zhakrulArena(at(100, 0));
    castFresh(arena, 'W');
    arena.blue.position.setFrom(at(-600, 0));
    const hits = hitsOver(arena, arena.red, 1.5, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(cloudOf(arena)!.position.distanceTo(O)).toBeLessThan(0.01);
  });

  test('just inside it is hurt, just outside is not', () => {
    const inside = zhakrulArena(at(W.aoeRadius! - 1, 0));
    castFresh(inside, 'W');
    expect(hitsOver(inside, inside.red, 0.1, true).length).toBe(1);
    const outside = zhakrulArena(at(W.aoeRadius! + 1, 0));
    castFresh(outside, 'W');
    expect(hitsOver(outside, outside.red, 0.1, true).length).toBe(0);
  });

  test('allies untouched; minions and monsters hurt; towers not', () => {
    const arena = zhakrulArena(at(0, 700));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(60, 0));
    const minion = arena.addMinion(TEAM_RED, at(-60, 0));
    const monster = arena.addJungleCreature(at(0, 100));
    const tower = arena.addTower(TEAM_RED, at(0, -120));
    const towerHealth = tower.health;
    castFresh(arena, 'W');
    arena.tickAll(DT);
    expect(ally.health).toBe(ally.maxHealth);
    expect(ally.hasEffect('slow_30')).toBe(false);
    expect(minion.health).toBeLessThan(minion.maxHealth);
    expect(monster.health).toBeLessThan(monster.maxHealth);
    expect(tower.health).toBe(towerHealth);
  });

  test('instant, 70 mana, 14 s cooldown (10 s at rank 5)', () => {
    const arena = zhakrulArena(at(600, 0));
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'W', { casting: true });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBeCloseTo(mana - 70, 5);
    expect(arena.blue.getAbilityCooldown('W')).toBeCloseTo(14, 5);
    const maxed = zhakrulArena(at(600, 0));
    rankUp(maxed.blue, 'W', 5);
    maxed.castAbility(maxed.blue, 'W');
    expect(maxed.blue.getAbilityCooldown('W')).toBeCloseTo(10, 5);
  });

  // Regression (G1): an enemy ability crossing the cloud erased it (its damage went on)
  test("an enemy's skillshot through the cloud doesn't erase it", () => {
    const arena = zhakrulArena(at(300, 0));
    castFresh(arena, 'W');
    const cloud = cloudOf(arena)!;
    expect(arena.castAbility(arena.red, 'Q', { targetPosition: at(-500, 20) }).success).toBe(true);
    tickAllFor(arena, 1.5);
    expect(cloud.isDead).toBe(false);
    expect(cloudOf(arena)).toBe(cloud);
  });
});

// =============================================================================
// E: Burrowed Ambush
// =============================================================================

describe("Zhak'rul E: Burrowed Ambush", () => {
  function untilOut(arena: TestArena): void {
    for (let t = 0; t < 2 && (t === 0 || arena.blue.forcedMovement); t += DT) arena.tick(DT);
    arena.tick(DT);
  }

  // Decision: a dash has no cast time; it had the 0.25 s of an aimed ability
  test('it goes at once, like the other dashes (no cast time)', () => {
    expect(getCastTime(E)).toBe(0);
    const arena = zhakrulArena(at(0, 600));
    castFresh(arena, 'E', { targetPosition: at(200, 0), casting: true });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.dashAbilityId).toBe('zhakrul_e');
  });

  test('he travels underground to the spot at 650 a second', () => {
    const arena = zhakrulArena(at(0, 600));
    castFresh(arena, 'E', { targetPosition: at(260, 0) });
    expect(arena.blue.forcedMovement?.passesWalls).toBe(true);
    tickFor(arena, 0.2);
    expect(arena.blue.position.x - O.x).toBeCloseTo(130, -1);
    untilOut(arena);
    expect(arena.blue.position.x - O.x).toBeCloseTo(260, 0);
  });

  test('a spot past 320 is brought to it', () => {
    const arena = zhakrulArena(at(0, 600));
    castFresh(arena, 'E', { targetPosition: at(1000, 0) });
    untilOut(arena);
    expect(arena.blue.position.x - O.x).toBeCloseTo(E.range!, 0);
  });

  test('he bursts out: 60 + 50% AP magic and a 1 s knock-up on the enemies around (130 + their body)', () => {
    const arena = zhakrulArena(at(260 + 120, 0));
    give(arena.blue, 'cinder_rod');
    const ap = arena.blue.getStats().abilityPower;
    const health = arena.red.health;
    castFresh(arena, 'E', { targetPosition: at(260, 0) });
    expect(arena.red.health).toBe(health);
    untilOut(arena);
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 60 + 0.5 * ap), 3);
    const knockup = arena.red.getActiveEffects().find(e => e.definitionId === 'knockup')!;
    expect(knockup.totalDuration).toBeCloseTo(E.effectDuration!, 5);
  });

  test('the burst event goes out where he comes up', () => {
    const arena = zhakrulArena(at(0, 600));
    castFresh(arena, 'E', { targetPosition: at(260, 0) });
    arena.context.flushEvents();
    untilOut(arena);
    const burst = arena.context.flushEvents().find(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'zhakrul_e_burst')!;
    expect(burst).toBeDefined();
    expect(burst.data.targetX as number - O.x).toBeCloseTo(260, 0);
  });

  test("the burst's edge: an enemy just inside is hit, just outside is not", () => {
    const radius = E.aoeRadius!;
    const inside = zhakrulArena(at(1000, 0));
    inside.red.position.setFrom(at(200 + radius + inside.red.getRadius() - 2, 0));
    castFresh(inside, 'E', { targetPosition: at(200, 0) });
    untilOut(inside);
    expect(hitsOn(inside, inside.red).length).toBe(1);

    const outside = zhakrulArena(at(1000, 0));
    outside.red.position.setFrom(at(200 + radius + outside.red.getRadius() + 3, 0));
    castFresh(outside, 'E', { targetPosition: at(200, 0) });
    untilOut(outside);
    expect(hitsOn(outside, outside.red).length).toBe(0);
  });

  test("nothing he passes under is hit: only where he bursts out", () => {
    const arena = zhakrulArena(at(130, 0));
    castFresh(arena, 'E', { targetPosition: at(E.range!, 0) });
    untilOut(arena);
    expect(hitsOn(arena, arena.red).length).toBe(0);
  });

  test('allies untouched; minions and monsters hit; towers not', () => {
    const arena = zhakrulArena(at(0, 700));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(260, 60));
    const minion = arena.addMinion(TEAM_RED, at(320, 0));
    const monster = arena.addJungleCreature(at(200, 0));
    const tower = arena.addTower(TEAM_RED, at(260, -90));
    const towerHealth = tower.health;
    castFresh(arena, 'E', { targetPosition: at(260, 0) });
    untilOut(arena);
    expect(ally.health).toBe(ally.maxHealth);
    expect(ally.hasEffect('knockup')).toBe(false);
    expect(minion.health).toBeLessThan(minion.maxHealth);
    expect(monster.health).toBeLessThan(monster.maxHealth);
    expect(tower.health).toBe(towerHealth);
  });

  test('he goes under a wall and comes up on open ground past it', () => {
    const thick = findWallCrossing(30, 90, 200);
    const arena = zhakrulArena(at(0, 700));
    arena.blue.position.setFrom(new Vector(thick.left - 60, thick.y));
    castFresh(arena, 'E', { targetPosition: new Vector(thick.right + 120, thick.y) });
    untilOut(arena);
    expect(arena.blue.position.x).toBeGreaterThan(thick.right);
    expect(arena.context.terrain.clearanceAt(arena.blue.position.x, arena.blue.position.y)).toBeGreaterThanOrEqual(0);
  });

  test("rooted or grounded he can't burrow: nothing spent", () => {
    for (const cc of ['root', 'grounded']) {
      const arena = zhakrulArena(at(0, 600));
      arena.blue.applyEffect(cc, 1, arena.red.id);
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, 'E', { targetPosition: at(200, 0) }).failReason).toBe('rooted');
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.forcedMovement).toBeNull();
    }
  });

  test('killed underground: no burst', () => {
    const arena = zhakrulArena(at(260 + 60, 0));
    castFresh(arena, 'E', { targetPosition: at(260, 0) });
    arena.tick(DT);
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    arena.context.flushEvents();
    tickFor(arena, 0.6);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    expect(arena.red.hasEffect('knockup')).toBe(false);
  });

  test('60 mana, 16 s cooldown (12 s at rank 5)', () => {
    const arena = zhakrulArena(at(0, 600));
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'E', { targetPosition: at(200, 0) });
    expect(arena.blue.resource).toBeCloseTo(mana - 60, 5);
    expect(arena.blue.getAbilityCooldown('E')).toBeCloseTo(16, 5);
    const maxed = zhakrulArena(at(0, 600));
    rankUp(maxed.blue, 'E', 5);
    maxed.castAbility(maxed.blue, 'E', { targetPosition: at(200, 0) });
    expect(maxed.blue.getAbilityCooldown('E')).toBeCloseTo(12, 5);
  });
});

// =============================================================================
// R: Death Stinger
// =============================================================================

describe("Zhak'rul R: Death Stinger", () => {
  const sting = (arena: TestArena) => castFresh(arena, 'R', { targetId: arena.red.id });

  /** The stinger's six ticks (venom ticks filtered out by size) */
  function stingTicks(arena: TestArena, perTick: number): number[] {
    return hitsOver(arena, arena.red, ZHAKRUL_KIT.stingDuration + 0.3).filter(hit => Math.abs(hit - perTick) < 0.01);
  }

  test('it stuns for 1.25 s and deals 150 + 80% AP magic over 3 s in six ticks (rank 1)', () => {
    const arena = zhakrulArena(at(100, 0));
    give(arena.blue, 'cinder_rod');
    const ap = arena.blue.getStats().abilityPower;
    expect(sting(arena).success).toBe(true);
    const stun = arena.red.getActiveEffects().find(e => e.definitionId === 'stun')!;
    expect(stun.totalDuration).toBeCloseTo(R.effectDuration!, 5);
    const perTick = magicOn(arena.red, (150 + 0.8 * ap) / ZHAKRUL_KIT.stingTicks);
    expect(stingTicks(arena, perTick).length).toBe(ZHAKRUL_KIT.stingTicks);
  });

  test('15% more per dose the target had', () => {
    const arena = zhakrulArena(at(100, 0));
    poison(arena.blue, arena.red, 2, arena.context);
    sting(arena);
    const perTick = magicOn(arena.red, 150 * (1 + ZHAKRUL_KIT.stingBonusPerStack * 2) / ZHAKRUL_KIT.stingTicks);
    expect(stingTicks(arena, perTick).length).toBe(ZHAKRUL_KIT.stingTicks);
  });

  test('then the target has every dose: the venom is ancient', () => {
    const arena = zhakrulArena(at(100, 0));
    sting(arena);
    expect(venomStacks(arena.blue, arena.red, arena.context)).toBe(ZHAKRUL_VENOM.maxStacks);
    expect(arena.red.hasEffect('zhakrul_ancient_venom')).toBe(true);
  });

  test('rank 3: 350; cooldown 70 s; 100 mana', () => {
    const arena = zhakrulArena(at(100, 0));
    rankUp(arena.blue, 'R', 3);
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
    expect(arena.blue.resource).toBeCloseTo(mana - 100, 5);
    expect(arena.blue.getAbilityCooldown('R')).toBeCloseTo(70, 5);
    const perTick = magicOn(arena.red, 350 / ZHAKRUL_KIT.stingTicks);
    expect(stingTicks(arena, perTick).length).toBe(ZHAKRUL_KIT.stingTicks);
  });

  test('the aimed cast time: stunned in it, nothing spent and no sting', () => {
    const arena = zhakrulArena(at(100, 0));
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id, casting: true });
    expect(arena.blue.isCasting()).toBe(true);
    arena.blue.applyEffect('stun', 1, arena.red.id);
    tickFor(arena, 0.4);
    expect(arena.red.hasEffect('stun')).toBe(false);
    expect(arena.blue.resource).toBeGreaterThanOrEqual(mana - 0.01);
    expect(arena.blue.getAbilityCooldown('R')).toBe(0);
  });

  test('range 150: just inside it stings, just outside it fails', () => {
    const inside = zhakrulArena(at(R.range!, 0));
    expect(inside.castAbility(inside.blue, 'R', { targetId: inside.red.id }).success).toBe(true);
    const outside = zhakrulArena(at(R.range! + 2, 0));
    expect(outside.castAbility(outside.blue, 'R', { targetId: outside.red.id }).failReason).toBe('out_of_range');
  });

  test('champions only: a minion or a monster is no target', () => {
    const arena = zhakrulArena(at(600, 0));
    const minion = arena.addMinion(TEAM_RED, at(60, 0));
    const monster = arena.addJungleCreature(at(0, 60));
    expect(arena.castAbility(arena.blue, 'R', { targetId: minion.id }).failReason).toBe('invalid_target');
    expect(arena.castAbility(arena.blue, 'R', { targetId: monster.id }).failReason).toBe('invalid_target');
  });

  test('the ticks keep going if he dies; they stop if the target dies', () => {
    const arena = zhakrulArena(at(100, 0));
    sting(arena);
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    const perTick = magicOn(arena.red, 150 / ZHAKRUL_KIT.stingTicks);
    expect(stingTicks(arena, perTick).length).toBe(ZHAKRUL_KIT.stingTicks);

    const other = zhakrulArena(at(100, 0));
    sting(other);
    tickFor(other, 1.1);
    other.red.takeDamage(1e9, 'true');
    other.context.flushEvents();
    expect(hitsOver(other, other.red, 3).length).toBe(0);
  });

  test("silenced he can't", () => {
    const arena = zhakrulArena(at(100, 0));
    arena.blue.applyEffect('silence', 1, arena.red.id);
    expect(arena.castAbility(arena.blue, 'R', { targetId: arena.red.id }).failReason).toBe('silenced');
  });
});
