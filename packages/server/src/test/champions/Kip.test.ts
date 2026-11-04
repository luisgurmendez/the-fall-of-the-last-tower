/**
 * Kip Champion Tests
 *
 * Kip - The Would-Be Legend, a ranged top laner who hunts tanks.
 * - The mark (Target Practice, Grand Entrance): 4 s on an enemy champion. His
 *   team sees it, in fog and bushes (not through stealth), and his team's
 *   champions' basic attacks on it give the attacker +20% movement speed
 * - Passive: The Bigger They Are - his basic attack on an enemy he marked
 *   pops the mark: 40% AD + 5% of its max health + 10% of how much more max
 *   health it has than him (counted up to 2000) bonus physical damage. Only
 *   his basic attacks pop marks; abilities never do
 * - Q: Target Practice - a skillshot that stops at the first enemy: damage,
 *   and a champion is marked (a minion or monster is only hit)
 * - W: Run Them Down - passive: faster the more crit chance he has; active:
 *   slows every enemy he marked within reach (fails with none)
 * - E: Grand Entrance - a dash (stops at walls) and a burst where he lands:
 *   damage, and the champions there are marked
 * - R: Show Them All - X marked enemies in reach (X > 0) take X arrows each,
 *   in volleys; each deals (1 + 25% per other mark) / X of the full damage
 */

import { describe, test, expect } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  EntityType,
  TEAM_BLUE,
  TEAM_RED,
  KIP_KIT,
  MOBAConfig,
  calculateIndividualBushPositions,
  getAbilityDefinition,
  type DamageType,
  type Side,
} from '@siege/shared';
import { createTestArena, TestChampion, type TestArena } from '../ServerTestUtils';
import type { ServerEntity } from '../../simulation/ServerEntity';
import { kipHooks } from '../../abilities/handlers/kip/KipHooks';
import { findWallCrossing } from '../wallSpots';
import { LaneBot } from '../../bots/LaneBot';

const DT = 1 / 60;
const Q = getAbilityDefinition('kip_q')!;
const W = getAbilityDefinition('kip_w')!;
const E = getAbilityDefinition('kip_e')!;
const R = getAbilityDefinition('kip_r')!;
const MARK = 'kip_mark';
const HUNT = 'kip_hunt_speed';

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

/** Step the arena's champions, the extra champions and every projectile (minions stay where the test put them) */
function step(arena: TestArena, seconds: number, extra: TestChampion[] = []): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    arena.tick(DT);
    for (const champion of extra) champion.update(DT, arena.context);
    for (const entity of arena.context.getAllEntities()) {
      if (entity.entityType === EntityType.PROJECTILE) entity.update(DT, arena.context);
    }
  }
}

/** Kip (level 6, every ability rank 1, full mana) at (0, 0) against a level 6 champion at full health */
function kipArena(redAt = new Vector(200, 0), redChampion = 'gorath'): TestArena {
  const arena = createTestArena({ blueChampion: 'kip', redChampion, bluePosition: new Vector(0, 0), redPosition: redAt });
  arena.blue.setLevel(6);
  arena.red.setLevel(6);
  arena.red.setHealth(arena.red.maxHealth);
  arena.blue.setResource(arena.blue.maxResource);
  return arena;
}

let extraIds = 0;
/** Another champion in the arena (level 6, full health) */
function addChampion(arena: TestArena, side: Side, at: Vector, championId = 'gorath'): TestChampion {
  const id = `test-extra-${extraIds++}`;
  const champion = new TestChampion({ id, position: at.clone(), side, definition: CHAMPION_DEFINITIONS[championId], playerId: `player-${id}` });
  arena.context.addChampion(champion, `player-${id}`);
  champion.learnAllAbilities();
  champion.setLevel(6);
  champion.setHealth(champion.maxHealth);
  return champion;
}

/** Kip marks a unit (as Target Practice or Grand Entrance do) */
const mark = (arena: TestArena, target: { applyEffect(id: string, duration: number, sourceId?: string): void }, duration: number = KIP_KIT.markDuration) =>
  target.applyEffect(MARK, duration, arena.blue.id);
const isMarked = (unit: ServerEntity) =>
  (unit as Partial<{ activeEffects: { definitionId: string }[] }>).activeEffects?.some(effect => effect.definitionId === MARK) ?? false;

const adOf = (champion: TestChampion) => champion.getStats().attackDamage;
const maxHealthOf = (champion: TestChampion) => champion.getStats().maxHealth;

/** Every hit's critical: crit chance 100% */
function alwaysCrit(champion: TestChampion): void {
  champion.addModifier({ source: 'test-crit', flat: { critChance: 1 } });
}

/** The pop's bonus, from the passive's rules */
function popBonus(kip: TestChampion, target: TestChampion): number {
  const gap = Math.min(2000, Math.max(0, maxHealthOf(target) - maxHealthOf(kip)));
  return 0.4 * adOf(kip) + 0.05 * maxHealthOf(target) + 0.1 * gap;
}

/** Shoot basic attacks at a target until `arrows` of them landed (an arrow: his attack damage, or twice it with crits); returns the hits since */
function shoot(arena: TestArena, target: ServerEntity, hits: Hit[], arrows: number, crit = false): Hit[] {
  arena.context.getFogOfWar().updateVision(arena.context, 1);
  const arrow = adOf(arena.blue) * (crit ? arena.blue.getStats().critDamage : 1);
  const before = hits.length;
  const landed = () => hits.slice(before).filter(hit => hit.type === 'physical' && Math.abs(hit.amount - arrow) < 1e-6).length;
  arena.blue.setAttackTarget(target.id);
  for (let t = 0; t < 2 * arrows + 2 && landed() < arrows; t += DT) step(arena, DT);
  arena.blue.stop();
  // Whatever the last arrow set off lands in the same tick
  return hits.slice(before);
}

/** Tick until Kip's dash ends */
function untilLanded(arena: TestArena, seconds = 2): void {
  for (let t = 0; t < seconds && (t === 0 || arena.blue.forcedMovement); t += DT) arena.tick(DT);
  // His burst comes out the tick after he lands
  arena.tick(DT);
}

let tick = 10;
/** Whether a side sees a unit now (a fresh look at the fog of war) */
function sees(arena: TestArena, side: Side, unit: ServerEntity): boolean {
  arena.context.getFogOfWar().updateVision(arena.context, tick++);
  return arena.context.getFogOfWar().isVisibleTo(unit, side);
}

/** The types of the projectiles in the arena (fired so far, landed or not) */
const projectileTypes = (arena: TestArena) =>
  arena.context.getAllEntities()
    .filter(entity => entity.entityType === EntityType.PROJECTILE)
    .map(entity => (entity as unknown as { projectileType?: string; abilityId?: string }).projectileType ?? (entity as unknown as { abilityId?: string }).abilityId);

/** Kip's arrows from Show Them All in the arena */
const ultimateArrows = (arena: TestArena) =>
  arena.context.getAllEntities().filter(entity => entity.entityType === EntityType.PROJECTILE && (entity as unknown as { projectileType?: string }).projectileType === 'kip_r');

/** R's full damage (one mark) at a rank */
const fullR = (arena: TestArena, rank: number) => R.damage!.scaling.base[rank - 1] + R.damage!.scaling.adRatio! * adOf(arena.blue);

// =============================================================================
// The champion
// =============================================================================

