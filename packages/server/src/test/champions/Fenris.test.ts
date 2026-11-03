/**
 * Fenris Champion Tests
 *
 * Fenris - The Cursed Howler, a jungle bruiser.
 * - Passive: Adrenaline Rush - under 40% health he's feral: 12% faster, his
 *   abilities deal 30% more damage and Vicious Bite heals twice as much
 * - Q: Vicious Bite - targeted damage and a heal on himself
 * - W: Savage Claw - a cone in front of him that slows, after the swipe
 * - E: Pounce - a leap at an enemy: damage and a slow when he lands on it
 * - R: Bloodthirst - faster attacks that heal him; a champion kill heals
 *   him to full (and, feral, restores his mana)
 */

import { describe, test, expect } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  FENRIS_FERAL,
  GameEventType,
  TEAM_BLUE,
  TEAM_RED,
  calculateAbilityValue,
  getAbilityDefinition,
  type DamageType,
  type Side,
} from '@siege/shared';
import { createTestArena, calculatePhysicalDamage, type TestArena, TestChampion } from '../ServerTestUtils';
import type { ServerEntity } from '../../simulation/ServerEntity';

const DT = 1 / 60;
const Q = getAbilityDefinition('fenris_q')!;
const W = getAbilityDefinition('fenris_w')!;
const E = getAbilityDefinition('fenris_e')!;
const R = getAbilityDefinition('fenris_r')!;
const FERAL = 1 + FENRIS_FERAL.damageBonus;

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

/** Record the heals a unit is given */
function recordHeals(entity: ServerEntity): number[] {
  const heals: number[] = [];
  const heal = entity.heal.bind(entity);
  entity.heal = ((amount, context, sourceId) => {
    heals.push(amount);
    return heal(amount, context, sourceId);
  }) as typeof entity.heal;
  return heals;
}

/** Fenris (level 6, every ability rank 1) next to Magnus, both full */
function fenrisArena(redAt = new Vector(80, 0)): TestArena {
  const arena = createTestArena({ blueChampion: 'fenris', redChampion: 'magnus', bluePosition: new Vector(0, 0), redPosition: redAt });
  // (Leveling up raises max health, not health)
  arena.blue.setLevel(6);
  arena.red.setLevel(6);
  arena.blue.setHealth(arena.blue.maxHealth);
  arena.red.setHealth(arena.red.maxHealth);
  arena.blue.setResource(arena.blue.maxResource);
  return arena;
}

function addChampion(arena: TestArena, id: string, side: Side, at: Vector, championId = 'magnus'): TestChampion {
  const champion = new TestChampion({ id, position: at.clone(), side, definition: CHAMPION_DEFINITIONS[championId], playerId: `player-${id}` });
  arena.context.addChampion(champion, `player-${id}`);
  champion.setLevel(6);
  champion.setHealth(champion.maxHealth);
  arena.context.getFogOfWar().updateVision(arena.context, 1);
  return champion;
}

/** Put him at a share of his health */
const hurt = (arena: TestArena, share: number) => arena.blue.setHealth(arena.blue.maxHealth * share);

const adOf = (champion: TestChampion) => champion.getStats().attackDamage;

/** Let his next basic attack on a target land; returns its hits */
function basicAttack(arena: TestArena, target: ServerEntity, hits: Hit[]): Hit[] {
  arena.context.getFogOfWar().updateVision(arena.context, 1);
  arena.blue.setAttackTarget(target.id);
  const before = hits.length;
  for (let t = 0; t < 3 && hits.length === before; t += DT) arena.tick(DT);
  arena.blue.stop();
  return hits.slice(before);
}

/** Tick until his leap lands (or the time runs out) */
function untilLanded(arena: TestArena, seconds = 2): void {
  for (let t = 0; t < seconds && (t === 0 || arena.blue.forcedMovement); t += DT) arena.tick(DT);
}

// =============================================================================
// Passive: Adrenaline Rush
// =============================================================================

