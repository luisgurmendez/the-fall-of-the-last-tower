/**
 * Hop-To-Eat Champion Tests
 *
 * Hop-To-Eat - Deadly Cuteness, a melee assassin:
 * - Passive (Hop to It!): every few seconds its next basic attack hops onto
 *   its target from up to 250 away and deals bonus physical damage
 * - Q (Rodent Fangs): shreds the target's armor, then bites
 * - W (Carrot Break): a heal that grows with missing health, rooted while
 *   it eats, then faster attacks
 * - E (Bunny Hop): a dash that readies the next hop
 * - R (Savage Kick): kicks an enemy champion flying into its allies
 */

import { describe, test, expect } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  GameEventType,
  HOP_HOP,
  TEAM_BLUE,
  TEAM_RED,
  calculatePhysicalDamage,
  getAbilityDefinition,
  getPassiveDefinition,
  type ItemSlot,
  type Side,
} from '@siege/shared';
import { createTestArena, TestChampion, type TestArena } from '../ServerTestUtils';
import type { ServerEntity } from '../../simulation/ServerEntity';
import { findWallCrossing } from '../wallSpots';

const DT = 1 / 30;
const Q = getAbilityDefinition('hop_q')!;
const W = getAbilityDefinition('hop_w')!;
const E = getAbilityDefinition('hop_e')!;
const R = getAbilityDefinition('hop_r')!;
const BASE = CHAMPION_DEFINITIONS.hop.baseStats;

/** Open ground (the middle of the map has walls within 400): red's base, clear of its nexus (an obstacle) */
const O = new Vector(2075, -1950);
const at = (x: number, y: number) => new Vector(O.x + x, O.y + y);

/** Hop-To-Eat (blue, at the origin) and Magnus (red), both at `level`, healthy and with full mana */
function hopArena(redAt = at(150, 0), level = 6): TestArena {
  const arena = createTestArena({ blueChampion: 'hop', redChampion: 'magnus', bluePosition: O, redPosition: redAt });
  for (const champion of [arena.blue, arena.red]) {
    champion.setLevel(level);
    // (Leveling up raises max health, not health)
    champion.setHealth(champion.maxHealth);
    champion.setResource(champion.maxResource);
  }
  arena.context.flushEvents();
  return arena;
}

/** Red placed so the gap between the two bodies is `gap` */
function redAtGap(gap: number, level = 6): TestArena {
  const arena = hopArena(at(800, 0), level);
  arena.red.position.setFrom(at(arena.blue.getRadius() + arena.red.getRadius() + gap, 0));
  refreshVision(arena);
  return arena;
}

/** Vision again, after moving champions around (attacks need to see their target) */
function refreshVision(arena: TestArena): void {
  arena.context.getFogOfWar().updateVision(arena.context, 1);
}

function gapBetween(a: ServerEntity, b: ServerEntity): number {
  return a.position.distanceTo(b.position) - a.getRadius() - b.getRadius();
}

/** The damage blue dealt `target` since the last flush, one entry per hit */
function hitsOn(arena: TestArena, target: ServerEntity, source: ServerEntity = arena.blue): number[] {
  return arena.context.flushEvents()
    .filter(e => e.type === GameEventType.DAMAGE && e.data.entityId === target.id && e.data.sourceId === source.id)
    .map(e => e.data.amount as number);
}

/** Tick until blue has hit `target` `count` times (or the time runs out) */
function tickUntilHits(arena: TestArena, target: ServerEntity, count: number, seconds = 3): number[] {
  const hits: number[] = [];
  for (let t = 0; t < seconds && hits.length < count; t += DT) {
    arena.tick(DT);
    hits.push(...hitsOn(arena, target));
  }
  return hits;
}

/** Tick the arena, every entity included, for `seconds` */
function tickAllFor(arena: TestArena, seconds: number): void {
  arena.tickAllFrames(Math.round(seconds / DT), DT);
}

function tickFor(arena: TestArena, seconds: number): void {
  arena.tickFrames(Math.round(seconds / DT), DT);
}

/** The hopping attack's bonus (before armor) */
function hopBonus(hop: TestChampion): number {
  return HOP_HOP.bonusBase + HOP_HOP.bonusPerLevel * hop.level + HOP_HOP.bonusAdRatio * hop.getStats().attackDamage;
}

function physicalOn(target: TestChampion, raw: number): number {
  return calculatePhysicalDamage(raw, target.getStats().armor);
}

const hopReady = (hop: TestChampion) => hop.passiveState.cooldownRemaining <= 0;

function give(champion: TestChampion, itemId: string, slot = 0): void {
  champion.items[slot] = { definitionId: itemId, slot: slot as ItemSlot, passiveCooldowns: {}, nextIntervalTick: {} };
  champion.invalidateStats();
  champion.getStats();
}

