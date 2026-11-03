/**
 * Oitboil Champion Tests
 *
 * Oitboil - The Pyromancer, a short-ranged mage who heats up as he casts:
 * - Passive (Overheat): his abilities heat him up; at 100 he overheats for
 *   4 seconds (25% more damage, but he burns 3% of his max health a second)
 * - Q (Spark Spray): magic damage to the enemies around him
 * - W (Blue Fire): a heal that vents heat and ends an overheat
 * - E (Afterburner): a dash that leaves patches of fire behind
 * - R (Flamethrower): a cone that burns a share of champions' current health,
 *   then exhaustion
 */

import { describe, test, expect } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  EntityType,
  GameEventType,
  OITBOIL_FLAMETHROWER_SHARE,
  OITBOIL_HEAT,
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
import { FLAMETHROWER_DURATION, FLAMETHROWER_EXHAUSTION } from '../../abilities/handlers/oitboil/OitboilRHandler';
import { findWallCrossing } from '../wallSpots';

const DT = 1 / 30;
const Q = getAbilityDefinition('oitboil_q')!;
const W = getAbilityDefinition('oitboil_w')!;
const E = getAbilityDefinition('oitboil_e')!;
const R = getAbilityDefinition('oitboil_r')!;

/** Open ground (the middle of the map has walls within 400): red's base, clear of its nexus (an obstacle) */
const O = new Vector(2075, -1950);
const at = (x: number, y: number) => new Vector(O.x + x, O.y + y);

/** Oitboil (blue, at O) and Magnus (red), both at `level`, healthy and with full mana */
function oitboilArena(redAt = at(150, 0), level = 6): TestArena {
  const arena = createTestArena({ blueChampion: 'oitboil', redChampion: 'magnus', bluePosition: O, redPosition: redAt });
  for (const champion of [arena.blue, arena.red]) {
    champion.setLevel(level);
    // (Leveling up raises max health, not health)
    champion.setHealth(champion.maxHealth);
    champion.setResource(champion.maxResource);
  }
  arena.context.flushEvents();
  return arena;
}

const heat = (champion: TestChampion) => champion.passiveState.stacks;
const overheated = (champion: TestChampion) => champion.hasEffect('oitboil_overheated');

