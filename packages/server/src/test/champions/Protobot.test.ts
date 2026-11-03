/**
 * Protobot 45 Champion Tests
 *
 * Protobot 45 - The Sentient Machine, a tank:
 * - Passive (Machine Learning): each time an enemy champion damages him (at
 *   most once a second) he gains armor and magic resist for a while, up to 6 times
 * - Q (Magnetism): a claw; a champion it catches is pulled to him, and he's shielded
 * - W (Hypercharge): a shield and a burst of speed
 * - E (Rocket Punch): damage, a knock-up, a small shield
 * - R (Overload): after a charge, a pulse: damage, silence, enemy shields broken
 */

import { describe, test, expect } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  EntityType,
  GameEventType,
  PROTOBOT_MACHINE,
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

const DT = 1 / 30;
const Q = getAbilityDefinition('protobot_q')!;
const W = getAbilityDefinition('protobot_w')!;
const E = getAbilityDefinition('protobot_e')!;
const R = getAbilityDefinition('protobot_r')!;

/** Open ground (the middle of the map has walls within 400): red's base, clear of its nexus (an obstacle) */
const O = new Vector(2075, -1950);
const at = (x: number, y: number) => new Vector(O.x + x, O.y + y);

/** Protobot (blue, at O) and Magnus (red), both at `level`, healthy and with full mana */
function protobotArena(redAt = at(120, 0), level = 6): TestArena {
  const arena = createTestArena({ blueChampion: 'protobot', redChampion: 'magnus', bluePosition: O, redPosition: redAt });
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

function tickFor(arena: TestArena, seconds: number): void {
  arena.tickFrames(Math.round(seconds / DT), DT);
}

function tickAllFor(arena: TestArena, seconds: number): void {
  arena.tickAllFrames(Math.round(seconds / DT), DT);
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
const lessons = (protobot: TestChampion) => protobot.passiveState.stacks;

// =============================================================================
// Passive: Machine Learning
// =============================================================================

describe('Protobot passive: Machine Learning', () => {
  /** Red hurts blue (as an ability would) */
  const hurt = (arena: TestArena, amount = 10) => arena.blue.takeDamage(amount, 'magic', arena.red.id, arena.context);

  test('an enemy champion damaging him teaches him a lesson: +3 armor and magic resist for 6 s', () => {
    const arena = protobotArena();
    const { armor, magicResist } = arena.blue.getStats();
    hurt(arena);
    arena.tick(DT);
    expect(lessons(arena.blue)).toBe(1);
    expect(arena.blue.passiveState.isActive).toBe(true);
    expect(arena.blue.getStats().armor).toBeCloseTo(armor + PROTOBOT_MACHINE.resistsPerLesson, 5);
    expect(arena.blue.getStats().magicResist).toBeCloseTo(magicResist + PROTOBOT_MACHINE.resistsPerLesson, 5);
  });

  test('one effect (one icon) holds both resists', () => {
    const arena = protobotArena();
    hurt(arena);
    const learning = arena.blue.getActiveEffects().filter(e => e.definitionId.startsWith('protobot_learning'));
    expect(learning.length).toBe(1);
  });

  test('at most one lesson a second', () => {
    const arena = protobotArena();
    hurt(arena);
    tickFor(arena, 0.5);
    hurt(arena);
    expect(lessons(arena.blue)).toBe(1);
    tickFor(arena, 0.6);
    hurt(arena);
    arena.tick(DT);
    expect(lessons(arena.blue)).toBe(2);
  });

  test('up to 6 lessons: +18 armor and magic resist', () => {
    const arena = protobotArena();
    const { armor, magicResist } = arena.blue.getStats();
    for (let i = 0; i < 9; i++) {
      hurt(arena);
      tickFor(arena, 1.05);
    }
    expect(lessons(arena.blue)).toBe(PROTOBOT_MACHINE.maxLessons);
    expect(arena.blue.getStats().armor).toBeCloseTo(armor + 18, 5);
    expect(arena.blue.getStats().magicResist).toBeCloseTo(magicResist + 18, 5);
  });

  test('a new lesson makes them all last 6 s from then; then they all go', () => {
    const arena = protobotArena();
    hurt(arena);
    tickFor(arena, 4);
    hurt(arena);
    tickFor(arena, 4);
    expect(lessons(arena.blue)).toBe(2);
    tickFor(arena, 2.2);
    expect(lessons(arena.blue)).toBe(0);
    expect(arena.blue.passiveState.isActive).toBe(false);
  });

  test('minions, towers and monsters teach him nothing', () => {
    const arena = protobotArena(at(600, 0));
    const minion = arena.addMinion(TEAM_RED, at(60, 0));
    const tower = arena.addTower(TEAM_RED, at(-200, 0));
    const monster = arena.addJungleCreature(at(0, 60));
    for (const source of [minion, tower, monster]) arena.blue.takeDamage(20, 'physical', source.id, arena.context);
    arena.tick(DT);
    expect(lessons(arena.blue)).toBe(0);
  });

  test('damage his shield soaks up still teaches him', () => {
    const arena = protobotArena();
    castFresh(arena, 'W');
    const health = arena.blue.health;
    hurt(arena, 5);
    expect(arena.blue.health).toBe(health);
    arena.tick(DT);
    expect(lessons(arena.blue)).toBe(1);
  });

  test('a basic attack from an enemy champion teaches him', () => {
    const arena = protobotArena(at(150, 0));
    arena.red.setAttackTarget(arena.blue.id);
    // (Magnus's attacks are projectiles: tick them too)
    for (let t = 0; t < 3 && lessons(arena.blue) === 0; t += DT) arena.tickAll(DT);
    expect(lessons(arena.blue)).toBe(1);
  });
});

// =============================================================================
// Q: Magnetism
// =============================================================================

describe('Protobot Q: Magnetism', () => {
  const clawsOf = (arena: TestArena) => arena.context.getAllEntities()
    .filter(e => e.entityType === EntityType.PROJECTILE && !e.isDead);

  /** Throw the claw at red and let it fly */
  function claw(arena: TestArena, aim?: Vector, seconds = 1) {
    const result = castFresh(arena, 'Q', { targetPosition: aim ?? arena.red.position.clone() });
    tickAllFor(arena, seconds);
    return result;
  }

  test('the first enemy hit takes 70 + 60% AP magic (rank 1)', () => {
    const arena = protobotArena(at(300, 0));
    give(arena.blue, 'cinder_rod');
    const ap = arena.blue.getStats().abilityPower;
    expect(castFresh(arena, 'Q', { targetPosition: arena.red.position.clone() }).success).toBe(true);
    const hits: number[] = [];
    for (let t = 0; t < 1; t += DT) {
      arena.tickAll(DT);
      hits.push(...hitsOn(arena, arena.red));
    }
    expect(hits.length).toBe(1);
    expect(hits[0]).toBeCloseTo(magicOn(arena.red, 70 + 0.6 * ap), 3);
  });

  test('a champion caught is pulled to just in front of him, stunned on the way', () => {
    const arena = protobotArena(at(300, 0));
    castFresh(arena, 'Q', { targetPosition: arena.red.position.clone() });
    let stunnedInFlight = false;
    for (let t = 0; t < 1.5; t += DT) {
      arena.tickAll(DT);
      if (arena.red.forcedMovement) stunnedInFlight ||= arena.red.ccStatus.isStunned;
    }
    expect(stunnedInFlight).toBe(true);
    const gap = arena.red.position.distanceTo(arena.blue.position) - arena.red.getRadius() - arena.blue.getRadius();
    expect(gap).toBeCloseTo(PROTOBOT_MACHINE.pullGap, 0);
    expect(arena.red.ccStatus.isStunned).toBe(false);
  });

  test('catching a champion shields him: 40 at rank 1, 120 at rank 5, for 3 s', () => {
    const arena = protobotArena(at(300, 0));
    claw(arena);
    expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(PROTOBOT_MACHINE.catchShield[0], 3);
    tickFor(arena, PROTOBOT_MACHINE.catchShieldDuration);
    expect(arena.blue.getTotalShieldAmount()).toBe(0);

    const maxed = protobotArena(at(300, 0));
    rankUp(maxed.blue, 'Q', 5);
    claw(maxed);
    expect(maxed.blue.getTotalShieldAmount()).toBeCloseTo(PROTOBOT_MACHINE.catchShield[4], 3);
  });

  test('the pull is announced for the chain (protobot_q_pull)', () => {
    const arena = protobotArena(at(300, 0));
    castFresh(arena, 'Q', { targetPosition: arena.red.position.clone() });
    const events: string[] = [];
    for (let t = 0; t < 1; t += DT) {
      arena.tickAll(DT);
      for (const e of arena.context.flushEvents()) if (e.type === GameEventType.ABILITY_CAST) events.push(e.data.abilityId as string);
    }
    expect(events).toContain('protobot_q_pull');
  });

  test('a minion in front takes the claw: hurt, not pulled, no shield; the champion behind is safe', () => {
    const arena = protobotArena(at(350, 0));
    const minion = arena.addMinion(TEAM_RED, at(150, 0));
    claw(arena, at(400, 0));
    expect(minion.health).toBeLessThan(minion.maxHealth);
    // (It walks at him after, on its own)
    expect(minion.activeEffects.some(e => e.definitionId === 'stun')).toBe(false);
    expect(arena.blue.getTotalShieldAmount()).toBe(0);
    expect(arena.red.health).toBe(arena.red.maxHealth);
  });

  test('a jungle monster is hit, not pulled', () => {
    const arena = protobotArena(at(0, 600));
    const monster = arena.addJungleCreature(at(200, 0));
    let pulled = false;
    castFresh(arena, 'Q', { targetPosition: at(300, 0) });
    for (let t = 0; t < 1; t += DT) {
      arena.tickAll(DT);
      pulled ||= arena.context.flushEvents().some(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'protobot_q_pull');
    }
    expect(monster.health).toBeLessThan(monster.maxHealth);
    expect(pulled).toBe(false);
    expect(arena.blue.getTotalShieldAmount()).toBe(0);
  });

  test('it flies through allies and towers', () => {
    const arena = protobotArena(at(350, 0));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(120, 0));
    const tower = arena.addTower(TEAM_RED, at(230, 60));
    const struck = new Set<string>();
    castFresh(arena, 'Q', { targetPosition: at(400, 0) });
    for (let t = 0; t < 1; t += DT) {
      arena.tickAll(DT);
      for (const e of arena.context.flushEvents()) {
        if (e.type === GameEventType.DAMAGE && e.data.sourceId === arena.blue.id) struck.add(e.data.entityId as string);
      }
    }
    // (The tower shoots at them meanwhile: only the claw's hits count)
    expect(struck.has(ally.id)).toBe(false);
    expect(struck.has(tower.id)).toBe(false);
    expect(struck.has(arena.red.id)).toBe(true);
  });

  // Regression (G1): the claw stopped on zones (and blossoms)
  test("it flies through zones on the way (an enemy's lava or cloud) and catches the champion past them", () => {
    const arena = protobotArena(at(350, 0));
    arena.context.addEntity(new ServerZone({
      id: 'cloud', position: at(170, 0), side: TEAM_RED, radius: 80, duration: 5,
      sourceId: arena.red.id, abilityId: 'zhakrul_w', zoneType: 'slow',
    }));
    claw(arena, at(400, 0));
    expect(arena.red.health).toBeLessThan(arena.red.maxHealth);
    expect(arena.context.getEntity('cloud')?.isDead).toBe(false);
  });

  test('470 reach: a champion past it is not caught', () => {
    const arena = protobotArena(at(Q.range! + arena_r() + 30, 0));
    claw(arena, at(1000, 0));
    expect(arena.red.health).toBe(arena.red.maxHealth);
    expect(clawsOf(arena).length).toBe(0);
  });

  test('the aimed cast time; 90 mana; 18 s cooldown (12 s at rank 5)', () => {
    const arena = protobotArena(at(300, 0));
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'Q', { targetPosition: at(300, 0), casting: true });
    expect(arena.blue.isCasting()).toBe(true);
    expect(clawsOf(arena).length).toBe(0);
    tickFor(arena, 0.3);
    expect(clawsOf(arena).length).toBe(1);
    expect(arena.blue.resource).toBeLessThanOrEqual(mana - 90 + 1);
    expect(arena.blue.getAbilityCooldown('Q')).toBeGreaterThan(17.5);

    const maxed = protobotArena(at(300, 0));
    rankUp(maxed.blue, 'Q', 5);
    maxed.castAbility(maxed.blue, 'Q', { targetPosition: at(300, 0) });
    expect(maxed.blue.getAbilityCooldown('Q')).toBeCloseTo(12, 5);
  });

  test("dead before the claw lands, he doesn't pull", () => {
    const arena = protobotArena(at(400, 0));
    castFresh(arena, 'Q', { targetPosition: arena.red.position.clone() });
    arena.tickAll(DT);
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    tickAllFor(arena, 1);
    expect(arena.red.forcedMovement).toBeNull();
    expect(arena.red.position.distanceTo(at(400, 0))).toBeLessThan(1);
  });

  test("a champion caught in his face isn't moved, but he's still shielded", () => {
    const arena = protobotArena(at(0, 0));
    arena.red.position.setFrom(at(arena.blue.getRadius() + arena.red.getRadius() + 10, 0));
    claw(arena, at(300, 0));
    expect(arena.red.health).toBeLessThan(arena.red.maxHealth);
    expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
  });
});