describe('Fenris passive - Adrenaline Rush', () => {
  test('under 40% health he is feral: 12% faster', () => {
    const arena = fenrisArena(new Vector(3000, 3000));
    const speed = arena.blue.getStats().movementSpeed;
    hurt(arena, FENRIS_FERAL.health - 0.05);
    arena.tick(DT);
    expect(arena.blue.hasEffect('fenris_feral')).toBe(true);
    expect(arena.blue.passiveState.isActive).toBe(true);
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(speed * 1.12, 6);
  });

  test('at 40% or more he is not', () => {
    const arena = fenrisArena(new Vector(3000, 3000));
    hurt(arena, FENRIS_FERAL.health + 0.01);
    arena.tick(DT);
    expect(arena.blue.hasEffect('fenris_feral')).toBe(false);
    expect(arena.blue.passiveState.isActive).toBe(false);
  });

  test('healed back over 40%, he stops being feral; the speed fades within a moment', () => {
    const arena = fenrisArena(new Vector(3000, 3000));
    hurt(arena, 0.3);
    arena.tick(DT);
    hurt(arena, 0.6);
    arena.tick(DT);
    expect(arena.blue.passiveState.isActive).toBe(false);
    arena.tickFrames(Math.ceil(0.35 / DT));
    expect(arena.blue.hasEffect('fenris_feral')).toBe(false);
  });

  test('feral, his abilities deal 30% more damage', () => {
    const calm = fenrisArena();
    const calmHits = recordHits(calm.red);
    calm.castAbility(calm.blue, 'Q', { targetId: calm.red.id });

    const feral = fenrisArena();
    hurt(feral, 0.3);
    const feralHits = recordHits(feral.red);
    feral.castAbility(feral.blue, 'Q', { targetId: feral.red.id });
    expect(feralHits[0].amount).toBeCloseTo(calmHits[0].amount * FERAL, 6);
  });

  test('his basic attacks are not raised', () => {
    const arena = fenrisArena(new Vector(60, 0));
    hurt(arena, 0.3);
    const hits = recordHits(arena.red);
    const [attack] = basicAttack(arena, arena.red, hits);
    expect(attack.amount).toBeCloseTo(adOf(arena.blue), 6);
  });

  test('dead, he is not feral', () => {
    const arena = fenrisArena(new Vector(3000, 3000));
    arena.blue.takeDamage(1e9, 'true');
    arena.tick(DT);
    expect(arena.blue.passiveState.isActive).toBe(false);
  });
});

// =============================================================================
// Q: Vicious Bite
// =============================================================================