describe('Kip - the champion', () => {
  test('a ranged marksman whose bow (200) is shorter than Elora\'s', () => {
    const kip = CHAMPION_DEFINITIONS.kip;
    expect(kip.class).toBe('marksman');
    expect(kip.attackType).toBe('ranged');
    expect(kip.baseStats.attackRange).toBe(200);
    expect(kip.baseStats.attackRange).toBeLessThan(CHAMPION_DEFINITIONS.elora.baseStats.attackRange);
  });

  test('his basic attacks are arrows (kip_auto projectiles)', () => {
    const arena = kipArena();
    arena.blue.setAttackTarget(arena.red.id);
    step(arena, 0.6);
    const arrows = arena.context.getAllEntities().filter(entity => (entity as unknown as { projectileType?: string }).projectileType === 'kip_auto');
    expect(arrows.length).toBeGreaterThan(0);
  });

  test('Q, W and E go up to rank 5 and R to rank 3, learned at levels 6, 11 and 16', () => {
    expect([Q.maxRank, W.maxRank, E.maxRank, R.maxRank]).toEqual([5, 5, 5, 3]);
    const arena = kipArena();
    arena.blue.abilityStates.R.rank = 0;
    arena.blue.abilityRanks.R = 0;
    arena.blue.setLevel(5);
    arena.blue.skillPoints = 5;
    expect(arena.blue.levelUpAbility('R')).toBe(false);
    arena.blue.setLevel(6);
    expect(arena.blue.levelUpAbility('R')).toBe(true);
    expect(arena.blue.levelUpAbility('R')).toBe(false);
    arena.blue.setLevel(11);
    expect(arena.blue.levelUpAbility('R')).toBe(true);
    arena.blue.setLevel(16);
    expect(arena.blue.levelUpAbility('R')).toBe(true);
    expect(arena.blue.abilityStates.R.rank).toBe(3);
  });
});

// =============================================================================
// Passive: The Bigger They Are
// =============================================================================

describe('Kip passive - The Bigger They Are', () => {
  test('his basic attack on an enemy he marked pops the mark for bonus physical damage', () => {
    const arena = kipArena();
    mark(arena, arena.red);
    const hits = recordHits(arena.red);
    const shot = shoot(arena, arena.red, hits, 1);
    expect(shot.length).toBe(2);
    expect(shot[1].type).toBe('physical');
    expect(shot[1].sourceId).toBe(arena.blue.id);
    expect(shot[1].amount).toBeCloseTo(popBonus(arena.blue, arena.red), 6);
    expect(arena.red.hasEffect(MARK)).toBe(false);
  });

  test('against a champion with more max health: 40% AD + 5% of its max health + 10% of the difference', () => {
    const arena = kipArena();
    const gap = maxHealthOf(arena.red) - maxHealthOf(arena.blue);
    expect(gap).toBeGreaterThan(0);
    mark(arena, arena.red);
    const hits = recordHits(arena.red);
    const shot = shoot(arena, arena.red, hits, 1);
    expect(shot[1].amount).toBeCloseTo(0.4 * adOf(arena.blue) + 0.05 * maxHealthOf(arena.red) + 0.1 * gap, 6);
  });

  test('against a champion with as much max health as him: no difference to add', () => {
    const arena = kipArena(new Vector(200, 0), 'kip');
    expect(maxHealthOf(arena.red)).toBe(maxHealthOf(arena.blue));
    mark(arena, arena.red);
    const hits = recordHits(arena.red);
    const shot = shoot(arena, arena.red, hits, 1);
    expect(shot[1].amount).toBeCloseTo(0.4 * adOf(arena.blue) + 0.05 * maxHealthOf(arena.red), 6);
  });

  test('against a champion with less max health: no difference to add (never less)', () => {
    const arena = kipArena(new Vector(200, 0), 'magnus');
    expect(maxHealthOf(arena.red)).toBeLessThan(maxHealthOf(arena.blue));
    mark(arena, arena.red);
    const hits = recordHits(arena.red);
    const shot = shoot(arena, arena.red, hits, 1);
    expect(shot[1].amount).toBeCloseTo(0.4 * adOf(arena.blue) + 0.05 * maxHealthOf(arena.red), 6);
  });

  test('the bigger the target, the bigger the pop', () => {
    const pops: number[] = [];
    for (const level of [1, 9, 18]) {
      const arena = kipArena();
      arena.red.setLevel(level);
      arena.red.setHealth(arena.red.maxHealth);
      mark(arena, arena.red);
      const hits = recordHits(arena.red);
      pops.push(shoot(arena, arena.red, hits, 1)[1].amount);
    }
    expect(pops[1]).toBeGreaterThan(pops[0]);
    expect(pops[2]).toBeGreaterThan(pops[1]);
  });

  test('the difference counts up to 2000 (+200 at most)', () => {
    const arena = kipArena();
    arena.blue.setLevel(1);
    arena.red.setLevel(18);
    arena.red.items[0] = { definitionId: 'heartstone', slot: 0, passiveCooldowns: {}, nextIntervalTick: {} };
    arena.red.invalidateStats();
    arena.red.setHealth(maxHealthOf(arena.red));
    const gap = maxHealthOf(arena.red) - maxHealthOf(arena.blue);
    expect(gap).toBeGreaterThan(2000);
    mark(arena, arena.red);
    const hits = recordHits(arena.red);
    const shot = shoot(arena, arena.red, hits, 1);
    expect(shot[1].amount).toBeCloseTo(0.4 * adOf(arena.blue) + 0.05 * maxHealthOf(arena.red) + 200, 6);
  });

  test("a critical arrow doesn't raise the pop: it scales with his attack damage, not the crit", () => {
    const arena = kipArena();
    alwaysCrit(arena.blue);
    mark(arena, arena.red);
    const hits = recordHits(arena.red);
    const shot = shoot(arena, arena.red, hits, 1, true);
    expect(shot[0].amount).toBeCloseTo(2 * adOf(arena.blue), 6);
    expect(shot[1].amount).toBeCloseTo(popBonus(arena.blue, arena.red), 6);
  });

  test('an enemy he never marked takes no bonus; once marked, it does', () => {
    const arena = kipArena();
    const hits = recordHits(arena.red);
    expect(shoot(arena, arena.red, hits, 2).length).toBe(2);
    step(arena, 1.6);
    mark(arena, arena.red);
    expect(shoot(arena, arena.red, hits, 1).length).toBe(2);
  });

  test('a mark pops once: the next arrow is plain', () => {
    const arena = kipArena();
    mark(arena, arena.red);
    const hits = recordHits(arena.red);
    expect(shoot(arena, arena.red, hits, 1).length).toBe(2);
    step(arena, 1.6);
    const second = shoot(arena, arena.red, hits, 1);
    expect(second.length).toBe(1);
  });

  test('a mark gone by the time the arrow lands: no pop', () => {
    const arena = kipArena();
    mark(arena, arena.red);
    const hits = recordHits(arena.red);
    arena.context.getFogOfWar().updateVision(arena.context, 1);
    arena.blue.setAttackTarget(arena.red.id);
    for (let t = 0; t < 1 && !arena.context.getAllEntities().some(entity => entity.entityType === EntityType.PROJECTILE); t += DT) step(arena, DT);
    // It was fired at a marked enemy: drawn as the arrow that pops
    expect(projectileTypes(arena)).toEqual(['kip_pop_auto']);
    arena.red.removeEffect(MARK);
    step(arena, 0.4);
    arena.blue.stop();
    expect(hits.length).toBe(1);
  });

  test("an enemy marked by another Kip on his team isn't his to pop", () => {
    const arena = kipArena();
    const otherKip = addChampion(arena, TEAM_BLUE, new Vector(0, 300), 'kip');
    arena.red.applyEffect(MARK, KIP_KIT.markDuration, otherKip.id);
    const hits = recordHits(arena.red);
    const shot = shoot(arena, arena.red, hits, 1);
    expect(shot.length).toBe(1);
    expect(arena.red.hasEffect(MARK)).toBe(true);
  });

  test('an arrow that kills its target pops nothing after', () => {
    const arena = kipArena();
    mark(arena, arena.red);
    arena.red.setHealth(1);
    const hits = recordHits(arena.red);
    shoot(arena, arena.red, hits, 1);
    expect(projectileTypes(arena)).toContain('kip_pop_auto');
    expect(arena.red.isDead).toBe(true);
    expect(hits.length).toBe(1);
  });

  test('the arrow that will pop is drawn as kip_pop_auto', () => {
    const arena = kipArena();
    const type = () => kipHooks.basicAttackProjectileType!(arena.blue, arena.red);
    expect(type()).toBeUndefined();
    mark(arena, arena.red);
    expect(type()).toBe('kip_pop_auto');
  });

  test('the passive shows how many enemy champions he has marked', () => {
    const arena = kipArena();
    const second = addChampion(arena, TEAM_RED, new Vector(300, 100));
    const update = () => { kipHooks.updatePassiveState!(arena.blue, arena.context); return arena.blue.passiveState.stacks; };
    expect(update()).toBe(0);
    mark(arena, arena.red);
    expect(update()).toBe(1);
    mark(arena, second);
    expect(update()).toBe(2);
    arena.red.removeEffect(MARK);
    expect(update()).toBe(1);
  });
});