/** A Magnus's radius, for placing it at the claw's reach */
function arena_r(): number {
  return CHAMPION_DEFINITIONS.magnus.collision?.type === 'circle' ? CHAMPION_DEFINITIONS.magnus.collision.radius : 25;
}

// =============================================================================
// W: Hypercharge
// =============================================================================

describe('Protobot W: Hypercharge', () => {
  test('a shield of 60 + 6% max health for 3 s (rank 1)', () => {
    const arena = protobotArena(at(600, 0));
    castFresh(arena, 'W');
    expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(60 + 0.06 * arena.blue.maxHealth, 3);
    tickFor(arena, W.shield!.duration! - 0.2);
    expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
    tickFor(arena, 0.4);
    expect(arena.blue.getTotalShieldAmount()).toBe(0);
  });

  test('rank 5: 200 + 6% max health; 12 s cooldown', () => {
    const arena = protobotArena(at(600, 0));
    rankUp(arena.blue, 'W', 5);
    arena.castAbility(arena.blue, 'W');
    expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(200 + 0.06 * arena.blue.maxHealth, 3);
    expect(arena.blue.getAbilityCooldown('W')).toBeCloseTo(12, 5);
  });

  test('30% movement speed for 2 s', () => {
    const arena = protobotArena(at(600, 0));
    const speed = arena.blue.getStats().movementSpeed;
    castFresh(arena, 'W');
    arena.blue.invalidateStats();
    expect(arena.blue.getStats().movementSpeed).toBeGreaterThan(speed * 1.2);
    tickFor(arena, W.effectDuration! + 0.1);
    expect(arena.blue.hasEffect('speed_30')).toBe(false);
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(speed, 3);
  });

  test('instant, 60 mana, 16 s cooldown; silenced or stunned it fails', () => {
    const arena = protobotArena(at(600, 0));
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'W', { casting: true });
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBeCloseTo(mana - 60, 5);
    expect(arena.blue.getAbilityCooldown('W')).toBeCloseTo(16, 5);
    for (const cc of ['silence', 'stun']) {
      const other = protobotArena(at(600, 0));
      other.blue.applyEffect(cc, 1, other.red.id);
      expect(other.castAbility(other.blue, 'W').success).toBe(false);
      expect(other.blue.getTotalShieldAmount()).toBe(0);
    }
  });

  test('rooted he can still hypercharge (no movement of its own)', () => {
    const arena = protobotArena(at(600, 0));
    arena.blue.applyEffect('root', 1, arena.red.id);
    expect(castFresh(arena, 'W').success).toBe(true);
  });
});