describe('Fenris Q - Vicious Bite', () => {
  const biteDamage = (arena: TestArena, rank: number) => calculateAbilityValue(Q.damage!.scaling, rank, { attackDamage: adOf(arena.blue) });
  const biteHeal = (arena: TestArena, rank: number) => calculateAbilityValue(Q.heal!.scaling, rank, { attackDamage: adOf(arena.blue) });

  test('bites for 40 + 70% AD physical damage and heals him 20 + 20% AD at rank 1', () => {
    const arena = fenrisArena();
    hurt(arena, 0.7);
    const hits = recordHits(arena.red);
    const heals = recordHeals(arena.blue);
    expect(arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id }).success).toBe(true);
    expect(hits).toEqual([{ amount: biteDamage(arena, 1), type: 'physical', sourceId: arena.blue.id }]);
    expect(heals.length).toBe(1);
    expect(heals[0]).toBeCloseTo(biteHeal(arena, 1), 6);
  });

  test('at rank 5: 160 + 70% AD, and a 60 + 20% AD heal', () => {
    const arena = fenrisArena();
    arena.blue.setLevel(18);
    arena.blue.maxAbility('Q');
    hurt(arena, 0.7);
    const hits = recordHits(arena.red);
    const heals = recordHeals(arena.blue);
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id });
    expect(hits[0].amount).toBeCloseTo(160 + 0.7 * adOf(arena.blue), 6);
    expect(heals[0]).toBeCloseTo(60 + 0.2 * adOf(arena.blue), 6);
  });

  test('feral, it hits 30% harder and heals twice as much', () => {
    const arena = fenrisArena();
    hurt(arena, 0.3);
    arena.tick(DT);
    const hits = recordHits(arena.red);
    const heals = recordHeals(arena.blue);
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id });
    expect(hits[0].amount).toBeCloseTo(biteDamage(arena, 1) * FERAL, 6);
    expect(heals[0]).toBeCloseTo(biteHeal(arena, 1) * FENRIS_FERAL.biteHealMultiplier, 6);
  });

  test('the doubled heal follows his feral mode: under 40% it doubles, even the moment he got there', () => {
    const arena = fenrisArena();
    hurt(arena, FENRIS_FERAL.health - 0.01);
    const heals = recordHeals(arena.blue);
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id });
    expect(heals[0]).toBeCloseTo(biteHeal(arena, 1) * FENRIS_FERAL.biteHealMultiplier, 6);
  });

  test("the doubled heal follows his feral mode: back over 40% it doesn't double, though the feral speed lingers", () => {
    const arena = fenrisArena();
    hurt(arena, FENRIS_FERAL.health - 0.05);
    arena.tick(DT);
    expect(arena.blue.hasEffect('fenris_feral')).toBe(true);
    hurt(arena, FENRIS_FERAL.health + 0.05);
    const hits = recordHits(arena.red);
    const heals = recordHeals(arena.blue);
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id });
    expect(hits[0].amount).toBeCloseTo(biteDamage(arena, 1), 6);
    expect(heals[0]).toBeCloseTo(biteHeal(arena, 1), 6);
  });

  test('the heal stops at his max health', () => {
    const arena = fenrisArena();
    hurt(arena, 0.99);
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id });
    expect(arena.blue.health).toBe(arena.blue.maxHealth);
  });

  test('Wounds on him cut the heal by 40%', () => {
    const arena = fenrisArena();
    hurt(arena, 0.7);
    arena.blue.applyEffect('wounds', 3, arena.red.id);
    const health = arena.blue.health;
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id });
    expect(arena.blue.health - health).toBeCloseTo(biteHeal(arena, 1) * 0.6, 6);
  });

  test('an enemy just inside its 110 range is bitten; one past it: it fails, nothing spent', () => {
    const near = fenrisArena(new Vector(Q.range! - 5, 0));
    expect(near.castAbility(near.blue, 'Q', { targetId: near.red.id }).success).toBe(true);

    const far = fenrisArena(new Vector(Q.range! + 20, 0));
    const mana = far.blue.resource;
    const health = far.red.health;
    expect(far.castAbility(far.blue, 'Q', { targetId: far.red.id }).failReason).toBe('out_of_range');
    expect(far.blue.resource).toBe(mana);
    expect(far.blue.getAbilityCooldown('Q')).toBe(0);
    expect(far.red.health).toBe(health);
  });

  test('with no target, on himself or on an ally it fails, nothing spent', () => {
    const arena = fenrisArena();
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(-60, 0));
    const mana = arena.blue.resource;
    for (const targetId of [undefined, arena.blue.id, ally.id]) {
      expect(arena.castAbility(arena.blue, 'Q', { targetId }).failReason).toBe('invalid_target');
    }
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
  });

  test('it bites minions and jungle monsters, not towers', () => {
    const arena = fenrisArena(new Vector(3000, 3000));
    const minion = arena.addMinion(TEAM_RED, new Vector(60, 0));
    const monster = arena.addJungleCreature(new Vector(-60, 0));
    const tower = arena.addTower(TEAM_RED, new Vector(0, 90));
    const minionHits = recordHits(minion);
    const monsterHits = recordHits(monster);
    expect(arena.castAbility(arena.blue, 'Q', { targetId: minion.id }).success).toBe(true);
    arena.blue.resetCooldowns();
    expect(arena.castAbility(arena.blue, 'Q', { targetId: monster.id }).success).toBe(true);
    arena.blue.resetCooldowns();
    expect(arena.castAbility(arena.blue, 'Q', { targetId: tower.id }).failReason).toBe('invalid_target');
    expect(minionHits.length).toBe(1);
    expect(monsterHits.length).toBe(1);
  });

  test('a stun in its cast time cancels it: no bite, no heal, nothing spent', () => {
    const arena = fenrisArena();
    hurt(arena, 0.7);
    const hits = recordHits(arena.red);
    const heals = recordHeals(arena.blue);
    expect(arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id, casting: true }).success).toBe(true);
    arena.blue.applyEffect('stun', 1, arena.red.id);
    arena.tickFrames(30);
    expect(hits).toEqual([]);
    expect(heals.filter(amount => amount > 5)).toEqual([]);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
  });

  test('a target that died in its cast time: no bite, nothing spent', () => {
    const arena = fenrisArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id, casting: true });
    arena.red.takeDamage(1e9, 'true');
    arena.tickFrames(30);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
    expect(arena.blue.resource).toBeGreaterThanOrEqual(mana);
  });

  test('it costs 40 mana; its cooldown is 8 s at rank 1 and 6 s at rank 5', () => {
    const arena = fenrisArena();
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id });
    expect(arena.blue.resource).toBe(mana - Q.manaCost![0]);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(Q.cooldown![0]);
    arena.blue.setLevel(18);
    arena.blue.maxAbility('Q');
    arena.blue.resetCooldowns();
    arena.castAbility(arena.blue, 'Q', { targetId: arena.red.id });
    expect(arena.blue.getAbilityCooldown('Q')).toBe(Q.cooldown![4]);
  });
});