// =============================================================================
// The mark: sight for his team
// =============================================================================

describe('Kip mark - his team sees the marked', () => {
  /** A bush, with Kip just outside it */
  function bushArena(): { arena: TestArena; inside: Vector } {
    const bush = calculateIndividualBushPositions(0)[1];
    const inside = new Vector(bush.x, bush.y);
    const arena = kipArena(inside);
    arena.blue.position.setFrom(new Vector(bush.x + 220, bush.y + 20));
    return { arena, inside };
  }

  test('an enemy hidden in a bush is seen by his team once marked', () => {
    const { arena } = bushArena();
    expect(sees(arena, TEAM_BLUE, arena.red)).toBe(false);
    mark(arena, arena.red);
    expect(sees(arena, TEAM_BLUE, arena.red)).toBe(true);
  });

  test('an enemy in the fog, far out of sight, is seen by his team once marked', () => {
    const arena = kipArena(new Vector(1500, 0));
    expect(sees(arena, TEAM_BLUE, arena.red)).toBe(false);
    mark(arena, arena.red);
    expect(sees(arena, TEAM_BLUE, arena.red)).toBe(true);
  });

  test('when the mark runs out, the fog hides it again', () => {
    const arena = kipArena(new Vector(1500, 0));
    mark(arena, arena.red, 0.5);
    expect(sees(arena, TEAM_BLUE, arena.red)).toBe(true);
    step(arena, 0.6);
    expect(arena.red.hasEffect(MARK)).toBe(false);
    expect(sees(arena, TEAM_BLUE, arena.red)).toBe(false);
  });

  test('when the mark is popped, the fog hides it again', () => {
    const arena = kipArena(new Vector(180, 0));
    mark(arena, arena.red);
    arena.red.position.setFrom(new Vector(1500, 0));
    expect(sees(arena, TEAM_BLUE, arena.red)).toBe(true);
    arena.red.position.setFrom(new Vector(180, 0));
    const hits = recordHits(arena.red);
    expect(shoot(arena, arena.red, hits, 1).length).toBe(2);
    arena.red.position.setFrom(new Vector(1500, 0));
    expect(sees(arena, TEAM_BLUE, arena.red)).toBe(false);
  });

  test("a stealthed champion stays hidden: the mark is sight, it doesn't see through stealth", () => {
    const arena = kipArena(new Vector(1500, 0), 'vex');
    mark(arena, arena.red);
    expect(sees(arena, TEAM_BLUE, arena.red)).toBe(true);
    arena.red.applyEffect('vex_stealth', 5, arena.red.id);
    expect(sees(arena, TEAM_BLUE, arena.red)).toBe(false);
  });

  test("it shows nothing to the marked champion's team: Kip in a bush stays hidden", () => {
    const bush = calculateIndividualBushPositions(0)[1];
    const arena = kipArena(new Vector(bush.x + 220, bush.y + 20));
    arena.blue.position.setFrom(new Vector(bush.x, bush.y));
    mark(arena, arena.red);
    expect(sees(arena, TEAM_RED, arena.blue)).toBe(false);
  });

  test('a marked enemy in a bush can be targeted by his team', () => {
    const { arena } = bushArena();
    mark(arena, arena.red);
    arena.context.getFogOfWar().updateVision(arena.context, tick++);
    expect(arena.context.getFogOfWar().canTarget(arena.blue, arena.red)).toBe(true);
  });

  test("a minion can't hold his mark (only champions are marked), so it reveals no minion", () => {
    const arena = kipArena(new Vector(0, 300));
    const minion = arena.addMinion(TEAM_RED, new Vector(300, 0));
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(500, 0) });
    step(arena, 1);
    expect(isMarked(minion)).toBe(false);
    arena.blue.resetCooldowns();
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(0, 500) });
    step(arena, 1);
    expect(arena.red.hasEffect(MARK)).toBe(true);
  });
});

// =============================================================================
// The mark: his team's attacks on the marked speed them up
// =============================================================================

describe('Kip mark - basic attacks on the marked speed up the attacker', () => {
  test('his own arrow on a marked enemy: +20% movement speed for 1.5 s', () => {
    const arena = kipArena();
    const speed = arena.blue.getStats().movementSpeed;
    mark(arena, arena.red);
    const hits = recordHits(arena.red);
    shoot(arena, arena.red, hits, 1);
    expect(arena.blue.getEffect(HUNT)!.totalDuration).toBe(KIP_KIT.huntSpeedDuration);
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(speed * 1.2, 6);
    step(arena, KIP_KIT.huntSpeedDuration + 0.1);
    expect(arena.blue.hasEffect(HUNT)).toBe(false);
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(speed, 6);
  });

  test("an allied champion's basic attack on a marked enemy speeds the ally up, and doesn't pop the mark", () => {
    const arena = kipArena(new Vector(400, 0));
    const ally = addChampion(arena, TEAM_BLUE, new Vector(440, 0), 'warrior');
    const speed = ally.getStats().movementSpeed;
    mark(arena, arena.red);
    const hits = recordHits(arena.red);
    arena.context.getFogOfWar().updateVision(arena.context, tick++);
    ally.setAttackTarget(arena.red.id);
    for (let t = 0; t < 2 && hits.length === 0; t += DT) step(arena, DT, [ally]);
    expect(hits.length).toBe(1);
    expect(ally.hasEffect(HUNT)).toBe(true);
    expect(ally.getStats().movementSpeed).toBeCloseTo(speed * 1.2, 6);
    expect(arena.red.hasEffect(MARK)).toBe(true);
  });

  test('an attack on an unmarked enemy gives nothing; on a marked one, the speed', () => {
    const arena = kipArena();
    const ally = addChampion(arena, TEAM_BLUE, new Vector(240, 0), 'warrior');
    arena.red.onBasicAttackTaken(ally, arena.context);
    arena.red.onBasicAttackTaken(arena.blue, arena.context);
    expect(ally.hasEffect(HUNT)).toBe(false);
    expect(arena.blue.hasEffect(HUNT)).toBe(false);
    mark(arena, arena.red);
    arena.red.onBasicAttackTaken(ally, arena.context);
    expect(ally.hasEffect(HUNT)).toBe(true);
  });

  test("an allied minion's attack on a marked enemy gives the minion nothing (champions only)", () => {
    const arena = kipArena();
    const minion = arena.addMinion(TEAM_BLUE, new Vector(240, 0));
    const ally = addChampion(arena, TEAM_BLUE, new Vector(240, 40), 'warrior');
    mark(arena, arena.red);
    arena.red.onBasicAttackTaken(minion, arena.context);
    arena.red.onBasicAttackTaken(ally, arena.context);
    expect(minion.activeEffects.some(effect => effect.definitionId === HUNT)).toBe(false);
    expect(ally.hasEffect(HUNT)).toBe(true);
  });

  test("abilities on a marked enemy don't speed him up (Target Practice)", () => {
    const arena = kipArena(new Vector(300, 0));
    mark(arena, arena.red);
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(500, 0) });
    step(arena, 1);
    expect(arena.red.hasEffect(MARK)).toBe(true);
    expect(arena.blue.hasEffect(HUNT)).toBe(false);
  });

  test('each attack on the marked refreshes the speed', () => {
    const arena = kipArena();
    const ally = addChampion(arena, TEAM_BLUE, new Vector(240, 0), 'warrior');
    mark(arena, arena.red);
    arena.red.onBasicAttackTaken(ally, arena.context);
    step(arena, 1, [ally]);
    arena.red.onBasicAttackTaken(ally, arena.context);
    expect(ally.getEffect(HUNT)!.timeRemaining).toBeCloseTo(KIP_KIT.huntSpeedDuration, 6);
  });
});