/** Another champion in the arena */
function addChampion(arena: TestArena, id: string, side: Side, position: Vector, championId = 'warrior'): TestChampion {
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

// =============================================================================
// Passive: Hop to It!
// =============================================================================

describe('Hop-To-Eat passive: Hop to It!', () => {
  test('it starts ready: its attack reaches 250, and the passive shows as active', () => {
    const arena = hopArena();
    arena.tick(DT);
    expect(hopReady(arena.blue)).toBe(true);
    expect(arena.blue.getAttackRange()).toBe(HOP_HOP.reach);
    expect(arena.blue.passiveState.isActive).toBe(true);
  });

  test('an attack from out of melee reach hops onto the target and lands before the blow', () => {
    const arena = redAtGap(150);
    arena.blue.setAttackTarget(arena.red.id);
    arena.tick(DT);
    expect(arena.blue.forcedMovement).not.toBeNull();
    expect(arena.blue.dashAbilityId).toBe('hop_hop');
    const events = arena.context.flushEvents();
    expect(events.some(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'hop_hop')).toBe(true);

    const hits = tickUntilHits(arena, arena.red, 2);
    expect(hits.length).toBe(2);
    expect(gapBetween(arena.blue, arena.red)).toBeLessThanOrEqual(BASE.attackRange + 1);
  });

  test('the hopping attack deals its attack damage plus 15 + 5 per level + 30% attack damage', () => {
    const arena = redAtGap(150);
    const ad = arena.blue.getStats().attackDamage;
    const bonus = hopBonus(arena.blue);
    arena.blue.setAttackTarget(arena.red.id);
    const hits = tickUntilHits(arena, arena.red, 2);
    expect(hits[0]).toBeCloseTo(physicalOn(arena.red, ad), 3);
    expect(hits[1]).toBeCloseTo(physicalOn(arena.red, bonus), 3);
  });

  test('at level 18 the bonus is bigger (15 + 90 + 30% attack damage)', () => {
    const arena = redAtGap(150, 18);
    const bonus = hopBonus(arena.blue);
    expect(bonus).toBeCloseTo(15 + 5 * 18 + 0.3 * arena.blue.getStats().attackDamage, 5);
    arena.blue.setAttackTarget(arena.red.id);
    const hits = tickUntilHits(arena, arena.red, 2);
    expect(hits[1]).toBeCloseTo(physicalOn(arena.red, bonus), 3);
  });

  test('after the hop its reach is melee again, for 6 seconds', () => {
    const arena = redAtGap(150);
    arena.blue.setAttackTarget(arena.red.id);
    tickUntilHits(arena, arena.red, 2);
    expect(hopReady(arena.blue)).toBe(false);
    expect(arena.blue.passiveState.cooldownRemaining).toBeGreaterThan(HOP_HOP.every - 1);
    expect(arena.blue.getAttackRange()).toBe(BASE.attackRange);
    expect(arena.blue.passiveState.isActive).toBe(false);
    arena.blue.stop();
    tickFor(arena, HOP_HOP.every);
    expect(hopReady(arena.blue)).toBe(true);
  });

  test('the attacks after the hop are plain attacks', () => {
    const arena = redAtGap(150);
    const ad = arena.blue.getStats().attackDamage;
    arena.blue.setAttackTarget(arena.red.id);
    const hits = tickUntilHits(arena, arena.red, 4, 6);
    expect(hits.length).toBe(4);
    expect(hits[2]).toBeCloseTo(physicalOn(arena.red, ad), 3);
    expect(hits[3]).toBeCloseTo(physicalOn(arena.red, ad), 3);
  });

  test('from melee reach it attacks where it stands, and still hits harder', () => {
    const arena = redAtGap(10);
    arena.blue.setAttackTarget(arena.red.id);
    arena.tick(DT);
    expect(arena.blue.forcedMovement).toBeNull();
    const hits = tickUntilHits(arena, arena.red, 2);
    expect(hits.length).toBe(2);
    expect(hits[1]).toBeCloseTo(physicalOn(arena.red, hopBonus(arena.blue)), 3);
    expect(hopReady(arena.blue)).toBe(false);
  });

  test('a target farther than 250: it walks closer, and hops from 250', () => {
    const arena = redAtGap(400);
    arena.blue.setAttackTarget(arena.red.id);
    let gapAtHop = -1;
    for (let t = 0; t < 4 && gapAtHop < 0; t += DT) {
      arena.tick(DT);
      if (arena.blue.dashAbilityId === 'hop_hop') gapAtHop = gapBetween(arena.blue, arena.red);
    }
    expect(gapAtHop).toBeGreaterThan(HOP_HOP.reach - 30);
    expect(gapAtHop).toBeLessThanOrEqual(HOP_HOP.reach);
  });

  test('it hops at minions too', () => {
    const arena = hopArena(at(-700, 0));
    const minion = arena.addMinion(TEAM_RED, at(arena.blue.getRadius() + 150, 0));
    arena.blue.setAttackTarget(minion.id);
    arena.tick(DT);
    expect(arena.blue.dashAbilityId).toBe('hop_hop');
    const hits = tickUntilHits(arena, minion, 2);
    expect(hits.length).toBe(2);
  });

  test('a hopping attack that kills its target deals no bonus to the corpse', () => {
    const arena = redAtGap(150);
    arena.red.setHealth(5);
    arena.blue.setAttackTarget(arena.red.id);
    const hits = tickUntilHits(arena, arena.red, 2, 1.5);
    expect(arena.red.isDead).toBe(true);
    expect(hits.length).toBe(1);
  });

  test('Bunny Hop (E) readies the next hop at once', () => {
    const arena = redAtGap(150);
    arena.blue.setAttackTarget(arena.red.id);
    tickUntilHits(arena, arena.red, 2);
    expect(hopReady(arena.blue)).toBe(false);
    arena.blue.stop();
    expect(arena.castAbility(arena.blue, 'E', { targetPosition: at(-500, 0) }).success).toBe(true);
    expect(hopReady(arena.blue)).toBe(true);
    expect(arena.blue.getAttackRange()).toBe(HOP_HOP.reach);
  });

  // Bug: rooted, the attack started from 250 away and spent the passive without leaping
  test('rooted, the hop waits: its reach stays melee, nothing is spent, it doesn\'t move', () => {
    const arena = redAtGap(150);
    arena.blue.applyEffect('root', 1.5, arena.red.id);
    arena.blue.setAttackTarget(arena.red.id);
    const start = arena.blue.position.clone();
    const hits = tickUntilHits(arena, arena.red, 1, 1);
    expect(hits.length).toBe(0);
    expect(hopReady(arena.blue)).toBe(true);
    expect(arena.blue.getAttackRange()).toBe(BASE.attackRange);
    expect(arena.blue.position.distanceTo(start)).toBeLessThan(0.01);
  });

  test('when the root ends it hops', () => {
    const arena = redAtGap(150);
    arena.blue.applyEffect('root', 1, arena.red.id);
    arena.blue.setAttackTarget(arena.red.id);
    tickFor(arena, 1.1);
    const hits = tickUntilHits(arena, arena.red, 2);
    expect(hits.length).toBe(2);
    expect(hits[1]).toBeCloseTo(physicalOn(arena.red, hopBonus(arena.blue)), 3);
  });

  test('rooted by its own Carrot Break, the hop waits for it to finish eating', () => {
    const arena = redAtGap(150);
    expect(arena.castAbility(arena.blue, 'W').success).toBe(true);
    arena.blue.setAttackTarget(arena.red.id);
    tickFor(arena, 0.6);
    expect(hopReady(arena.blue)).toBe(true);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    const hits = tickUntilHits(arena, arena.red, 2);
    expect(hits.length).toBe(2);
    expect(hopReady(arena.blue)).toBe(false);
  });

  test('grounded, it walks up and attacks normally: the hop waits', () => {
    const arena = redAtGap(150);
    arena.blue.applyEffect('grounded', 5, arena.red.id);
    const ad = arena.blue.getStats().attackDamage;
    arena.blue.setAttackTarget(arena.red.id);
    arena.tick(DT);
    expect(arena.blue.forcedMovement).toBeNull();
    const hits = tickUntilHits(arena, arena.red, 1, 4);
    expect(hits.length).toBe(1);
    expect(hits[0]).toBeCloseTo(physicalOn(arena.red, ad), 3);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    expect(hopReady(arena.blue)).toBe(true);
  });

  test('silenced, it still hops (a passive, not a cast)', () => {
    const arena = redAtGap(150);
    arena.blue.applyEffect('silence', 2, arena.red.id);
    arena.blue.setAttackTarget(arena.red.id);
    arena.tick(DT);
    expect(arena.blue.dashAbilityId).toBe('hop_hop');
  });

  // Bug: the hop's target stayed set when its blow didn't land, so the next plain attack got the bonus
  test('a hopping attack cut short by a cast leaves no bonus on the next attack', () => {
    const arena = redAtGap(150);
    const ad = arena.blue.getStats().attackDamage;
    arena.blue.setAttackTarget(arena.red.id);
    for (let t = 0; t < 1 && arena.blue.forcedMovement === null; t += DT) arena.tick(DT);
    for (let t = 0; t < 1 && arena.blue.forcedMovement !== null; t += DT) arena.tick(DT);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    // Q now, in the attack's windup: it drops the blow
    expect(arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id }).success).toBe(true);
    const qHits = hitsOn(arena, arena.red);
    expect(qHits.length).toBe(1);
    // The next attack is a plain one: one hit, its attack damage
    const hits = tickUntilHits(arena, arena.red, 1);
    tickFor(arena, 0.1);
    hits.push(...hitsOn(arena, arena.red));
    expect(hits.length).toBe(1);
    expect(hits[0]).toBeCloseTo(physicalOn(arena.red, ad), 3);
  });

  test('a hopping attack whose blow was dropped: the next attack is plain even with no cast', () => {
    const arena = redAtGap(150);
    arena.blue.setAttackTarget(arena.red.id);
    arena.tick(DT);
    expect(arena.blue.dashAbilityId).toBe('hop_hop');
    arena.blue.basicAttacks.cancelPendingAttack();
    const hits = tickUntilHits(arena, arena.red, 1);
    tickFor(arena, 0.1);
    hits.push(...hitsOn(arena, arena.red));
    expect(hits.length).toBe(1);
  });

  // Bug: the bonus counted as ability damage, so Veil (which blocks abilities) ate it
  test("the bonus is part of the basic attack: Veil doesn't block it, and stays up", () => {
    const arena = redAtGap(150);
    give(arena.red, 'stormward_veil');
    const bonus = hopBonus(arena.blue);
    arena.blue.setAttackTarget(arena.red.id);
    const hits = tickUntilHits(arena, arena.red, 2);
    expect(hits.length).toBe(2);
    expect(hits[1]).toBeCloseTo(physicalOn(arena.red, bonus), 3);
    // Veil is still ready for an ability
    expect(arena.red.takeDamage(100, 'magic', arena.blue.id, arena.context)).toBe(0);
  });

  test("both blows of the hopping attack are dealt as basic attack damage (for items, its own and the target's)", () => {
    const arena = redAtGap(150);
    const kinds: string[] = [];
    const takeDamage = arena.red.takeDamage.bind(arena.red);
    arena.red.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
      kinds.push(arena.blue.damageKind);
      return takeDamage(...args);
    }) as typeof takeDamage;
    arena.blue.setAttackTarget(arena.red.id);
    tickUntilHits(arena, arena.red, 2);
    expect(kinds).toEqual(['basic', 'basic']);
  });

  test('a hop at a target behind a wall stops at the wall, and the blow then misses', () => {
    const wall = findWallCrossing(30, 90);
    const arena = hopArena(new Vector(wall.right + 120, wall.y));
    arena.blue.position.setFrom(new Vector(wall.left - 30, wall.y));
    // Seen (an ally's ward, say): walls block its own sight
    arena.context.isVisibleTo = () => true;
    arena.blue.setAttackTarget(arena.red.id);
    arena.tick(DT);
    expect(arena.blue.dashAbilityId).toBe('hop_hop');
    for (let t = 0; t < 1 && arena.blue.forcedMovement; t += DT) arena.tick(DT);
    expect(arena.blue.position.x).toBeLessThan(wall.left + 1);
    // (The arena doesn't keep walkers out of walls: the blow comes before it walks far)
    expect(tickUntilHits(arena, arena.red, 1, 0.3).length).toBe(0);
  });
});

