/**
 * Calamitus Champion Tests
 *
 * Calamitus - The Flowing Magma, a tank who floods the ground with lava:
 * - Passive (Lavaborn): his Q and W leave pools of lava that burn enemies;
 *   standing in his own lava he gains armor and magic resist
 * - Q (Lava Flow): magic damage around him, and a pool under him
 * - W (Magma Landslide): a line of magma (damage, slow) leaving a stream of lava
 * - E (Obsidian Skin): a shield on max health, stronger on his lava
 * - R (Eruption): after a moment the ground around where he cast it and
 *   every pool of his lava erupts: damage and a stun
 */

import { describe, test, expect } from 'bun:test';
import {
  Vector,
  CALAMITUS_LAVA,
  CHAMPION_DEFINITIONS,
  EntityType,
  GameEventType,
  TEAM_BLUE,
  TEAM_RED,
  calculateMagicDamage,
  getAbilityDefinition,
  type ItemSlot,
  type Side,
} from '@siege/shared';
import { createTestArena, TestChampion, type TestArena } from '../ServerTestUtils';
import type { ServerEntity } from '../../simulation/ServerEntity';
import { ServerZone } from '../../simulation/ServerZone';
import { ServerProjectile } from '../../simulation/ServerProjectile';

const DT = 1 / 30;
const Q = getAbilityDefinition('calamitus_q')!;
const W = getAbilityDefinition('calamitus_w')!;
const E = getAbilityDefinition('calamitus_e')!;
const R = getAbilityDefinition('calamitus_r')!;
const BASE = CHAMPION_DEFINITIONS.calamitus.baseStats;

/** Open ground (the middle of the map has walls within 400): a base's clearing, away from its fountain */
const O = new Vector(2200, -2200);
const at = (x: number, y: number) => new Vector(O.x + x, O.y + y);

/** Calamitus (blue, at O) and Magnus (red), both at `level`, healthy and with full mana */
function calamitusArena(redAt = at(100, 0), level = 6): TestArena {
  const arena = createTestArena({ blueChampion: 'calamitus', redChampion: 'magnus', bluePosition: O, redPosition: redAt });
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

/** Tick everything (zones too) for `seconds` */
function tickAllFor(arena: TestArena, seconds: number): void {
  arena.tickAllFrames(Math.round(seconds / DT), DT);
}

/** Tick everything for `seconds`, adding up what `target` took from blue */
function damageOver(arena: TestArena, target: ServerEntity, seconds: number): number {
  let total = 0;
  for (let t = 0; t < seconds; t += DT) {
    arena.tickAll(DT);
    total += sum(hitsOn(arena, target));
  }
  return total;
}

function castFresh(arena: TestArena, slot: 'Q' | 'W' | 'E' | 'R', options: { targetPosition?: Vector; targetId?: string; windup?: boolean } = {}) {
  arena.blue.resetCooldowns();
  arena.blue.setResource(arena.blue.maxResource);
  return arena.castAbility(arena.blue, slot, options);
}

const lavaOf = (arena: TestArena) => arena.context.getAllEntities()
  .filter((e): e is ServerZone => e.entityType === EntityType.ZONE && e instanceof ServerZone && !e.isDead &&
    (e.abilityId === 'calamitus_q' || e.abilityId === 'calamitus_w'));

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
  champion.level = Math.max(champion.level, 16);
  while (champion.abilityStates[slot].rank < rank) {
    champion.skillPoints++;
    champion.levelUpAbility(slot);
  }
  champion.setResource(champion.maxResource);
}

const magicOn = (target: TestChampion, raw: number) => calculateMagicDamage(raw, target.getStats().magicResist);

/** One lava tick's damage (before magic resist) */
function lavaTick(calamitus: TestChampion): number {
  return (CALAMITUS_LAVA.burnBase + CALAMITUS_LAVA.burnPerLevel * calamitus.level
    + CALAMITUS_LAVA.burnApRatio * calamitus.getStats().abilityPower) * CALAMITUS_LAVA.tickRate;
}

// =============================================================================
// Passive: Lavaborn
// =============================================================================