// =============================================================================
// Q: Target Practice
// =============================================================================

describe('Kip Q - Target Practice', () => {
  const qDamage = (arena: TestArena, rank: number) => Q.damage!.scaling.base[rank - 1] + Q.damage!.scaling.adRatio! * adOf(arena.blue);
  const fire = (arena: TestArena, at = new Vector(500, 0), options: { casting?: boolean } = {}) =>
    arena.castAbility(arena.blue, 'Q', { targetPosition: at, ...options });

  test('the first enemy champion hit takes 50 + 70% AD physical damage and is marked for 4 s', () => {
    const arena = kipArena(new Vector(300, 0));
    const hits = recordHits(arena.red);
    expect(fire(arena).success).toBe(true);
    step(arena, 1);
    expect(hits.length).toBe(1);
    expect(hits[0].type).toBe('physical');
    expect(hits[0].amount).toBeCloseTo(qDamage(arena, 1), 6);
    expect(arena.red.getEffect(MARK)!.totalDuration).toBe(KIP_KIT.markDuration);
    expect(arena.red.getEffect(MARK)!.sourceId).toBe(arena.blue.id);
  });

  test('at rank 5 it deals 170 + 70% AD', () => {
    const arena = kipArena(new Vector(300, 0));
    arena.blue.setLevel(18);
    arena.blue.maxAbility('Q');
    const hits = recordHits(arena.red);
    fire(arena);
    step(arena, 1);
    expect(hits[0].amount).toBeCloseTo(170 + 0.7 * adOf(arena.blue), 6);
    expect(arena.red.hasEffect(MARK)).toBe(true);
  });

  test('the mark lasts its 4 s, then it is gone', () => {
    const arena = kipArena(new Vector(300, 0));
    fire(arena);
    step(arena, 1);
    expect(arena.red.hasEffect(MARK)).toBe(true);
    step(arena, KIP_KIT.markDuration - 0.7);
    expect(arena.red.hasEffect(MARK)).toBe(true);
    step(arena, 0.8);
    expect(arena.red.hasEffect(MARK)).toBe(false);
  });

  test("on an enemy already marked it refreshes the mark and doesn't pop it", () => {
    const arena = kipArena(new Vector(300, 0));
    mark(arena, arena.red, 1);
    const hits = recordHits(arena.red);
    fire(arena);
    step(arena, 1);
    expect(hits.length).toBe(1);
    expect(hits[0].amount).toBeCloseTo(qDamage(arena, 1), 6);
    expect(arena.red.getEffect(MARK)!.timeRemaining).toBeGreaterThan(KIP_KIT.markDuration - 0.6);
  });

  test("it stops at the first enemy: a minion in front takes the damage and isn't marked; the champion behind is untouched", () => {
    const arena = kipArena(new Vector(350, 0));
    const minion = arena.addMinion(TEAM_RED, new Vector(150, 0));
    const minionHits = recordHits(minion);
    const hits = recordHits(arena.red);
    fire(arena);
    step(arena, 1.2);
    expect(minionHits.length).toBe(1);
    expect(minionHits[0].amount).toBeCloseTo(qDamage(arena, 1), 6);
    expect(isMarked(minion)).toBe(false);
    expect(hits).toEqual([]);
    expect(arena.red.hasEffect(MARK)).toBe(false);
  });

  test("a jungle monster hit takes the damage and isn't marked", () => {
    const arena = kipArena(new Vector(3000, 3000));
    const monster = arena.addJungleCreature(new Vector(250, 0));
    const hits = recordHits(monster);
    fire(arena);
    step(arena, 1);
    expect(hits.length).toBe(1);
    expect(isMarked(monster)).toBe(false);
  });

  test('it flies past allies and towers, which are untouched', () => {
    const arena = kipArena(new Vector(420, 0));
    const ally = addChampion(arena, TEAM_BLUE, new Vector(100, 0), 'warrior');
    const allyMinion = arena.addMinion(TEAM_BLUE, new Vector(180, 0));
    const tower = arena.addTower(TEAM_RED, new Vector(300, 0));
    const allyHits = recordHits(ally);
    const minionHits = recordHits(allyMinion);
    const towerHits = recordHits(tower);
    const hits = recordHits(arena.red);
    fire(arena);
    step(arena, 1.2);
    expect(allyHits).toEqual([]);
    expect(minionHits).toEqual([]);
    expect(towerHits).toEqual([]);
    expect(isMarked(ally)).toBe(false);
    expect(hits.length).toBe(1);
    expect(arena.red.hasEffect(MARK)).toBe(true);
  });

  test('an enemy just inside its range is hit', () => {
    const arena = kipArena(new Vector(Q.range! - 10, 0));
    const hits = recordHits(arena.red);
    fire(arena, new Vector(Q.range!, 0));
    step(arena, 1.5);
    expect(hits.length).toBe(1);
    expect(arena.red.hasEffect(MARK)).toBe(true);
  });

  test('an enemy past its range is not hit', () => {
    const arena = kipArena(new Vector(Q.range! + Q.projectileRadius! + 25 + 20, 0));
    const hits = recordHits(arena.red);
    fire(arena, new Vector(Q.range!, 0));
    step(arena, 1.5);
    expect(hits).toEqual([]);
    expect(arena.red.hasEffect(MARK)).toBe(false);
  });

  test('a miss marks nothing, and still costs its mana and cooldown', () => {
    const arena = kipArena(new Vector(300, 0));
    const mana = arena.blue.resource;
    const hits = recordHits(arena.red);
    expect(fire(arena, new Vector(0, -500)).success).toBe(true);
    step(arena, 1.2);
    expect(hits).toEqual([]);
    expect(arena.red.hasEffect(MARK)).toBe(false);
    expect(arena.blue.resource).toBeLessThan(mana);
    expect(arena.blue.getAbilityCooldown('Q')).toBeGreaterThan(0);
  });

  test('a champion that walks out of its path is not hit', () => {
    const arena = kipArena(new Vector(400, 0));
    const hits = recordHits(arena.red);
    fire(arena, new Vector(500, 0));
    arena.red.position.setFrom(new Vector(400, 120));
    step(arena, 1.2);
    expect(hits).toEqual([]);
  });

  test('it has a 0.25 s cast time: a stun in it cancels the cast, nothing spent, no arrow', () => {
    const arena = kipArena(new Vector(300, 0));
    const mana = arena.blue.resource;
    expect(fire(arena, new Vector(500, 0), { casting: true }).success).toBe(true);
    expect(arena.blue.isCasting()).toBe(true);
    arena.blue.applyEffect('stun', 1, arena.red.id);
    step(arena, 1);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
    expect(arena.blue.resource).toBeGreaterThanOrEqual(mana);
    expect(arena.red.hasEffect(MARK)).toBe(false);
  });

  test("silenced or stunned he can't cast it: nothing spent", () => {
    for (const cc of ['silence', 'stun']) {
      const arena = kipArena(new Vector(300, 0));
      arena.blue.applyEffect(cc, 1, arena.red.id);
      const mana = arena.blue.resource;
      const result = fire(arena);
      expect(result.success).toBe(false);
      expect(result.failReason).toBe(cc === 'silence' ? 'silenced' : 'stunned');
      expect(arena.blue.resource).toBe(mana);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
    }
  });

  test('rooted, he can still cast it (it moves nothing)', () => {
    const arena = kipArena(new Vector(300, 0));
    arena.blue.applyEffect('root', 2, arena.red.id);
    expect(fire(arena).success).toBe(true);
    step(arena, 1);
    expect(arena.red.hasEffect(MARK)).toBe(true);
  });

  test('without the mana it fails, nothing spent', () => {
    const arena = kipArena(new Vector(300, 0));
    arena.blue.setResource(Q.manaCost![0] - 1);
    const result = fire(arena);
    expect(result.success).toBe(false);
    expect(result.failReason).toBe('not_enough_mana');
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
  });

  test('it costs 40 mana with a 9 s cooldown at rank 1, 60 mana and 7 s at rank 5', () => {
    const arena = kipArena(new Vector(3000, 3000));
    const mana = arena.blue.resource;
    fire(arena);
    expect(arena.blue.resource).toBe(mana - 40);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(9);
    arena.blue.setLevel(18);
    arena.blue.maxAbility('Q');
    arena.blue.resetCooldowns();
    arena.blue.setResource(arena.blue.maxResource);
    const full = arena.blue.resource;
    fire(arena);
    expect(arena.blue.resource).toBe(full - 60);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(7);
  });
});