// =============================================================================
// E: Rocket Punch
// =============================================================================

describe('Protobot E: Rocket Punch', () => {
  const punch = (arena: TestArena, target: ServerEntity = arena.red) => castFresh(arena, 'E', { targetId: target.id });

  test('rank 1: 60 + 50% AP magic, knocked up 1 s, and a 30 shield on him for 2 s', () => {
    const arena = protobotArena();
    give(arena.blue, 'cinder_rod');
    const ap = arena.blue.getStats().abilityPower;
    expect(punch(arena).success).toBe(true);
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 60 + 0.5 * ap), 3);
    const knockup = arena.red.getActiveEffects().find(e => e.definitionId === 'knockup')!;
    expect(knockup.totalDuration).toBeCloseTo(E.effectDuration!, 5);
    expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(30, 3);
    tickFor(arena, E.shield!.duration! + 0.1);
    expect(arena.blue.getTotalShieldAmount()).toBe(0);
  });

  test('rank 5: 220 and a 90 shield; 8 s cooldown', () => {
    const arena = protobotArena();
    rankUp(arena.blue, 'E', 5);
    arena.castAbility(arena.blue, 'E', { targetId: arena.red.id });
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 220), 3);
    expect(arena.blue.getTotalShieldAmount()).toBeCloseTo(90, 3);
    expect(arena.blue.getAbilityCooldown('E')).toBeCloseTo(8, 5);
  });

  test('the aimed cast time; 50 mana; 10 s cooldown', () => {
    const arena = protobotArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'E', { targetId: arena.red.id, casting: true });
    expect(arena.blue.isCasting()).toBe(true);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    tickFor(arena, 0.3);
    expect(hitsOn(arena, arena.red).length).toBe(1);
    expect(arena.blue.resource).toBeLessThanOrEqual(mana - 50 + 1);
    expect(arena.blue.getAbilityCooldown('E')).toBeGreaterThan(9.5);
  });

  test('range 170: just inside it punches, just outside it fails and spends nothing', () => {
    const inside = protobotArena(at(E.range!, 0));
    expect(punch(inside).success).toBe(true);
    const outside = protobotArena(at(E.range! + 2, 0));
    const mana = outside.blue.resource;
    expect(outside.castAbility(outside.blue, 'E', { targetId: outside.red.id }).failReason).toBe('out_of_range');
    expect(outside.blue.resource).toBe(mana);
  });

  test('a target that dies in the cast time: nothing spent, no shield', () => {
    const arena = protobotArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'E', { targetId: arena.red.id, casting: true });
    arena.red.takeDamage(1e9, 'true');
    tickFor(arena, 0.4);
    expect(arena.blue.getAbilityCooldown('E')).toBe(0);
    expect(arena.blue.resource).toBeGreaterThanOrEqual(mana - 0.01);
    expect(arena.blue.getTotalShieldAmount()).toBe(0);
  });

  test('a punch that kills: no knock-up on the corpse, still the shield', () => {
    const arena = protobotArena();
    arena.red.setHealth(5);
    punch(arena);
    expect(arena.red.isDead).toBe(true);
    expect(arena.red.hasEffect('knockup')).toBe(false);
    expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
  });

  test('minions and monsters can be punched; towers and allies not', () => {
    const arena = protobotArena(at(600, 0));
    const minion = arena.addMinion(TEAM_RED, at(80, 0));
    expect(punch(arena, minion).success).toBe(true);
    expect(minion.health).toBeLessThan(minion.maxHealth);
    const monster = arena.addJungleCreature(at(0, 80));
    expect(punch(arena, monster).success).toBe(true);
    const tower = arena.addTower(TEAM_RED, at(-100, 0));
    expect(punch(arena, tower).failReason).toBe('invalid_target');
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(0, -80));
    expect(punch(arena, ally).failReason).toBe('invalid_target');
  });
});