describe('Calamitus passive: Lavaborn', () => {
  test('his lava burns an enemy in it each half second: (6 + 1.5 per level + 5% AP) a second, magic', () => {
    const arena = calamitusArena(at(60, 0));
    castFresh(arena, 'Q');
    hitsOn(arena, arena.red);
    const burns: number[] = [];
    for (let t = 0; t < 1.6; t += DT) {
      arena.tickAll(DT);
      burns.push(...hitsOn(arena, arena.red));
    }
    expect(burns.length).toBeGreaterThanOrEqual(3);
    for (const burn of burns) expect(burn).toBeCloseTo(magicOn(arena.red, lavaTick(arena.blue)), 3);
  });

  test('at level 18 with ability power the lava burns harder', () => {
    const arena = calamitusArena(at(60, 0), 18);
    give(arena.blue, 'cinder_rod');
    castFresh(arena, 'Q');
    hitsOn(arena, arena.red);
    arena.tickAll(DT);
    const burn = hitsOn(arena, arena.red)[0];
    expect(lavaTick(arena.blue)).toBeCloseTo((6 + 1.5 * 18 + 0.05 * 50) * 0.5, 5);
    expect(burn).toBeCloseTo(magicOn(arena.red, lavaTick(arena.blue)), 3);
  });

  test('a pool lasts 4 seconds', () => {
    const arena = calamitusArena(at(600, 0));
    castFresh(arena, 'Q');
    expect(lavaOf(arena).length).toBe(1);
    tickAllFor(arena, CALAMITUS_LAVA.duration - 0.2);
    expect(lavaOf(arena).length).toBe(1);
    tickAllFor(arena, 0.4);
    expect(lavaOf(arena).length).toBe(0);
  });

  test('standing in his lava: +15 armor and magic resist, the passive active; out of it, gone', () => {
    const arena = calamitusArena(at(600, 0));
    const { armor, magicResist } = arena.blue.getStats();
    castFresh(arena, 'Q');
    arena.tick(DT);
    expect(arena.blue.passiveState.isActive).toBe(true);
    expect(arena.blue.getStats().armor).toBeCloseTo(armor + CALAMITUS_LAVA.resists, 5);
    expect(arena.blue.getStats().magicResist).toBeCloseTo(magicResist + CALAMITUS_LAVA.resists, 5);
    arena.blue.position.setFrom(at(0, Q.aoeRadius! + 20));
    tickFor(arena, 0.4);
    expect(arena.blue.passiveState.isActive).toBe(false);
    expect(arena.blue.getStats().armor).toBeCloseTo(armor, 5);
    expect(arena.blue.getStats().magicResist).toBeCloseTo(magicResist, 5);
  });

  test('Lavaborn is one effect (one icon) for both resists', () => {
    const arena = calamitusArena(at(600, 0));
    castFresh(arena, 'Q');
    arena.tick(DT);
    const lavaborn = arena.blue.getActiveEffects().filter(e => e.definitionId.startsWith('calamitus_lavaborn'));
    expect(lavaborn.length).toBe(1);
  });

  test('just inside a pool\'s edge counts; just outside doesn\'t', () => {
    const arena = calamitusArena(at(600, 0));
    castFresh(arena, 'Q');
    arena.blue.position.setFrom(at(Q.aoeRadius! - 1, 0));
    arena.tick(DT);
    expect(arena.blue.passiveState.isActive).toBe(true);
    arena.blue.position.setFrom(at(Q.aoeRadius! + 1, 0));
    arena.tick(DT);
    expect(arena.blue.passiveState.isActive).toBe(false);
  });

  test("another Calamitus's lava, even an ally's, doesn't harden him", () => {
    const arena = calamitusArena(at(600, 0));
    const other = addChampion(arena, 'other', TEAM_BLUE, at(0, 30), 'calamitus');
    other.learnAllAbilities();
    other.setResource(other.maxResource);
    expect(arena.castAbility(other, 'Q').success).toBe(true);
    arena.tick(DT);
    expect(arena.blue.passiveState.isActive).toBe(false);
  });

  test("the lava doesn't burn him, allies or towers; it burns minions and monsters", () => {
    const arena = calamitusArena(at(600, 0));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(40, 0));
    const minion = arena.addMinion(TEAM_RED, at(-40, 0));
    const monster = arena.addJungleCreature(at(0, 60));
    const tower = arena.addTower(TEAM_RED, at(0, -60));
    const towerHealth = tower.health;
    castFresh(arena, 'Q');
    arena.context.flushEvents();
    const burned = new Set<string>();
    for (let t = 0; t < 1.5; t += DT) {
      arena.tickAll(DT);
      for (const e of arena.context.flushEvents()) {
        if (e.type === GameEventType.DAMAGE && e.data.sourceId === arena.blue.id) burned.add(e.data.entityId as string);
      }
    }
    // (The tower and the monster fight back: only what the lava burned counts)
    expect(burned.has(arena.blue.id)).toBe(false);
    expect(burned.has(ally.id)).toBe(false);
    expect(burned.has(tower.id)).toBe(false);
    expect(tower.health).toBe(towerHealth);
    expect(burned.has(minion.id)).toBe(true);
    expect(burned.has(monster.id)).toBe(true);
  });

  // Regression (G1): the lava's ticks killed projectiles that flew through it
  test("an enemy projectile crossing his lava isn't eaten by it", () => {
    const arena = calamitusArena(at(600, 0));
    castFresh(arena, 'Q');
    const arrow = new ServerProjectile({
      id: 'arrow',
      position: at(-120, 0),
      side: TEAM_RED,
      direction: new Vector(1, 0),
      speed: 10,
      radius: 10,
      maxDistance: 1000,
      sourceId: arena.red.id,
      abilityId: 'magnus_fireball',
      damage: 10,
      damageType: 'magic',
    });
    arena.context.addEntity(arrow);
    tickAllFor(arena, 1.2);
    expect(arrow.isDead).toBe(false);
    expect(lavaOf(arena).length).toBe(1);
  });

  test("an enemy's ability doesn't erase his lava", () => {
    const arena = calamitusArena(at(250, 0));
    castFresh(arena, 'Q');
    const pool = lavaOf(arena)[0];
    // Magnus's fireball through the pool
    arena.red.setResource(arena.red.maxResource);
    expect(arena.castAbility(arena.red, 'Q', { targetPosition: at(-400, 30) }).success).toBe(true);
    tickAllFor(arena, 1.5);
    expect(pool.isDead).toBe(false);
  });

  test('his W leaves lava too; his E and R don\'t', () => {
    const arena = calamitusArena(at(0, 600));
    castFresh(arena, 'W', { targetPosition: at(300, 0) });
    expect(lavaOf(arena).length).toBeGreaterThan(0);
    tickAllFor(arena, CALAMITUS_LAVA.duration + 0.2);
    expect(lavaOf(arena).length).toBe(0);
    castFresh(arena, 'E');
    castFresh(arena, 'R');
    tickAllFor(arena, 0.1);
    const zones = arena.context.getAllEntities().filter(e => e.entityType === EntityType.ZONE && !e.isDead);
    expect(zones.length).toBe(0);
  });
});

