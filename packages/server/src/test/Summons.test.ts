/**
 * Summons: units a champion raises that fight for it (Nocthar's Hollows and
 * colossus). They're minions with an owner (ServerSummon): towers, minions,
 * abilities and vision treat them like lane minions.
 * - Rising out of the ground, a summon does nothing
 * - Without orders it follows its owner (each in its own spot, around
 *   walls, keeping up with it), fights what its owner attacks and hits back
 *   at enemy units right next to it; it doesn't go for structures or jungle
 *   monsters on its own
 * - Orders: walk to a point (and fight what comes near there), attack a
 *   unit (until it dies or hides), come back
 * - Past its leash from the owner it drops its order and comes back
 * - Its owner dying, it crumbles; killing one gives no gold, XP or CS
 * - Crowd control holds it like a minion (stun, fear, slow)
 * - A dash (the colossus's charge) carries it along a line, touching each
 *   enemy once, carrying them if it carries, and nothing stops it
 */

import { describe, test, expect } from 'bun:test';
import { Vector, EntityType, GameEventType, TEAM_BLUE, TEAM_RED, type MinionSnapshot } from '@siege/shared';
import { createTestArena, type TestArena } from './ServerTestUtils';
import { ServerSummon, type SummonStats } from '../simulation/ServerSummon';
import type { ServerEntity } from '../simulation/ServerEntity';
import { findWallCrossing } from './wallSpots';

const DT = 1 / 60;
const LEASH = 380;

const STATS: SummonStats = {
  maxHealth: 300,
  armor: 10,
  magicResist: 10,
  attackDamage: 20,
  damageType: 'magic',
  attackRange: 30,
  attackCooldown: 1,
  attackWindup: 0.2,
  movementSpeed: 90,
  sightRange: 400,
  acquisitionRange: 90,
  radius: 12,
  mass: 40,
};

let summonIds = 0;

/** Along mid lane (the map's center is (0, 0); the lane runs to the top right): `d` along it, `off` across */
const ALONG = new Vector(1, -1).normalized();
const ACROSS = new Vector(1, 1).normalized();
const p = (d: number, off = 0) => ALONG.scaled(d).added(ACROSS.scaled(off));

/** Magnus (blue, the owner) at (0, 0); red Kael far away */
function ownerArena(redAt = new Vector(3000, 3000)): TestArena {
  const arena = createTestArena({ blueChampion: 'magnus', redChampion: 'warrior', bluePosition: p(0), redPosition: redAt });
  arena.context.getFogOfWar().updateVision(arena.context, 1);
  return arena;
}

function summon(arena: TestArena, at: Vector, options: { riseTime?: number; scale?: number; stats?: Partial<SummonStats>; side?: number } = {}): ServerSummon {
  const unit = new ServerSummon({
    id: `test-summon-${summonIds++}`,
    position: at.clone(),
    side: (options.side ?? TEAM_BLUE) as typeof TEAM_BLUE,
    ownerId: options.side === TEAM_RED ? arena.red.id : arena.blue.id,
    summonType: 'hollow',
    stats: { ...STATS, ...options.stats },
    leash: LEASH,
    riseTime: options.riseTime ?? 0,
    scale: options.scale,
  });
  arena.context.addEntity(unit);
  return unit;
}

/** Everything moves for `seconds`, vision updating as it goes */
function step(arena: TestArena, seconds: number): void {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) {
    arena.tickAll(DT);
    if (i % 6 === 0) arena.context.getFogOfWar().updateVision(arena.context, arena.context.getGameTime());
  }
}