// =============================================================================
// Q: Rodent Fangs
// =============================================================================

describe('Hop-To-Eat Q: Rodent Fangs', () => {
  const inRange = () => hopArena(at(Q.range! - 5, 0));

  test('rank 1: 50 + 80% attack damage, physical, through the 10 armor it just shred', () => {
    const arena = inRange();
    const armor = arena.red.getStats().armor;
    const raw = Q.damage!.scaling.base[0] + 0.8 * arena.blue.getStats().attackDamage;
    expect(arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id }).success).toBe(true);
    const hits = hitsOn(arena, arena.red);
    expect(hits.length).toBe(1);
    expect(hits[0]).toBeCloseTo(calculatePhysicalDamage(raw, armor - 10), 3);
    expect(arena.red.getStats().armor).toBeCloseTo(armor - 10, 5);
  });

  test('rank 5: 190 + 80% attack damage, cheaper cooldown (5 s)', () => {
    const arena = inRange();
    rankUp(arena.blue, 'Q', 5);
    const armor = arena.red.getStats().armor;
    const raw = 190 + 0.8 * arena.blue.getStats().attackDamage;
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id });
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(calculatePhysicalDamage(raw, armor - 10), 3);
    expect(arena.blue.getAbilityCooldown('Q')).toBeCloseTo(5, 5);
  });

  test('costs 35 mana and goes on a 7 second cooldown at rank 1', () => {
    const arena = inRange();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id });
    expect(arena.blue.resource).toBeCloseTo(mana - 35, 5);
    expect(arena.blue.getAbilityCooldown('Q')).toBeCloseTo(7, 5);
  });

  test('the shred lasts 4 seconds', () => {
    const arena = inRange();
    const armor = arena.red.getStats().armor;
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id });
    tickFor(arena, 3.8);
    expect(arena.red.getStats().armor).toBeCloseTo(armor - 10, 5);
    tickFor(arena, 0.4);
    expect(arena.red.hasEffect('armor_reduction')).toBe(false);
    expect(arena.red.getStats().armor).toBeCloseTo(armor, 5);
  });

  // Bug: the shred stacked (-30 after three bites); it should refresh
  test("bites in a row don't stack the shred: still 10 armor, and it lasts from the last bite", () => {
    const arena = inRange();
    const armor = arena.red.getStats().armor;
    for (let i = 0; i < 3; i++) {
      arena.blue.resetCooldowns();
      expect(arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id }).success).toBe(true);
      tickFor(arena, 1);
    }
    expect(arena.red.getStats().armor).toBeCloseTo(armor - 10, 5);
    const shred = arena.red.getActiveEffects().find(e => e.definitionId === 'armor_reduction')!;
    expect(shred.stacks).toBe(1);
    expect(shred.timeRemaining).toBeGreaterThan(2.9);
  });

  test('it has the aimed cast time: the bite lands 0.25 s after the cast', () => {
    const arena = inRange();
    expect(arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id, casting: true }).success).toBe(true);
    expect(arena.blue.isCasting()).toBe(true);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    tickFor(arena, 0.3);
    expect(hitsOn(arena, arena.red).length).toBe(1);
  });

  test('just inside its range it bites; just outside it fails and spends nothing', () => {
    const inside = hopArena(at(Q.range!, 0));
    expect(inside.castAbility(inside.blue, 'Q', { targetId: inside.red.id }).success).toBe(true);

    const outside = hopArena(at(Q.range! + 2, 0));
    const mana = outside.blue.resource;
    const result = outside.castAbility(outside.blue, 'Q', { targetId: outside.red.id });
    expect(result.success).toBe(false);
    expect(result.failReason).toBe('out_of_range');
    expect(outside.blue.resource).toBe(mana);
    expect(outside.blue.getAbilityCooldown('Q')).toBe(0);
  });

  test('no target, or an ally: it fails and spends nothing', () => {
    const arena = inRange();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(50, 0));
    const mana = arena.blue.resource;
    expect(arena.castAbility(arena.blue, 'Q').failReason).toBe('invalid_target');
    expect(arena.castAbility(arena.blue, 'Q', { targetId: ally.id }).failReason).toBe('invalid_target');
    expect(arena.blue.resource).toBe(mana);
  });

  test('stunned or silenced it can\'t bite; rooted it can', () => {
    const stunned = inRange();
    stunned.blue.applyEffect('stun', 1, stunned.red.id);
    expect(stunned.castAbility(stunned.blue, 'Q', { targetId: stunned.red.id }).failReason).toBe('stunned');

    const silenced = inRange();
    silenced.blue.applyEffect('silence', 1, silenced.red.id);
    expect(silenced.castAbility(silenced.blue, 'Q', { targetId: silenced.red.id }).failReason).toBe('silenced');

    const rooted = inRange();
    rooted.blue.applyEffect('root', 1, rooted.red.id);
    expect(rooted.castAbility(rooted.blue, 'Q', { targetId: rooted.red.id }).success).toBe(true);
  });

  test('stunned during the cast time: no bite, nothing spent', () => {
    const arena = inRange();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id, casting: true });
    arena.blue.applyEffect('stun', 1, arena.red.id);
    tickFor(arena, 0.4);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    expect(arena.red.hasEffect('armor_reduction')).toBe(false);
    expect(arena.blue.resource).toBeGreaterThanOrEqual(mana - 0.01);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
  });

  test('a target that dies in the cast time: nothing spent', () => {
    const arena = inRange();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id, casting: true });
    arena.red.takeDamage(1e9, 'true');
    tickFor(arena, 0.4);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
    expect(arena.blue.resource).toBeGreaterThanOrEqual(mana - 0.01);
  });

  test('it bites minions and jungle monsters, not towers', () => {
    const arena = hopArena(at(-700, 0));
    const minion = arena.addMinion(TEAM_RED, at(60, 0));
    expect(arena.castAbility(arena.blue, 'Q', { targetId: minion.id }).success).toBe(true);
    expect(minion.health).toBeLessThan(minion.maxHealth);

    arena.blue.resetCooldowns();
    const monster = arena.addJungleCreature(at(0, 60));
    expect(arena.castAbility(arena.blue, 'Q', { targetId: monster.id }).success).toBe(true);
    expect(monster.health).toBeLessThan(monster.maxHealth);

    arena.blue.resetCooldowns();
    const tower = arena.addTower(TEAM_RED, at(-80, 0));
    expect(arena.castAbility(arena.blue, 'Q', { targetId: tower.id }).failReason).toBe('invalid_target');
  });
});

