/**
 * Elora Champion Tests
 *
 * Elora - The Master Hunter, a marksman with the longest bow.
 * - Passive: Proficient Archer - every third arrow in a row on the same
 *   target strikes a weak point for bonus physical damage (by her level
 *   and attack damage, not the arrow's crit)
 * - Q: Poison Arrow - the next arrow deals bonus damage, slows and poisons
 * - W: Pinning Arrow - a skillshot that roots the first enemy hit
 * - E: Dexterity - a roll; she (only she) attacks faster after it
 * - R: Arrow Barrage - after a moment, a long lane of arrows, where it was cast
 */

import { describe, test, expect } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  EntityType,
  TEAM_BLUE,
  TEAM_RED,
  ELORA_HUNT,
  ELORA_POISON,
  calculateAbilityValue,
  getAbilityDefinition,
  type DamageType,
} from '@siege/shared';
import { createTestArena, type TestArena, type TestChampion } from '../ServerTestUtils';
import type { ServerEntity } from '../../simulation/ServerEntity';
import { eloraHooks } from '../../abilities/handlers/elora/EloraHooks';

const DT = 1 / 60;
const Q = getAbilityDefinition('elora_q')!;
const W = getAbilityDefinition('elora_w')!;
const E = getAbilityDefinition('elora_e')!;
const R = getAbilityDefinition('elora_r')!;

interface Hit { amount: number; type: DamageType; sourceId?: string }

/** Record every damage instance an entity is dealt (before its resistances) */
function recordHits(entity: ServerEntity): Hit[] {
  const hits: Hit[] = [];
  const takeDamage = entity.takeDamage.bind(entity);
  entity.takeDamage = ((amount, type, sourceId, context) => {
    hits.push({ amount, type, sourceId });
    return takeDamage(amount, type, sourceId, context);
  }) as typeof entity.takeDamage;
  return hits;
}

/** Step the champions and projectiles only (minions stay where the test put them) */
function step(arena: TestArena, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    arena.tick(DT);
    for (const entity of arena.context.getAllEntities()) {
      if (entity.entityType === EntityType.PROJECTILE) entity.update(DT, arena.context);
    }
  }
}

/** Elora (level 6, every ability rank 1) against Magnus at her range, both full */
function eloraArena(redAt = new Vector(200, 0)): TestArena {
  const arena = createTestArena({ blueChampion: 'elora', redChampion: 'magnus', bluePosition: new Vector(0, 0), redPosition: redAt });
  // (Leveling up raises max health, not health)
  arena.blue.setLevel(6);
  arena.red.setLevel(6);
  arena.red.setHealth(arena.red.maxHealth);
  arena.blue.setResource(arena.blue.maxResource);
  return arena;
}

const adOf = (champion: TestChampion) => champion.getStats().attackDamage;

/** Every hit's critical: crit chance 100% */
function alwaysCrit(champion: TestChampion): void {
  champion.addModifier({ source: 'test-crit', flat: { critChance: 1 } });
}

/** An arrow's damage: her attack damage, doubled by a crit */
const arrowDamage = (champion: TestChampion, crit = false) => adOf(champion) * (crit ? champion.getStats().critDamage : 1);

/**
 * Shoot `arrows` basic attacks at a target (counted by their damage, the
 * arrow's) and stop; returns the hits since the call.
 */
function shoot(arena: TestArena, target: ServerEntity, hits: Hit[], arrows: number, arrow: number): Hit[] {
  arena.context.getFogOfWar().updateVision(arena.context, 1);
  const before = hits.length;
  const landed = () => hits.slice(before).filter(hit => hit.type === 'physical' && Math.abs(hit.amount - arrow) < 1e-6).length;
  arena.blue.setAttackTarget(target.id);
  for (let t = 0; t < 2 * arrows + 2 && landed() < arrows; t += DT) step(arena, DT);
  arena.blue.stop();
  return hits.slice(before);
}

/** The weak point's bonus for her level and attack damage */
const weakPoint = (champion: TestChampion) =>
  ELORA_HUNT.weakPointBase + ELORA_HUNT.weakPointPerLevel * champion.level + ELORA_HUNT.weakPointAdRatio * adOf(champion);

