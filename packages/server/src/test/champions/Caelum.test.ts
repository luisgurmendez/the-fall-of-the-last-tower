/**
 * Caelum Champion Tests
 *
 * Tests for Caelum Lightbranch - Of the Whispering Woods, an enchanter.
 * Abilities:
 * - Passive: Lightweaving - every 8 seconds, once someone near him is hurt,
 *   his light heals him and allied champions within 300
 * - Q: Ray of Light - skillshot: damage and a slow on the first enemy hit
 * - W: Embolden - an allied champion (or himself) gets more AD, AP and speed
 * - E: Whispering Roots - after a moment, damage and a root in an area
 * - R: Martyr - he gives a quarter of his health; an ally heals a lot more
 *
 * Every part of the kit with its edge cases: numbers from the definitions
 * at rank 1 and max rank with ability power, ranges and radii just inside
 * and outside, durations, what's hit (allies, minions, monsters, towers,
 * wards) and casts refused with nothing spent.
 */

import { describe, test, expect } from 'bun:test';
import {
  Vector,
  CAELUM_LIGHT,
  CHAMPION_DEFINITIONS,
  GameEventType,
  TEAM_BLUE,
  TEAM_RED,
  getAbilityDefinition,
  getCastTime,
} from '@siege/shared';
import { createTestArena, calculateMagicDamage, TestArena, TestChampion } from '../ServerTestUtils';
import { ServerWard } from '../../simulation/ServerWard';
import type { ServerEntity } from '../../simulation/ServerEntity';
import { EntityType } from '@siege/shared';

const Q = getAbilityDefinition('caelum_q')!;
const W = getAbilityDefinition('caelum_w')!;
const E = getAbilityDefinition('caelum_e')!;
const R = getAbilityDefinition('caelum_r')!;
const DT = 1 / 60;

/** Caelum at the origin, Magnus `redAt` (out of the way unless given) */
function caelumArena(redAt = new Vector(3000, 3000)): TestArena {
  const arena = createTestArena({ blueChampion: 'caelum', redChampion: 'magnus', bluePosition: new Vector(0, 0), redPosition: redAt });
  // (Leveling up raised their max health, not their health)
  for (const champion of [arena.blue, arena.red]) {
    champion.setLevel(champion.level);
    champion.setHealth(champion.maxHealth);
  }
  return arena;
}

/** An allied champion */
function addAlly(arena: TestArena, at: Vector, id = 'blue-ally'): TestChampion {
  const ally = new TestChampion({ id, position: at.clone(), side: TEAM_BLUE, definition: CHAMPION_DEFINITIONS.gorath, playerId: `player-${id}` });
  arena.context.addChampion(ally, `player-${id}`);
  return ally;
}

/** Everything an entity is dealt from now on (after resistances), and how many hits */
function recordDamage(entity: ServerEntity): { total: number; hits: number } {
  const record = { total: 0, hits: 0 };
  const takeDamage = entity.takeDamage.bind(entity);
  entity.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
    const dealt = takeDamage(...args);
    record.total += dealt;
    if (dealt > 0) record.hits++;
    return dealt;
  }) as typeof takeDamage;
  return record;
}

/** Step the champions and the projectiles only */
function stepProjectiles(arena: TestArena, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    arena.tick(DT);
    for (const entity of arena.context.getAllEntities()) {
      if (entity.entityType === EntityType.PROJECTILE) entity.update(DT, arena.context);
    }
  }
}

/** An ability's value at a rank with some ability power */
function valueAt(scaling: { base: number[]; apRatio?: number }, rank: number, abilityPower: number): number {
  return scaling.base[rank - 1] + abilityPower * (scaling.apRatio ?? 0);
}

/** Lightweaving's heal for him now */
function weave(champion: TestChampion): number {
  return CAELUM_LIGHT.weaveBase + CAELUM_LIGHT.weavePerLevel * champion.level + CAELUM_LIGHT.weaveApRatio * champion.getStats().abilityPower;
}

/** Rank an ability up to `rank` (R needs the levels) */
function rankUp(champion: TestChampion, slot: 'Q' | 'W' | 'E' | 'R', rank: number): void {
  champion.setLevel(18);
  champion.skillPoints = 10;
  while (champion.abilityStates[slot].rank < rank) champion.levelUpAbility(slot);
  champion.setResource(champion.maxResource);
}