describe('Summons', () => {
  describe('what it is', () => {
    test('a minion with an owner: its snapshot says whose, which and how big', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30), { scale: 1.5 });
      expect(unit.entityType).toBe(EntityType.MINION);
      const snapshot = unit.toSnapshot() as MinionSnapshot;
      expect(snapshot.minionType).toBe('hollow');
      expect(snapshot.ownerId).toBe(arena.blue.id);
      expect(snapshot.scale).toBe(1.5);
      expect(snapshot.health).toBe(STATS.maxHealth);
    });

    test('it collides with other units', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      expect(unit.isCollidable()).toBe(true);
      expect(unit.getRadius()).toBe(STATS.radius);
    });

    test('a bigger one has a bigger body', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30), { scale: 2 });
      expect(unit.getRadius()).toBe(STATS.radius * 2);
    });
  });

  describe('rising', () => {
    test('climbing out of the ground it neither moves nor attacks', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30), { riseTime: 0.75 });
      const enemy = arena.addMinion(TEAM_RED, p(45));
      arena.blue.position.setFrom(p(300));
      step(arena, 0.6);
      expect(unit.position.distanceTo(p(30))).toBeLessThan(1);
      expect(enemy.health).toBe(enemy.maxHealth);
      expect((unit.toSnapshot() as MinionSnapshot).rising).toBeGreaterThan(0);
    });

    test('then it acts, and says it has risen', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30), { riseTime: 0.75 });
      arena.blue.position.setFrom(p(300));
      step(arena, 2);
      expect(unit.position.x).toBeGreaterThan(100);
      expect((unit.toSnapshot() as MinionSnapshot).rising).toBeNull();
    });
  });

  describe('following its owner', () => {
    test('it follows its owner around', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      arena.blue.setMoveTarget(p(300));
      step(arena, 5);
      expect(unit.position.distanceTo(arena.blue.position)).toBeLessThan(80);
    });

    test("two of them don't stand on the same spot", () => {
      const arena = ownerArena();
      const a = summon(arena, p(30));
      const b = summon(arena, p(30, 1));
      arena.blue.setMoveTarget(p(200));
      step(arena, 5);
      expect(a.position.distanceTo(b.position)).toBeGreaterThan(15);
    });

    test('it keeps up with a faster owner', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      arena.blue.addModifier({ source: 'test-speed', flat: { movementSpeed: 120 } });
      arena.blue.setMoveTarget(p(900));
      step(arena, 3);
      expect(unit.position.distanceTo(arena.blue.position)).toBeLessThan(120);
    });

    test('it walks around a wall to its owner, never into it', () => {
      const wall = findWallCrossing(30, 90);
      const arena = ownerArena();
      arena.blue.position.setFrom(new Vector(wall.right + 60, wall.y));
      const unit = summon(arena, new Vector(wall.left - 60, wall.y));
      let inWall = false;
      for (let i = 0; i < 20 / (DT * 10); i++) {
        step(arena, DT * 10);
        if (arena.context.terrain.isBlocked(unit.position.x, unit.position.y)) inWall = true;
      }
      expect(inWall).toBe(false);
      expect(unit.position.distanceTo(arena.blue.position)).toBeLessThan(100);
    });
  });

  describe('fighting', () => {
    test('it attacks what its owner attacks', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      const enemy = arena.addMinion(TEAM_RED, p(150));
      arena.blue.setAttackTarget(enemy.id);
      const hits: string[] = [];
      const takeDamage = enemy.takeDamage.bind(enemy);
      enemy.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
        if (args[2]) hits.push(args[2]);
        return takeDamage(...args);
      }) as typeof takeDamage;
      step(arena, 4);
      expect(hits).toContain(unit.id);
    });

    test('its attack has an animation the clients hear of, and lands after its windup', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      const enemy = arena.addMinion(TEAM_RED, p(30 + STATS.radius + 12 + 10));
      arena.blue.setAttackTarget(enemy.id);
      // Let it start the attack
      let started = -1;
      for (let i = 0; i < 120 && started < 0; i++) {
        arena.tickAll(DT);
        if (arena.context.flushEvents().some(e => e.type === GameEventType.BASIC_ATTACK && e.data.entityId === unit.id)) started = i;
      }
      expect(started).toBeGreaterThanOrEqual(0);
      expect(enemy.health).toBe(enemy.maxHealth);
      step(arena, STATS.attackWindup + 0.05);
      expect(enemy.health).toBeLessThan(enemy.maxHealth);
    });

    test('it hits back at an enemy unit right next to it', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      const enemy = arena.addMinion(TEAM_RED, p(60));
      step(arena, 3);
      expect(enemy.health).toBeLessThan(enemy.maxHealth);
      expect(unit.health).toBeLessThan(unit.maxHealth);
    });

    test("it doesn't go for a jungle monster on its own, but helps its owner fight one", () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      const monster = arena.addJungleCreature(p(80));
      step(arena, 2);
      expect(monster.health).toBe(monster.maxHealth);
      arena.blue.setAttackTarget(monster.id);
      const hits: string[] = [];
      const takeDamage = monster.takeDamage.bind(monster);
      monster.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
        if (args[2]) hits.push(args[2]);
        return takeDamage(...args);
      }) as typeof takeDamage;
      step(arena, 3);
      expect(hits).toContain(unit.id);
    });

    test("it doesn't walk into an enemy tower on its own", () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      const tower = arena.addTower(TEAM_RED, p(200));
      step(arena, 3);
      expect(tower.health).toBe(tower.maxHealth);
      expect(unit.position.distanceTo(arena.blue.position)).toBeLessThan(80);
    });

    test('an enemy tower shoots it before its owner (it counts as a minion)', () => {
      const arena = ownerArena();
      const tower = arena.addTower(TEAM_RED, p(0, 300));
      arena.blue.position.setFrom(p(0, 300 - 150));
      const unit = summon(arena, p(10, 300 - 150));
      const shotAt: string[] = [];
      for (const target of [unit, arena.blue] as ServerEntity[]) {
        const takeDamage = target.takeDamage.bind(target);
        target.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
          if (args[2]?.startsWith('proj') || args[2] === tower.id) shotAt.push(target.id);
          return takeDamage(...args);
        }) as typeof takeDamage;
      }
      for (let i = 0; i < 300 && shotAt.length === 0; i++) {
        arena.tickAll(DT);
        for (const entity of arena.context.getAllEntities()) if (entity.entityType === EntityType.PROJECTILE) entity.update(0, arena.context);
      }
      expect(shotAt[0]).toBe(unit.id);
    });

    test('lane minions fight it', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      arena.addMinion(TEAM_RED, p(70));
      step(arena, 3);
      expect(unit.health).toBeLessThan(unit.maxHealth);
    });
  });

  describe('orders', () => {
    test('sent to a point it walks there and stays, even with its owner standing still', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      unit.command({ kind: 'move', point: p(250) }, arena.context);
      step(arena, 5);
      expect(unit.position.distanceTo(p(250))).toBeLessThan(10);
      expect(unit.order.kind).toBe('move');
    });

    test('there it fights what comes near', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      unit.command({ kind: 'move', point: p(250) }, arena.context);
      step(arena, 4);
      const enemy = arena.addMinion(TEAM_RED, p(290));
      step(arena, 3);
      expect(enemy.health).toBeLessThan(enemy.maxHealth);
    });

    test('sent at an enemy it chases it down, then comes back to its owner', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30), { stats: { attackDamage: 200 } });
      const enemy = arena.addMinion(TEAM_RED, p(250, 60));
      step(arena, 0.1);
      unit.command({ kind: 'attack', targetId: enemy.id }, arena.context);
      step(arena, 8);
      expect(enemy.isDead).toBe(true);
      expect(unit.order.kind).toBe('follow');
      step(arena, 5);
      expect(unit.position.distanceTo(arena.blue.position)).toBeLessThan(80);
    });

    test('sent at an enemy that hides, it gives up', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      const enemy = arena.addMinion(TEAM_RED, p(250));
      step(arena, 0.1);
      unit.command({ kind: 'attack', targetId: enemy.id }, arena.context);
      step(arena, 0.5);
      const isVisibleTo = arena.context.isVisibleTo.bind(arena.context);
      arena.context.isVisibleTo = (entity, side) => entity.id === enemy.id ? false : isVisibleTo(entity, side);
      step(arena, 0.5);
      expect(unit.order.kind).toBe('follow');
    });

    test('sent past its leash it stops there and comes back', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      unit.command({ kind: 'move', point: p(LEASH + 400) }, arena.context);
      let farthest = 0;
      for (let i = 0; i < 12 / (DT * 10); i++) {
        step(arena, DT * 10);
        farthest = Math.max(farthest, unit.position.distanceTo(arena.blue.position));
      }
      expect(farthest).toBeLessThanOrEqual(LEASH + 10);
      expect(unit.order.kind).toBe('follow');
      expect(unit.position.distanceTo(arena.blue.position)).toBeLessThan(80);
    });

    test('its owner walking away drops its order', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      unit.command({ kind: 'move', point: p(-200) }, arena.context);
      step(arena, 3);
      arena.blue.setMoveTarget(p(LEASH + 200));
      step(arena, 9);
      expect(unit.order.kind).toBe('follow');
      expect(unit.position.distanceTo(arena.blue.position)).toBeLessThan(120);
    });

    test('told to come back, it does', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      unit.command({ kind: 'move', point: p(250) }, arena.context);
      step(arena, 4);
      unit.command({ kind: 'follow' }, arena.context);
      step(arena, 4);
      expect(unit.position.distanceTo(arena.blue.position)).toBeLessThan(80);
    });

    /** A summon at p(30) fighting a sturdy red minion right next to it */
    function fighting(arena: TestArena): { unit: ServerSummon; enemy: ServerEntity } {
      const unit = summon(arena, p(30));
      const enemy = arena.addMinion(TEAM_RED, p(30 + STATS.radius + 12 + 6));
      enemy.health = enemy.maxHealth = 1e6;
      step(arena, 1.5);
      expect(enemy.health).toBeLessThan(1e6);
      return { unit, enemy };
    }

    test('BUG: fighting something, sent to a point it stops and goes there', () => {
      const arena = ownerArena();
      const { unit, enemy } = fighting(arena);
      unit.command({ kind: 'move', point: p(-200) }, arena.context);
      const health = enemy.health;
      // On its way it hits nothing (there, it fights whatever followed it)
      for (let i = 0; i < 4 / DT && unit.position.distanceTo(p(-200)) > 8; i++) arena.tickAll(DT);
      expect(unit.position.distanceTo(p(-200))).toBeLessThanOrEqual(8);
      expect(enemy.health).toBe(health);
    });

    test('BUG: fighting something, told to come back it comes back', () => {
      const arena = ownerArena();
      arena.blue.position.setFrom(p(-150));
      const { unit, enemy } = fighting(arena);
      unit.command({ kind: 'follow' }, arena.context);
      const health = enemy.health;
      // On its way it hits nothing (back by its owner, it fights whatever followed it)
      for (let i = 0; i < 4 / DT && unit.position.distanceTo(arena.blue.position) > 70; i++) arena.tickAll(DT);
      expect(unit.position.distanceTo(arena.blue.position)).toBeLessThanOrEqual(70);
      expect(enemy.health).toBe(health);
    });

    test('BUG: fighting something its owner attacks, told to come back it comes back', () => {
      const arena = ownerArena();
      arena.blue.position.setFrom(p(-150));
      const { unit, enemy } = fighting(arena);
      arena.blue.setAttackTarget(enemy.id);
      // (the owner keeps hitting from range; the summon is called off)
      unit.command({ kind: 'follow' }, arena.context);
      step(arena, 3);
      expect(unit.position.distanceTo(arena.blue.position)).toBeLessThan(80);
    });

    test('BUG: fighting something, sent at another enemy it goes for that one', () => {
      const arena = ownerArena();
      const { unit, enemy } = fighting(arena);
      const other = arena.addMinion(TEAM_RED, p(-120));
      other.health = other.maxHealth = 1e6;
      unit.command({ kind: 'attack', targetId: other.id }, arena.context);
      const health = enemy.health;
      step(arena, 4);
      expect(other.health).toBeLessThan(1e6);
      expect(enemy.health).toBe(health);
    });

    test('once back by its owner, it hits back at enemies next to it again', () => {
      const arena = ownerArena();
      arena.blue.position.setFrom(p(-150));
      const { unit, enemy } = fighting(arena);
      unit.command({ kind: 'follow' }, arena.context);
      step(arena, 4);
      // (the one that followed it gone)
      enemy.takeDamage(1e9, 'true');
      step(arena, 0.1);
      const near = arena.addMinion(TEAM_RED, unit.position.added(ACROSS.scaled(STATS.radius + 12 + 6)));
      step(arena, 2);
      expect(near.health).toBeLessThan(near.maxHealth);
    });

    test('the same order again keeps the attack it is winding up', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      const enemy = arena.addMinion(TEAM_RED, p(30 + STATS.radius + 12 + 10));
      unit.command({ kind: 'attack', targetId: enemy.id }, arena.context);
      for (let i = 0; i < 120 && !unit.toSnapshot().isAttacking; i++) arena.tickAll(DT);
      expect(unit.toSnapshot().isAttacking).toBe(true);
      unit.command({ kind: 'attack', targetId: enemy.id }, arena.context);
      step(arena, STATS.attackWindup + 0.05);
      expect(enemy.health).toBeLessThan(enemy.maxHealth);
    });

    test("an order at an ally or something it can't attack is a walk there", () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      const ally = arena.addMinion(TEAM_BLUE, p(200));
      unit.command({ kind: 'attack', targetId: ally.id }, arena.context);
      step(arena, 3);
      expect(ally.health).toBe(ally.maxHealth);
    });
  });

  describe('its end', () => {
    test('its owner dying, it crumbles: nobody gets anything for it', () => {
      const arena = ownerArena(p(200));
      const unit = summon(arena, p(30));
      const gold = arena.red.gold;
      arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
      const goldAfterKill = arena.red.gold;
      step(arena, 0.1);
      expect(unit.isDead).toBe(true);
      expect(unit.shouldRemove()).toBe(true);
      // (only its passive income since)
      expect(arena.red.gold).toBeCloseTo(goldAfterKill, 0);
      expect(goldAfterKill).toBeGreaterThan(gold);
    });

    test('killing one gives no gold, XP or creep score', () => {
      const arena = ownerArena(p(200));
      const unit = summon(arena, p(30));
      const { gold, cs } = arena.red;
      const xp = arena.red.experience;
      unit.takeDamage(1e9, 'true', arena.red.id, arena.context);
      expect(unit.isDead).toBe(true);
      expect(arena.red.gold).toBe(gold);
      expect(arena.red.cs).toBe(cs);
      expect(arena.red.experience).toBe(xp);
    });

    test("its last hit counts as its owner's: the gold, the creep score and the XP are the owner's", () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      const victim = arena.addMinion(TEAM_RED, p(60));
      const { gold, cs } = arena.blue;
      const xp = arena.blue.experience;
      victim.takeDamage(1e9, 'true', unit.id, arena.context);
      expect(victim.isDead).toBe(true);
      expect(arena.blue.gold).toBeGreaterThan(gold);
      expect(arena.blue.cs).toBe(cs + 1);
      expect(arena.blue.experience).toBeGreaterThan(xp);
    });

    test("killing a champion, the kill is its owner's", () => {
      const arena = ownerArena(p(60));
      const unit = summon(arena, p(30));
      const kills = arena.blue.kills;
      arena.red.takeDamage(1e9, 'true', unit.id, arena.context);
      expect(arena.red.isDead).toBe(true);
      expect(arena.blue.kills).toBe(kills + 1);
    });

    test('crumbling (absorbed, or its owner gone) is a death without a killer', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      unit.crumble(arena.context);
      expect(unit.isDead).toBe(true);
      expect(unit.shouldRemove()).toBe(true);
    });
  });

  describe('crowd control', () => {
    test('stunned it stands still', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      unit.applyEffect('stun', 1, arena.red.id);
      arena.blue.setMoveTarget(p(300));
      step(arena, 0.8);
      expect(unit.position.distanceTo(p(30))).toBeLessThan(1);
    });

    test('feared it runs from whoever scared it', () => {
      const arena = ownerArena(p(100));
      const unit = summon(arena, p(60));
      unit.applyEffect('fear', 1, arena.red.id);
      step(arena, 0.8);
      expect(unit.position.dot(ALONG)).toBeLessThan(60 - 30);
    });

    test('slowed it walks slower', () => {
      const arena = ownerArena();
      const slowed = summon(arena, p(30));
      const free = summon(arena, p(30, 40));
      slowed.applyEffect('slow_40', 2, arena.red.id);
      slowed.command({ kind: 'move', point: p(330) }, arena.context);
      free.command({ kind: 'move', point: p(330, 40) }, arena.context);
      step(arena, 1);
      expect(slowed.position.dot(ALONG) - 30).toBeLessThan((free.position.dot(ALONG) - 30) * 0.75);
    });
  });

  describe('what its owner can do to it', () => {
    /** How many attacks it starts on a dummy minion in `seconds` */
    function attacksIn(arena: TestArena, unit: ServerSummon, seconds: number): number {
      let attacks = 0;
      for (let i = 0; i < seconds / DT; i++) {
        arena.tickAll(DT);
        attacks += arena.context.flushEvents().filter(e => e.type === GameEventType.BASIC_ATTACK && e.data.entityId === unit.id).length;
      }
      return attacks;
    }

    test('a frenzy makes it attack faster for a while', () => {
      const arena = ownerArena();
      const calm = summon(arena, p(30));
      arena.addMinion(TEAM_RED, p(30 + 30), 'siege').health = 1e6;
      const calmAttacks = attacksIn(arena, calm, 4);
      const arena2 = ownerArena();
      const frenzied = summon(arena2, p(30));
      arena2.addMinion(TEAM_RED, p(30 + 30), 'siege').health = 1e6;
      frenzied.frenzyFor(1, 4);
      expect(attacksIn(arena2, frenzied, 4)).toBeGreaterThanOrEqual(calmAttacks + 2);
    });

    test('a charge makes it faster and hit harder, for a while', () => {
      const arena = ownerArena();
      const charged = summon(arena, p(30));
      const plain = summon(arena, p(30, 40));
      charged.chargeFor(0.5, 0.5, 1);
      charged.command({ kind: 'move', point: p(330) }, arena.context);
      plain.command({ kind: 'move', point: p(330, 40) }, arena.context);
      step(arena, 1);
      expect(charged.position.dot(ALONG) - 30).toBeGreaterThan((plain.position.dot(ALONG) - 30) * 1.3);

      const victim = arena.addMinion(TEAM_RED, charged.position.added(ALONG.scaled(30)));
      const health = victim.health;
      charged.chargeFor(0.5, 0.5, 2);
      charged.command({ kind: 'attack', targetId: victim.id }, arena.context);
      step(arena, STATS.attackWindup + 0.1);
      // 20 x 1.5, less the minion's magic resist
      expect(health - victim.health).toBeGreaterThan(STATS.attackDamage * 1.3);
    });

    test('held for a windup, it neither moves nor attacks', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      const enemy = arena.addMinion(TEAM_RED, p(60));
      unit.holdFor(0.6);
      arena.blue.setMoveTarget(p(300));
      const at = unit.position.clone();
      for (let i = 0; i < 0.55 / DT; i++) {
        arena.tickAll(DT);
        expect(arena.context.flushEvents().some(e => e.type === GameEventType.BASIC_ATTACK && e.data.entityId === unit.id)).toBe(false);
      }
      expect(unit.position.distanceTo(at)).toBeLessThan(1);
      expect(enemy.isDead).toBe(false);
    });

    test('it pays health only if it has more than the price', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      expect(unit.payHealth(100)).toBe(true);
      expect(unit.health).toBe(STATS.maxHealth - 100);
      expect(unit.payHealth(unit.health)).toBe(false);
      expect(unit.health).toBe(STATS.maxHealth - 100);
      expect(unit.isDead).toBe(false);
    });
  });

  describe('a dash (the colossus charging)', () => {
    test('it goes its distance along the line over its duration, whatever its orders', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(30));
      unit.command({ kind: 'move', point: p(-300) }, arena.context);
      let ended = 0;
      unit.startDash({ direction: ALONG, distance: 200, duration: 0.4, onEnd: () => ended++ });
      expect(unit.isDashing()).toBe(true);
      step(arena, 0.2);
      expect(unit.position.dot(ALONG)).toBeGreaterThan(30 + 80);
      expect(unit.position.dot(ALONG)).toBeLessThan(30 + 120);
      // (its last frame)
      step(arena, 0.2);
      expect(unit.position.dot(ALONG)).toBeCloseTo(230, 0);
      expect(unit.position.dot(ACROSS)).toBeCloseTo(0, 0);
      expect(unit.isDashing()).toBe(false);
      expect(ended).toBe(1);
    });

    test('each enemy it runs into is touched once; allies are not', () => {
      const arena = ownerArena();
      const unit = summon(arena, p(0));
      const enemy = arena.addMinion(TEAM_RED, p(100));
      const ally = arena.addMinion(TEAM_BLUE, p(140));
      const touched: string[] = [];
      unit.startDash({ direction: ALONG, distance: 200, duration: 0.4, touchRadius: 30, onTouch: entity => touched.push(entity.id) });
      step(arena, 0.5);
      expect(touched).toEqual([enemy.id]);
      expect(touched).not.toContain(ally.id);
    });

    test('carrying, the enemies it runs into end up in front of it where it stops', () => {
      const arena = ownerArena(p(100));
      const unit = summon(arena, p(0));
      const minion = arena.addMinion(TEAM_RED, p(60, 5));
      unit.startDash({ direction: ALONG, distance: 250, duration: 0.4, touchRadius: 30, carries: true });
      step(arena, 0.4);
      expect(unit.position.dot(ALONG)).toBeCloseTo(250, 0);
      expect(arena.red.position.dot(ALONG)).toBeGreaterThan(250);
      expect(arena.red.position.distanceTo(unit.position)).toBeLessThan(70);
      expect(minion.position.dot(ALONG)).toBeGreaterThan(250);
    });

    test("it doesn't go through walls", () => {
      const wall = findWallCrossing(30, 90);
      const arena = ownerArena();
      const unit = summon(arena, new Vector(wall.left - 60, wall.y));
      unit.startDash({ direction: new Vector(1, 0), distance: 300, duration: 0.4 });
      // The wall ends it early
      for (let i = 0; i < 24 && unit.isDashing(); i++) arena.tickAll(DT);
      expect(unit.isDashing()).toBe(false);
      expect(unit.position.x).toBeLessThan(wall.left);
      expect(arena.context.terrain.clearanceAt(unit.position.x, unit.position.y)).toBeGreaterThan(0);
    });
  });
});
