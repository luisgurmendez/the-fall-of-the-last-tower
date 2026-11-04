/**
 * Nocthar Champion Tests
 *
 * Nocthar - The Unburied, a mage who commands an army of the dead.
 * - Passive: Nobody Leaves - an enemy (minion, monster, champion; not a
 *   summon) dying within reach rises as a Hollow where it fell, if the
 *   passive is ready; then it waits 12.5 s (7.5 s at level 18). Up to 5; a
 *   champion rises as a big one. With the colossus alive none rise: the
 *   deaths heal the colossus instead (4% a unit, 25% a champion)
 * - Q: Grasping Hands - 0.25 s cast, then 0.85 s later hands burst out of a
 *   circle: damage, a drag toward its middle and a 30% slow
 * - W: Lament - 0.5 s cast (he channels it): enemies near him take damage and flee from him
 *   for 1 s; his Hollows near him attack faster for 2 s
 * - E: Heed Me - free orders to the Hollows (ground: go there; enemy: hunt
 *   it; himself: come back); the first after its cooldown is a charge
 * - R: Colossus of Bones - 1.5 s cast (the Hollows run to the spot); the
 *   Hollows become one colossus, bigger for each (a big one counts twice),
 *   that knocks up and damages enemies where it rises and lasts until it's
 *   destroyed. Meanwhile W, E and R are its own (Bone Volley, Trample, an
 *   order); R's cooldown starts when it falls. Interrupted, it's back in 10 s
 */

import { describe, test, expect } from 'bun:test';
import {
  Vector,
  EntityType,
  TEAM_BLUE,
  TEAM_RED,
  NOCTHAR_KIT,
  noctharRaiseCooldown,
  hollowStats,
  colossusStats,
  colossusScale,
  getAbilityDefinition,
  calculateAbilityValue,
} from '@siege/shared';
import { createTestArena, type TestArena } from '../ServerTestUtils';
import { ServerSummon } from '../../simulation/ServerSummon';
import type { ServerEntity } from '../../simulation/ServerEntity';
import { noctharState } from '../../abilities/handlers/nocthar/state';
import { LaneBot } from '../../bots/LaneBot';
import { ROLE_PICKS as PRACTICE_PICKS } from '../../bots/practiceMatch';
import type { TestChampion } from '../ServerTestUtils';

const DT = 1 / 60;
const Q = getAbilityDefinition('nocthar_q')!;
const W = getAbilityDefinition('nocthar_w')!;
const E = getAbilityDefinition('nocthar_e')!;
const R = getAbilityDefinition('nocthar_r')!;
const BONE_VOLLEY = getAbilityDefinition('nocthar_colossus_w')!;
const TRAMPLE = getAbilityDefinition('nocthar_colossus_e')!;

/** Along mid lane (the map's center is (0, 0)): `d` along it, `off` across */
const ALONG = new Vector(1, -1).normalized();
const ACROSS = new Vector(1, 1).normalized();
const p = (d: number, off = 0) => ALONG.scaled(d).added(ACROSS.scaled(off));

/** Nocthar (blue, level 6, every ability rank 1, full mana) at p(0); Kael (red) at `redAt` */
function noctharArena(redAt = p(3000, 3000), redChampion = 'warrior'): TestArena {
  const arena = createTestArena({ blueChampion: 'nocthar', redChampion, bluePosition: p(0), redPosition: redAt });
  arena.blue.setLevel(6);
  arena.red.setLevel(6);
  arena.red.setHealth(arena.red.maxHealth);
  arena.blue.setResource(arena.blue.maxResource);
  arena.context.getFogOfWar().updateVision(arena.context, 1);
  return arena;
}

const summonsOf = (arena: TestArena, type: 'hollow' | 'colossus') =>
  arena.context.getAllEntities().filter((entity): entity is ServerSummon =>
    entity instanceof ServerSummon && entity.ownerId === arena.blue.id && entity.minionType === type && !entity.isDead);
const hollows = (arena: TestArena) => summonsOf(arena, 'hollow');
const colossus = (arena: TestArena) => summonsOf(arena, 'colossus')[0] as ServerSummon | undefined;

/** Everything moves for `seconds`, vision updating as it goes */
function step(arena: TestArena, seconds: number): void {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) {
    arena.tickAll(DT);
    if (i % 6 === 0) arena.context.getFogOfWar().updateVision(arena.context, arena.context.getGameTime());
  }
}

/** An enemy minion at `at`, killed by Nocthar */
function killMinion(arena: TestArena, at: Vector, side = TEAM_RED): ServerEntity {
  const minion = arena.addMinion(side, at);
  minion.takeDamage(1e9, 'true', arena.blue.id, arena.context);
  return minion;
}