// =============================================================================
// W: Run Them Down
// =============================================================================

describe('Kip W - Run Them Down (passive: speed from crit chance)', () => {
  const baseSpeed = () => CHAMPION_DEFINITIONS.kip.baseStats.movementSpeed;
  const withCrit = (arena: TestArena, crit: number) => arena.blue.addModifier({ source: 'test-crit', flat: { critChance: crit } });

  test('with no crit chance he moves at his base speed; with some, faster', () => {
    const arena = kipArena(new Vector(3000, 3000));
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(baseSpeed(), 6);
    withCrit(arena, 0.2);
    expect(arena.blue.getStats().movementSpeed).toBeGreaterThan(baseSpeed());
  });

  test('50% crit chance at rank 1: +5% movement speed', () => {
    const arena = kipArena(new Vector(3000, 3000));
    withCrit(arena, 0.5);
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(baseSpeed() * 1.05, 6);
  });

  test('100% crit chance at rank 1: +10%; at rank 3: +15%; at rank 5: +20%', () => {
    for (const [rank, bonus] of [[1, 0.1], [3, 0.15], [5, 0.2]] as const) {
      const arena = kipArena(new Vector(3000, 3000));
      arena.blue.setLevel(18);
      arena.blue.abilityStates.W.rank = rank;
      withCrit(arena, 1);
      arena.blue.invalidateStats();
      expect(arena.blue.getStats().movementSpeed).toBeCloseTo(baseSpeed() * (1 + bonus), 6);
    }
  });

  test('crit chance past 100% counts as 100%', () => {
    const arena = kipArena(new Vector(3000, 3000));
    withCrit(arena, 1.6);
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(baseSpeed() * 1.1, 6);
  });

  test('before W is learned, crit chance gives no speed', () => {
    const arena = kipArena(new Vector(3000, 3000));
    arena.blue.abilityStates.W.rank = 0;
    withCrit(arena, 1);
    arena.blue.invalidateStats();
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(baseSpeed(), 6);
    arena.blue.abilityStates.W.rank = 1;
    arena.blue.invalidateStats();
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(baseSpeed() * 1.1, 6);
  });

  test('it adds to a slow on him rather than ignoring it', () => {
    const arena = kipArena(new Vector(3000, 3000));
    withCrit(arena, 1);
    arena.blue.applyEffect('slow_40', 2, arena.red.id);
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(baseSpeed() * 0.6 * 1.1, 6);
  });

  test("it's his alone: an enemy with crit chance isn't sped up", () => {
    const arena = kipArena(new Vector(3000, 3000), 'elora');
    const speed = arena.red.getStats().movementSpeed;
    arena.red.addModifier({ source: 'test-crit', flat: { critChance: 1 } });
    expect(arena.red.getStats().movementSpeed).toBeCloseTo(speed, 6);
    withCrit(arena, 1);
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(baseSpeed() * 1.1, 6);
  });
});

describe('Kip W - Run Them Down (active: slows the marked)', () => {
  const cast = (arena: TestArena) => arena.castAbility(arena.blue, 'W');

  test('every enemy champion he marked in reach is slowed by 40% for 1 s at rank 1', () => {
    const arena = kipArena(new Vector(300, 0));
    const speed = arena.red.getStats().movementSpeed;
    mark(arena, arena.red);
    expect(cast(arena).success).toBe(true);
    expect(arena.red.getEffect(KIP_KIT.wSlowEffect)!.totalDuration).toBe(1);
    expect(arena.red.getStats().movementSpeed).toBeCloseTo(speed * 0.6, 6);
  });

  test('the slow lasts 1 / 1.25 / 1.5 / 1.75 / 2 s by rank', () => {
    for (let rank = 1; rank <= 5; rank++) {
      const arena = kipArena(new Vector(300, 0));
      arena.blue.setLevel(18);
      arena.blue.abilityStates.W.rank = rank;
      mark(arena, arena.red);
      cast(arena);
      expect(arena.red.getEffect(KIP_KIT.wSlowEffect)!.totalDuration).toBe(KIP_KIT.wSlowDuration[rank - 1]);
    }
  });

  test('the slow ends after its time', () => {
    const arena = kipArena(new Vector(300, 0));
    mark(arena, arena.red);
    cast(arena);
    expect(arena.red.getEffect(KIP_KIT.wSlowEffect)!.totalDuration).toBe(1);
    step(arena, 1.1);
    expect(arena.red.hasEffect(KIP_KIT.wSlowEffect)).toBe(false);
  });

  test('it slows every marked enemy at once, and no unmarked one', () => {
    const arena = kipArena(new Vector(300, 0));
    const second = addChampion(arena, TEAM_RED, new Vector(-200, 150));
    const unmarked = addChampion(arena, TEAM_RED, new Vector(100, -200));
    const minion = arena.addMinion(TEAM_RED, new Vector(150, 0));
    mark(arena, arena.red);
    mark(arena, second);
    cast(arena);
    expect(arena.red.hasEffect(KIP_KIT.wSlowEffect)).toBe(true);
    expect(second.hasEffect(KIP_KIT.wSlowEffect)).toBe(true);
    expect(unmarked.hasEffect(KIP_KIT.wSlowEffect)).toBe(false);
    expect(minion.activeEffects.some(effect => effect.definitionId === KIP_KIT.wSlowEffect)).toBe(false);
  });

  test('its reach is 650 to the edge of the body: just inside is slowed', () => {
    const arena = kipArena(new Vector(W.aoeRadius! + 25 - 5, 0));
    mark(arena, arena.red);
    expect(cast(arena).success).toBe(true);
    expect(arena.red.hasEffect(KIP_KIT.wSlowEffect)).toBe(true);
  });

  test('a marked enemy just past its reach is not slowed (and alone, the cast fails)', () => {
    const arena = kipArena(new Vector(W.aoeRadius! + 25 + 5, 0));
    mark(arena, arena.red);
    const mana = arena.blue.resource;
    const result = cast(arena);
    expect(result.success).toBe(false);
    expect(arena.red.hasEffect(KIP_KIT.wSlowEffect)).toBe(false);
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.getAbilityCooldown('W')).toBe(0);
  });

  test('with no marked enemy around it fails: no mana, no cooldown', () => {
    const arena = kipArena(new Vector(300, 0));
    const mana = arena.blue.resource;
    const result = cast(arena);
    expect(result.success).toBe(false);
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.getAbilityCooldown('W')).toBe(0);
    expect(arena.red.hasEffect(KIP_KIT.wSlowEffect)).toBe(false);
  });

  test("an enemy only another Kip marked doesn't count", () => {
    const arena = kipArena(new Vector(300, 0));
    const otherKip = addChampion(arena, TEAM_BLUE, new Vector(0, 300), 'kip');
    arena.red.applyEffect(MARK, KIP_KIT.markDuration, otherKip.id);
    expect(cast(arena).success).toBe(false);
  });

  test("it doesn't use up the marks", () => {
    const arena = kipArena(new Vector(300, 0));
    mark(arena, arena.red);
    cast(arena);
    expect(arena.red.hasEffect(MARK)).toBe(true);
  });

  test("silenced or stunned he can't cast it; rooted he can", () => {
    for (const cc of ['silence', 'stun', 'root']) {
      const arena = kipArena(new Vector(300, 0));
      mark(arena, arena.red);
      arena.blue.applyEffect(cc, 1, arena.red.id);
      expect(cast(arena).success).toBe(cc === 'root');
    }
  });

  test('it costs 50 mana; its cooldown is 16 s at rank 1 and 12 s at rank 5', () => {
    const arena = kipArena(new Vector(300, 0));
    mark(arena, arena.red);
    const mana = arena.blue.resource;
    cast(arena);
    expect(arena.blue.resource).toBe(mana - 50);
    expect(arena.blue.getAbilityCooldown('W')).toBe(16);
    arena.blue.setLevel(18);
    arena.blue.maxAbility('W');
    arena.blue.resetCooldowns();
    cast(arena);
    expect(arena.blue.getAbilityCooldown('W')).toBe(12);
  });
});