// =============================================================================
// Q: Lava Flow
// =============================================================================

describe('Calamitus Q: Lava Flow', () => {
  test('rank 1: 50 + 40% AP magic to the enemies around him', () => {
    const arena = calamitusArena();
    give(arena.blue, 'cinder_rod');
    const ap = arena.blue.getStats().abilityPower;
    castFresh(arena, 'Q');
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 50 + 0.4 * ap), 3);
  });

  test('rank 5: 170, and a 7 s cooldown', () => {
    const arena = calamitusArena();
    rankUp(arena.blue, 'Q', 5);
    arena.castAbility(arena.blue, 'Q');
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 170), 3);
    expect(arena.blue.getAbilityCooldown('Q')).toBeCloseTo(7, 5);
  });

  test('instant, 45 mana, 9 s cooldown at rank 1', () => {
    const arena = calamitusArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'Q', { casting: true } as { casting: boolean });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBeCloseTo(mana - 45, 5);
    expect(arena.blue.getAbilityCooldown('Q')).toBeCloseTo(9, 5);
  });

  test('140 around him: just inside hit, just outside missed', () => {
    const inside = calamitusArena(at(Q.aoeRadius! - 1, 0));
    castFresh(inside, 'Q');
    expect(hitsOn(inside, inside.red).length).toBe(1);
    const outside = calamitusArena(at(Q.aoeRadius! + 2, 0));
    castFresh(outside, 'Q');
    expect(hitsOn(outside, outside.red).length).toBe(0);
  });

  test('the pool is under him, as big as the burst', () => {
    const arena = calamitusArena(at(600, 0));
    castFresh(arena, 'Q');
    const pool = lavaOf(arena)[0];
    expect(pool.position.distanceTo(O)).toBeLessThan(0.01);
    expect(pool.radius).toBe(Q.aoeRadius!);
  });

  test("allies and towers aren't hit; minions and monsters are", () => {
    const arena = calamitusArena(at(600, 0));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(40, 0));
    const minion = arena.addMinion(TEAM_RED, at(-40, 0));
    const monster = arena.addJungleCreature(at(0, 60));
    const tower = arena.addTower(TEAM_RED, at(0, -60));
    const towerHealth = tower.health;
    castFresh(arena, 'Q');
    expect(ally.health).toBe(ally.maxHealth);
    expect(tower.health).toBe(towerHealth);
    expect(minion.health).toBeLessThan(minion.maxHealth);
    expect(monster.health).toBeLessThan(monster.maxHealth);
  });

  test("stunned or silenced he can't; nothing is spent and no lava", () => {
    for (const cc of ['stun', 'silence']) {
      const arena = calamitusArena();
      arena.blue.applyEffect(cc, 1, arena.red.id);
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, 'Q').success).toBe(false);
      expect(arena.blue.resource).toBe(mana);
      expect(lavaOf(arena).length).toBe(0);
    }
  });
});