// =============================================================================
// W: Savage Claw
// =============================================================================

describe('Fenris W - Savage Claw', () => {
  const clawDamage = (arena: TestArena, rank: number) => calculateAbilityValue(W.damage!.scaling, rank, { attackDamage: adOf(arena.blue) });
  /** Claw toward +x */
  const claw = (arena: TestArena, options: { windup?: boolean } = {}) =>
    arena.castAbility(arena.blue, 'W', { targetPosition: new Vector(W.range!, 0), ...options });

  test('after the swipe, every enemy in front takes 55 + 80% AD and is slowed by 30% for 1.5 s', () => {
    const arena = fenrisArena(new Vector(100, 0));
    const minion = arena.addMinion(TEAM_RED, new Vector(80, 50));
    const hits = recordHits(arena.red);
    const minionHits = recordHits(minion);
    expect(claw(arena, { windup: true }).success).toBe(true);
    expect(hits).toEqual([]);
    arena.context.advanceTime(W.aoeDelay! + 0.01);
    expect(hits.length).toBe(1);
    expect(hits[0].amount).toBeCloseTo(clawDamage(arena, 1), 6);
    expect(minionHits.length).toBe(1);
    expect(arena.red.getEffect('slow_30')!.totalDuration).toBe(W.effectDuration!);
    expect(minion.activeEffects.some(effect => effect.definitionId === 'slow_30')).toBe(true);
  });

  test('its reach: 170 ahead, 45 degrees to each side; nothing behind or past it', () => {
    const cases: [Vector, boolean][] = [
      [new Vector(W.range! - 10, 0), true],
      [new Vector(W.range! + 10, 0), false],
      [new Vector(Math.cos(Math.PI / 5) * 120, Math.sin(Math.PI / 5) * 120), true],
      [new Vector(Math.cos(Math.PI / 3) * 120, Math.sin(Math.PI / 3) * 120), false],
      [new Vector(-80, 0), false],
    ];
    for (const [at, hit] of cases) {
      const arena = fenrisArena(at);
      const hits = recordHits(arena.red);
      claw(arena);
      expect(hits.length).toBe(hit ? 1 : 0);
    }
  });

  test('at rank 5 it deals 195 + 80% AD; feral, 30% more', () => {
    const arena = fenrisArena(new Vector(100, 0));
    arena.blue.setLevel(18);
    arena.blue.maxAbility('W');
    hurt(arena, 0.3);
    const hits = recordHits(arena.red);
    claw(arena);
    expect(hits[0].amount).toBeCloseTo((195 + 0.8 * adOf(arena.blue)) * FERAL, 6);
  });

  test('allies and towers in front are untouched', () => {
    const arena = fenrisArena(new Vector(3000, 3000));
    const ally = arena.addMinion(TEAM_BLUE, new Vector(80, 0));
    const tower = arena.addTower(TEAM_RED, new Vector(120, 20));
    const allyHits = recordHits(ally);
    const towerHits = recordHits(tower);
    claw(arena);
    expect(allyHits).toEqual([]);
    expect(towerHits).toEqual([]);
  });

  test('it costs 45 mana; its cooldown is 9 s at rank 1', () => {
    const arena = fenrisArena(new Vector(3000, 3000));
    const mana = arena.blue.resource;
    claw(arena);
    expect(arena.blue.resource).toBe(mana - W.manaCost![0]);
    expect(arena.blue.getAbilityCooldown('W')).toBe(W.cooldown![0]);
  });
});