/** An arrow hitting (her hook, as a landing arrow calls it) */
const arrowHits = (arena: TestArena, target: ServerEntity) =>
  eloraHooks.onRangedAttackHit!(arena.blue, target, { attackDamage: adOf(arena.blue), abilityPower: 0 }, arena.context);

// =============================================================================
// Passive: Proficient Archer
// =============================================================================

describe('Elora passive - Proficient Archer', () => {
  test('her bow reaches farther than any other champion', () => {
    const ranges = Object.values(CHAMPION_DEFINITIONS).filter(def => def.id !== 'elora').map(def => def.baseStats.attackRange);
    expect(CHAMPION_DEFINITIONS.elora.baseStats.attackRange).toBeGreaterThan(Math.max(...ranges));
  });

  test('the third arrow in a row on a target strikes a weak point: 20 + 4 per level + 40% AD bonus physical damage', () => {
    const arena = eloraArena();
    const hits = recordHits(arena.red);
    const arrow = arrowDamage(arena.blue);
    const shot = shoot(arena, arena.red, hits, 3, arrow);
    expect(shot.length).toBe(4);
    expect(shot.slice(0, 3).every(hit => hit.amount === arrow)).toBe(true);
    expect(shot[3].type).toBe('physical');
    expect(shot[3].amount).toBeCloseTo(weakPoint(arena.blue), 6);
  });

  test("a critical arrow doesn't raise the weak point: it scales with her attack damage, not the crit", () => {
    const arena = eloraArena();
    alwaysCrit(arena.blue);
    const hits = recordHits(arena.red);
    const arrow = arrowDamage(arena.blue, true);
    const shot = shoot(arena, arena.red, hits, 3, arrow);
    expect(shot.length).toBe(4);
    expect(shot[2].amount).toBeCloseTo(2 * adOf(arena.blue), 6);
    expect(shot[3].amount).toBeCloseTo(weakPoint(arena.blue), 6);
  });

  test('her count shows as the passive stacks (0, 1, 2, then 0 after the weak point)', () => {
    const arena = eloraArena();
    const stacks: number[] = [];
    for (let i = 0; i < 4; i++) {
      arrowHits(arena, arena.red);
      eloraHooks.updatePassiveState!(arena.blue, arena.context);
      stacks.push(arena.blue.passiveState.stacks);
    }
    expect(stacks).toEqual([1, 2, 0, 1]);
  });

  test('another target in between starts the count over', () => {
    const arena = eloraArena();
    const minion = arena.addMinion(TEAM_RED, new Vector(150, 100));
    const hits = recordHits(arena.red);
    arrowHits(arena, arena.red);
    arrowHits(arena, arena.red);
    arrowHits(arena, minion);
    arrowHits(arena, arena.red);
    arrowHits(arena, arena.red);
    expect(hits).toEqual([]);
    arrowHits(arena, arena.red);
    expect(hits.length).toBe(1);
  });

  test('the weak point grows with her level', () => {
    const arena = eloraArena();
    const hits = recordHits(arena.red);
    for (const level of [1, 18]) {
      arena.blue.setLevel(level);
      for (let i = 0; i < 3; i++) arrowHits(arena, arena.red);
    }
    expect(hits.length).toBe(2);
    expect(hits[1].amount - hits[0].amount).toBeCloseTo(ELORA_HUNT.weakPointPerLevel * 17 + ELORA_HUNT.weakPointAdRatio * (adOf(arena.blue) - hitsAdAt1(arena)), 6);
  });

  test('it strikes towers too (design)', () => {
    const arena = eloraArena(new Vector(3000, 3000));
    const tower = arena.addTower(TEAM_RED, new Vector(200, 0));
    const hits = recordHits(tower);
    for (let i = 0; i < 3; i++) arrowHits(arena, tower);
    expect(hits.length).toBe(1);
    expect(hits[0].amount).toBeCloseTo(weakPoint(arena.blue), 6);
  });

  test("a target the third arrow killed isn't struck again", () => {
    const arena = eloraArena();
    arrowHits(arena, arena.red);
    arrowHits(arena, arena.red);
    arena.red.takeDamage(1e9, 'true');
    const hits = recordHits(arena.red);
    arrowHits(arena, arena.red);
    expect(hits).toEqual([]);
    expect(arena.blue.passiveState.customData).toMatchObject({ aimCount: 0 });
  });

  test('the arrow that will strike a weak point is drawn as elora_weak_auto; a poisoned one as elora_poison_auto', () => {
    const arena = eloraArena();
    const type = () => eloraHooks.basicAttackProjectileType!(arena.blue, arena.red);
    expect(type()).toBeUndefined();
    arrowHits(arena, arena.red);
    arrowHits(arena, arena.red);
    expect(type()).toBe('elora_weak_auto');
    arena.castAbility(arena.blue, 'Q');
    expect(type()).toBe('elora_poison_auto');
  });
});