// =============================================================================
// W: Carrot Break
// =============================================================================

describe('Hop-To-Eat W: Carrot Break', () => {
  function expectedHeal(hop: TestChampion, rank: number): number {
    const scaling = W.heal!.scaling;
    return scaling.base[rank - 1] + scaling.adRatio! * hop.getStats().attackDamage
      + scaling.missingHealthRatio! * (hop.maxHealth - hop.health);
  }

  test('rank 1 at half health: 60 + 40% attack damage + 6% of its missing health', () => {
    const arena = hopArena();
    arena.blue.setHealth(arena.blue.maxHealth / 2);
    const before = arena.blue.health;
    const heal = expectedHeal(arena.blue, 1);
    expect(arena.castAbility(arena.blue, 'W').success).toBe(true);
    expect(arena.blue.health - before).toBeCloseTo(heal, 3);
  });

  test('the heal grows with the health it misses', () => {
    const low = hopArena();
    low.blue.setHealth(50);
    const lowBefore = low.blue.health;
    low.castAbility(low.blue, 'W');

    const high = hopArena();
    high.blue.setHealth(high.blue.maxHealth - 200);
    const highBefore = high.blue.health;
    high.castAbility(high.blue, 'W');

    expect(low.blue.health - lowBefore).toBeGreaterThan(high.blue.health - highBefore);
  });

  test('rank 5: 200 + 40% attack damage + 6% missing health, 10 s cooldown', () => {
    const arena = hopArena();
    rankUp(arena.blue, 'W', 5);
    arena.blue.setHealth(100);
    const heal = expectedHeal(arena.blue, 5);
    arena.castAbility(arena.blue, 'W');
    expect(arena.blue.health - 100).toBeCloseTo(heal, 3);
    expect(arena.blue.getAbilityCooldown('W')).toBeCloseTo(10, 5);
  });

  test('at full health it heals nothing past its maximum', () => {
    const arena = hopArena();
    arena.castAbility(arena.blue, 'W');
    expect(arena.blue.health).toBeCloseTo(arena.blue.maxHealth, 5);
  });

  test('Wounds cut the heal', () => {
    const arena = hopArena();
    arena.blue.setHealth(200);
    const heal = expectedHeal(arena.blue, 1);
    arena.blue.applyEffect('wounds', 3, arena.red.id);
    arena.castAbility(arena.blue, 'W');
    expect(arena.blue.health - 200).toBeCloseTo(heal * 0.6, 3);
  });

  test("it's instant, costs 50 mana and goes on a 14 s cooldown", () => {
    const arena = hopArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'W', { casting: true });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBeCloseTo(mana - 50, 5);
    expect(arena.blue.getAbilityCooldown('W')).toBeCloseTo(14, 5);
  });

  test("it can't move for 0.75 s while it eats, then it can", () => {
    const arena = hopArena();
    arena.castAbility(arena.blue, 'W');
    expect(arena.blue.ccStatus.canMove).toBe(false);
    expect(arena.blue.ccStatus.canAttack).toBe(true);
    arena.blue.setMoveTarget(at(-300, 0));
    tickFor(arena, 0.6);
    expect(arena.blue.position.x).toBeCloseTo(O.x, 3);
    tickFor(arena, 0.3);
    expect(arena.blue.ccStatus.canMove).toBe(true);
    tickFor(arena, 0.3);
    expect(arena.blue.position.x).toBeLessThan(O.x - 10);
  });

  test('then it attacks 30% faster for 3 seconds', () => {
    const arena = hopArena();
    const attackSpeed = arena.blue.getStats().attackSpeed;
    arena.castAbility(arena.blue, 'W');
    arena.tick(DT);
    expect(arena.blue.getStats().attackSpeed).toBeCloseTo(attackSpeed * 1.3, 5);
    tickFor(arena, 2.8);
    expect(arena.blue.hasEffect('hop_sugar_rush')).toBe(true);
    tickFor(arena, 0.3);
    expect(arena.blue.hasEffect('hop_sugar_rush')).toBe(false);
    expect(arena.blue.getStats().attackSpeed).toBeCloseTo(attackSpeed, 5);
  });

  test('rooted it can still eat; silenced or stunned it can\'t', () => {
    const rooted = hopArena();
    rooted.blue.applyEffect('root', 1, rooted.red.id);
    expect(rooted.castAbility(rooted.blue, 'W').success).toBe(true);

    const silenced = hopArena();
    silenced.blue.applyEffect('silence', 1, silenced.red.id);
    expect(silenced.castAbility(silenced.blue, 'W').failReason).toBe('silenced');

    const stunned = hopArena();
    stunned.blue.applyEffect('stun', 1, stunned.red.id);
    expect(stunned.castAbility(stunned.blue, 'W').failReason).toBe('stunned');
  });

  test('not enough mana: nothing happens', () => {
    const arena = hopArena();
    arena.blue.setHealth(100);
    arena.blue.setResource(10);
    expect(arena.castAbility(arena.blue, 'W').failReason).toBe('not_enough_mana');
    expect(arena.blue.health).toBe(100);
    expect(arena.blue.hasEffect('hop_eating')).toBe(false);
  });
});