// =============================================================================
// E: Pounce
// =============================================================================

describe('Fenris E - Pounce', () => {
  const pounceDamage = (arena: TestArena, rank: number) => calculateAbilityValue(E.damage!.scaling, rank, { attackDamage: adOf(arena.blue) });

  test('landing on the enemy: 40 + 50% AD physical damage and a 40% slow for 1.25 s, from the landing', () => {
    const arena = fenrisArena(new Vector(E.range! - 20, 0));
    const hits = recordHits(arena.red);
    expect(arena.castAbility(arena.blue, 'E', { targetId: arena.red.id }).success).toBe(true);
    expect(hits).toEqual([]);
    untilLanded(arena);
    expect(hits).toEqual([{ amount: pounceDamage(arena, 1), type: 'physical', sourceId: arena.blue.id }]);
    const slow = arena.red.getEffect('slow_40')!;
    expect(slow.totalDuration).toBe(E.effectDuration!);
    expect(slow.timeRemaining).toBeGreaterThan(E.effectDuration! - 2 * DT);
  });

  test('at rank 5 it deals 160 + 50% AD', () => {
    const arena = fenrisArena(new Vector(200, 0));
    arena.blue.setLevel(18);
    arena.blue.maxAbility('E');
    const hits = recordHits(arena.red);
    arena.castAbility(arena.blue, 'E', { targetId: arena.red.id });
    untilLanded(arena);
    expect(hits[0].amount).toBeCloseTo(160 + 0.5 * adOf(arena.blue), 6);
  });

  test('feral when he pounces, it hits 30% harder', () => {
    const arena = fenrisArena(new Vector(200, 0));
    hurt(arena, 0.3);
    const hits = recordHits(arena.red);
    arena.castAbility(arena.blue, 'E', { targetId: arena.red.id });
    untilLanded(arena);
    expect(hits[0].amount).toBeCloseTo(pounceDamage(arena, 1) * FERAL, 6);
  });

  test('he pounces on minions and jungle monsters too', () => {
    const arena = fenrisArena(new Vector(3000, 3000));
    const monster = arena.addJungleCreature(new Vector(200, 0));
    const hits = recordHits(monster);
    expect(arena.castAbility(arena.blue, 'E', { targetId: monster.id }).success).toBe(true);
    untilLanded(arena);
    expect(hits.length).toBe(1);
    expect(arena.blue.position.distanceTo(monster.position)).toBeLessThan(arena.blue.getRadius() + monster.getRadius() + 2);
  });

  test("an ally can't be pounced on: it fails, nothing spent", () => {
    const arena = fenrisArena(new Vector(3000, 3000));
    const ally = addChampion(arena, 'ally', TEAM_BLUE, new Vector(200, 0));
    const mana = arena.blue.resource;
    expect(arena.castAbility(arena.blue, 'E', { targetId: ally.id }).failReason).toBe('invalid_target');
    expect(arena.blue.resource).toBe(mana);
    expect(arena.blue.forcedMovement).toBeNull();
  });

  test('it costs 50 mana; its cooldown is 14 s at rank 1 and 10 s at rank 5', () => {
    const arena = fenrisArena(new Vector(200, 0));
    const mana = arena.blue.resource;
    arena.castAbility(arena.blue, 'E', { targetId: arena.red.id });
    expect(arena.blue.resource).toBe(mana - E.manaCost![0]);
    expect(arena.blue.getAbilityCooldown('E')).toBe(E.cooldown![0]);
    untilLanded(arena);
    arena.blue.setLevel(18);
    arena.blue.maxAbility('E');
    arena.blue.resetCooldowns();
    arena.castAbility(arena.blue, 'E', { targetId: arena.red.id });
    expect(arena.blue.getAbilityCooldown('E')).toBe(E.cooldown![4]);
  });
});

// =============================================================================
// R: Bloodthirst
// =============================================================================