// =============================================================================
// E: Grand Entrance
// =============================================================================

describe('Kip E - Grand Entrance', () => {
  const eDamage = (arena: TestArena, rank: number) => E.damage!.scaling.base[rank - 1] + E.damage!.scaling.adRatio! * adOf(arena.blue);
  const dash = (arena: TestArena, to = new Vector(500, 0)) => arena.castAbility(arena.blue, 'E', { targetPosition: to });

  test('he dashes 200 toward the point (to the point when it is nearer)', () => {
    const far = kipArena(new Vector(3000, 3000));
    expect(dash(far, new Vector(0, 900)).success).toBe(true);
    untilLanded(far);
    expect(far.blue.position.y).toBeCloseTo(E.range!, 0);
    expect(far.blue.position.x).toBeCloseTo(0, 3);

    const near = kipArena(new Vector(3000, 3000));
    dash(near, new Vector(0, 100));
    untilLanded(near);
    expect(near.blue.position.y).toBeCloseTo(100, 0);
  });

  test('instant: no cast time, he is dashing at once (drawn as a dash, kip_e)', () => {
    const arena = kipArena(new Vector(3000, 3000));
    dash(arena);
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.forcedMovement).not.toBeNull();
    expect(arena.blue.dashAbilityId).toBe('kip_e');
  });

  test('where he lands, enemies within 130 take 60 + 50% AD physical damage and champions are marked for 4 s', () => {
    const arena = kipArena(new Vector(300, 0));
    const hits = recordHits(arena.red);
    dash(arena);
    untilLanded(arena);
    expect(hits.length).toBe(1);
    expect(hits[0].type).toBe('physical');
    expect(hits[0].amount).toBeCloseTo(eDamage(arena, 1), 6);
    expect(arena.red.getEffect(MARK)!.totalDuration).toBe(KIP_KIT.markDuration);
  });

  test('at rank 5 it deals 200 + 50% AD', () => {
    const arena = kipArena(new Vector(300, 0));
    arena.blue.setLevel(18);
    arena.blue.maxAbility('E');
    const hits = recordHits(arena.red);
    dash(arena);
    untilLanded(arena);
    expect(arena.blue.position.x).toBeCloseTo(E.range!, 0);
    expect(hits[0].amount).toBeCloseTo(200 + 0.5 * adOf(arena.blue), 6);
  });

  test('nothing happens at the cast: an enemy where he starts is untouched, the burst is where he lands', () => {
    const arena = kipArena(new Vector(-60, 0));
    const atLanding = addChampion(arena, TEAM_RED, new Vector(250, 30));
    const hits = recordHits(arena.red);
    const landingHits = recordHits(atLanding);
    dash(arena);
    expect(hits).toEqual([]);
    expect(landingHits).toEqual([]);
    untilLanded(arena);
    expect(hits).toEqual([]);
    expect(arena.red.hasEffect(MARK)).toBe(false);
    expect(landingHits.length).toBe(1);
    expect(atLanding.hasEffect(MARK)).toBe(true);
  });

  test('a minion and a monster in the burst are hit but not marked', () => {
    const arena = kipArena(new Vector(3000, 3000));
    const minion = arena.addMinion(TEAM_RED, new Vector(260, 40));
    const monster = arena.addJungleCreature(new Vector(240, -60));
    const minionHits = recordHits(minion);
    const monsterHits = recordHits(monster);
    dash(arena);
    untilLanded(arena);
    expect(arena.blue.position.x).toBeCloseTo(E.range!, 0);
    expect(minionHits.length).toBe(1);
    expect(monsterHits.length).toBe(1);
    expect(isMarked(minion)).toBe(false);
    expect(isMarked(monster)).toBe(false);
  });

  test('it marks every enemy champion in the burst', () => {
    const arena = kipArena(new Vector(300, 0));
    const second = addChampion(arena, TEAM_RED, new Vector(200, 100));
    dash(arena);
    untilLanded(arena);
    expect(arena.red.hasEffect(MARK)).toBe(true);
    expect(second.hasEffect(MARK)).toBe(true);
  });

  test('an enemy just inside 130 of where he lands is hit; just outside is not', () => {
    for (const [offset, hit] of [[-5, true], [5, false]] as const) {
      const arena = kipArena(new Vector(200 + E.aoeRadius! + 25 + offset, 0));
      const hits = recordHits(arena.red);
      dash(arena);
      untilLanded(arena);
      expect(hits.length).toBe(hit ? 1 : 0);
      expect(arena.red.hasEffect(MARK)).toBe(hit);
    }
  });

  test('allies and towers in the burst are untouched', () => {
    const arena = kipArena(new Vector(3000, 3000));
    const ally = addChampion(arena, TEAM_BLUE, new Vector(260, 0), 'warrior');
    const tower = arena.addTower(TEAM_RED, new Vector(200, 90));
    const allyHits = recordHits(ally);
    const towerHits = recordHits(tower);
    dash(arena);
    untilLanded(arena);
    expect(arena.blue.position.x).toBeCloseTo(E.range!, 0);
    expect(allyHits).toEqual([]);
    expect(towerHits).toEqual([]);
    expect(ally.hasEffect(MARK)).toBe(false);
  });

  test('the burst hits once', () => {
    const arena = kipArena(new Vector(300, 0));
    const hits = recordHits(arena.red);
    dash(arena);
    untilLanded(arena);
    step(arena, 1);
    expect(arena.blue.position.x).toBeCloseTo(E.range!, 0);
    expect(hits.length).toBe(1);
  });

  test("on an enemy already marked it refreshes the mark and doesn't pop it", () => {
    const arena = kipArena(new Vector(300, 0));
    mark(arena, arena.red, 1);
    const hits = recordHits(arena.red);
    dash(arena);
    untilLanded(arena);
    expect(hits.length).toBe(1);
    expect(arena.red.getEffect(MARK)!.timeRemaining).toBeGreaterThan(KIP_KIT.markDuration - 0.5);
  });

  test('cast at his feet, he bursts where he stands', () => {
    const arena = kipArena(new Vector(100, 0));
    const hits = recordHits(arena.red);
    expect(dash(arena, new Vector(0, 0)).success).toBe(true);
    untilLanded(arena);
    expect(arena.blue.position.x).toBeCloseTo(0, 3);
    expect(hits.length).toBe(1);
    expect(arena.red.hasEffect(MARK)).toBe(true);
  });

  test('dying in the dash: no burst', () => {
    const arena = kipArena(new Vector(300, 0));
    const hits = recordHits(arena.red);
    dash(arena);
    arena.tick(DT);
    arena.blue.takeDamage(1e9, 'true');
    untilLanded(arena);
    step(arena, 0.5);
    expect(hits).toEqual([]);
    expect(arena.red.hasEffect(MARK)).toBe(false);
  });

  describe('walls', () => {
    const wall = findWallCrossing(30, 90);

    test('dashing into a wall he stops on his side of it, and bursts there', () => {
      const arena = kipArena(new Vector(wall.left - 110, wall.y + 50));
      arena.blue.position.setFrom(new Vector(wall.left - 40, wall.y));
      const farSide = arena.addMinion(TEAM_RED, new Vector(wall.right + 150, wall.y));
      const farHits = recordHits(farSide);
      const hits = recordHits(arena.red);
      expect(dash(arena, new Vector(wall.right + 400, wall.y)).success).toBe(true);
      untilLanded(arena);
      expect(MOBAConfig.WALL_FIELD.distance(arena.blue.position.x, arena.blue.position.y)).toBeGreaterThanOrEqual(0);
      expect(arena.blue.position.x).toBeLessThan(wall.left + 1);
      expect(hits.length).toBe(1);
      expect(arena.red.hasEffect(MARK)).toBe(true);
      expect(farHits).toEqual([]);
    });

    test('dashing away from a wall he stands against goes the full way', () => {
      const arena = kipArena(new Vector(3000, 3000));
      arena.blue.position.setFrom(new Vector(wall.left - 30, wall.y));
      const start = arena.blue.position.x;
      dash(arena, new Vector(start - 1000, wall.y));
      untilLanded(arena);
      expect(start - arena.blue.position.x).toBeGreaterThan(E.range! - 2);
    });
  });

  test("rooted or grounded he can't dash: it fails, nothing spent, he doesn't move", () => {
    for (const cc of ['root', 'grounded']) {
      const arena = kipArena(new Vector(300, 0));
      arena.blue.applyEffect(cc, 2, arena.red.id);
      const mana = arena.blue.resource;
      const result = dash(arena);
      arena.tickFrames(30);
      expect(result.success).toBe(false);
      expect(result.failReason).toBe('rooted');
      expect(arena.blue.position.x).toBeCloseTo(0, 5);
      expect(arena.blue.resource).toBeGreaterThanOrEqual(mana);
      expect(arena.blue.getAbilityCooldown('E')).toBe(0);
      expect(arena.red.hasEffect(MARK)).toBe(false);
    }
  });

  test("silenced or stunned he can't cast it", () => {
    for (const cc of ['silence', 'stun']) {
      const arena = kipArena(new Vector(300, 0));
      arena.blue.applyEffect(cc, 1, arena.red.id);
      expect(dash(arena).success).toBe(false);
      expect(arena.blue.forcedMovement).toBeNull();
    }
  });

  test('it costs 60 mana; its cooldown is 16 s at rank 1 and 12 s at rank 5', () => {
    const arena = kipArena(new Vector(3000, 3000));
    const mana = arena.blue.resource;
    dash(arena);
    expect(arena.blue.resource).toBe(mana - 60);
    expect(arena.blue.getAbilityCooldown('E')).toBe(16);
    untilLanded(arena);
    arena.blue.setLevel(18);
    arena.blue.maxAbility('E');
    arena.blue.resetCooldowns();
    dash(arena);
    expect(arena.blue.getAbilityCooldown('E')).toBe(12);
  });
});