// =============================================================================
// E: Bunny Hop
// =============================================================================

describe('Hop-To-Eat E: Bunny Hop', () => {
  const open = () => hopArena(at(-700, 0));

  function untilLanded(arena: TestArena): void {
    for (let t = 0; t < 2 && (t === 0 || arena.blue.forcedMovement); t += DT) arena.tick(DT);
  }

  test('it hops 220 toward a far spot (the click is brought to its range)', () => {
    const arena = open();
    expect(arena.castAbility(arena.blue, 'E', { targetPosition: at(1000, 0) }).success).toBe(true);
    expect(arena.blue.dashAbilityId).toBe('hop_e');
    untilLanded(arena);
    expect(arena.blue.position.x - O.x).toBeCloseTo(E.dash!.distance, 0);
  });

  test('to a nearer spot it stops there', () => {
    const arena = open();
    arena.castAbility(arena.blue, 'E', { targetPosition: at(0, 100) });
    untilLanded(arena);
    expect(arena.blue.position.y - O.y).toBeCloseTo(100, 0);
  });

  test("it's instant, costs 40 mana, cooldown 12 s (8 s at rank 5)", () => {
    const arena = open();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'E', { targetPosition: at(100, 0), casting: true });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBeCloseTo(mana - 40, 5);
    expect(arena.blue.getAbilityCooldown('E')).toBeCloseTo(12, 5);

    const maxed = open();
    rankUp(maxed.blue, 'E', 5);
    maxed.castAbility(maxed.blue, 'E', { targetPosition: at(100, 0) });
    expect(maxed.blue.getAbilityCooldown('E')).toBeCloseTo(8, 5);
  });

  test("rooted or grounded it can't hop, and nothing is spent", () => {
    for (const cc of ['root', 'grounded']) {
      const arena = open();
      arena.blue.applyEffect(cc, 1, arena.red.id);
      const mana = arena.blue.resource;
      const result = arena.castAbility(arena.blue, 'E', { targetPosition: at(200, 0) });
      expect(result.failReason).toBe('rooted');
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.forcedMovement).toBeNull();
    }
  });

  test("it doesn't hurt the enemies it hops over", () => {
    const arena = hopArena(at(110, 0));
    arena.castAbility(arena.blue, 'E', { targetPosition: at(220, 0) });
    untilLanded(arena);
    expect(hitsOn(arena, arena.red).length).toBe(0);
  });

  test('a failed hop (no mana) leaves the passive on its cooldown', () => {
    const arena = open();
    arena.blue.passiveState.cooldownRemaining = 4;
    arena.blue.setResource(0);
    expect(arena.castAbility(arena.blue, 'E', { targetPosition: at(200, 0) }).success).toBe(false);
    expect(hopReady(arena.blue)).toBe(false);
  });
});