// =============================================================================
// W: Magma Landslide
// =============================================================================

describe('Calamitus W: Magma Landslide', () => {
  test('rank 1: 60 + 50% AP magic to enemies down the line, slowed 30% for 1.5 s', () => {
    const arena = calamitusArena(at(250, 10));
    give(arena.blue, 'cinder_rod');
    const ap = arena.blue.getStats().abilityPower;
    const speed = arena.red.getStats().movementSpeed;
    expect(castFresh(arena, 'W', { targetPosition: at(300, 0) }).success).toBe(true);
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 60 + 0.5 * ap), 3);
    expect(arena.red.hasEffect('slow_30')).toBe(true);
    arena.red.invalidateStats();
    expect(arena.red.getStats().movementSpeed).toBeCloseTo(speed * 0.7, 3);
    const slow = arena.red.getActiveEffects().find(e => e.definitionId === 'slow_30')!;
    expect(slow.totalDuration).toBeCloseTo(W.effectDuration!, 5);
  });

  test('rank 5: 200 and an 8 s cooldown', () => {
    const arena = calamitusArena(at(250, 0));
    rankUp(arena.blue, 'W', 5);
    arena.castAbility(arena.blue, 'W', { targetPosition: at(300, 0) });
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 200), 3);
    expect(arena.blue.getAbilityCooldown('W')).toBeCloseTo(8, 5);
  });

  test('it rolls: the aimed cast time, then 0.3 s before it lands', () => {
    const arena = calamitusArena(at(250, 0));
    arena.castAbility(arena.blue, 'W', { targetPosition: at(300, 0), casting: true });
    expect(arena.blue.isCasting()).toBe(true);
    tickFor(arena, 0.25 + 0.15);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    expect(lavaOf(arena).length).toBe(0);
    tickFor(arena, 0.25);
    expect(hitsOn(arena, arena.red).length).toBe(1);
    expect(lavaOf(arena).length).toBeGreaterThan(0);
  });

  test('a stream of pools down its 380: radius 45, 70 apart from 35 out', () => {
    const arena = calamitusArena(at(0, 600));
    castFresh(arena, 'W', { targetPosition: at(300, 0) });
    const pools = lavaOf(arena).sort((a, b) => a.position.x - b.position.x);
    const expected: number[] = [];
    for (let along = CALAMITUS_LAVA.streamSpacing / 2; along < W.range!; along += CALAMITUS_LAVA.streamSpacing) expected.push(along);
    expect(pools.map(pool => Math.round(pool.position.x - O.x))).toEqual(expected.map(Math.round));
    for (const pool of pools) {
      expect(pool.radius).toBe(CALAMITUS_LAVA.streamRadius);
      expect(Math.abs(pool.position.y - O.y)).toBeLessThan(0.01);
    }
  });

  test('aimed past its range it goes its 380 that way', () => {
    const arena = calamitusArena(at(0, 600));
    castFresh(arena, 'W', { targetPosition: at(0, -2000) });
    const pools = lavaOf(arena);
    const farthest = Math.max(...pools.map(pool => O.y - pool.position.y));
    expect(farthest).toBeLessThan(W.range!);
    expect(farthest).toBeGreaterThan(W.range! - CALAMITUS_LAVA.streamSpacing);
  });

  test("the line's width: an enemy 45 + its body off the line is grazed, farther is missed", () => {
    const grazed = calamitusArena(at(200, 0));
    grazed.red.position.setFrom(at(200, W.aoeRadius! + grazed.red.getRadius() - 2));
    castFresh(grazed, 'W', { targetPosition: at(300, 0) });
    expect(hitsOn(grazed, grazed.red).length).toBe(1);

    const missed = calamitusArena(at(200, 0));
    missed.red.position.setFrom(at(200, W.aoeRadius! + missed.red.getRadius() + 5));
    castFresh(missed, 'W', { targetPosition: at(300, 0) });
    expect(hitsOn(missed, missed.red).length).toBe(0);
  });

  test("it doesn't hit enemies behind him", () => {
    const arena = calamitusArena(at(-100, 0));
    castFresh(arena, 'W', { targetPosition: at(300, 0) });
    expect(hitsOn(arena, arena.red).length).toBe(0);
  });

  test('a click on himself: no direction, nothing spent', () => {
    const arena = calamitusArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'W', { targetPosition: O.clone() });
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.getAbilityCooldown('W')).toBe(0);
    expect(lavaOf(arena).length).toBe(0);
  });

  test('killed before it lands: no wave, no lava', () => {
    const arena = calamitusArena(at(250, 0));
    castFresh(arena, 'W', { targetPosition: at(300, 0), windup: true });
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    arena.context.flushEvents();
    tickFor(arena, 0.5);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    expect(lavaOf(arena).length).toBe(0);
  });
});