// =============================================================================
// R: Show Them All
// =============================================================================

describe('Kip R - Show Them All', () => {
  /** Kip with `count` marked enemy champions around him (red and more), and their hits */
  function markedArena(count: number): { arena: TestArena; enemies: TestChampion[]; hits: Hit[][] } {
    const arena = kipArena(new Vector(300, 0));
    const enemies: TestChampion[] = [arena.red];
    const spots = [new Vector(-300, 0), new Vector(0, 300), new Vector(0, -300), new Vector(250, 250)];
    for (let i = 1; i < count; i++) enemies.push(addChampion(arena, TEAM_RED, spots[i - 1]));
    for (const enemy of enemies.slice(0, count)) mark(arena, enemy);
    return { arena, enemies, hits: enemies.map(recordHits) };
  }
  const cast = (arena: TestArena) => arena.castAbility(arena.blue, 'R');
  /** Each arrow's share of the full damage, with that many marks */
  const SHARE: Record<number, number> = { 1: 1, 2: 0.625, 3: 0.5, 4: 0.4375, 5: 0.4 };

  test('with no marked enemy in reach it fails: no mana, no cooldown', () => {
    const arena = kipArena(new Vector(300, 0));
    const mana = arena.blue.resource;
    const result = cast(arena);
    expect(result.success).toBe(false);
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.getAbilityCooldown('R')).toBe(0);
  });

  test('one mark: one arrow of 150 + 75% AD physical damage', () => {
    const { arena, hits } = markedArena(1);
    expect(cast(arena).success).toBe(true);
    expect(ultimateArrows(arena).length).toBe(1);
    step(arena, 1.5);
    expect(hits[0].length).toBe(1);
    expect(hits[0][0].type).toBe('physical');
    expect(hits[0][0].amount).toBeCloseTo(fullR(arena, 1), 6);
  });

  for (const count of [2, 3, 4, 5]) {
    test(`${count} marks: ${count} arrows at each marked enemy, ${count * count} in all, each ${SHARE[count] * 100}% of the full damage`, () => {
      const { arena, enemies, hits } = markedArena(count);
      cast(arena);
      step(arena, 2, enemies.slice(1));
      for (const enemyHits of hits) {
        expect(enemyHits.length).toBe(count);
        for (const hit of enemyHits) expect(hit.amount).toBeCloseTo(fullR(arena, 1) * SHARE[count], 6);
      }
    });
  }

  test('each marked enemy takes 100% + 25% per other mark in all (5 marks: 200% each, 10 full arrows in all)', () => {
    for (let count = 1; count <= 5; count++) {
      const { arena, enemies, hits } = markedArena(count);
      cast(arena);
      step(arena, 2, enemies.slice(1));
      const total = hits.map(list => list.reduce((sum, hit) => sum + hit.amount, 0));
      for (const each of total) expect(each).toBeCloseTo(fullR(arena, 1) * (1 + 0.25 * (count - 1)), 6);
    }
  });

  test('the arrows come in volleys 0.15 s apart, the first at once', () => {
    const { arena, enemies } = markedArena(3);
    cast(arena);
    expect(ultimateArrows(arena).length).toBe(3);
    step(arena, 0.1, enemies.slice(1));
    expect(ultimateArrows(arena).length).toBe(3);
    step(arena, 0.1, enemies.slice(1));
    expect(ultimateArrows(arena).length).toBe(6);
    step(arena, 0.15, enemies.slice(1));
    expect(ultimateArrows(arena).length).toBe(9);
    step(arena, 0.5, enemies.slice(1));
    expect(ultimateArrows(arena).length).toBe(9);
  });

  test('a marked enemy past 650 (to the edge of its body) is neither counted nor shot', () => {
    const arena = kipArena(new Vector(300, 0));
    const far = addChampion(arena, TEAM_RED, new Vector(0, R.aoeRadius! + 25 + 5));
    mark(arena, arena.red);
    mark(arena, far);
    const hits = recordHits(arena.red);
    const farHits = recordHits(far);
    cast(arena);
    expect(ultimateArrows(arena).length).toBe(1);
    step(arena, 1.5, [far]);
    expect(hits.length).toBe(1);
    expect(hits[0].amount).toBeCloseTo(fullR(arena, 1), 6);
    expect(farHits).toEqual([]);
  });

  test('a marked enemy just inside 650 counts', () => {
    const arena = kipArena(new Vector(0, R.aoeRadius! + 25 - 5));
    mark(arena, arena.red);
    const hits = recordHits(arena.red);
    expect(cast(arena).success).toBe(true);
    step(arena, 1.5);
    expect(hits.length).toBe(1);
  });

  test('only a far marked enemy: it fails, nothing spent', () => {
    const arena = kipArena(new Vector(0, R.aoeRadius! + 60));
    mark(arena, arena.red);
    const mana = arena.blue.resource;
    expect(cast(arena).success).toBe(false);
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.getAbilityCooldown('R')).toBe(0);
  });

  test('unmarked enemies and minions near him are not shot', () => {
    const arena = kipArena(new Vector(300, 0));
    const unmarked = addChampion(arena, TEAM_RED, new Vector(-200, 0));
    const minion = arena.addMinion(TEAM_RED, new Vector(0, 150));
    mark(arena, arena.red);
    const unmarkedHits = recordHits(unmarked);
    const minionHits = recordHits(minion);
    cast(arena);
    step(arena, 1.5, [unmarked]);
    expect(unmarkedHits).toEqual([]);
    expect(minionHits).toEqual([]);
  });

  test('the arrows leave the marks: his next basic attack still pops one', () => {
    const { arena, hits } = markedArena(1);
    cast(arena);
    step(arena, 1.5);
    expect(arena.red.hasEffect(MARK)).toBe(true);
    const shot = shoot(arena, arena.red, hits[0], 1);
    expect(shot.length).toBe(2);
    expect(shot[1].amount).toBeCloseTo(popBonus(arena.blue, arena.red), 6);
  });

  test('his arrows are not basic attacks: they give no speed', () => {
    const { arena, hits } = markedArena(1);
    cast(arena);
    expect(ultimateArrows(arena).length).toBe(1);
    step(arena, 1.5);
    expect(hits[0].length).toBe(1);
    expect(arena.blue.hasEffect(HUNT)).toBe(false);
  });

  test("the targets are set when he casts it: a mark running out between volleys doesn't stop that enemy's arrows", () => {
    const { arena, enemies, hits } = markedArena(2);
    arena.red.applyEffect(MARK, 0.05, arena.blue.id);
    cast(arena);
    step(arena, 1.5, enemies.slice(1));
    expect(arena.red.hasEffect(MARK)).toBe(false);
    expect(hits[0].length).toBe(2);
    expect(hits[1].length).toBe(2);
  });

  test("a target that dies between volleys gets no more arrows, and they don't go to the others", () => {
    const { arena, enemies, hits } = markedArena(3);
    cast(arena);
    step(arena, 0.05, enemies.slice(1));
    enemies[1].takeDamage(1e9, 'true');
    step(arena, 1.5, enemies.slice(2));
    expect(hits[1].filter(hit => hit.type === 'physical').length).toBeLessThanOrEqual(1);
    expect(hits[0].length).toBe(3);
    expect(hits[2].length).toBe(3);
  });

  test('if he dies between volleys, the rest are not fired', () => {
    const { arena, enemies, hits } = markedArena(2);
    cast(arena);
    step(arena, 0.05, enemies.slice(1));
    arena.blue.takeDamage(1e9, 'true');
    step(arena, 1.5, enemies.slice(1));
    expect(ultimateArrows(arena).length).toBe(2);
    expect(hits[0].length).toBeLessThanOrEqual(1);
  });

  test('if he is stunned between volleys, the rest are not fired', () => {
    const { arena, enemies } = markedArena(3);
    cast(arena);
    step(arena, 0.05, enemies.slice(1));
    arena.blue.applyEffect('stun', 1, arena.red.id);
    step(arena, 1.5, enemies.slice(1));
    expect(ultimateArrows(arena).length).toBe(3);
  });

  test('each arrow can critically strike: with 100% crit each deals twice', () => {
    const { arena, enemies, hits } = markedArena(2);
    alwaysCrit(arena.blue);
    cast(arena);
    step(arena, 1.5, enemies.slice(1));
    for (const enemyHits of hits) {
      expect(enemyHits.length).toBe(2);
      for (const hit of enemyHits) expect(hit.amount).toBeCloseTo(fullR(arena, 1) * SHARE[2] * 2, 6);
    }
  });

  test('at rank 3: 350 + 75% AD with one mark', () => {
    const { arena, hits } = markedArena(1);
    arena.blue.setLevel(18);
    arena.blue.maxAbility('R');
    cast(arena);
    expect(ultimateArrows(arena).length).toBe(1);
    step(arena, 1.5);
    expect(hits[0][0].amount).toBeCloseTo(350 + 0.75 * adOf(arena.blue), 6);
  });

  test('it costs 100 mana; its cooldown is 100 / 85 / 70 s', () => {
    for (const rank of [1, 2, 3]) {
      const { arena } = markedArena(1);
      arena.blue.setLevel(18);
      arena.blue.abilityStates.R.rank = rank;
      arena.blue.setResource(arena.blue.maxResource);
      const mana = arena.blue.resource;
      cast(arena);
      expect(arena.blue.resource).toBe(mana - 100);
      expect(arena.blue.getAbilityCooldown('R')).toBe([100, 85, 70][rank - 1]);
    }
  });

  test("silenced or stunned he can't cast it; rooted he can", () => {
    for (const cc of ['silence', 'stun', 'root']) {
      const { arena } = markedArena(1);
      arena.blue.applyEffect(cc, 1, arena.red.id);
      expect(cast(arena).success).toBe(cc === 'root');
    }
  });

  test("the arrows follow their targets (they can't be dodged)", () => {
    const { arena, hits } = markedArena(1);
    cast(arena);
    expect(ultimateArrows(arena).length).toBe(1);
    for (let t = 0; t < 1.5; t += DT) {
      arena.red.position.y += 100 * DT;
      step(arena, DT);
    }
    expect(hits[0].length).toBe(1);
  });
});