/** Her attack damage at level 1 (for the weak point's growth) */
function hitsAdAt1(arena: TestArena): number {
  const level = arena.blue.level;
  arena.blue.setLevel(1);
  const ad = adOf(arena.blue);
  arena.blue.setLevel(level);
  return ad;
}

// =============================================================================
// Q: Poison Arrow
// =============================================================================

describe('Elora Q - Poison Arrow', () => {
  const bonus = (arena: TestArena, rank: number) => calculateAbilityValue(Q.damage!.scaling, rank, { attackDamage: adOf(arena.blue) });
  const poison = (arena: TestArena, rank: number) => calculateAbilityValue(ELORA_POISON, rank, { attackDamage: adOf(arena.blue) });

  test('cast at once on herself: the arrow is nocked for 4 s and her attack is ready again', () => {
    const arena = eloraArena();
    const hits = recordHits(arena.red);
    shoot(arena, arena.red, hits, 1, arrowDamage(arena.blue));
    expect(arena.blue.basicAttacks.cooldownRemaining).toBeGreaterThan(0);
    expect(arena.castAbility(arena.blue, 'Q').success).toBe(true);
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.getEffect('elora_poison_arrow')!.totalDuration).toBe(Q.effectDuration!);
    expect(arena.blue.basicAttacks.cooldownRemaining).toBe(0);
  });

  test('the poisoned arrow deals 20 + 30% AD bonus physical damage at rank 1, slows by 20% and poisons, for 3 s', () => {
    const arena = eloraArena();
    const speed = arena.red.getStats().movementSpeed;
    arena.castAbility(arena.blue, 'Q');
    const hits = recordHits(arena.red);
    const shot = shoot(arena, arena.red, hits, 1, arrowDamage(arena.blue));
    expect(shot.length).toBe(2);
    expect(shot[1].type).toBe('physical');
    expect(shot[1].amount).toBeCloseTo(bonus(arena, 1), 6);
    expect(arena.red.getEffect('slow_20')!.totalDuration).toBe(ELORA_HUNT.poisonDuration);
    expect(arena.red.getEffect('elora_venom')!.totalDuration).toBe(ELORA_HUNT.poisonDuration);
    expect(arena.red.getStats().movementSpeed).toBeCloseTo(speed * 0.8, 6);
    expect(arena.blue.hasEffect('elora_poison_arrow')).toBe(false);
  });

  test("a critical poisoned arrow doesn't raise the bonus damage: it scales with her attack damage, not the crit", () => {
    const arena = eloraArena();
    alwaysCrit(arena.blue);
    arena.castAbility(arena.blue, 'Q');
    const hits = recordHits(arena.red);
    const shot = shoot(arena, arena.red, hits, 1, arrowDamage(arena.blue, true));
    expect(shot.length).toBe(2);
    expect(shot[1].amount).toBeCloseTo(bonus(arena, 1), 6);
  });

  test('the poison deals 20 + 30% AD magic damage over 3 s, in 3 ticks', () => {
    const arena = eloraArena();
    arena.castAbility(arena.blue, 'Q');
    const hits = recordHits(arena.red);
    shoot(arena, arena.red, hits, 1, arrowDamage(arena.blue));
    step(arena, ELORA_HUNT.poisonDuration + 0.1);
    const ticks = hits.filter(hit => hit.type === 'magic');
    expect(ticks.length).toBe(ELORA_HUNT.poisonTicks);
    expect(ticks.reduce((sum, hit) => sum + hit.amount, 0)).toBeCloseTo(poison(arena, 1), 6);
  });

  test('at rank 5: 100 + 30% AD bonus, 80 + 30% AD poison', () => {
    const arena = eloraArena();
    arena.blue.setLevel(18);
    arena.blue.maxAbility('Q');
    arena.castAbility(arena.blue, 'Q');
    const hits = recordHits(arena.red);
    const shot = shoot(arena, arena.red, hits, 1, arrowDamage(arena.blue));
    expect(shot[1].amount).toBeCloseTo(100 + 0.3 * adOf(arena.blue), 6);
    step(arena, ELORA_HUNT.poisonDuration + 0.1);
    const ticks = hits.filter(hit => hit.type === 'magic');
    expect(ticks.reduce((sum, hit) => sum + hit.amount, 0)).toBeCloseTo(80 + 0.3 * adOf(arena.blue), 6);
  });

  test('cleansed, the poison stops ticking', () => {
    const arena = eloraArena();
    arena.castAbility(arena.blue, 'Q');
    const hits = recordHits(arena.red);
    shoot(arena, arena.red, hits, 1, arrowDamage(arena.blue));
    arena.red.cleanse();
    step(arena, ELORA_HUNT.poisonDuration + 0.1);
    expect(hits.filter(hit => hit.type === 'magic')).toEqual([]);
  });

  test('one arrow only: the next one is plain', () => {
    const arena = eloraArena();
    arena.castAbility(arena.blue, 'Q');
    const hits = recordHits(arena.red);
    shoot(arena, arena.red, hits, 1, arrowDamage(arena.blue));
    step(arena, 1.5);
    const second = shoot(arena, arena.red, hits, 1, arrowDamage(arena.blue)).filter(hit => hit.type === 'physical');
    expect(second.length).toBe(1);
  });

  test('unused, it is gone after 4 s', () => {
    const arena = eloraArena(new Vector(3000, 3000));
    arena.castAbility(arena.blue, 'Q');
    step(arena, Q.effectDuration! + 0.1);
    expect(arena.blue.hasEffect('elora_poison_arrow')).toBe(false);
  });

  test('a poisoned arrow on a minion poisons and slows it too', () => {
    const arena = eloraArena(new Vector(3000, 3000));
    const minion = arena.addMinion(TEAM_RED, new Vector(180, 0));
    arena.castAbility(arena.blue, 'Q');
    const hits = recordHits(minion);
    shoot(arena, minion, hits, 1, arrowDamage(arena.blue));
    expect(minion.activeEffects.map(effect => effect.definitionId)).toEqual(expect.arrayContaining(['slow_20', 'elora_venom']));
    step(arena, 1.1);
    expect(hits.some(hit => hit.type === 'magic')).toBe(true);
  });

  test('it costs 30 mana; its cooldown is 7 s at rank 1 and 5 s at rank 5', () => {
    const arena = eloraArena(new Vector(3000, 3000));
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'Q');
    expect(arena.blue.resource).toBe(mana - Q.manaCost![0]);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(Q.cooldown![0]);
    arena.blue.setLevel(18);
    arena.blue.maxAbility('Q');
    arena.blue.resetCooldowns();
    arena.castAbility(arena.blue, 'Q');
    expect(arena.blue.getAbilityCooldown('Q')).toBe(Q.cooldown![4]);
  });
});