/** The damage `source` dealt `target` since the last flush, one entry per hit */
function hitsOn(arena: TestArena, target: ServerEntity, source: ServerEntity | null = arena.blue): number[] {
  return arena.context.flushEvents()
    .filter(e => e.type === GameEventType.DAMAGE && e.data.entityId === target.id && (source === null || e.data.sourceId === source.id))
    .map(e => e.data.amount as number);
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

function tickFor(arena: TestArena, seconds: number): void {
  arena.tickFrames(Math.round(seconds / DT), DT);
}

/** Tick everything (zones too) for `seconds`, adding up what `target` took from blue */
function damageOver(arena: TestArena, target: ServerEntity, seconds: number): number {
  let total = 0;
  for (let t = 0; t < seconds; t += DT) {
    arena.tickAll(DT);
    total += sum(hitsOn(arena, target));
  }
  return total;
}

/** Cast an ability again and again (cooldowns reset) */
function castFresh(arena: TestArena, slot: 'Q' | 'W' | 'E' | 'R', options: { targetPosition?: Vector; targetId?: string } = {}) {
  arena.blue.resetCooldowns();
  arena.blue.setResource(arena.blue.maxResource);
  return arena.castAbility(arena.blue, slot, options);
}

/** Spark Spray until he overheats */
function overheat(arena: TestArena): void {
  for (let i = 0; i < 10 && !overheated(arena.blue); i++) {
    expect(castFresh(arena, 'Q').success).toBe(true);
  }
  expect(overheated(arena.blue)).toBe(true);
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

// =============================================================================
// Passive: Overheat
// =============================================================================

describe('Oitboil passive: Overheat', () => {
  test('he starts cold', () => {
    const arena = oitboilArena();
    arena.tick(DT);
    expect(heat(arena.blue)).toBe(0);
    expect(arena.blue.passiveState.isActive).toBe(false);
  });

  test('Q heats him 20, E 25 and R 40; Blue Fire vents 40', () => {
    const arena = oitboilArena(at(600, 600));
    castFresh(arena, 'Q');
    expect(heat(arena.blue)).toBe(OITBOIL_HEAT.gain.oitboil_q);
    castFresh(arena, 'E', { targetPosition: at(-200, 0) });
    expect(heat(arena.blue)).toBe(20 + OITBOIL_HEAT.gain.oitboil_e);
    castFresh(arena, 'W');
    expect(heat(arena.blue)).toBe(45 - OITBOIL_HEAT.vent);
    castFresh(arena, 'R', { targetPosition: at(0, 200) });
    expect(heat(arena.blue)).toBe(5 + OITBOIL_HEAT.gain.oitboil_r);
  });

  test("Blue Fire can't take heat below 0", () => {
    const arena = oitboilArena();
    castFresh(arena, 'Q');
    castFresh(arena, 'W');
    expect(heat(arena.blue)).toBe(0);
  });

  test('heat holds for 4.5 s after his last cast, then falls 15 a second', () => {
    const arena = oitboilArena();
    castFresh(arena, 'Q');
    castFresh(arena, 'Q');
    expect(heat(arena.blue)).toBe(40);
    tickFor(arena, OITBOIL_HEAT.decayDelay - 0.2);
    expect(heat(arena.blue)).toBe(40);
    tickFor(arena, 1.2);
    expect(heat(arena.blue)).toBeGreaterThanOrEqual(40 - OITBOIL_HEAT.decayPerSecond * 1.1 - 1);
    expect(heat(arena.blue)).toBeLessThanOrEqual(40 - OITBOIL_HEAT.decayPerSecond * 0.9 + 1);
    tickFor(arena, 5);
    expect(heat(arena.blue)).toBe(0);
  });

  test('a cast restarts the wait before heat falls', () => {
    const arena = oitboilArena();
    castFresh(arena, 'Q');
    tickFor(arena, 4);
    castFresh(arena, 'Q');
    tickFor(arena, 4);
    expect(heat(arena.blue)).toBe(40);
  });

  test('a failed cast (no mana) adds no heat', () => {
    const arena = oitboilArena();
    arena.blue.setResource(0);
    expect(arena.castAbility(arena.blue, 'Q').success).toBe(false);
    arena.tick(DT);
    expect(heat(arena.blue)).toBe(0);
  });

  test('at 100 heat he overheats for 4 seconds: the passive is active and an overheat event goes out', () => {
    const arena = oitboilArena();
    for (let i = 0; i < 4; i++) castFresh(arena, 'Q');
    expect(overheated(arena.blue)).toBe(false);
    arena.context.flushEvents();
    castFresh(arena, 'Q');
    expect(overheated(arena.blue)).toBe(true);
    expect(heat(arena.blue)).toBe(OITBOIL_HEAT.max);
    expect(arena.blue.passiveState.isActive).toBe(true);
    const events = arena.context.flushEvents();
    expect(events.some(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'oitboil_overheat')).toBe(true);
    tickFor(arena, OITBOIL_HEAT.overheatDuration - 0.2);
    expect(overheated(arena.blue)).toBe(true);
    tickFor(arena, 0.4);
    expect(overheated(arena.blue)).toBe(false);
    expect(heat(arena.blue)).toBe(0);
    expect(arena.blue.passiveState.isActive).toBe(false);
  });

  test('casting while overheated adds no heat and makes it no longer', () => {
    const arena = oitboilArena();
    overheat(arena);
    tickFor(arena, 1);
    castFresh(arena, 'Q');
    expect(heat(arena.blue)).toBe(OITBOIL_HEAT.max);
    tickFor(arena, OITBOIL_HEAT.overheatDuration - 1 + 0.2);
    expect(overheated(arena.blue)).toBe(false);
  });

  test('overheated, his abilities deal 25% more damage', () => {
    const cold = oitboilArena();
    castFresh(cold, 'Q');
    const coldHit = hitsOn(cold, cold.red)[0];

    const hot = oitboilArena();
    overheat(hot);
    hot.context.flushEvents();
    hot.red.setHealth(hot.red.maxHealth);
    castFresh(hot, 'Q');
    expect(hitsOn(hot, hot.red)[0]).toBeCloseTo(coldHit * (1 + OITBOIL_HEAT.overheatDamageBonus), 3);
  });

  test('overheated, his attack damage is 25% higher', () => {
    const arena = oitboilArena();
    const ad = arena.blue.getStats().attackDamage;
    overheat(arena);
    expect(arena.blue.getStats().attackDamage).toBeCloseTo(ad * 1.25, 5);
  });

  test('overheated, he burns 3% of his max health a second, in half-second chunks of true damage', () => {
    const arena = oitboilArena();
    overheat(arena);
    arena.context.flushEvents();
    const burns: number[] = [];
    for (let t = 0; t < 2; t += DT) {
      arena.tick(DT);
      burns.push(...hitsOn(arena, arena.blue, null));
    }
    expect(burns.length).toBe(4);
    for (const burn of burns) expect(burn).toBeCloseTo(arena.blue.maxHealth * OITBOIL_HEAT.overheatBurnPerSecond * 0.5, 3);
  });

  test('the burn never takes him below 1 health', () => {
    const arena = oitboilArena();
    overheat(arena);
    arena.blue.setHealth(10);
    tickFor(arena, 3);
    expect(arena.blue.isDead).toBe(false);
    expect(arena.blue.health).toBeGreaterThanOrEqual(1);
    expect(arena.blue.health).toBeLessThan(5);
  });

  // Bug: the self-burn counted as his own damage: stats, omnivamp, his items
  test("the burn isn't damage he dealt: not in his damage to champions or dealt", () => {
    const arena = oitboilArena(at(800, 0));
    overheat(arena);
    tickFor(arena, OITBOIL_HEAT.overheatDuration + 0.5);
    expect(arena.blue.health).toBeLessThan(arena.blue.maxHealth - 50);
    const totals = arena.blue.matchStats.toTotals();
    expect(totals.damageToChampions).toBe(0);
    expect(totals.damageDealt).toBe(0);
    expect(totals.damageTaken).toBeGreaterThan(0);
  });

  test("his omnivamp doesn't heal the burn back", () => {
    const arena = oitboilArena(at(800, 0));
    give(arena.blue, 'bloodroot_sigil');
    expect(arena.blue.getStats().omnivamp).toBeGreaterThan(0);
    overheat(arena);
    let healed = 0;
    const heal = arena.blue.heal.bind(arena.blue);
    arena.blue.heal = ((...args: Parameters<typeof heal>) => {
      const amount = heal(...args);
      healed += amount;
      return amount;
    }) as typeof heal;
    tickFor(arena, 2);
    expect(arena.blue.health).toBeLessThan(arena.blue.maxHealth - 50);
    expect(healed).toBe(0);
  });

  test("his items don't amplify the burn (Execution below 35% health)", () => {
    const arena = oitboilArena(at(800, 0));
    give(arena.blue, 'nightglass_edge');
    overheat(arena);
    arena.blue.setHealth(arena.blue.maxHealth * 0.3);
    arena.context.flushEvents();
    const burns: number[] = [];
    for (let t = 0; t < 1.1; t += DT) {
      arena.tick(DT);
      burns.push(...hitsOn(arena, arena.blue, null));
    }
    expect(burns.length).toBeGreaterThan(0);
    for (const burn of burns) expect(burn).toBeCloseTo(arena.blue.maxHealth * OITBOIL_HEAT.overheatBurnPerSecond * 0.5, 3);
  });

  test('Blue Fire puts out an overheat (and leaves him at 60 heat: the vent from 100)', () => {
    const arena = oitboilArena();
    overheat(arena);
    expect(castFresh(arena, 'W').success).toBe(true);
    expect(overheated(arena.blue)).toBe(false);
    expect(arena.blue.passiveState.isActive).toBe(false);
    expect(heat(arena.blue)).toBe(OITBOIL_HEAT.max - OITBOIL_HEAT.vent);
    // No more burning
    arena.context.flushEvents();
    tickFor(arena, 1.2);
    expect(hitsOn(arena, arena.blue, null).length).toBe(0);
  });

  test('he comes back from death cold, even if he died overheated', () => {
    const arena = oitboilArena();
    overheat(arena);
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    expect(arena.blue.isDead).toBe(true);
    for (let t = 0; t < 120 && arena.blue.isDead; t += DT) arena.tick(DT);
    expect(arena.blue.isDead).toBe(false);
    arena.tick(DT);
    expect(overheated(arena.blue)).toBe(false);
    expect(heat(arena.blue)).toBe(0);
    expect(arena.blue.passiveState.isActive).toBe(false);
  });

  test('he comes back from death cold from some heat too', () => {
    const arena = oitboilArena();
    for (let i = 0; i < 4; i++) castFresh(arena, 'Q');
    expect(heat(arena.blue)).toBe(80);
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    for (let t = 0; t < 120 && arena.blue.isDead; t += DT) arena.tick(DT);
    arena.tick(DT);
    expect(heat(arena.blue)).toBe(0);
    // And it builds from 0 again
    castFresh(arena, 'Q');
    expect(heat(arena.blue)).toBe(20);
  });
});

// =============================================================================
// Q: Spark Spray
// =============================================================================

describe('Oitboil Q: Spark Spray', () => {
  test('rank 1: 50 + 35% ability power, magic, to the enemies around him', () => {
    const arena = oitboilArena();
    expect(castFresh(arena, 'Q').success).toBe(true);
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, Q.damage!.scaling.base[0]), 3);
  });

  test('rank 5 with ability power: 150 + 35% AP', () => {
    const arena = oitboilArena();
    rankUp(arena.blue, 'Q', 5);
    give(arena.blue, 'cinder_rod');
    const ap = arena.blue.getStats().abilityPower;
    castFresh(arena, 'Q');
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 150 + 0.35 * ap), 3);
  });

  test('costs 20 mana, 3 s cooldown at every rank, instant', () => {
    const arena = oitboilArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'Q', { casting: true });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBeCloseTo(mana - 20, 5);
    expect(arena.blue.getAbilityCooldown('Q')).toBeCloseTo(3, 5);
  });

  test('190 around him: just inside hit, just outside missed', () => {
    const inside = oitboilArena(at(Q.aoeRadius! - 1, 0));
    castFresh(inside, 'Q');
    expect(hitsOn(inside, inside.red).length).toBe(1);

    const outside = oitboilArena(at(Q.aoeRadius! + 2, 0));
    castFresh(outside, 'Q');
    expect(hitsOn(outside, outside.red).length).toBe(0);
  });

  test("its radius counts from the centers: a big champion at his full attack range is just out of it (a design note)", () => {
    const arena = oitboilArena(at(800, 0));
    const big = addChampion(arena, 'big', TEAM_RED, O.clone(), 'protobot');
    const edge = CHAMPION_DEFINITIONS.oitboil.baseStats.attackRange + arena.blue.getRadius() + big.getRadius();
    big.position.setFrom(at(edge, 0));
    expect(arena.blue.isInAttackRange(big, arena.blue.getAttackRange())).toBe(true);
    castFresh(arena, 'Q');
    expect(hitsOn(arena, big).length).toBe(0);
  });

  test('enemy minions and monsters too; never allies, towers or himself', () => {
    const arena = oitboilArena(at(800, 0));
    const minion = arena.addMinion(TEAM_RED, at(80, 0));
    const monster = arena.addJungleCreature(at(0, 80));
    const tower = arena.addTower(TEAM_RED, at(-120, 0));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(0, -80));
    const towerHealth = tower.health;
    castFresh(arena, 'Q');
    expect(minion.health).toBeLessThan(minion.maxHealth);
    expect(monster.health).toBeLessThan(monster.maxHealth);
    expect(tower.health).toBe(towerHealth);
    expect(ally.health).toBe(ally.maxHealth);
    expect(arena.blue.health).toBe(arena.blue.maxHealth);
  });

  test("stunned or silenced he can't; rooted he can", () => {
    for (const [cc, reason] of [['stun', 'stunned'], ['silence', 'silenced']] as const) {
      const arena = oitboilArena();
      arena.blue.applyEffect(cc, 1, arena.red.id);
      expect(arena.castAbility(arena.blue, 'Q').failReason).toBe(reason);
      expect(heat(arena.blue)).toBe(0);
    }
    const rooted = oitboilArena();
    rooted.blue.applyEffect('root', 1, rooted.red.id);
    expect(rooted.castAbility(rooted.blue, 'Q').success).toBe(true);
  });

  test('on cooldown it fails and adds no heat', () => {
    const arena = oitboilArena();
    castFresh(arena, 'Q');
    expect(arena.castAbility(arena.blue, 'Q').failReason).toBe('on_cooldown');
    expect(heat(arena.blue)).toBe(20);
  });
});