// =============================================================================
// E: Obsidian Skin
// =============================================================================

describe('Calamitus E: Obsidian Skin', () => {
  test('rank 1: a shield of 50 + 5% of his max health for 3 seconds', () => {
    const arena = calamitusArena(at(600, 0));
    castFresh(arena, 'E');
    const expected = 50 + 0.05 * arena.blue.maxHealth;
    expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(expected, 3);
    tickFor(arena, E.shield!.duration! - 0.2);
    expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
    tickFor(arena, 0.4);
    expect(arena.blue.getTotalShieldAmount()).toBe(0);
  });

  test('rank 5: 150 + 5% max health, 12 s cooldown', () => {
    const arena = calamitusArena(at(600, 0));
    rankUp(arena.blue, 'E', 5);
    arena.castAbility(arena.blue, 'E');
    expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(150 + 0.05 * arena.blue.maxHealth, 3);
    expect(arena.blue.getAbilityCooldown('E')).toBeCloseTo(12, 5);
  });

  test('half again as strong cast in his lava', () => {
    const arena = calamitusArena(at(600, 0));
    castFresh(arena, 'Q');
    castFresh(arena, 'E');
    expect(arena.blue.getTotalShieldAmount()).toBeCloseTo((50 + 0.05 * arena.blue.maxHealth) * 1.5, 3);
  });

  test('more health, a bigger shield (items)', () => {
    const plain = calamitusArena(at(600, 0));
    castFresh(plain, 'E');
    const tanky = calamitusArena(at(600, 0));
    give(tanky.blue, 'bloodroot_sigil');
    castFresh(tanky, 'E');
    expect(tanky.blue.getTotalShieldAmount()).toBeGreaterThan(plain.blue.getTotalShieldAmount());
  });

  test('it absorbs damage before his health', () => {
    const arena = calamitusArena();
    castFresh(arena, 'E');
    const health = arena.blue.health;
    arena.blue.takeDamage(30, 'true', arena.red.id, arena.context);
    expect(arena.blue.health).toBe(health);
    expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(50 + 0.05 * arena.blue.maxHealth - 30, 3);
  });

  test('instant, 50 mana, 16 s cooldown; silenced it fails', () => {
    const arena = calamitusArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'E', { casting: true });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBeCloseTo(mana - 50, 5);
    expect(arena.blue.getAbilityCooldown('E')).toBeCloseTo(16, 5);

    const silenced = calamitusArena();
    silenced.blue.applyEffect('silence', 1, silenced.red.id);
    expect(silenced.castAbility(silenced.blue, 'E').failReason).toBe('silenced');
    expect(silenced.blue.getTotalShieldAmount()).toBe(0);
  });
});