describe('Fenris R - Bloodthirst', () => {
  const kill = (arena: TestArena, victim: ServerEntity) => victim.takeDamage(1e9, 'true', arena.blue.id, arena.context);

  test('for 8 s he attacks 35% faster', () => {
    const arena = fenrisArena(new Vector(3000, 3000));
    const attackSpeed = arena.blue.getStats().attackSpeed;
    expect(arena.castAbility(arena.blue, 'R', { casting: true }).success).toBe(true);
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.getEffect('fenris_bloodthirst')!.totalDuration).toBe(R.effectDuration!);
    expect(arena.blue.getStats().attackSpeed).toBeCloseTo(attackSpeed * 1.35, 6);
    arena.tickFrames(Math.ceil((R.effectDuration! + 0.1) / DT));
    expect(arena.blue.hasEffect('fenris_bloodthirst')).toBe(false);
    expect(arena.blue.getStats().attackSpeed).toBeCloseTo(attackSpeed, 6);
  });

  test('his basic attacks heal him 15% of the damage they deal (after armor) at rank 1, 25% at rank 3', () => {
    for (const rank of [1, 3]) {
      const arena = fenrisArena(new Vector(60, 0));
      arena.blue.setLevel(18);
      arena.blue.abilityStates.R.rank = rank;
      arena.blue.setResource(arena.blue.maxResource);
      hurt(arena, 0.5);
      arena.castAbility(arena.blue, 'R');
      const armor = arena.red.getStats().armor;
      const hits = recordHits(arena.red);
      const heals = recordHeals(arena.blue);
      basicAttack(arena, arena.red, hits);
      const dealt = calculatePhysicalDamage(adOf(arena.blue), armor);
      expect(heals.some(amount => Math.abs(amount - dealt * FENRIS_FERAL.lifeSteal[rank - 1]) < 1e-6)).toBe(true);
    }
  });

  test("without it, his attacks don't heal him", () => {
    const arena = fenrisArena(new Vector(60, 0));
    hurt(arena, 0.5);
    const hits = recordHits(arena.red);
    const heals = recordHeals(arena.blue);
    basicAttack(arena, arena.red, hits);
    expect(hits.length).toBe(1);
    expect(heals).toEqual([]);
  });

  test('a champion kill in it heals him to full and says so (fenris_r_feast); not feral, his mana stays', () => {
    const arena = fenrisArena();
    hurt(arena, 0.5);
    arena.castAbility(arena.blue, 'R');
    arena.blue.setResource(50);
    arena.context.flushEvents();
    kill(arena, arena.red);
    expect(arena.blue.health).toBe(arena.blue.maxHealth);
    expect(arena.blue.resource).toBe(50);
    const feast = arena.context.flushEvents().find(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'fenris_r_feast');
    expect(feast?.data.entityId).toBe(arena.blue.id);
  });

  test('a feral champion kill in it restores his mana too', () => {
    const arena = fenrisArena();
    hurt(arena, 0.3);
    arena.castAbility(arena.blue, 'R');
    arena.blue.setResource(50);
    kill(arena, arena.red);
    expect(arena.blue.health).toBe(arena.blue.maxHealth);
    expect(arena.blue.resource).toBe(arena.blue.maxResource);
  });

  test("a kill without it, or a minion's in it, doesn't heal him to full", () => {
    const without = fenrisArena();
    hurt(without, 0.5);
    kill(without, without.red);
    expect(without.blue.health).toBeLessThan(without.blue.maxHealth * 0.6);

    const minionKill = fenrisArena(new Vector(3000, 3000));
    const minion = minionKill.addMinion(TEAM_RED, new Vector(60, 0));
    hurt(minionKill, 0.5);
    minionKill.castAbility(minionKill.blue, 'R');
    kill(minionKill, minion);
    expect(minionKill.blue.health).toBeLessThan(minionKill.blue.maxHealth * 0.6);
  });

  test('it costs 100 mana; its cooldown is 100 / 85 / 70 s', () => {
    for (const rank of [1, 2, 3]) {
      const arena = fenrisArena(new Vector(3000, 3000));
      arena.blue.setLevel(18);
      arena.blue.abilityStates.R.rank = rank;
      arena.blue.setResource(arena.blue.maxResource);
      const mana = arena.blue.resource;
      arena.castAbility(arena.blue, 'R');
      expect(arena.blue.resource).toBe(mana - R.manaCost![rank - 1]);
      expect(arena.blue.getAbilityCooldown('R')).toBe(R.cooldown![rank - 1]);
    }
  });
});