// =============================================================================
// W: Pinning Arrow
// =============================================================================

describe('Elora W - Pinning Arrow', () => {
  const arrowAt = (arena: TestArena, at: Vector, options: { casting?: boolean } = {}) =>
    arena.castAbility(arena.blue, 'W', { targetPosition: at, ...options });

  test('the first enemy hit takes 60 + 70% AD physical damage and is rooted for 1.75 s', () => {
    const arena = eloraArena(new Vector(300, 0));
    const hits = recordHits(arena.red);
    expect(arrowAt(arena, new Vector(460, 0)).success).toBe(true);
    step(arena, 0.6);
    expect(hits.length).toBe(1);
    expect(hits[0].type).toBe('physical');
    expect(hits[0].amount).toBeCloseTo(calculateAbilityValue(W.damage!.scaling, 1, { attackDamage: adOf(arena.blue) }), 6);
    expect(arena.red.getEffect('root')!.totalDuration).toBe(W.effectDuration!);
    expect(arena.red.ccStatus.canMove).toBe(false);
  });

  test('the root ends after its 1.75 s', () => {
    const arena = eloraArena(new Vector(300, 0));
    arrowAt(arena, new Vector(460, 0));
    step(arena, 0.6);
    expect(arena.red.ccStatus.canMove).toBe(false);
    step(arena, W.effectDuration!);
    expect(arena.red.ccStatus.canMove).toBe(true);
  });

  test('at rank 5 it deals 220 + 70% AD', () => {
    const arena = eloraArena(new Vector(300, 0));
    arena.blue.setLevel(18);
    arena.blue.maxAbility('W');
    const hits = recordHits(arena.red);
    arrowAt(arena, new Vector(460, 0));
    step(arena, 0.6);
    expect(hits[0].amount).toBeCloseTo(220 + 0.7 * adOf(arena.blue), 6);
  });

  test('it stops at the first enemy: a minion in front is pinned, the champion behind is untouched', () => {
    const arena = eloraArena(new Vector(350, 0));
    const minion = arena.addMinion(TEAM_RED, new Vector(180, 0));
    const hits = recordHits(arena.red);
    arrowAt(arena, new Vector(460, 0));
    step(arena, 1);
    expect(minion.activeEffects.some(effect => effect.definitionId === 'root')).toBe(true);
    expect(hits).toEqual([]);
    expect(arena.red.hasEffect('root')).toBe(false);
  });

  test("it flies past allies and towers, which aren't hit", () => {
    const arena = eloraArena(new Vector(400, 0));
    const ally = arena.addMinion(TEAM_BLUE, new Vector(120, 0));
    const tower = arena.addTower(TEAM_RED, new Vector(250, 0));
    const allyHits = recordHits(ally);
    const towerHits = recordHits(tower);
    const hits = recordHits(arena.red);
    arrowAt(arena, new Vector(460, 0));
    step(arena, 1.2);
    expect(allyHits).toEqual([]);
    expect(towerHits).toEqual([]);
    expect(hits.length).toBe(1);
  });

  test('an enemy past its range is not hit', () => {
    const arena = eloraArena(new Vector(W.range! + W.projectileRadius! + 40, 0));
    const hits = recordHits(arena.red);
    arrowAt(arena, new Vector(W.range!, 0));
    step(arena, 1.5);
    expect(hits).toEqual([]);
  });

  test('a stun in its 0.25 s cast time cancels it: no arrow, nothing spent', () => {
    const arena = eloraArena(new Vector(300, 0));
    const mana = arena.blue.resource;
    expect(arrowAt(arena, new Vector(460, 0), { casting: true }).success).toBe(true);
    expect(arena.blue.resource).toBe(mana);
    arena.blue.applyEffect('stun', 1, arena.red.id);
    step(arena, 0.5);
    expect(arena.blue.getAbilityCooldown('W')).toBe(0);
    expect(arena.blue.resource).toBeGreaterThanOrEqual(mana);
    expect(arena.red.hasEffect('root')).toBe(false);
  });

  test('it costs 60 mana; its cooldown is 14 s at rank 1', () => {
    const arena = eloraArena(new Vector(3000, 3000));
    const mana = arena.blue.resource;
    arrowAt(arena, new Vector(460, 0));
    expect(arena.blue.resource).toBe(mana - W.manaCost![0]);
    expect(arena.blue.getAbilityCooldown('W')).toBe(W.cooldown![0]);
  });
});