// =============================================================================
// R: Savage Kick
// =============================================================================

describe('Hop-To-Eat R: Savage Kick', () => {
  /** Hop at the origin, red Magnus in kicking range */
  const kickArena = () => hopArena(at(80, 0));

  function untilKicked(arena: TestArena, victim: TestChampion = arena.red): void {
    for (let t = 0; t < 2 && (t === 0 || victim.forcedMovement); t += DT) arena.tick(DT);
  }

  test('rank 1: 150 + 100% attack damage, physical', () => {
    const arena = kickArena();
    const raw = R.damage!.scaling.base[0] + arena.blue.getStats().attackDamage;
    expect(arena.castAbility(arena.blue, 'R', { targetId: arena.red.id }).success).toBe(true);
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(physicalOn(arena.red, raw), 3);
  });

  test('rank 3: 350 + 100% attack damage, 80 s cooldown', () => {
    const arena = kickArena();
    rankUp(arena.blue, 'R', 3);
    arena.red.setLevel(18);
    arena.red.setHealth(arena.red.maxHealth);
    const raw = 350 + arena.blue.getStats().attackDamage;
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(physicalOn(arena.red, raw), 3);
    expect(arena.blue.getAbilityCooldown('R')).toBeCloseTo(80, 5);
  });

  test('the target flies 380 away from Hop-To-Eat, stunned while it flies', () => {
    const arena = kickArena();
    const from = arena.red.position.clone();
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
    expect(arena.red.forcedMovement?.type).toBe('knockback');
    expect(arena.red.ccStatus.isStunned).toBe(true);
    untilKicked(arena);
    expect(arena.red.position.x - from.x).toBeCloseTo(HOP_HOP.kickDistance, 0);
    expect(Math.abs(arena.red.position.y - O.y)).toBeLessThan(0.01);
    tickFor(arena, 0.2);
    expect(arena.red.ccStatus.isStunned).toBe(false);
  });

  test('it flies along the line from Hop-To-Eat through it', () => {
    const arena = hopArena(at(0, 80));
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
    untilKicked(arena);
    expect(arena.red.position.y - O.y).toBeCloseTo(80 + HOP_HOP.kickDistance, 0);
    expect(Math.abs(arena.red.position.x - O.x)).toBeLessThan(0.01);
  });

  test('an enemy champion it crashes into takes the same damage and is knocked up for 1 s', () => {
    const arena = kickArena();
    const friend = addChampion(arena, 'friend', TEAM_RED, at(250, 0), 'magnus');
    const raw = R.damage!.scaling.base[0] + arena.blue.getStats().attackDamage;
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
    arena.context.flushEvents();
    let crashEvents = 0;
    const friendHits: number[] = [];
    for (let t = 0; t < 1 && arena.red.forcedMovement; t += DT) {
      arena.tick(DT);
      const events = arena.context.flushEvents();
      crashEvents += events.filter(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'hop_r_crash').length;
      friendHits.push(...events.filter(e => e.type === GameEventType.DAMAGE && e.data.entityId === friend.id).map(e => e.data.amount as number));
      if (friendHits.length) expect(friend.hasEffect('knockup')).toBe(true);
    }
    expect(friendHits.length).toBe(1);
    expect(friendHits[0]).toBeCloseTo(physicalOn(friend, raw), 3);
    expect(crashEvents).toBe(1);
    const knockup = friend.getActiveEffects().find(e => e.definitionId === 'knockup');
    expect(knockup).toBeDefined();
    expect(knockup!.totalDuration).toBeCloseTo(HOP_HOP.crashKnockup, 5);
  });

  test('it crashes into each enemy champion in its way once', () => {
    const arena = kickArena();
    const one = addChampion(arena, 'one', TEAM_RED, at(200, 10), 'magnus');
    const two = addChampion(arena, 'two', TEAM_RED, at(330, -10), 'magnus');
    const health = [one.health, two.health];
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
    untilKicked(arena);
    expect(one.health).toBeLessThan(health[0]);
    expect(two.health).toBeLessThan(health[1]);
    expect(one.hasEffect('knockup')).toBe(true);
    expect(two.hasEffect('knockup')).toBe(true);
    expect(arena.red.hasEffect('knockup')).toBe(false);
  });

  test("Hop-To-Eat's allies and minions in its way are untouched; champions off its path too", () => {
    const arena = kickArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(250, 0));
    const minion = arena.addMinion(TEAM_RED, at(300, 0));
    const aside = addChampion(arena, 'aside', TEAM_RED, at(250, 150), 'magnus');
    const allyHealth = ally.health;
    const minionHealth = minion.health;
    const asideHealth = aside.health;
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
    untilKicked(arena);
    expect(ally.health).toBe(allyHealth);
    expect(ally.hasEffect('knockup')).toBe(false);
    expect(minion.health).toBe(minionHealth);
    expect(aside.health).toBeGreaterThanOrEqual(asideHealth);
  });

  test('only champions: a minion or a monster is no target, and nothing is spent', () => {
    const arena = hopArena(at(-700, 0));
    const minion = arena.addMinion(TEAM_RED, at(60, 0));
    const monster = arena.addJungleCreature(at(0, 60));
    const mana = arena.blue.resource;
    expect(arena.castAbility(arena.blue, 'R', { targetId: minion.id }).failReason).toBe('invalid_target');
    expect(arena.castAbility(arena.blue, 'R', { targetId: monster.id }).failReason).toBe('invalid_target');
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.getAbilityCooldown('R')).toBe(0);
  });

  test('range 120: just inside it kicks, just outside it fails', () => {
    const inside = hopArena(at(R.range!, 0));
    expect(inside.castAbility(inside.blue, 'R', { targetId: inside.red.id }).success).toBe(true);
    const outside = hopArena(at(R.range! + 2, 0));
    expect(outside.castAbility(outside.blue, 'R', { targetId: outside.red.id }).failReason).toBe('out_of_range');
  });

  test('it has the aimed cast time; stunned in it, nothing is spent', () => {
    const arena = kickArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id, casting: true });
    expect(arena.blue.isCasting()).toBe(true);
    arena.blue.applyEffect('stun', 1, arena.red.id);
    tickFor(arena, 0.4);
    expect(arena.red.forcedMovement).toBeNull();
    expect(arena.blue.resource).toBeGreaterThanOrEqual(mana - 0.01);
    expect(arena.blue.getAbilityCooldown('R')).toBe(0);
  });

  test('a kick that kills: no flight', () => {
    const arena = kickArena();
    arena.red.setHealth(10);
    expect(arena.castAbility(arena.blue, 'R', { targetId: arena.red.id }).success).toBe(true);
    expect(arena.red.isDead).toBe(true);
    expect(arena.red.forcedMovement).toBeNull();
  });

  test('kicked into a wall it stops there, and champions behind the wall are safe', () => {
    const wall = findWallCrossing(30, 90);
    const arena = hopArena(new Vector(wall.left - 40, wall.y));
    arena.blue.position.setFrom(new Vector(wall.left - 40 - 90, wall.y));
    const behind = addChampion(arena, 'behind', TEAM_RED, new Vector(wall.right + 60, wall.y), 'magnus');
    const health = behind.health;
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
    untilKicked(arena);
    expect(arena.red.position.x).toBeLessThan(wall.left + 1);
    expect(behind.health).toBeGreaterThanOrEqual(health);
    expect(behind.hasEffect('knockup')).toBe(false);
  });

  test('unlearned (rank 0) it fails', () => {
    const arena = createTestArena({ blueChampion: 'hop', redChampion: 'magnus', bluePosition: O, redPosition: at(80, 0), learnAbilities: false });
    expect(arena.castAbility(arena.blue, 'R', { targetId: arena.red.id }).failReason).toBe('not_learned');
  });
});

describe('Hop-To-Eat descriptions', () => {
  test("the passive's bonus range is level 1 to 18's", () => {
    const passive = getPassiveDefinition('hop_passive')!;
    const at1 = HOP_HOP.bonusBase + HOP_HOP.bonusPerLevel;
    const at18 = HOP_HOP.bonusBase + HOP_HOP.bonusPerLevel * 18;
    expect(passive.description).toContain(`${at1}-${at18} (+30% attack damage)`);
  });

  test("Carrot Break's says the heal grows with missing health", () => {
    expect(W.description).toContain('missing');
  });
});