// =============================================================================
// W: Blue Fire
// =============================================================================

describe('Oitboil W: Blue Fire', () => {
  test('rank 1 heals 90 + 50% ability power', () => {
    const arena = oitboilArena();
    give(arena.blue, 'cinder_rod');
    const ap = arena.blue.getStats().abilityPower;
    arena.blue.setHealth(200);
    castFresh(arena, 'W');
    expect(arena.blue.health - 200).toBeCloseTo(W.heal!.scaling.base[0] + 0.5 * ap, 3);
  });

  test('rank 5 heals 210 and goes on a 10 s cooldown', () => {
    const arena = oitboilArena();
    rankUp(arena.blue, 'W', 5);
    arena.blue.setHealth(200);
    arena.castAbility(arena.blue, 'W');
    expect(arena.blue.health - 200).toBeCloseTo(210, 3);
    expect(arena.blue.getAbilityCooldown('W')).toBeCloseTo(10, 5);
  });

  test('not past his max health', () => {
    const arena = oitboilArena();
    arena.blue.setHealth(arena.blue.maxHealth - 10);
    castFresh(arena, 'W');
    expect(arena.blue.health).toBeCloseTo(arena.blue.maxHealth, 5);
  });

  test('instant, 60 mana, 14 s cooldown; silenced it fails', () => {
    const arena = oitboilArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'W', { casting: true });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBeCloseTo(mana - 60, 5);
    expect(arena.blue.getAbilityCooldown('W')).toBeCloseTo(14, 5);

    const silenced = oitboilArena();
    silenced.blue.applyEffect('silence', 1, silenced.red.id);
    expect(silenced.castAbility(silenced.blue, 'W').failReason).toBe('silenced');
  });

  test("it heals only him: an ally next to him isn't healed", () => {
    const arena = oitboilArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(40, 0));
    ally.setHealth(100);
    arena.blue.setHealth(100);
    castFresh(arena, 'W');
    expect(ally.health).toBe(100);
    expect(arena.blue.health).toBeGreaterThan(100);
  });
});