// =============================================================================
// E: Dexterity
// =============================================================================

describe('Elora E - Dexterity', () => {
  const untilRolled = (arena: TestArena) => {
    for (let t = 0; t < 1 && (t === 0 || arena.blue.forcedMovement); t += DT) arena.tick(DT);
  };

  test('she rolls 170 toward the point (to the point when it is nearer)', () => {
    const far = eloraArena(new Vector(3000, 3000));
    far.castAbility(far.blue, 'E', { targetPosition: new Vector(0, 500) });
    untilRolled(far);
    expect(far.blue.position.y).toBeCloseTo(E.dash!.distance, 0);

    const near = eloraArena(new Vector(3000, 3000));
    near.castAbility(near.blue, 'E', { targetPosition: new Vector(0, 100) });
    untilRolled(near);
    expect(near.blue.position.y).toBeCloseTo(100, 0);
  });

  test('she attacks 35% faster for 2.5 s', () => {
    const arena = eloraArena(new Vector(3000, 3000));
    const attackSpeed = arena.blue.getStats().attackSpeed;
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(0, 170) });
    expect(arena.blue.getEffect('elora_dexterity')!.totalDuration).toBe(E.effectDuration!);
    expect(arena.blue.getStats().attackSpeed).toBeCloseTo(attackSpeed * 1.35, 6);
    step(arena, E.effectDuration! + 0.1);
    expect(arena.blue.hasEffect('elora_dexterity')).toBe(false);
    expect(arena.blue.getStats().attackSpeed).toBeCloseTo(attackSpeed, 6);
  });

  test("enemies near where she lands don't attack faster: it's hers alone", () => {
    const arena = eloraArena(new Vector(E.range! + 60, 0));
    const minion = arena.addMinion(TEAM_RED, new Vector(E.range!, 60));
    const attackSpeed = arena.red.getStats().attackSpeed;
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(E.range!, 0) });
    expect(arena.blue.hasEffect('elora_dexterity')).toBe(true);
    expect(arena.red.hasEffect('elora_dexterity')).toBe(false);
    expect(arena.red.getStats().attackSpeed).toBeCloseTo(attackSpeed, 6);
    expect(minion.activeEffects.some(effect => effect.definitionId === 'elora_dexterity')).toBe(false);
  });

  test("allies near where she lands don't get it either", () => {
    const arena = eloraArena(new Vector(3000, 3000));
    const ally = arena.addMinion(TEAM_BLUE, new Vector(E.range!, 40));
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(E.range!, 0) });
    expect(ally.activeEffects.some(effect => effect.definitionId === 'elora_dexterity')).toBe(false);
  });

  test("rooted she can't roll: it fails, nothing spent", () => {
    const arena = eloraArena(new Vector(3000, 3000));
    arena.blue.applyEffect('root', 1, arena.red.id);
    const mana = arena.blue.resource;
    expect(arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(0, 170) }).failReason).toBe('rooted');
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.hasEffect('elora_dexterity')).toBe(false);
  });

  test('it costs 40 mana; its cooldown is 12 s at rank 1 and 8 s at rank 5', () => {
    const arena = eloraArena(new Vector(3000, 3000));
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(0, 170) });
    expect(arena.blue.resource).toBe(mana - E.manaCost![0]);
    expect(arena.blue.getAbilityCooldown('E')).toBe(E.cooldown![0]);
    untilRolled(arena);
    arena.blue.setLevel(18);
    arena.blue.maxAbility('E');
    arena.blue.resetCooldowns();
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(0, 0) });
    expect(arena.blue.getAbilityCooldown('E')).toBe(E.cooldown![4]);
  });
});