describe('Caelum', () => {
  describe('Passive - Lightweaving', () => {
    /** Tick until just before, then just after, his first pulse is ready */
    function untilReady(arena: TestArena): void {
      arena.tickFrames(Math.ceil(CAELUM_LIGHT.weaveEvery / DT) + 2);
    }

    test('every 8 seconds, someone near him hurt, it heals him and allied champions within reach', () => {
      const arena = caelumArena();
      const ally = addAlly(arena, new Vector(CAELUM_LIGHT.weaveRadius - 10, 0));
      arena.tick(DT);
      ally.setHealth(ally.maxHealth - 300);
      arena.blue.setHealth(arena.blue.maxHealth - 300);
      arena.tickFrames(Math.floor((CAELUM_LIGHT.weaveEvery - 0.2) / DT));
      const allyBefore = ally.health;
      const himBefore = arena.blue.health;
      arena.tickFrames(Math.ceil(0.4 / DT));
      // (Plus a little regeneration meanwhile)
      expect(ally.health - allyBefore).toBeGreaterThanOrEqual(weave(arena.blue));
      expect(ally.health - allyBefore).toBeLessThan(weave(arena.blue) + 2);
      expect(arena.blue.health - himBefore).toBeGreaterThanOrEqual(weave(arena.blue));
    });

    test('its heal: 14 at level 1 up to 82 at level 18, plus 10% of his ability power', () => {
      for (const level of [1, 18]) {
        const arena = caelumArena();
        arena.blue.setLevel(level);
        arena.blue.addModifier({ source: 'test_ap', flat: { abilityPower: 200 } });
        const ally = addAlly(arena, new Vector(100, 0));
        arena.tick(DT);
        ally.setHealth(ally.maxHealth - 500);
        arena.tickFrames(Math.floor((CAELUM_LIGHT.weaveEvery - 0.1) / DT));
        const before = ally.health;
        arena.tickFrames(Math.ceil(0.2 / DT));
        const heal = CAELUM_LIGHT.weaveBase + CAELUM_LIGHT.weavePerLevel * level + CAELUM_LIGHT.weaveApRatio * 200;
        expect(ally.health - before).toBeGreaterThanOrEqual(heal);
        expect(ally.health - before).toBeLessThan(heal + 2);
      }
    });

    test('it waits, charged, while nobody near him is hurt, and goes off as soon as someone is', () => {
      const arena = caelumArena();
      const ally = addAlly(arena, new Vector(100, 0));
      untilReady(arena);
      arena.tickFrames(Math.ceil(5 / DT));
      expect(arena.blue.passiveState.isActive).toBe(true);
      ally.setHealth(ally.maxHealth - 300);
      const before = ally.health;
      arena.tick(DT);
      expect(ally.health - before).toBeGreaterThanOrEqual(weave(arena.blue));
      expect(arena.blue.passiveState.isActive).toBe(false);
    });

    test('after a pulse it waits another 8 seconds', () => {
      const arena = caelumArena();
      const ally = addAlly(arena, new Vector(100, 0));
      arena.tick(DT);
      ally.setHealth(ally.maxHealth - 600);
      untilReady(arena);
      const afterFirst = ally.health;
      arena.tickFrames(Math.floor((CAELUM_LIGHT.weaveEvery - 0.5) / DT));
      // Only regeneration
      expect(ally.health - afterFirst).toBeLessThan(weave(arena.blue));
      arena.tickFrames(Math.ceil(0.7 / DT));
      expect(ally.health - afterFirst).toBeGreaterThanOrEqual(weave(arena.blue));
    });

    test("allies past its reach, enemies, minions and dead allies aren't healed", () => {
      const arena = caelumArena(new Vector(100, 100));
      const far = addAlly(arena, new Vector(CAELUM_LIGHT.weaveRadius + 20, 0), 'far-ally');
      const dead = addAlly(arena, new Vector(50, 0), 'dead-ally');
      const minion = arena.addMinion(TEAM_BLUE, new Vector(0, 60));
      arena.tick(DT);
      far.setHealth(far.maxHealth - 300);
      arena.red.setHealth(arena.red.maxHealth - 300);
      minion.takeDamage(100, 'true');
      dead.takeDamage(99999, 'true');
      arena.blue.setHealth(arena.blue.maxHealth - 300);
      const farBefore = far.health;
      const redBefore = arena.red.health;
      const minionBefore = minion.health;
      untilReady(arena);
      expect(far.health - farBefore).toBeLessThan(weave(arena.blue));
      expect(arena.red.health - redBefore).toBeLessThan(weave(arena.blue));
      expect(minion.health).toBe(minionBefore);
      expect(dead.isDead).toBe(true);
      expect(dead.health).toBe(0);
    });

    test('a pulse is announced for the VFX (caelum_lightweave), where he is', () => {
      const arena = caelumArena();
      arena.tick(DT);
      arena.blue.setHealth(arena.blue.maxHealth - 300);
      arena.context.flushEvents();
      untilReady(arena);
      const pulse = arena.context.flushEvents().find(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'caelum_lightweave');
      expect(pulse).toBeDefined();
      expect(pulse!.data.entityId).toBe(arena.blue.id);
      expect(pulse!.data.targetX).toBeCloseTo(arena.blue.position.x, 3);
    });

    test('a hair under full health (regeneration rounding) is not hurt: no pulse is spent', () => {
      const arena = caelumArena();
      arena.tick(DT);
      arena.blue.setHealth(arena.blue.maxHealth - 0.5);
      untilReady(arena);
      expect(arena.blue.passiveState.isActive).toBe(true);
    });
  });

  describe('Q - Ray of Light', () => {
    test('damage (base + 60% AP, magic) and a 20% slow for 1.5 s on the first enemy hit, at rank 1 and max rank', () => {
      for (const rank of [1, Q.maxRank]) {
        const arena = caelumArena(new Vector(250, 0));
        if (rank > 1) rankUp(arena.blue, 'Q', rank);
        arena.blue.addModifier({ source: 'test_ap', flat: { abilityPower: 100 } });
        const speed = arena.red.getStats().movementSpeed;
        const dealt = recordDamage(arena.red);
        arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) });
        stepProjectiles(arena, 0.6);
        expect(dealt.hits).toBe(1);
        expect(dealt.total).toBeCloseTo(calculateMagicDamage(valueAt(Q.damage!.scaling, rank, 100), arena.red.getStats().magicResist), 3);
        expect(arena.red.getStats().movementSpeed).toBeCloseTo(speed * 0.8, 5);
        expect(arena.red.getEffect('slow_20')!.timeRemaining).toBeLessThanOrEqual(Q.effectDuration as number);
      }
    });

    test('the slow wears off after its time', () => {
      const arena = caelumArena(new Vector(250, 0));
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) });
      stepProjectiles(arena, 0.6);
      arena.tickFrames(Math.ceil((Q.effectDuration as number) / DT));
      expect(arena.red.hasEffect('slow_20')).toBe(false);
    });

    test('just inside its range it hits; just outside, it misses', () => {
      const reach = Q.projectileRadius! + arena0Radius();
      const inside = caelumArena(new Vector(Q.range! + reach - 15, 0));
      const hit = recordDamage(inside.red);
      inside.castAbility(inside.blue, 'Q', { targetPosition: new Vector(1000, 0) });
      stepProjectiles(inside, 1.2);
      expect(hit.hits).toBe(1);

      const outside = caelumArena(new Vector(Q.range! + reach + 10, 0));
      const miss = recordDamage(outside.red);
      outside.castAbility(outside.blue, 'Q', { targetPosition: new Vector(1000, 0) });
      stepProjectiles(outside, 1.2);
      expect(miss.hits).toBe(0);
    });

    test('the first enemy stops it: a minion in front shields the champion behind', () => {
      const arena = caelumArena(new Vector(300, 0));
      const minion = arena.addMinion(TEAM_RED, new Vector(150, 0));
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0) });
      stepProjectiles(arena, 1);
      expect(minion.health).toBeLessThan(minion.maxHealth);
      expect(dealt.hits).toBe(0);
    });

    test('it flies through allies, towers and wards', () => {
      const arena = caelumArena(new Vector(350, 0));
      const allyMinion = arena.addMinion(TEAM_BLUE, new Vector(80, 0));
      const ally = addAlly(arena, new Vector(140, 0));
      const tower = arena.addTower(TEAM_RED, new Vector(230, 0));
      const ward = new ServerWard({ id: 'red-ward', position: new Vector(290, 0), side: TEAM_RED, wardType: 'stealth', ownerId: 'player-red' });
      arena.context.addEntity(ward);
      const towerHealth = tower.health;
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0) });
      stepProjectiles(arena, 1);
      expect(allyMinion.health).toBe(allyMinion.maxHealth);
      expect(ally.hasEffect('slow_20')).toBe(false);
      expect(tower.health).toBe(towerHealth);
      expect(ward.isDead).toBe(false);
      expect(dealt.hits).toBe(1);
    });

    test('it hits a jungle monster', () => {
      const arena = caelumArena();
      const monster = arena.addJungleCreature(new Vector(200, 0));
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(400, 0) });
      stepProjectiles(arena, 1);
      expect(monster.health).toBeLessThan(monster.maxHealth);
    });

    for (const rank of [1, Q.maxRank]) {
      test(`rank ${rank}: costs ${Q.manaCost![rank - 1]} mana, ${Q.cooldown![rank - 1]} s cooldown`, () => {
        const arena = caelumArena();
        if (rank > 1) rankUp(arena.blue, 'Q', rank);
        const mana = arena.blue.resource;
        expect(arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0) }).success).toBe(true);
        expect(arena.blue.resource).toBe(mana - Q.manaCost![rank - 1]);
        expect(arena.blue.getAbilityCooldown('Q')).toBe(Q.cooldown![rank - 1]);
      });
    }

    test('it has a cast time; stunned in it, nothing is spent and no ray flies', () => {
      expect(getCastTime(Q)).toBeGreaterThan(0);
      const arena = caelumArena(new Vector(250, 0));
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0), casting: true });
      expect(arena.blue.isCasting()).toBe(true);
      arena.blue.applyEffect('stun', 1, arena.red.id);
      const dealt = recordDamage(arena.red);
      stepProjectiles(arena, 1);
      expect(arena.blue.resource).toBeGreaterThanOrEqual(mana);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
      expect(dealt.hits).toBe(0);
    });

    test('silenced, or without the mana, it fails with nothing spent', () => {
      const silenced = caelumArena();
      silenced.blue.applyEffect('silence', 1, silenced.red.id);
      expect(silenced.castAbility(silenced.blue, 'Q', { targetPosition: new Vector(300, 0) }).failReason).toBe('silenced');

      const broke = caelumArena();
      broke.blue.setResource(Q.manaCost![0] - 1);
      expect(broke.castAbility(broke.blue, 'Q', { targetPosition: new Vector(300, 0) }).failReason).toBe('not_enough_mana');
      expect(broke.blue.getAbilityCooldown('Q')).toBe(0);
    });
  });

  describe('W - Embolden', () => {
    const duration = W.effectDuration as number;

    test('an allied champion gets 20% more AD and AP and 20% speed for its duration', () => {
      const arena = caelumArena();
      const ally = addAlly(arena, new Vector(200, 0));
      ally.addModifier({ source: 'test_ap', flat: { abilityPower: 50 } });
      const before = ally.getStats();
      expect(arena.castAbility(arena.blue, 'W', { targetId: ally.id, targetPosition: ally.position.clone() }).success).toBe(true);
      const now = ally.getStats();
      expect(now.attackDamage).toBeCloseTo(before.attackDamage * 1.2, 5);
      expect(now.abilityPower).toBeCloseTo(before.abilityPower * 1.2, 5);
      expect(now.movementSpeed).toBeCloseTo(before.movementSpeed * 1.2, 5);
      for (const id of W.appliesEffects!) expect(ally.getEffect(id)!.timeRemaining).toBeCloseTo(duration, 5);
      ally.tickEffects(duration + 0.05);
      expect(ally.getStats().attackDamage).toBeCloseTo(before.attackDamage, 5);
      for (const id of W.appliesEffects!) expect(ally.hasEffect(id)).toBe(false);
    });

    test('on himself (clicked on him, or on nothing)', () => {
      for (const target of ['self', 'nothing'] as const) {
        const arena = caelumArena();
        const before = arena.blue.getStats().attackDamage;
        const result = arena.castAbility(arena.blue, 'W', target === 'self'
          ? { targetId: arena.blue.id, targetPosition: arena.blue.position.clone() }
          : { targetPosition: new Vector(200, 0) });
        expect(result.success).toBe(true);
        expect(arena.blue.getStats().attackDamage).toBeCloseTo(before * 1.2, 5);
      }
    });

    test('an ally just inside its range is emboldened; just outside, it fails with nothing spent', () => {
      const inside = caelumArena();
      const near = addAlly(inside, new Vector(W.range! - 5, 0));
      expect(inside.castAbility(inside.blue, 'W', { targetId: near.id, targetPosition: near.position.clone() }).success).toBe(true);
      expect(near.hasEffect('caelum_embolden')).toBe(true);

      const outside = caelumArena();
      const far = addAlly(outside, new Vector(W.range! + far0Radius() + 30, 0));
      const mana = outside.blue.resource;
      const result = outside.castAbility(outside.blue, 'W', { targetId: far.id, targetPosition: far.position.clone() });
      expect(result.success).toBe(false);
      expect(result.failReason).toBe('out_of_range');
      expect(outside.blue.resource).toBe(mana);
      expect(far.hasEffect('caelum_embolden')).toBe(false);
    });

    test('an enemy under the cursor is refused, nothing spent', () => {
      const arena = caelumArena(new Vector(200, 0));
      const mana = arena.blue.resource;
      const result = arena.castAbility(arena.blue, 'W', { targetId: arena.red.id, targetPosition: arena.red.position.clone() });
      expect(result.success).toBe(false);
      expect(arena.blue.resource).toBe(mana);
      expect(arena.red.hasEffect('caelum_embolden')).toBe(false);
    });

    test('a dead ally under the cursor: it goes on him instead', () => {
      const arena = caelumArena();
      const ally = addAlly(arena, new Vector(150, 0));
      ally.takeDamage(99999, 'true');
      expect(arena.castAbility(arena.blue, 'W', { targetId: ally.id, targetPosition: ally.position.clone() }).success).toBe(true);
      expect(arena.blue.hasEffect('caelum_embolden')).toBe(true);
    });

    test('recast on the same ally refreshes it, it doesn\'t stack', () => {
      const arena = caelumArena();
      const ally = addAlly(arena, new Vector(150, 0));
      const before = ally.getStats().attackDamage;
      arena.castAbility(arena.blue, 'W', { targetId: ally.id, targetPosition: ally.position.clone() });
      ally.tickEffects(2);
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'W', { targetId: ally.id, targetPosition: ally.position.clone() });
      expect(ally.getEffect('caelum_embolden')!.timeRemaining).toBeCloseTo(duration, 5);
      expect(ally.getStats().attackDamage).toBeCloseTo(before * 1.2, 5);
    });

    for (const rank of [1, W.maxRank]) {
      test(`rank ${rank}: costs ${W.manaCost![rank - 1]} mana, ${W.cooldown![rank - 1]} s cooldown, instant`, () => {
        const arena = caelumArena();
        if (rank > 1) rankUp(arena.blue, 'W', rank);
        const mana = arena.blue.resource;
        arena.castAbility(arena.blue, 'W', { targetPosition: new Vector(100, 0) });
        expect(arena.blue.resource).toBe(mana - W.manaCost![rank - 1]);
        expect(arena.blue.getAbilityCooldown('W')).toBe(W.cooldown![rank - 1]);
        expect(getCastTime(W)).toBe(0);
      });
    }

    test('stunned or silenced it fails, nothing spent; rooted it goes off', () => {
      for (const effect of ['stun', 'silence']) {
        const arena = caelumArena();
        arena.blue.applyEffect(effect, 1, arena.red.id);
        const mana = arena.blue.resource;
        expect(arena.castAbility(arena.blue, 'W', { targetPosition: new Vector(100, 0) }).success).toBe(false);
        expect(arena.blue.resource).toBe(mana);
      }
      const rooted = caelumArena();
      rooted.blue.applyEffect('root', 1, rooted.red.id);
      expect(rooted.castAbility(rooted.blue, 'W', { targetPosition: new Vector(100, 0) }).success).toBe(true);
    });
  });

  describe('E - Whispering Roots', () => {
    test('after its windup: damage (base + 40% AP, magic) and a 1.5 s root on enemies in it, at rank 1 and max rank', () => {
      for (const rank of [1, E.maxRank]) {
        const arena = caelumArena(new Vector(250, 0));
        if (rank > 1) rankUp(arena.blue, 'E', rank);
        arena.blue.addModifier({ source: 'test_ap', flat: { abilityPower: 100 } });
        const dealt = recordDamage(arena.red);
        arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(250, 0) });
        expect(dealt.hits).toBe(1);
        expect(dealt.total).toBeCloseTo(calculateMagicDamage(valueAt(E.damage!.scaling, rank, 100), arena.red.getStats().magicResist), 3);
        expect(arena.red.getEffect('root')!.timeRemaining).toBeCloseTo(E.effectDuration as number, 5);
        expect(arena.red.canMove()).toBe(false);
      }
    });

    test('nothing before the roots rise', () => {
      const arena = caelumArena(new Vector(250, 0));
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(250, 0), windup: true });
      arena.context.advanceTime(E.aoeDelay! - 0.05);
      expect(dealt.hits).toBe(0);
      expect(arena.red.hasEffect('root')).toBe(false);
      arena.context.advanceTime(0.1);
      expect(dealt.hits).toBe(1);
    });

    test('an enemy who walks out before they rise is missed', () => {
      const arena = caelumArena(new Vector(250, 0));
      const dealt = recordDamage(arena.red);
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(250, 0), windup: true });
      arena.red.position.setFrom(new Vector(250, E.aoeRadius! + 60));
      arena.context.advanceTime(E.aoeDelay! + 0.05);
      expect(dealt.hits).toBe(0);
    });

    test('just inside its radius is caught; just outside, not', () => {
      for (const [offset, hits] of [[E.aoeRadius! - 5, 1], [E.aoeRadius! + 5, 0]] as const) {
        const arena = caelumArena(new Vector(250, offset));
        const dealt = recordDamage(arena.red);
        arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(250, 0) });
        expect(dealt.hits).toBe(hits);
      }
    });

    test('clicked past its range, it rises at its range toward the click', () => {
      const arena = caelumArena(new Vector(E.range!, 0));
      const dealt = recordDamage(arena.red);
      expect(arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(E.range! * 3, 0) }).success).toBe(true);
      expect(dealt.hits).toBe(1);
    });

    test('it catches enemy minions and monsters, not allies, towers or wards', () => {
      const arena = caelumArena();
      const at = new Vector(250, 0);
      const minion = arena.addMinion(TEAM_RED, at.added(new Vector(30, 0)));
      const monster = arena.addJungleCreature(at.added(new Vector(-30, 0)));
      const ally = addAlly(arena, at.added(new Vector(0, 30)));
      const tower = arena.addTower(TEAM_RED, at.added(new Vector(0, -50)));
      const ward = new ServerWard({ id: 'red-ward', position: at.clone(), side: TEAM_RED, wardType: 'stealth', ownerId: 'player-red' });
      arena.context.addEntity(ward);
      const towerHealth = tower.health;
      arena.castAbility(arena.blue, 'E', { targetPosition: at });
      expect(minion.health).toBeLessThan(minion.maxHealth);
      expect(monster.health).toBeLessThan(monster.maxHealth);
      expect(ally.hasEffect('root')).toBe(false);
      expect(ally.health).toBe(ally.maxHealth);
      expect(tower.health).toBe(towerHealth);
      expect(ward.isDead).toBe(false);
    });

    for (const rank of [1, E.maxRank]) {
      test(`rank ${rank}: costs ${E.manaCost![rank - 1]} mana, ${E.cooldown![rank - 1]} s cooldown`, () => {
        const arena = caelumArena();
        if (rank > 1) rankUp(arena.blue, 'E', rank);
        const mana = arena.blue.resource;
        arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(200, 0) });
        expect(arena.blue.resource).toBe(mana - E.manaCost![rank - 1]);
        expect(arena.blue.getAbilityCooldown('E')).toBe(E.cooldown![rank - 1]);
      });
    }

    test('stunned or silenced it fails, nothing spent', () => {
      for (const effect of ['stun', 'silence']) {
        const arena = caelumArena(new Vector(250, 0));
        arena.blue.applyEffect(effect, 1, arena.red.id);
        const mana = arena.blue.resource;
        expect(arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(250, 0) }).success).toBe(false);
        expect(arena.blue.resource).toBe(mana);
        expect(arena.red.hasEffect('root')).toBe(false);
      }
    });
  });

  describe('R - Martyr', () => {
    function martyrArena(allyAt = new Vector(200, 0)) {
      const arena = caelumArena();
      const ally = addAlly(arena, allyAt);
      ally.setHealth(200);
      return { arena, ally };
    }

    test('he gives a quarter of his health; the ally heals the base heal plus twice that, at every rank', () => {
      for (const rank of [1, 2, 3]) {
        const { arena, ally } = martyrArena();
        rankUp(arena.blue, 'R', rank);
        ally.setMaxHealth(10000);
        ally.setHealth(200);
        arena.blue.addModifier({ source: 'test_ap', flat: { abilityPower: 100 } });
        arena.blue.setHealth(arena.blue.maxHealth);
        const health = arena.blue.health;
        const given = health * CAELUM_LIGHT.martyrShare;
        expect(arena.castAbility(arena.blue, 'R', { targetId: ally.id, targetPosition: ally.position.clone() }).success).toBe(true);
        expect(arena.blue.health).toBeCloseTo(health - given, 5);
        expect(ally.health - 200).toBeCloseTo(valueAt(R.heal!.scaling, rank, 100) + given * CAELUM_LIGHT.martyrMultiplier, 3);
        expect(arena.blue.getAbilityCooldown('R')).toBe(R.cooldown![rank - 1]);
      }
    });

    test('a quarter of his current health, not his max', () => {
      const { arena, ally } = martyrArena();
      arena.blue.setHealth(400);
      arena.castAbility(arena.blue, 'R', { targetId: ally.id, targetPosition: ally.position.clone() });
      expect(arena.blue.health).toBeCloseTo(300, 5);
    });

    test('never his last point of health', () => {
      for (const health of [1, 1.2, 1.3]) {
        const { arena, ally } = martyrArena();
        arena.blue.setHealth(health);
        expect(arena.castAbility(arena.blue, 'R', { targetId: ally.id, targetPosition: ally.position.clone() }).success).toBe(true);
        expect(arena.blue.isDead).toBe(false);
        expect(arena.blue.health).toBeGreaterThanOrEqual(1 - 1e-9);
        expect(arena.blue.health).toBeCloseTo(Math.max(1, health * (1 - CAELUM_LIGHT.martyrShare)), 5);
      }
    });

    test("the ally's heal stops at its max health", () => {
      const { arena, ally } = martyrArena();
      ally.setHealth(ally.maxHealth - 10);
      arena.castAbility(arena.blue, 'R', { targetId: ally.id, targetPosition: ally.position.clone() });
      expect(ally.health).toBe(ally.maxHealth);
    });

    test('not on himself: clicked on him or on nothing, it fails with nothing spent', () => {
      for (const target of ['self', 'nothing'] as const) {
        const { arena } = martyrArena();
        const health = arena.blue.health;
        const mana = arena.blue.resource;
        const result = arena.castAbility(arena.blue, 'R', target === 'self'
          ? { targetId: arena.blue.id, targetPosition: arena.blue.position.clone() }
          : { targetPosition: new Vector(100, 0) });
        expect(result.success).toBe(false);
        expect(arena.blue.health).toBe(health);
        expect(arena.blue.resource).toBe(mana);
        expect(arena.blue.getAbilityCooldown('R')).toBe(0);
      }
    });

    test('not on a minion: refused, his health and mana and the cooldown kept', () => {
      const { arena } = martyrArena();
      const minion = arena.addMinion(TEAM_BLUE, new Vector(150, 0));
      minion.takeDamage(100, 'true');
      const minionHealth = minion.health;
      const health = arena.blue.health;
      const mana = arena.blue.resource;
      const result = arena.castAbility(arena.blue, 'R', { targetId: minion.id, targetPosition: minion.position.clone() });
      expect(result.success).toBe(false);
      expect(minion.health).toBe(minionHealth);
      expect(arena.blue.health).toBe(health);
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.getAbilityCooldown('R')).toBe(0);
    });

    test('not on an enemy, a dead ally or an allied tower', () => {
      const { arena, ally } = martyrArena();
      ally.takeDamage(99999, 'true');
      const tower = arena.addTower(TEAM_BLUE, new Vector(-150, 0));
      arena.red.position.setFrom(new Vector(0, 150));
      const health = arena.blue.health;
      for (const target of [arena.red, ally, tower]) {
        const result = arena.castAbility(arena.blue, 'R', { targetId: target.id, targetPosition: target.position.clone() });
        expect(result.success).toBe(false);
      }
      expect(arena.blue.health).toBe(health);
      expect(arena.blue.getAbilityCooldown('R')).toBe(0);
    });

    test('an ally just inside its range is saved; just outside, it fails with nothing spent', () => {
      const inside = martyrArena(new Vector(R.range! - 5, 0));
      expect(inside.arena.castAbility(inside.arena.blue, 'R', { targetId: inside.ally.id, targetPosition: inside.ally.position.clone() }).success).toBe(true);

      const outside = martyrArena(new Vector(R.range! + far0Radius() + 30, 0));
      const health = outside.arena.blue.health;
      const result = outside.arena.castAbility(outside.arena.blue, 'R', { targetId: outside.ally.id, targetPosition: outside.ally.position.clone() });
      expect(result.success).toBe(false);
      expect(result.failReason).toBe('out_of_range');
      expect(outside.arena.blue.health).toBe(health);
    });

    test('announced for the VFX where the ally is (caelum_r_given), and paid for', () => {
      const { arena, ally } = martyrArena();
      const mana = arena.blue.resource;
      arena.context.flushEvents();
      arena.castAbility(arena.blue, 'R', { targetId: ally.id, targetPosition: ally.position.clone() });
      const given = arena.context.flushEvents().find(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'caelum_r_given');
      expect(given).toBeDefined();
      expect(given!.data.targetX).toBeCloseTo(ally.position.x, 3);
      expect(arena.blue.resource).toBe(mana - R.manaCost![0]);
    });

    test('instant; stunned or silenced it fails with nothing spent', () => {
      expect(getCastTime(R)).toBe(0);
      for (const effect of ['stun', 'silence']) {
        const { arena, ally } = martyrArena();
        arena.blue.applyEffect(effect, 1, arena.red.id);
        const health = arena.blue.health;
        expect(arena.castAbility(arena.blue, 'R', { targetId: ally.id, targetPosition: ally.position.clone() }).success).toBe(false);
        expect(arena.blue.health).toBe(health);
      }
    });

    test('given health hurts him, so Lightweaving can heal him back', () => {
      const { arena, ally } = martyrArena(new Vector(150, 0));
      arena.tick(DT);
      arena.blue.setHealth(arena.blue.maxHealth);
      ally.setHealth(ally.maxHealth);
      arena.castAbility(arena.blue, 'R', { targetId: ally.id, targetPosition: ally.position.clone() });
      const after = arena.blue.health;
      arena.tickFrames(Math.ceil(CAELUM_LIGHT.weaveEvery / DT) + 2);
      expect(arena.blue.health - after).toBeGreaterThanOrEqual(weave(arena.blue));
    });

    test('not before level 6', () => {
      const arena = createTestArena({ blueChampion: 'caelum', redChampion: 'magnus', learnAbilities: false });
      expect(arena.castAbility(arena.blue, 'R').failReason).toBe('not_learned');
      arena.blue.skillPoints = 1;
      expect(arena.blue.levelUpAbility('R')).toBe(false);
    });
  });
});

/** Magnus's collision radius (the red champion) */
function arena0Radius(): number {
  return (CHAMPION_DEFINITIONS.magnus.collision as { radius?: number } | undefined)?.radius ?? 25;
}

/** Gorath's collision radius (the allies here): ranges reach the edge of a unit */
function far0Radius(): number {
  return (CHAMPION_DEFINITIONS.gorath.collision as { radius?: number } | undefined)?.radius ?? 25;
}