// =============================================================================
// R: Overload
// =============================================================================

describe('Protobot R: Overload', () => {
  test('after a 0.5 s charge: 150 + 70% AP magic and a 1.5 s silence around him (rank 1)', () => {
    const arena = protobotArena(at(200, 0));
    give(arena.blue, 'cinder_rod');
    const ap = arena.blue.getStats().abilityPower;
    expect(castFresh(arena, 'R', { windup: true }).success).toBe(true);
    tickFor(arena, R.aoeDelay! - 0.1);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    tickFor(arena, 0.15);
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 150 + 0.7 * ap), 3);
    const silence = arena.red.getActiveEffects().find(e => e.definitionId === 'silence')!;
    expect(silence.totalDuration).toBeCloseTo(R.effectDuration!, 5);
    expect(arena.red.ccStatus.canCast).toBe(false);
  });

  test('rank 3: 350; cooldown 70 s; 100 mana; instant to cast', () => {
    const arena = protobotArena(at(200, 0));
    rankUp(arena.blue, 'R', 3);
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'R', { casting: true });
    expect(arena.blue.isCasting()).toBe(false);
    expect(hitsOn(arena, arena.red)[0]).toBeCloseTo(magicOn(arena.red, 350), 3);
    expect(arena.blue.resource).toBeCloseTo(mana - 100, 5);
    expect(arena.blue.getAbilityCooldown('R')).toBeCloseTo(70, 5);
  });

  test("it breaks enemy champions' shields before the damage", () => {
    const arena = protobotArena(at(200, 0));
    arena.red.grantShield(500, 5, 'test');
    const health = arena.red.health;
    castFresh(arena, 'R');
    expect(arena.red.getTotalShieldAmount()).toBe(0);
    expect(arena.red.health).toBeLessThan(health);
  });

  test("allies keep their shields and aren't hurt or silenced; his own shield stays", () => {
    const arena = protobotArena(at(600, 0));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, at(100, 0));
    ally.grantShield(100, 5, 'test');
    castFresh(arena, 'W');
    castFresh(arena, 'R');
    expect(ally.getTotalShieldAmount()).toBe(100);
    expect(ally.health).toBe(ally.maxHealth);
    expect(ally.hasEffect('silence')).toBe(false);
    expect(arena.blue.getTotalShieldAmount()).toBeGreaterThan(0);
  });

  test('280 around him, counting the body: just inside hit, just outside missed', () => {
    const inside = protobotArena(at(1000, 0));
    inside.red.position.setFrom(at(R.aoeRadius! + inside.red.getRadius() - 1, 0));
    castFresh(inside, 'R');
    expect(hitsOn(inside, inside.red).length).toBe(1);
    const outside = protobotArena(at(1000, 0));
    outside.red.position.setFrom(at(R.aoeRadius! + outside.red.getRadius() + 2, 0));
    castFresh(outside, 'R');
    expect(hitsOn(outside, outside.red).length).toBe(0);
  });

  test('the pulse is announced (protobot_r_pulse)', () => {
    const arena = protobotArena(at(200, 0));
    castFresh(arena, 'R', { windup: true });
    tickFor(arena, R.aoeDelay! + 0.05);
    expect(arena.context.flushEvents().some(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'protobot_r_pulse')).toBe(true);
  });

  test('minions and monsters are hit; towers not', () => {
    const arena = protobotArena(at(0, 700));
    const minion = arena.addMinion(TEAM_RED, at(100, 0));
    const monster = arena.addJungleCreature(at(-100, 0));
    const tower = arena.addTower(TEAM_RED, at(0, -150));
    const towerHealth = tower.health;
    castFresh(arena, 'R');
    expect(minion.health).toBeLessThan(minion.maxHealth);
    expect(monster.health).toBeLessThan(monster.maxHealth);
    expect(tower.health).toBe(towerHealth);
  });

  test('killed during the charge: no pulse', () => {
    const arena = protobotArena(at(200, 0));
    castFresh(arena, 'R', { windup: true });
    arena.blue.takeDamage(1e9, 'true', arena.red.id, arena.context);
    arena.context.flushEvents();
    tickFor(arena, R.aoeDelay! + 0.1);
    expect(hitsOn(arena, arena.red).length).toBe(0);
    expect(arena.red.hasEffect('silence')).toBe(false);
  });

  test('stunned during the charge, the pulse still goes off (a design choice)', () => {
    const arena = protobotArena(at(200, 0));
    castFresh(arena, 'R', { windup: true });
    arena.blue.applyEffect('stun', 1, arena.red.id);
    tickFor(arena, R.aoeDelay! + 0.1);
    expect(hitsOn(arena, arena.red).length).toBe(1);
  });

  test('the pulse goes off around him where he is when it does', () => {
    const arena = protobotArena(at(-400, 0));
    castFresh(arena, 'R', { windup: true });
    arena.blue.position.setFrom(at(-250, 0));
    tickFor(arena, R.aoeDelay! + 0.1);
    expect(hitsOn(arena, arena.red).length).toBe(1);
  });

  test("silenced or stunned he can't overload", () => {
    for (const cc of ['silence', 'stun']) {
      const arena = protobotArena(at(200, 0));
      arena.blue.applyEffect(cc, 1, arena.red.id);
      const mana = arena.blue.resource;
      expect(arena.castAbility(arena.blue, 'R').success).toBe(false);
      expect(arena.blue.resource).toBe(mana);
    }
  });
});