// =============================================================================
// R: Arrow Barrage
// =============================================================================

describe('Elora R - Arrow Barrage', () => {
  /** Barrage straight up the screen from (0, 0) */
  const barrage = (arena: TestArena, options: { windup?: boolean } = {}) =>
    arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(0, -R.range!), ...options });
  const damage = (arena: TestArena, rank: number) => calculateAbilityValue(R.damage!.scaling, rank, { attackDamage: adOf(arena.blue) });

  test('after its 0.6 s, every enemy in the lane takes 180 + 90% AD and is slowed by 30% for 2 s', () => {
    const arena = eloraArena(new Vector(0, -500));
    const minion = arena.addMinion(TEAM_RED, new Vector(20, -200));
    const championHits = recordHits(arena.red);
    const minionHits = recordHits(minion);
    expect(barrage(arena, { windup: true }).success).toBe(true);
    arena.context.advanceTime(R.aoeDelay! - 0.05);
    expect(championHits).toEqual([]);
    arena.context.advanceTime(0.06);
    expect(championHits.length).toBe(1);
    expect(championHits[0].amount).toBeCloseTo(damage(arena, 1), 6);
    expect(minionHits.length).toBe(1);
    expect(arena.red.getEffect('slow_30')!.totalDuration).toBe(R.effectDuration!);
    expect(minion.activeEffects.some(effect => effect.definitionId === 'slow_30')).toBe(true);
  });

  test('at rank 3 it deals 420 + 90% AD', () => {
    const arena = eloraArena(new Vector(0, -500));
    arena.blue.setLevel(18);
    arena.blue.maxAbility('R');
    const hits = recordHits(arena.red);
    barrage(arena);
    expect(hits[0].amount).toBeCloseTo(420 + 0.9 * adOf(arena.blue), 6);
  });

  test('the lane is 700 long and 110 wide: just inside its end and edge is hit, just outside is not', () => {
    const radius = eloraArena().red.getRadius();
    const halfWidth = R.aoeRadius!;
    const cases: [Vector, boolean][] = [
      [new Vector(0, -(R.range! + radius - 5)), true],
      [new Vector(0, -(R.range! + radius + 15)), false],
      [new Vector(halfWidth + radius - 5, -300), true],
      [new Vector(halfWidth + radius + 15, -300), false],
      [new Vector(0, 80), false],
    ];
    for (const [at, hit] of cases) {
      const arena = eloraArena(at);
      const hits = recordHits(arena.red);
      barrage(arena);
      expect(hits.length).toBe(hit ? 1 : 0);
    }
  });

  test('it lands where it was cast (where the warning is), even if she moves in the windup', () => {
    const arena = eloraArena(new Vector(0, -400));
    const minion = arena.addMinion(TEAM_RED, new Vector(300, -400));
    const championHits = recordHits(arena.red);
    const minionHits = recordHits(minion);
    barrage(arena, { windup: true });
    // A roll or a Flash sideways before the arrows come down
    arena.blue.position.setFrom(new Vector(300, 0));
    arena.context.advanceTime(R.aoeDelay! + 0.01);
    expect(championHits.length).toBe(1);
    expect(minionHits).toEqual([]);
  });

  test('aimed past its 700 it still sweeps its 700', () => {
    const arena = eloraArena(new Vector(0, -650));
    const hits = recordHits(arena.red);
    arena.castAbility(arena.blue, 'R', { targetPosition: new Vector(0, -2000) });
    expect(hits.length).toBe(1);
  });

  test('allies and towers in the lane are untouched', () => {
    const arena = eloraArena(new Vector(3000, 3000));
    const ally = arena.addMinion(TEAM_BLUE, new Vector(0, -200));
    const tower = arena.addTower(TEAM_RED, new Vector(0, -450));
    const allyHits = recordHits(ally);
    const towerHits = recordHits(tower);
    barrage(arena);
    expect(allyHits).toEqual([]);
    expect(towerHits).toEqual([]);
  });

  test('it costs 100 mana; its cooldown is 100 / 85 / 70 s', () => {
    for (const rank of [1, 2, 3]) {
      const arena = eloraArena(new Vector(3000, 3000));
      arena.blue.setLevel(18);
      arena.blue.abilityStates.R.rank = rank;
      arena.blue.setResource(arena.blue.maxResource);
      const mana = arena.blue.resource;
      barrage(arena);
      expect(arena.blue.resource).toBe(mana - R.manaCost![rank - 1]);
      expect(arena.blue.getAbilityCooldown('R')).toBe(R.cooldown![rank - 1]);
    }
  });
});