/** `count` Hollows raised (the passive made ready for each) */
function raiseHollows(arena: TestArena, count: number, at = p(60)): ServerSummon[] {
  for (let i = 0; i < count; i++) {
    noctharState(arena.blue).raiseCooldown = 0;
    killMinion(arena, at.added(ACROSS.scaled(i * 15)));
  }
  noctharState(arena.blue).raiseCooldown = 0;
  return hollows(arena);
}

/** Cast R and let it rise (the cast time passes at once) */
function raiseColossus(arena: TestArena, at = p(120)): ServerSummon {
  expect(arena.castAbility(arena.blue, 'R', { targetPosition: at }).success).toBe(true);
  return colossus(arena)!;
}

interface Hit { amount: number; sourceId?: string }
function recordHits(entity: ServerEntity): Hit[] {
  const hits: Hit[] = [];
  const takeDamage = entity.takeDamage.bind(entity);
  entity.takeDamage = ((amount, type, sourceId, context) => {
    hits.push({ amount, sourceId });
    return takeDamage(amount, type, sourceId, context);
  }) as typeof entity.takeDamage;
  return hits;
}

const ap = (arena: TestArena) => arena.blue.getStats().abilityPower;

describe('Nocthar', () => {
  test('is registered: a ranged mage with his kit', () => {
    const arena = noctharArena();
    expect(arena.blue.definition.class).toBe('mage');
    expect(arena.blue.definition.attackType).toBe('ranged');
    expect(arena.blue.abilityInSlot('R')).toBe('nocthar_r');
  });

  describe('Passive: Nobody Leaves', () => {
    test('an enemy minion dying near him rises as a Hollow where it fell', () => {
      const arena = noctharArena();
      const fell = killMinion(arena, p(100));
      const [hollow] = hollows(arena);
      expect(hollow).toBeDefined();
      expect(hollow.position.distanceTo(fell.position)).toBeLessThan(1);
      expect(hollow.side).toBe(TEAM_BLUE);
      expect(hollow.toSnapshot().rising).toBeCloseTo(NOCTHAR_KIT.riseTime, 5);
    });

    test('then the passive waits: the next one stays dead', () => {
      const arena = noctharArena();
      killMinion(arena, p(100));
      killMinion(arena, p(110));
      expect(hollows(arena).length).toBe(1);
    });

    test('it waits 12.5 s at level 1 and 7.5 s at level 18', () => {
      for (const level of [1, 18]) {
        const arena = noctharArena();
        arena.blue.setLevel(level);
        killMinion(arena, p(100));
        expect(noctharState(arena.blue).raiseCooldown).toBeCloseTo(noctharRaiseCooldown(level), 5);
      }
      expect(noctharRaiseCooldown(1)).toBe(12.5);
      expect(noctharRaiseCooldown(18)).toBe(7.5);
    });

    test('once it has waited, the next death rises', () => {
      const arena = noctharArena();
      killMinion(arena, p(100));
      step(arena, noctharRaiseCooldown(6) + 0.2);
      killMinion(arena, arena.blue.position.added(ACROSS.scaled(60)));
      expect(hollows(arena).length).toBe(2);
    });

    test('too far, an ally or a summon dying: nothing rises and the passive is still ready', () => {
      const arena = noctharArena();
      killMinion(arena, p(NOCTHAR_KIT.raiseRadius + 60));
      killMinion(arena, p(80), TEAM_BLUE);
      const enemyHollow = new ServerSummon({
        id: 'enemy-hollow', position: p(70), side: TEAM_RED, ownerId: arena.red.id, summonType: 'hollow',
        stats: hollowStats(1, 0), leash: NOCTHAR_KIT.leash,
      });
      arena.context.addEntity(enemyHollow);
      enemyHollow.takeDamage(1e9, 'true', arena.blue.id, arena.context);
      expect(hollows(arena).length).toBe(0);
      expect(noctharState(arena.blue).raiseCooldown).toBe(0);
    });

    test('an enemy champion rises as a big Hollow', () => {
      const arena = noctharArena(p(100));
      arena.red.takeDamage(1e9, 'true', arena.blue.id, arena.context);
      const [hollow] = hollows(arena);
      expect(hollow.scale).toBe(NOCTHAR_KIT.bigHollowScale);
      expect(hollow.maxHealth).toBe(hollowStats(6, ap(arena), true).maxHealth);
      expect(hollow.maxHealth).toBeGreaterThan(hollowStats(6, ap(arena)).maxHealth);
    });

    test('a jungle monster rises too', () => {
      const arena = noctharArena();
      const monster = arena.addJungleCreature(p(100));
      monster.takeDamage(1e9, 'true', arena.blue.id, arena.context);
      expect(hollows(arena).length).toBe(1);
    });

    test('with 5 Hollows nothing rises, and the passive is still ready', () => {
      const arena = noctharArena();
      expect(raiseHollows(arena, 5).length).toBe(5);
      killMinion(arena, p(100));
      expect(hollows(arena).length).toBe(NOCTHAR_KIT.maxHollows);
      expect(noctharState(arena.blue).raiseCooldown).toBe(0);
    });

    test('Hollows grow with his level and ability power', () => {
      const weak = noctharArena();
      weak.blue.setLevel(1);
      const [weakHollow] = raiseHollows(weak, 1);
      const strong = noctharArena();
      strong.blue.setLevel(11);
      strong.blue.addModifier({ source: 'test-ap', flat: { abilityPower: 100 } });
      const [strongHollow] = raiseHollows(strong, 1);
      expect(strongHollow.maxHealth).toBe(hollowStats(11, 100).maxHealth);
      expect(strongHollow.maxHealth).toBeGreaterThan(weakHollow.maxHealth);
      expect(strongHollow.stats.attackDamage).toBeGreaterThan(weakHollow.stats.attackDamage);
    });

    test('dead, he raises nothing', () => {
      const arena = noctharArena();
      arena.blue.takeDamage(1e9, 'true');
      killMinion(arena, p(60));
      expect(hollows(arena).length).toBe(0);
    });

    test('his passive shows how many Hollows he has and its wait', () => {
      const arena = noctharArena();
      killMinion(arena, p(100));
      arena.tick();
      const passive = arena.blue.toSnapshot().passive;
      expect(passive.stacks).toBe(1);
      expect(passive.cooldownRemaining).toBeGreaterThan(0);
      expect(passive.isActive).toBe(false);
    });

    test('if he dies, his Hollows crumble', () => {
      const arena = noctharArena();
      raiseHollows(arena, 3);
      arena.blue.takeDamage(1e9, 'true');
      step(arena, 0.1);
      expect(hollows(arena).length).toBe(0);
    });

    test("a Hollow's kill is his: the gold and the creep score", () => {
      const arena = noctharArena();
      const [hollow] = raiseHollows(arena, 1);
      const { gold, cs } = arena.blue;
      const victim = arena.addMinion(TEAM_RED, p(200));
      victim.takeDamage(1e9, 'true', hollow.id, arena.context);
      expect(arena.blue.gold).toBeGreaterThan(gold);
      expect(arena.blue.cs).toBe(cs + 1);
    });
  });

  describe('Q: Grasping Hands', () => {
    test('he stands still for its cast time', () => {
      const arena = noctharArena();
      expect(arena.castAbility(arena.blue, 'Q', { targetPosition: p(200), casting: true }).success).toBe(true);
      expect(arena.blue.isCasting()).toBe(true);
      expect(Q.castTime).toBe(0.25);
      // The circle fills a while before the hands come
      expect(Q.aoeDelay).toBe(0.85);
    });

    test('nothing until the ground cracks open, then damage in the circle', () => {
      const arena = noctharArena(p(200));
      const hits = recordHits(arena.red);
      expect(arena.castAbility(arena.blue, 'Q', { targetPosition: p(200), windup: true }).success).toBe(true);
      expect(hits.length).toBe(0);
      arena.context.advanceTime(Q.aoeDelay! + 0.01);
      expect(hits.length).toBe(1);
      expect(hits[0].amount).toBeCloseTo(calculateAbilityValue(Q.damage!.scaling, 1, { attackDamage: 0, abilityPower: ap(arena), bonusHealth: 0, maxHealth: 0 }), 3);
    });

    test('enemies outside the circle are untouched, and so are allies', () => {
      const arena = noctharArena(p(200 + Q.aoeRadius! + 60));
      const ally = arena.addMinion(TEAM_BLUE, p(200));
      arena.castAbility(arena.blue, 'Q', { targetPosition: p(200) });
      expect(arena.red.health).toBe(arena.red.maxHealth);
      expect(ally.health).toBe(ally.maxHealth);
    });

    test('it drags enemies toward its middle', () => {
      const arena = noctharArena(p(200 + 70));
      const minion = arena.addMinion(TEAM_RED, p(200, -70));
      arena.castAbility(arena.blue, 'Q', { targetPosition: p(200) });
      step(arena, 0.3);
      expect(minion.position.distanceTo(p(200))).toBeLessThan(70 - NOCTHAR_KIT.qPull + 5);
      expect(arena.red.position.distanceTo(p(200))).toBeLessThan(70 - NOCTHAR_KIT.qPull + 5);
    });

    test("it doesn't drag anyone past its middle", () => {
      const arena = noctharArena(p(205));
      arena.castAbility(arena.blue, 'Q', { targetPosition: p(200) });
      step(arena, 0.3);
      expect(arena.red.position.distanceTo(p(200))).toBeLessThan(6);
    });

    test('it slows them by 30% for 1.5 s', () => {
      const arena = noctharArena(p(200));
      arena.castAbility(arena.blue, 'Q', { targetPosition: p(200) });
      const slow = arena.red.getEffect(NOCTHAR_KIT.qSlowEffect);
      expect(slow).toBeDefined();
      expect(slow!.timeRemaining).toBeCloseTo(NOCTHAR_KIT.qSlowDuration, 1);
    });
  });

  describe('W: Lament', () => {
    test('it has a cast time', () => {
      const arena = noctharArena();
      expect(arena.castAbility(arena.blue, 'W', { casting: true }).success).toBe(true);
      expect(arena.blue.isCasting()).toBe(true);
      expect(W.castTime).toBe(0.5);
    });

    test('enemies near him take damage and flee from him for 1 s', () => {
      const arena = noctharArena(p(100));
      const hits = recordHits(arena.red);
      arena.castAbility(arena.blue, 'W');
      expect(hits.length).toBe(1);
      const fear = arena.red.getEffect('fear');
      expect(fear?.sourceId).toBe(arena.blue.id);
      expect(fear!.timeRemaining).toBeCloseTo(NOCTHAR_KIT.wFearDuration, 1);
      const gap = arena.red.position.distanceTo(arena.blue.position);
      step(arena, 0.5);
      expect(arena.red.position.distanceTo(arena.blue.position)).toBeGreaterThan(gap + 20);
    });

    test('enemies farther away are untouched', () => {
      const arena = noctharArena(p(NOCTHAR_KIT.wFearRadius + 60));
      arena.castAbility(arena.blue, 'W');
      expect(arena.red.hasEffect('fear')).toBe(false);
      expect(arena.red.health).toBe(arena.red.maxHealth);
    });

    test('minions near him flee too', () => {
      const arena = noctharArena();
      const minion = arena.addMinion(TEAM_RED, p(60));
      arena.castAbility(arena.blue, 'W');
      expect(minion.ccStatus.isFeared || minion.activeEffects.some(effect => effect.definitionId === 'fear')).toBe(true);
    });

    test('his Hollows near him attack faster for 2 s; those far away do not', () => {
      const arena = noctharArena();
      const [near, far] = raiseHollows(arena, 2);
      far.position.setFrom(p(NOCTHAR_KIT.wFrenzyRadius + 80));
      arena.castAbility(arena.blue, 'W');
      expect(near.isFrenzied()).toBe(true);
      expect(far.isFrenzied()).toBe(false);
      step(arena, NOCTHAR_KIT.wFrenzyDuration + 0.1);
      expect(near.isFrenzied()).toBe(false);
    });
  });

  describe('E: Heed Me', () => {
    test('with no Hollows the order fails and costs nothing', () => {
      const arena = noctharArena();
      const result = arena.castAbility(arena.blue, 'E', { targetPosition: p(200) });
      expect(result.success).toBe(false);
      expect(arena.blue.getAbilityCooldown('E')).toBe(0);
    });

    test('at the ground: they go there', () => {
      const arena = noctharArena();
      const army = raiseHollows(arena, 3);
      arena.castAbility(arena.blue, 'E', { targetPosition: p(200) });
      for (const hollow of army) {
        expect(hollow.order.kind).toBe('move');
        if (hollow.order.kind === 'move') expect(hollow.order.point.distanceTo(p(200))).toBeLessThan(1);
      }
    });

    test('at an enemy: they hunt it', () => {
      const arena = noctharArena(p(200));
      const army = raiseHollows(arena, 2);
      arena.castAbility(arena.blue, 'E', { targetPosition: arena.red.position.clone(), targetId: arena.red.id });
      for (const hollow of army) expect(hollow.order).toEqual({ kind: 'attack', targetId: arena.red.id });
    });

    test('at himself, or right next to him: they come back', () => {
      const arena = noctharArena();
      const army = raiseHollows(arena, 2);
      arena.castAbility(arena.blue, 'E', { targetPosition: p(200) });
      arena.castAbility(arena.blue, 'E', { targetPosition: p(10), targetId: arena.blue.id });
      for (const hollow of army) expect(hollow.order.kind).toBe('follow');
      arena.castAbility(arena.blue, 'E', { targetPosition: p(200) });
      arena.castAbility(arena.blue, 'E', { targetPosition: p(NOCTHAR_KIT.eReturnRadius - 10) });
      for (const hollow of army) expect(hollow.order.kind).toBe('follow');
    });

    test('BUG: Hollows fighting a minion heed him: sent away, they leave it; called back, they come', () => {
      const arena = noctharArena();
      const army = raiseHollows(arena, 2, p(80));
      const minion = arena.addMinion(TEAM_RED, p(110));
      minion.health = minion.maxHealth = 1e6;
      step(arena, 2.5);
      expect(minion.health).toBeLessThan(1e6);
      arena.castAbility(arena.blue, 'E', { targetPosition: p(-150) });
      const health = minion.health;
      step(arena, 0.8);
      expect(minion.health).toBe(health);
      for (const hollow of army) expect(hollow.position.dot(ALONG)).toBeLessThan(60);
      arena.castAbility(arena.blue, 'E', { targetPosition: p(5), targetId: arena.blue.id });
      for (const hollow of army) expect(hollow.order.kind).toBe('follow');
    });

    test('Hollows still rising get the order too', () => {
      const arena = noctharArena();
      const [hollow] = raiseHollows(arena, 1);
      expect(hollow.isRising()).toBe(true);
      arena.castAbility(arena.blue, 'E', { targetPosition: p(200) });
      expect(hollow.order.kind).toBe('move');
    });

    test('free: no mana and no cooldown', () => {
      const arena = noctharArena();
      raiseHollows(arena, 1);
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'E', { targetPosition: p(200) });
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.getAbilityCooldown('E')).toBe(0);
      expect(arena.castAbility(arena.blue, 'E', { targetPosition: p(100) }).success).toBe(true);
    });

    test('the first order is a charge; the next ones within its cooldown are not; after it, again', () => {
      const arena = noctharArena();
      const [hollow] = raiseHollows(arena, 1);
      arena.castAbility(arena.blue, 'E', { targetPosition: p(200) });
      expect(hollow.isCharged()).toBe(true);
      expect(noctharState(arena.blue).chargeCooldown).toBeCloseTo(NOCTHAR_KIT.eChargeCooldown[0], 5);
      step(arena, NOCTHAR_KIT.eChargeDuration + 0.1);
      expect(hollow.isCharged()).toBe(false);
      arena.castAbility(arena.blue, 'E', { targetPosition: p(100) });
      expect(hollow.isCharged()).toBe(false);
      step(arena, NOCTHAR_KIT.eChargeCooldown[0]);
      arena.castAbility(arena.blue, 'E', { targetPosition: p(150) });
      expect(hollow.isCharged()).toBe(true);
    });

    test("the charge's cooldown is shorter with rank", () => {
      const arena = noctharArena();
      arena.blue.setLevel(18);
      arena.blue.maxAbility('E');
      raiseHollows(arena, 1);
      arena.castAbility(arena.blue, 'E', { targetPosition: p(200) });
      expect(noctharState(arena.blue).chargeCooldown).toBeCloseTo(NOCTHAR_KIT.eChargeCooldown[4], 5);
    });
  });

  describe('R: Colossus of Bones', () => {
    test('he stands still for 1.5 s while his Hollows run to where it will rise', () => {
      const arena = noctharArena();
      const army = raiseHollows(arena, 2);
      expect(arena.castAbility(arena.blue, 'R', { targetPosition: p(150), casting: true }).success).toBe(true);
      expect(arena.blue.isCasting()).toBe(true);
      expect(R.castTime).toBe(1.5);
      for (const hollow of army) expect(hollow.order.kind).toBe('move');
      expect(colossus(arena)).toBeUndefined();
    });

    test("stunned in its cast: no colossus, the Hollows stay, nothing's spent and it's back in 10 s", () => {
      const arena = noctharArena();
      raiseHollows(arena, 2);
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'R', { targetPosition: p(150), casting: true });
      arena.blue.applyEffect('stun', 1, arena.red.id);
      arena.tick();
      expect(arena.blue.isCasting()).toBe(false);
      expect(colossus(arena)).toBeUndefined();
      expect(hollows(arena).length).toBe(2);
      for (const hollow of hollows(arena)) expect(hollow.order.kind).toBe('follow');
      expect(arena.blue.resource).toBeGreaterThanOrEqual(mana);
      expect(arena.blue.getAbilityCooldown('R')).toBeCloseTo(NOCTHAR_KIT.rInterruptedCooldown, 1);
    });

    test("it rises where he aimed, from the Hollows' bones: they're gone", () => {
      const arena = noctharArena();
      raiseHollows(arena, 3);
      const giant = raiseColossus(arena, p(150));
      expect(giant.position.distanceTo(p(150))).toBeLessThan(1);
      expect(hollows(arena).length).toBe(0);
      expect(giant.side).toBe(TEAM_BLUE);
    });

    test("past its range it rises at its range", () => {
      const arena = noctharArena();
      const giant = raiseColossus(arena, p(R.range! + 300));
      expect(giant.position.distanceTo(p(R.range!))).toBeLessThan(1);
    });

    test('it is bigger and stronger for each Hollow, a big one counting twice', () => {
      const arena = noctharArena(p(100));
      raiseHollows(arena, 2);
      // A champion rises as a big one
      noctharState(arena.blue).raiseCooldown = 0;
      arena.red.takeDamage(1e9, 'true', arena.blue.id, arena.context);
      expect(hollows(arena).length).toBe(3);
      const giant = raiseColossus(arena);
      // (the kill leveled him up)
      const level = arena.blue.level;
      expect(giant.maxHealth).toBe(colossusStats(level, ap(arena), 4).maxHealth);
      expect(giant.scale).toBeCloseTo(colossusScale(4), 5);
      expect(giant.maxHealth).toBeGreaterThan(colossusStats(level, ap(arena), 0).maxHealth);
    });

    test('its size goes with what it took: small with one Hollow, big with five, never past the cap', () => {
      expect(colossusScale(1)).toBeCloseTo(0.7, 5);
      expect(colossusScale(5)).toBeCloseTo(1.3, 5);
      expect(colossusScale(0)).toBeLessThan(colossusScale(1));
      for (let absorbed = 1; absorbed <= 10; absorbed++) {
        expect(colossusScale(absorbed)).toBeGreaterThanOrEqual(colossusScale(absorbed - 1));
      }
      expect(colossusScale(10)).toBe(1.6);
      // Twice as big from one Hollow to five, near enough
      expect(colossusScale(5) / colossusScale(1)).toBeGreaterThan(1.8);
    });

    test('with no Hollows a small colossus rises', () => {
      const arena = noctharArena();
      const giant = raiseColossus(arena);
      expect(giant.maxHealth).toBe(colossusStats(6, ap(arena), 0).maxHealth);
      expect(giant.scale).toBeCloseTo(colossusScale(0), 5);
      expect(giant.scale).toBeLessThan(colossusScale(1));
    });

    test('enemies where it rises are knocked up and take damage; those farther are not', () => {
      const arena = noctharArena(p(150 + 40));
      const far = arena.addMinion(TEAM_RED, p(150 + NOCTHAR_KIT.rKnockupRadius + 60));
      const hits = recordHits(arena.red);
      raiseColossus(arena, p(150));
      expect(arena.red.hasEffect('knockup')).toBe(true);
      expect(hits.some(hit => hit.sourceId === arena.blue.id)).toBe(true);
      expect(far.health).toBe(far.maxHealth);
    });

    test('while it lives his W, E and R are its own, and R has no cooldown', () => {
      const arena = noctharArena();
      raiseColossus(arena);
      expect(arena.blue.abilityInSlot('W')).toBe('nocthar_colossus_w');
      expect(arena.blue.abilityInSlot('E')).toBe('nocthar_colossus_e');
      expect(arena.blue.abilityInSlot('R')).toBe('nocthar_colossus_r');
      expect(arena.blue.abilityInSlot('Q')).toBe('nocthar_q');
      expect(arena.blue.getAbilityCooldown('R')).toBe(0);
      arena.tick();
      expect(arena.blue.toSnapshot().passive.isActive).toBe(true);
    });

    test("when it falls, his W, E and R are back and R's full cooldown starts", () => {
      const arena = noctharArena();
      const giant = raiseColossus(arena);
      giant.takeDamage(1e9, 'true', arena.red.id, arena.context);
      arena.tick();
      expect(arena.blue.abilityInSlot('W')).toBe('nocthar_w');
      expect(arena.blue.abilityInSlot('E')).toBe('nocthar_e');
      expect(arena.blue.abilityInSlot('R')).toBe('nocthar_r');
      expect(arena.blue.getAbilityCooldown('R')).toBeCloseTo(arena.blue.abilityStates.R.cooldownTotal, 1);
      expect(arena.blue.getAbilityCooldown('R')).toBeGreaterThan(R.cooldown![0] * 0.5);
      expect(arena.blue.toSnapshot().passive.isActive).toBe(false);
    });

    test('him dying, the colossus crumbles and his abilities are back', () => {
      const arena = noctharArena();
      raiseColossus(arena);
      arena.blue.takeDamage(1e9, 'true');
      step(arena, 0.1);
      expect(colossus(arena)).toBeUndefined();
      expect(arena.blue.abilityInSlot('W')).toBe('nocthar_w');
    });

    test('while it lives no Hollows rise; enemies dying near it heal it (4% a minion, 25% a champion)', () => {
      const arena = noctharArena(p(140));
      const giant = raiseColossus(arena, p(120));
      giant.health = giant.maxHealth * 0.5;
      killMinion(arena, p(130));
      expect(hollows(arena).length).toBe(0);
      expect(giant.health).toBeCloseTo(giant.maxHealth * 0.54, 3);
      arena.red.takeDamage(1e9, 'true', arena.blue.id, arena.context);
      expect(giant.health).toBeCloseTo(giant.maxHealth * 0.79, 3);
    });

    test('deaths far from the colossus heal nothing', () => {
      const arena = noctharArena();
      const giant = raiseColossus(arena, p(120));
      giant.health = giant.maxHealth * 0.5;
      killMinion(arena, p(120 + NOCTHAR_KIT.raiseRadius + 80));
      expect(giant.health).toBeCloseTo(giant.maxHealth * 0.5, 3);
    });

    test('R again orders it: to the ground, at an enemy, back to him; for free', () => {
      const arena = noctharArena(p(250));
      const giant = raiseColossus(arena, p(60));
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, 'R', { targetPosition: p(-100) }).success).toBe(true);
      expect(giant.order.kind).toBe('move');
      arena.castAbility(arena.blue, 'R', { targetPosition: arena.red.position.clone(), targetId: arena.red.id });
      expect(giant.order).toEqual({ kind: 'attack', targetId: arena.red.id });
      arena.castAbility(arena.blue, 'R', { targetPosition: p(0), targetId: arena.blue.id });
      expect(giant.order.kind).toBe('follow');
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.getAbilityCooldown('R')).toBe(0);
    });
  });

  describe('W with the colossus: Bone Volley', () => {
    test('it costs the colossus 10% of its max health', () => {
      const arena = noctharArena();
      const giant = raiseColossus(arena);
      expect(arena.castAbility(arena.blue, 'W', { targetPosition: p(250) }).success).toBe(true);
      expect(giant.health).toBeCloseTo(giant.maxHealth * (1 - NOCTHAR_KIT.colossusAbilityCost), 3);
    });

    test('the bones land after its windup and flight: damage and a slow', () => {
      const arena = noctharArena(p(300));
      raiseColossus(arena, p(120));
      const hits = recordHits(arena.red);
      arena.castAbility(arena.blue, 'W', { targetPosition: p(300) });
      step(arena, NOCTHAR_KIT.colossusWWindup + NOCTHAR_KIT.colossusWFlight - 0.15);
      expect(hits.length).toBe(0);
      step(arena, 0.25);
      expect(hits.length).toBe(1);
      expect(arena.red.hasEffect(NOCTHAR_KIT.colossusWSlowEffect)).toBe(true);
    });

    test('past its reach from the colossus, they land at its reach', () => {
      const arena = noctharArena();
      const giant = raiseColossus(arena, p(60));
      const reach = giant.position.added(ALONG.scaled(NOCTHAR_KIT.colossusWRange));
      const minion = arena.addMinion(TEAM_RED, reach);
      minion.health = 1e6;
      arena.castAbility(arena.blue, 'W', { targetPosition: p(60 + NOCTHAR_KIT.colossusWRange + 400) });
      step(arena, NOCTHAR_KIT.colossusWWindup + NOCTHAR_KIT.colossusWFlight + 0.1);
      expect(minion.health).toBeLessThan(1e6);
    });

    test('the colossus holds still while it winds up', () => {
      const arena = noctharArena();
      const giant = raiseColossus(arena, p(60));
      arena.blue.setMoveTarget(p(-300));
      const at = giant.position.clone();
      arena.castAbility(arena.blue, 'W', { targetPosition: p(250) });
      step(arena, NOCTHAR_KIT.colossusWWindup - 0.05);
      expect(giant.position.distanceTo(at)).toBeLessThan(1);
    });

    test("without the health to pay, it fails and costs nothing", () => {
      const arena = noctharArena();
      const giant = raiseColossus(arena);
      giant.health = giant.maxHealth * NOCTHAR_KIT.colossusAbilityCost * 0.5;
      const health = giant.health;
      expect(arena.castAbility(arena.blue, 'W', { targetPosition: p(250) }).success).toBe(false);
      expect(giant.health).toBe(health);
      expect(arena.blue.getAbilityCooldown('W')).toBe(0);
    });

    test('its kill is his', () => {
      expect(BONE_VOLLEY.damage).toBeDefined();
      // (Magnus: Kael's passive shields him when he's low)
      const arena = noctharArena(p(300), 'magnus');
      raiseColossus(arena, p(120));
      arena.red.setHealth(1);
      const kills = arena.blue.kills;
      arena.castAbility(arena.blue, 'W', { targetPosition: p(300) });
      step(arena, NOCTHAR_KIT.colossusWWindup + NOCTHAR_KIT.colossusWFlight + 0.1);
      expect(arena.blue.kills).toBe(kills + 1);
    });
  });

  describe('E with the colossus: Trample', () => {
    test('it costs the colossus 10% of its max health', () => {
      const arena = noctharArena();
      const giant = raiseColossus(arena);
      expect(arena.castAbility(arena.blue, 'E', { targetPosition: p(300) }).success).toBe(true);
      expect(giant.health).toBeCloseTo(giant.maxHealth * (1 - NOCTHAR_KIT.colossusAbilityCost), 3);
    });

    test('after its windup it charges toward the aim; enemies in its way are carried, knocked up and hurt where it stops', () => {
      const arena = noctharArena(p(60 + 70));
      const giant = raiseColossus(arena, p(60));
      arena.red.removeEffect?.('knockup');
      step(arena, 1.1);
      const start = giant.position.clone();
      const redHits = recordHits(arena.red);
      arena.castAbility(arena.blue, 'E', { targetPosition: start.added(ALONG.scaled(400)) });
      step(arena, NOCTHAR_KIT.colossusEWindup - 0.05);
      expect(giant.position.distanceTo(start)).toBeLessThan(1);
      step(arena, NOCTHAR_KIT.colossusEDuration + 0.1);
      expect(giant.position.distanceTo(start)).toBeGreaterThan(NOCTHAR_KIT.colossusEDistance - 10);
      expect(arena.red.position.dot(ALONG)).toBeGreaterThan(giant.position.dot(ALONG));
      expect(arena.red.hasEffect('knockup')).toBe(true);
      expect(redHits.some(hit => hit.sourceId === arena.blue.id)).toBe(true);
      expect(TRAMPLE.damage).toBeDefined();
    });

    test("without the health to pay, it fails and costs nothing", () => {
      const arena = noctharArena();
      const giant = raiseColossus(arena);
      giant.health = giant.maxHealth * NOCTHAR_KIT.colossusAbilityCost * 0.5;
      expect(arena.castAbility(arena.blue, 'E', { targetPosition: p(300) }).success).toBe(false);
      expect(arena.blue.getAbilityCooldown('E')).toBe(0);
    });
  });

  describe('his E order and the client', () => {
    test("the order's event names its target, so his team can see where he sent them", () => {
      const arena = noctharArena();
      raiseHollows(arena, 1);
      arena.context.flushEvents();
      arena.castAbility(arena.blue, 'E', { targetPosition: p(200) });
      const event = arena.context.flushEvents().find(e => e.data.abilityId === 'nocthar_e');
      expect(event?.data.targetX).toBeCloseTo(p(200).x, 3);
      expect(E.manaCost![0]).toBe(0);
    });
  });

  describe('played by a practice bot', () => {
    class AskedBot extends LaneBot {
      offense(champion: TestChampion, target: TestChampion, arena: TestArena) {
        return this.chooseAbility(champion, target, 'offense', arena.context);
      }
    }
    /** Nocthar with only `ready` off cooldown, Kael at `at` */
    function botArena(ready: ('Q' | 'W' | 'E' | 'R')[], at = p(200)): { arena: TestArena; bot: AskedBot } {
      const arena = noctharArena(at);
      for (const slot of ['Q', 'W', 'E', 'R'] as const) {
        arena.blue.abilityStates[slot].cooldownRemaining = ready.includes(slot) ? 0 : 10;
      }
      return { arena, bot: new AskedBot({ playerId: arena.blue.playerId }) };
    }

    test('with no Hollows it gives no orders', () => {
      const { arena, bot } = botArena(['E']);
      expect(bot.offense(arena.blue, arena.red, arena)).toBeNull();
    });

    test('it sends its Hollows at its target once, not again while they hunt it', () => {
      const { arena, bot } = botArena(['E']);
      raiseHollows(arena, 2);
      expect(bot.offense(arena.blue, arena.red, arena)).toMatchObject({ slot: 'E', targetType: 'unit', targetEntityId: arena.red.id });
      arena.castAbility(arena.blue, 'E', { targetPosition: arena.red.position.clone(), targetId: arena.red.id });
      expect(bot.offense(arena.blue, arena.red, arena)).toBeNull();
    });

    test('it raises the colossus on a champion in reach, with Hollows to make it of', () => {
      const { arena, bot } = botArena(['R'], p(150));
      expect(bot.offense(arena.blue, arena.red, arena)).toBeNull();
      raiseHollows(arena, 2);
      expect(bot.offense(arena.blue, arena.red, arena)).toMatchObject({ slot: 'R', targetType: 'position' });
    });

    test('with the colossus it sends it at its target, and uses its abilities only within its reach', () => {
      const { arena, bot } = botArena(['W', 'E', 'R'], p(300));
      raiseColossus(arena, p(-100));
      for (const slot of ['W', 'E'] as const) arena.blue.abilityStates[slot].cooldownRemaining = 10;
      expect(bot.offense(arena.blue, arena.red, arena)).toMatchObject({ slot: 'R', targetType: 'unit', targetEntityId: arena.red.id });
      arena.castAbility(arena.blue, 'R', { targetPosition: arena.red.position.clone(), targetId: arena.red.id });
      arena.blue.abilityStates.W.cooldownRemaining = 0;
      // Kael too far from the colossus to throw at
      expect(bot.offense(arena.blue, arena.red, arena)).toBeNull();
      arena.red.position.setFrom(p(150));
      expect(bot.offense(arena.blue, arena.red, arena)).toMatchObject({ slot: 'W', targetType: 'position' });
    });

    test("it doesn't send them at a target past their leash", () => {
      const { arena, bot } = botArena(['E'], p(NOCTHAR_KIT.leash + 100));
      raiseHollows(arena, 2);
      expect(bot.offense(arena.blue, arena.red, arena)).toBeNull();
    });

    test('it plays Nocthar in practice lanes', () => {
      expect(PRACTICE_PICKS.mid).toContain('nocthar');
    });
  });

  test('his summons are minions with his id as their owner', () => {
    const arena = noctharArena();
    const [hollow] = raiseHollows(arena, 1);
    expect(hollow.entityType).toBe(EntityType.MINION);
    expect(hollow.toSnapshot().ownerId).toBe(arena.blue.id);
  });
});