// =============================================================================
// E: Afterburner
// =============================================================================

describe('Oitboil E: Afterburner', () => {
  function untilLanded(arena: TestArena): void {
    for (let t = 0; t < 2 && (t === 0 || arena.blue.forcedMovement); t += DT) arena.tick(DT);
  }

  const patchesOf = (arena: TestArena) => arena.context.getAllEntities()
    .filter((e): e is ServerZone => e.entityType === EntityType.ZONE && e instanceof ServerZone && e.abilityId === 'oitboil_e' && !e.isDead);

  /** What one patch deals an enemy standing in it the whole time (rank 1) */
  function fullTrail(arena: TestArena, target: TestChampion): number {
    return magicOn(target, E.damage!.scaling.base[0] + 0.4 * arena.blue.getStats().abilityPower);
  }

  test('he rockets 220 toward the spot, at 900 a second', () => {
    const arena = oitboilArena(at(0, 600));
    expect(castFresh(arena, 'E', { targetPosition: at(1000, 0) }).success).toBe(true);
    expect(arena.blue.dashAbilityId).toBe('oitboil_e');
    tickFor(arena, 0.1);
    expect(arena.blue.position.x - O.x).toBeCloseTo(90, -1);
    untilLanded(arena);
    expect(arena.blue.position.x - O.x).toBeCloseTo(E.dash!.distance, 0);
  });

  test('instant, 50 mana, 12 s cooldown (8 s at rank 5)', () => {
    const arena = oitboilArena(at(0, 600));
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'E', { targetPosition: at(200, 0), casting: true });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBeCloseTo(mana - 50, 5);
    expect(arena.blue.getAbilityCooldown('E')).toBeCloseTo(12, 5);
    const maxed = oitboilArena(at(0, 600));
    rankUp(maxed.blue, 'E', 5);
    maxed.castAbility(maxed.blue, 'E', { targetPosition: at(200, 0) });
    expect(maxed.blue.getAbilityCooldown('E')).toBeCloseTo(8, 5);
  });

  test('the trail: patches of fire from where he took off, apart, lasting 2 seconds', () => {
    const arena = oitboilArena(at(0, 600));
    castFresh(arena, 'E', { targetPosition: at(220, 0) });
    untilLanded(arena);
    arena.tick(DT);
    const patches = patchesOf(arena).sort((a, b) => a.position.x - b.position.x);
    expect(patches.length).toBe(Math.floor(220 / 68));
    expect(patches[0].position.x - O.x).toBeLessThan(5);
    for (let i = 1; i < patches.length; i++) {
      expect(patches[i].position.x - patches[i - 1].position.x).toBeGreaterThan(patches[0].radius);
    }
    arena.tickAllFrames(Math.round(2 / DT), DT);
    expect(patchesOf(arena).length).toBe(0);
  });

  test('an enemy standing in one patch takes the ability\'s damage over 2 seconds', () => {
    const arena = oitboilArena(at(80, 0));
    castFresh(arena, 'E', { targetPosition: at(220, 0) });
    const total = damageOver(arena, arena.red, 2.5);
    const full = fullTrail(arena, arena.red);
    expect(total).toBeGreaterThan(full * 0.74);
    expect(total).toBeLessThan(full * 1.26);
  });

  // Bug: against a wall the patches dropped after he stopped piled up on one spot: 2-3x the damage
  test('dashing into a wall, the patches don\'t pile up where he stops: one patch\'s damage', () => {
    const wall = findWallCrossing(30, 90);
    const arena = oitboilArena(new Vector(wall.left - 20, wall.y + 1));
    arena.blue.position.setFrom(new Vector(wall.left - 40, wall.y));
    const open = oitboilArena(at(80, 0));
    castFresh(open, 'E', { targetPosition: at(220, 0) });
    const inTheOpen = damageOver(open, open.red, 2.5);

    castFresh(arena, 'E', { targetPosition: new Vector(wall.right + 400, wall.y) });
    const atTheWall = damageOver(arena, arena.red, 2.5);
    expect(arena.blue.position.x).toBeLessThan(wall.left + 1);
    expect(atTheWall).toBeGreaterThan(0);
    expect(atTheWall).toBeLessThan(inTheOpen * 1.3);
  });

  test('at a wall, no two patches on the same spot', () => {
    const wall = findWallCrossing(30, 90);
    const arena = oitboilArena(at(0, 600));
    arena.blue.position.setFrom(new Vector(wall.left - 40, wall.y));
    castFresh(arena, 'E', { targetPosition: new Vector(wall.right + 400, wall.y) });
    untilLanded(arena);
    arena.tick(DT);
    const patches = patchesOf(arena);
    for (let i = 0; i < patches.length; i++) {
      for (let j = i + 1; j < patches.length; j++) {
        expect(patches[i].position.distanceTo(patches[j].position)).toBeGreaterThan(patches[i].radius);
      }
    }
  });

  test('an enemy where two patches overlap takes one patch\'s damage', () => {
    // A 140 rocket: two patches, the second dropped at the tick it's due, 60 on (closer than two radii)
    const arena = oitboilArena(at(30, 0));
    castFresh(arena, 'E', { targetPosition: at(140, 0) });
    let total = damageOver(arena, arena.red, 0.2);
    const patches = patchesOf(arena);
    expect(patches.length).toBe(2);
    for (const patch of patches) expect(patch.position.distanceTo(arena.red.position)).toBeLessThan(patch.radius);
    total += damageOver(arena, arena.red, 2.3);
    expect(total).toBeGreaterThan(fullTrail(arena, arena.red) * 0.74);
    expect(total).toBeLessThan(fullTrail(arena, arena.red) * 1.26);
  });

  test('a short hop leaves a single patch', () => {
    const arena = oitboilArena(at(0, 600));
    castFresh(arena, 'E', { targetPosition: at(50, 0) });
    for (let t = 0; t < 0.3; t += DT) arena.tickAll(DT);
    expect(patchesOf(arena).length).toBe(1);
  });

  test("the fire doesn't burn allies, and burns minions", () => {
    const arena = oitboilArena(at(0, 600));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(80, 0));
    const minion = arena.addMinion(TEAM_RED, at(150, 0));
    castFresh(arena, 'E', { targetPosition: at(220, 0) });
    tickFor(arena, 0.01);
    arena.tickAllFrames(Math.round(2.5 / DT), DT);
    expect(ally.health).toBe(ally.maxHealth);
    expect(minion.health).toBeLessThan(minion.maxHealth);
  });

  test("overheated, the fire burns 25% harder", () => {
    const cold = oitboilArena(at(80, 0));
    castFresh(cold, 'E', { targetPosition: at(220, 0) });
    const coldTotal = damageOver(cold, cold.red, 2.5);

    const hot = oitboilArena(at(80, 0));
    overheat(hot);
    hot.red.setHealth(hot.red.maxHealth);
    hot.context.flushEvents();
    castFresh(hot, 'E', { targetPosition: at(220, 0) });
    const hotTotal = damageOver(hot, hot.red, 2.5);
    expect(hotTotal).toBeCloseTo(coldTotal * 1.25, 0);
  });

  test("rooted or grounded he can't rocket: nothing spent, no heat", () => {
    for (const cc of ['root', 'grounded']) {
      const arena = oitboilArena(at(0, 600));
      arena.blue.applyEffect(cc, 1, arena.red.id);
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, 'E', { targetPosition: at(200, 0) }).failReason).toBe('rooted');
      expect(arena.blue.resource).toBe(mana);
      expect(heat(arena.blue)).toBe(0);
      arena.tick(DT);
      expect(patchesOf(arena).length).toBe(0);
    }
  });

  test('killed in the dash, no more patches', () => {
    const arena = oitboilArena(at(0, 600));
    castFresh(arena, 'E', { targetPosition: at(220, 0) });
    arena.tick(DT);
    const before = patchesOf(arena).length;
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    tickFor(arena, 0.5);
    expect(patchesOf(arena).length).toBe(before);
  });

  test('a click on himself does nothing and costs nothing', () => {
    const arena = oitboilArena(at(0, 600));
    const mana = arena.blue.resource;
    expect(arena.castAbility(arena.blue, 'E', { targetPosition: O.clone() }).success).toBe(false);
    expect(arena.blue.resource).toBe(mana);
  });
});