// =============================================================================
// R: Eruption
// =============================================================================

describe('Calamitus R: Eruption', () => {
  test('after 0.6 s the ground around him erupts: 120 + 50% AP magic and a 1.25 s stun (rank 1)', () => {
    const arena = calamitusArena(at(150, 0));
    give(arena.blue, 'cinder_rod');
    const ap = arena.blue.getStats().abilityPower;
    expect(castFresh(arena, 'R', { windup: true }).success).toBe(true);
    tickFor(arena, R.aoeDelay! - 0.1);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    tickFor(arena, 0.15);
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 120 + 0.5 * ap), 3);
    const stun = arena.red.getActiveEffects().find(e => e.definitionId === 'stun')!;
    expect(stun).toBeDefined();
    expect(stun.totalDuration).toBeCloseTo(CALAMITUS_LAVA.eruptionStun, 5);
  });

  test('rank 3: 280; cooldown 80 s', () => {
    const arena = calamitusArena(at(150, 0));
    rankUp(arena.blue, 'R', 3);
    arena.castAbility(arena.blue, 'R');
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 280), 3);
    expect(arena.blue.getAbilityCooldown('R')).toBeCloseTo(80, 5);
  });

  test('instant to cast, 100 mana, 110 s cooldown at rank 1', () => {
    const arena = calamitusArena(at(150, 0));
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'R', { casting: true, windup: true });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBeCloseTo(mana - 100, 5);
    expect(arena.blue.getAbilityCooldown('R')).toBeCloseTo(110, 5);
  });

  test('220 around him, counting the body: just inside hit, just outside missed', () => {
    const inside = calamitusArena(at(1000, 0));
    inside.red.position.setFrom(at(R.aoeRadius! + inside.red.getRadius() - 1, 0));
    castFresh(inside, 'R');
    expect(hitsOn(inside, inside.red).length).toBe(1);

    const outside = calamitusArena(at(1000, 0));
    outside.red.position.setFrom(at(R.aoeRadius! + outside.red.getRadius() + 2, 0));
    castFresh(outside, 'R');
    expect(hitsOn(outside, outside.red).length).toBe(0);
  });

  // Bug: it erupted around where he was when it landed, not where it was cast (and the warning was drawn)
  test('it erupts where he cast it, even if he walked away in the meantime', () => {
    const arena = calamitusArena(at(150, 0));
    const near = addChampion(arena, 'near', TEAM_RED, at(-400, 0));
    castFresh(arena, 'R', { windup: true });
    // He walks off during the rumble
    arena.blue.position.setFrom(at(-300, 0));
    tickFor(arena, R.aoeDelay! + 0.05);
    expect(hitsOn(arena, arena.red).length).toBe(1);
    expect(arena.red.hasEffect('stun')).toBe(true);
    expect(near.hasEffect('stun')).toBe(false);
    expect(near.health).toBe(near.maxHealth);
  });

  test('every pool of his lava erupts too: enemies in them are hit and stunned, one geyser event each', () => {
    const arena = calamitusArena(at(0, 700));
    castFresh(arena, 'W', { targetPosition: at(300, 0) });
    const pools = lavaOf(arena);
    const far = addChampion(arena, 'far', TEAM_RED, at(315, 0));
    hitsOn(arena, far);
    arena.context.flushEvents();
    castFresh(arena, 'R', { windup: true });
    tickFor(arena, R.aoeDelay! + 0.05);
    const events = arena.context.flushEvents();
    const geysers = events.filter(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'calamitus_lava_erupt');
    expect(geysers.length).toBe(pools.length);
    const farHits = events.filter(e => e.type === GameEventType.DAMAGE && e.data.entityId === far.id);
    expect(farHits.length).toBe(1);
    expect(far.hasEffect('stun')).toBe(true);
  });

  test('an enemy in his area and in pools is struck once', () => {
    const arena = calamitusArena(at(60, 0));
    castFresh(arena, 'Q');
    castFresh(arena, 'W', { targetPosition: at(300, 0) });
    hitsOn(arena, arena.red);
    castFresh(arena, 'R');
    expect(hitsOn(arena, arena.red).length).toBe(1);
  });

  test("the pools erupt even far from him; a pool that's gone doesn't", () => {
    const arena = calamitusArena(at(0, 700));
    castFresh(arena, 'Q');
    const far = addChampion(arena, 'far', TEAM_RED, at(60, 0));
    // He walks far away; the pool is still there
    arena.blue.position.setFrom(at(-600, 0));
    castFresh(arena, 'R', { windup: true });
    tickFor(arena, R.aoeDelay! + 0.05);
    expect(far.hasEffect('stun')).toBe(true);

    const gone = calamitusArena(at(0, 700));
    castFresh(gone, 'Q');
    const late = addChampion(gone, 'late', TEAM_RED, at(60, 0));
    tickAllFor(gone, CALAMITUS_LAVA.duration + 0.2);
    late.setHealth(late.maxHealth);
    gone.blue.position.setFrom(at(-600, 0));
    castFresh(gone, 'R');
    expect(late.hasEffect('stun')).toBe(false);
  });

  test('allies, minions-wise: allies untouched; minions and monsters hit; towers not', () => {
    const arena = calamitusArena(at(0, 700));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(60, 0));
    const minion = arena.addMinion(TEAM_RED, at(-60, 0));
    const monster = arena.addJungleCreature(at(0, 80));
    const tower = arena.addTower(TEAM_RED, at(0, -100));
    const towerHealth = tower.health;
    castFresh(arena, 'R');
    expect(ally.health).toBe(ally.maxHealth);
    expect(ally.hasEffect('stun')).toBe(false);
    expect(minion.health).toBeLessThan(minion.maxHealth);
    expect(monster.health).toBeLessThan(monster.maxHealth);
    expect(tower.health).toBe(towerHealth);
  });

  test('killed during the rumble: nothing erupts', () => {
    const arena = calamitusArena(at(150, 0));
    castFresh(arena, 'R', { windup: true });
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    arena.context.flushEvents();
    tickFor(arena, R.aoeDelay! + 0.1);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    expect(arena.red.hasEffect('stun')).toBe(false);
  });

  test("stunned or silenced he can't; nothing spent", () => {
    for (const cc of ['stun', 'silence']) {
      const arena = calamitusArena(at(150, 0));
      arena.blue.applyEffect(cc, 1, arena.red.id);
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, 'R').success).toBe(false);
      expect(arena.blue.resource).toBe(mana);
    }
  });
});

describe('Calamitus base', () => {
  test('a slow, tough melee tank: 690 health, 34 armor, 50 range', () => {
    const arena = createTestArena({ blueChampion: 'calamitus', redChampion: 'magnus', bluePosition: O, redPosition: at(300, 0), learnAbilities: false });
    expect(arena.blue.maxHealth).toBe(BASE.health);
    expect(arena.blue.getStats().armor).toBe(BASE.armor);
    expect(arena.blue.getAttackRange()).toBe(BASE.attackRange);
  });
});