// =============================================================================
// Practice bots playing him
// =============================================================================

/** A practice bot, asked what it would cast in a fight */
class AskedBot extends LaneBot {
  offense(champion: TestChampion, target: TestChampion, arena: TestArena) {
    return this.chooseAbility(champion, target, 'offense', arena.context);
  }
}

describe('Kip played by a practice bot', () => {
  /** Kip with only `ready` off cooldown, an enemy at 300 */
  function botArena(ready: ('Q' | 'W' | 'E' | 'R')[]): { arena: TestArena; bot: AskedBot } {
    const arena = kipArena(new Vector(300, 0));
    for (const slot of ['Q', 'W', 'E', 'R'] as const) {
      arena.blue.abilityStates[slot].cooldownRemaining = ready.includes(slot) ? 0 : 10;
    }
    return { arena, bot: new AskedBot({ playerId: arena.blue.playerId }) };
  }

  test("it presses Run Them Down, then Show Them All, on an enemy he marked, and not before he marked it", () => {
    const { arena, bot } = botArena(['W', 'R']);
    expect(bot.offense(arena.blue, arena.red, arena)).toBeNull();
    mark(arena, arena.red);
    expect(bot.offense(arena.blue, arena.red, arena)).toMatchObject({ slot: 'W', targetType: 'none' });
    arena.blue.abilityStates.W.cooldownRemaining = 10;
    expect(bot.offense(arena.blue, arena.red, arena)).toMatchObject({ slot: 'R', targetType: 'none' });
  });

  test('a mark from another Kip is no reason to', () => {
    const { arena, bot } = botArena(['W', 'R']);
    const otherKip = addChampion(arena, TEAM_BLUE, new Vector(0, 300), 'kip');
    arena.red.applyEffect(MARK, KIP_KIT.markDuration, otherKip.id);
    expect(bot.offense(arena.blue, arena.red, arena)).toBeNull();
  });

  test('it leaps in (Grand Entrance) only to catch a weakened enemy out of his reach', () => {
    const { arena, bot } = botArena(['E']);
    arena.red.position.setFrom(new Vector(arena.blue.getAttackRange() + 90, 0));
    expect(bot.offense(arena.blue, arena.red, arena)).toBeNull();
    arena.red.setHealth(arena.red.maxHealth * 0.3);
    expect(bot.offense(arena.blue, arena.red, arena)).toMatchObject({ slot: 'E', targetType: 'position' });
  });
});