// =============================================================================
// R: Flamethrower
// =============================================================================

describe('Oitboil R: Flamethrower', () => {
  /** Red in front of him (along +x), in the cone */
  const coneArena = () => oitboilArena(at(150, 0));

  function pour(arena: TestArena, aim = at(200, 0)) {
    return castFresh(arena, 'R', { targetPosition: aim });
  }

  /** What's left of `health` after the stream, with `pulses` pulses each taking their share */
  function afterStream(health: number, rank: number, magicResist: number, pulses = 4, multiplier = 1): number {
    const share = OITBOIL_FLAMETHROWER_SHARE[rank - 1];
    const pulseShare = 1 - Math.pow(1 - share, 1 / 4);
    const mitigation = 100 / (100 + magicResist);
    return health * Math.pow(1 - pulseShare * multiplier * mitigation, pulses);
  }

  test('an enemy champion in the cone loses 35% of its current health (rank 1) as magic damage, in four pulses', () => {
    const arena = coneArena();
    const health = arena.red.health;
    expect(pour(arena).success).toBe(true);
    let pulses = 0;
    for (let t = 0; t < 1.2; t += DT) {
      arena.tick(DT);
      pulses += hitsOn(arena, arena.red).length;
    }
    expect(pulses).toBe(4);
    expect(arena.red.health).toBeCloseTo(afterStream(health, 1, arena.red.getStats().magicResist), -1);
  });

  test('rank 2 takes 40%, rank 3 45%', () => {
    for (const rank of [2, 3]) {
      const arena = coneArena();
      rankUp(arena.blue, 'R', rank);
      const health = arena.red.health;
      pour(arena);
      tickFor(arena, 1.2);
      expect(arena.red.health).toBeCloseTo(afterStream(health, rank, arena.red.getStats().magicResist), -1);
    }
  });

  test('a hurt champion loses less: it\'s a share of its current health', () => {
    const arena = coneArena();
    arena.red.setHealth(200);
    pour(arena);
    tickFor(arena, 1.2);
    expect(arena.red.health).toBeCloseTo(afterStream(200, 1, arena.red.getStats().magicResist), -1);
  });

  test('other units take 150 + 60% ability power, spread over the pulses', () => {
    const arena = oitboilArena(at(0, 700));
    const minion = arena.addMinion(TEAM_RED, at(150, 0), 'super');
    const health = minion.health;
    pour(arena);
    arena.tickFrames(Math.round(1.2 / DT), DT);
    const taken = health - minion.health;
    expect(taken).toBeGreaterThan(0);
    // Four pulses of 150/4, less the minion's resists
    expect(taken).toBeLessThanOrEqual(R.damage!.scaling.base[0] + 0.01);
  });

  test('outside the cone (behind, aside, past its 260) nothing burns; allies never', () => {
    const arena = oitboilArena(at(0, 700));
    const behind = addChampion(arena, 'behind', TEAM_RED, at(-100, 0));
    const aside = addChampion(arena, 'aside', TEAM_RED, at(60, 120));
    const far = addChampion(arena, 'far', TEAM_RED, at(R.range! + 20, 0));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(120, 0));
    pour(arena);
    tickFor(arena, 1.2);
    for (const champion of [behind, aside, far, ally]) expect(champion.health).toBe(champion.maxHealth);
  });

  test('just inside the cone\'s edge it burns', () => {
    const arena = oitboilArena(at(0, 700));
    // 30 degrees off the aim, a little inside
    const angle = Math.PI / 6 - 0.05;
    const edge = addChampion(arena, 'edge', TEAM_RED, at(Math.cos(angle) * 200, Math.sin(angle) * 200));
    pour(arena);
    tickFor(arena, 1.2);
    expect(edge.health).toBeLessThan(edge.maxHealth);
  });

  test('it has the aimed cast time; 100 mana; cooldown 110 s (80 s at rank 3)', () => {
    const arena = coneArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'R', { targetPosition: at(200, 0), casting: true });
    expect(arena.blue.isCasting()).toBe(true);
    tickFor(arena, 0.3);
    expect(arena.blue.resource).toBeLessThanOrEqual(mana - 100 + 1);
    expect(arena.blue.getAbilityCooldown('R')).toBeGreaterThan(109);

    const maxed = coneArena();
    rankUp(maxed.blue, 'R', 3);
    pour(maxed);
    expect(maxed.blue.getAbilityCooldown('R')).toBeCloseTo(80, 5);
  });

  test("he's rooted while he pours, then exhausted: walking, but no attacks or casts", () => {
    const arena = coneArena();
    pour(arena);
    expect(arena.blue.ccStatus.canMove).toBe(false);
    expect(arena.blue.ccStatus.canCast).toBe(false);
    expect(arena.blue.ccStatus.canAttack).toBe(false);
    tickFor(arena, FLAMETHROWER_DURATION + 0.1);
    expect(arena.blue.ccStatus.canMove).toBe(true);
    expect(arena.blue.ccStatus.canCast).toBe(false);
    expect(arena.blue.ccStatus.canAttack).toBe(false);
    expect(castFresh(arena, 'Q').failReason).toBe('silenced');
    tickFor(arena, FLAMETHROWER_EXHAUSTION);
    expect(arena.blue.ccStatus.canCast).toBe(true);
    expect(arena.blue.ccStatus.canAttack).toBe(true);
  });

  test('stunned while he pours, the stream stops', () => {
    const arena = coneArena();
    const health = arena.red.health;
    pour(arena);
    tickFor(arena, 0.35);
    const afterTwo = arena.red.health;
    expect(afterTwo).toBeLessThan(health);
    arena.blue.applyEffect('stun', 1, arena.red.id);
    arena.context.flushEvents();
    tickFor(arena, 0.8);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    expect(arena.blue.hasEffect('oitboil_flamethrower')).toBe(false);
  });

  test('killed while he pours, the stream stops', () => {
    const arena = coneArena();
    pour(arena);
    tickFor(arena, 0.15);
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    arena.context.flushEvents();
    tickFor(arena, 1);
    expect(hitsOn(arena, arena.red).length).toBe(0);
  });

  test('overheated, champions lose 25% more of the share each pulse', () => {
    const arena = coneArena();
    overheat(arena);
    arena.red.setHealth(arena.red.maxHealth);
    const health = arena.red.health;
    pour(arena);
    tickFor(arena, 1.2);
    expect(arena.red.health).toBeCloseTo(afterStream(health, 1, arena.red.getStats().magicResist, 4, 1.25), -1);
  });

  test('a click on himself: no aim, so when the cast time ends nothing goes off and nothing is spent', () => {
    const arena = coneArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'R', { targetPosition: O.clone() });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.getAbilityCooldown('R')).toBe(0);
    expect(arena.blue.hasEffect('oitboil_exhausted')).toBe(false);
    expect(heat(arena.blue)).toBe(0);
  });
});
