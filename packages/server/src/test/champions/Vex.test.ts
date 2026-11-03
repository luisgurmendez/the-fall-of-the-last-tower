/**
 * Vex Champion Tests
 *
 * Tests for Vex - a melee assassin with high burst and mobility.
 * Abilities:
 * - Passive: Assassin's Mark - every 3rd hit deals 4% of the target's max
 *   health as true damage (the count is shared between targets, 5 s)
 * - Q: Shadow Shuriken - Skillshot that marks the first enemy hit; marked
 *   enemies take 10% more damage from Vex
 * - W: Shadow Shroud - Stealth and speed buff
 * - E: Shadow Step - Dash; the next basic attack deals its damage
 * - R: Ninja Mode - Attack speed buff with CDR for Q and E; champion kills
 *   extend it
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  Vector,
  CHAMPION_DEFINITIONS,
  EntityType,
  GameEventType,
  TEAM_BLUE,
  TEAM_RED,
  calculateAbilityValue,
  getAbilityDefinition,
  getPassiveDefinition,
  type DamageType,
  type Side,
} from '@siege/shared';
import {
  createTestArena,
  calculatePhysicalDamage,
  TestArena,
  TestChampion,
} from '../ServerTestUtils';
import type { ServerEntity } from '../../simulation/ServerEntity';
import { ServerWard } from '../../simulation/ServerWard';
import { passiveTriggerSystem } from '../../systems/PassiveTriggerSystem';

const DT = 1 / 60;
const Q = getAbilityDefinition('vex_shuriken')!;
const W = getAbilityDefinition('vex_shroud')!;
const E = getAbilityDefinition('vex_dash')!;
const R = getAbilityDefinition('vex_ninja_mode')!;
const PASSIVE = getPassiveDefinition('vex_passive')!;
/** Marked enemies take this much of Vex's damage (Q's description: 10% more) */
const MARK_BONUS = 1.1;

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

/** Damage an entity took (after resistances): the DAMAGE events since the last flush */
function damageTaken(arena: TestArena, entityId: string): number[] {
  return arena.context.flushEvents()
    .filter(e => e.type === GameEventType.DAMAGE && e.data.entityId === entityId)
    .map(e => e.data.amount as number);
}

/** Step the champions and projectiles only (minions stay where the test put them) */
function stepProjectiles(arena: TestArena, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) {
    arena.tick(DT);
    for (const entity of arena.context.getAllEntities()) {
      if (entity.entityType === EntityType.PROJECTILE) entity.update(DT, arena.context);
    }
  }
}

/** Tick until the blue champion's dash ends */
function untilDashEnds(arena: TestArena, seconds = 2): void {
  for (let t = 0; t < seconds && (t === 0 || arena.blue.forcedMovement); t += DT) arena.tick(DT);
}

/** Vex (level 6, every ability rank 1) against Gorath, both full */
function vexArena(redAt = new Vector(200, 0), redChampion = 'gorath'): TestArena {
  const arena = createTestArena({ blueChampion: 'vex', redChampion, bluePosition: new Vector(0, 0), redPosition: redAt });
  // (Leveling up raises max health, not health)
  arena.blue.setLevel(6);
  arena.red.setLevel(6);
  arena.red.setHealth(arena.red.maxHealth);
  arena.blue.setResource(arena.blue.maxResource);
  arena.context.flushEvents();
  return arena;
}

function addChampion(arena: TestArena, id: string, side: Side, at: Vector, championId = 'warrior'): TestChampion {
  const champion = new TestChampion({ id, position: at.clone(), side, definition: CHAMPION_DEFINITIONS[championId], playerId: `player-${id}` });
  arena.context.addChampion(champion, `player-${id}`);
  arena.context.getFogOfWar().updateVision(arena.context, 1);
  return champion;
}

/** Let the blue champion's next basic attack on a target land; returns its hits */
function basicAttack(arena: TestArena, target: ServerEntity, hits: Hit[]): Hit[] {
  arena.context.getFogOfWar().updateVision(arena.context, 1);
  arena.blue.setAttackTarget(target.id);
  const before = hits.length;
  for (let t = 0; t < 3 && hits.length === before; t += DT) arena.tick(DT);
  arena.blue.stop();
  return hits.slice(before);
}

/** Vex's AD now */
const adOf = (champion: TestChampion) => champion.getStats().attackDamage;

describe('Vex', () => {
  let arena: TestArena;

  // Default arena with abilities learned (for ability tests)
  beforeEach(() => {
    arena = createTestArena({
      blueChampion: 'vex',
      redChampion: 'magnus',
      bluePosition: new Vector(0, 0),
      redPosition: new Vector(300, 0),
    });
  });

  describe('Base Stats', () => {
    // Base: health=520, resource=260, attackDamage=65 (level 1)
    let statsArena: TestArena;

    beforeEach(() => {
      statsArena = createTestArena({
        blueChampion: 'vex',
        redChampion: 'magnus',
        bluePosition: new Vector(0, 0),
        redPosition: new Vector(300, 0),
        learnAbilities: false,
      });
    });

    test('should have correct base health (570)', () => {
      expect(statsArena.blue.maxHealth).toBe(570);
    });

    test('should have melee attack range', () => {
      const { attackRange } = CHAMPION_DEFINITIONS.vex.baseStats;
      expect(statsArena.blue.getStats().attackRange).toBe(attackRange);
      expect(attackRange).toBeLessThan(100);
    });

    test('should have correct base attack damage (65)', () => {
      expect(statsArena.blue.getStats().attackDamage).toBe(65);
    });

    test('should use energy (resourceType)', () => {
      expect(statsArena.blue.definition.resourceType).toBe('energy');
    });

    test('should have correct base resource (260)', () => {
      expect(statsArena.blue.maxResource).toBe(260);
    });
  });

  describe('Q - Shadow Shuriken', () => {
    test('should fire a projectile', () => {
      const result = arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(700, 0),
      });

      expect(result.success).toBe(true);
    });

    test('should have low energy cost (30)', () => {
      const initialEnergy = arena.blue.resource;

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(700, 0),
      });

      expect(arena.blue.resource).toBe(initialEnergy - 30);
    });

    test('should have short cooldown at max rank', () => {
      arena.blue.maxAbility('Q');

      arena.castAbility(arena.blue, 'Q', {
        targetPosition: new Vector(700, 0),
      });

      const cooldown = arena.blue.getAbilityCooldown('Q');
      expect(cooldown).toBeLessThanOrEqual(4);
    });
  });

  describe('W - Shadow Shroud', () => {
    test('should cast successfully', () => {
      const result = arena.castAbility(arena.blue, 'W');
      expect(result.success).toBe(true);
    });

    test('should have correct energy cost at rank 1 (50)', () => {
      const initialEnergy = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.resource).toBe(initialEnergy - 50);
    });

    test('energy cost should decrease with rank', () => {
      arena.blue.maxAbility('W');
      arena.blue.resetCooldowns();

      const initialEnergy = arena.blue.resource;
      arena.castAbility(arena.blue, 'W');
      expect(arena.blue.resource).toBe(initialEnergy - 30);
    });

    test('should apply stealth effect', () => {
      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.hasEffect('vex_stealth')).toBe(true);
    });

    test('should apply speed buff', () => {
      const baseSpeed = arena.blue.getStats().movementSpeed;

      arena.castAbility(arena.blue, 'W');
      arena.tick();

      expect(arena.blue.getStats().movementSpeed).toBeGreaterThan(baseSpeed);
    });
  });

  describe('E - Shadow Step', () => {
    test('should cast successfully', () => {
      const result = arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(200, 0),
      });

      expect(result.success).toBe(true);
    });

    test('should have fixed energy cost (40)', () => {
      const initialEnergy = arena.blue.resource;

      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(200, 0),
      });

      expect(arena.blue.resource).toBe(initialEnergy - 40);
    });

    test('cooldown should decrease with rank', () => {
      // Rank 1: 14s
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(200, 0),
      });
      expect(arena.blue.getAbilityCooldown('E')).toBeGreaterThanOrEqual(12);

      // Max rank: 6s
      arena.blue.resetCooldowns();
      arena.blue.maxAbility('E');
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(200, 0),
      });
      expect(arena.blue.getAbilityCooldown('E')).toBeLessThanOrEqual(8);
    });

    test('should apply empowered attack buff', () => {
      arena.castAbility(arena.blue, 'E', {
        targetPosition: new Vector(200, 0),
      });
      arena.tick();

      expect(arena.blue.hasEffect('vex_empowered')).toBe(true);
    });
  });

  describe('R - Ninja Mode', () => {
    test('should cast successfully (self-target)', () => {
      const result = arena.castAbility(arena.blue, 'R');

      expect(result.success).toBe(true);
    });

    test('should have no energy cost (0)', () => {
      const initialEnergy = arena.blue.resource;

      arena.castAbility(arena.blue, 'R');

      expect(arena.blue.resource).toBe(initialEnergy);
    });

    test('should have long cooldown at rank 1 (100s)', () => {
      arena.castAbility(arena.blue, 'R');

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBe(100);
    });

    test('cooldown should decrease at max rank (60s)', () => {
      arena.blue.maxAbility('R');

      arena.castAbility(arena.blue, 'R');

      const cooldown = arena.blue.getAbilityCooldown('R');
      expect(cooldown).toBe(60);
    });

    test('should apply ninja mode effect to self', () => {
      arena.castAbility(arena.blue, 'R');
      arena.tick();

      expect(arena.blue.hasEffect('vex_ninja_mode')).toBe(true);
    });

    test('should enable ninja mode state', () => {
      arena.castAbility(arena.blue, 'R');
      arena.tick();

      expect(arena.blue.isInNinjaMode()).toBe(true);
    });

    test('should increase attack speed', () => {
      const baseAttackSpeed = arena.blue.getStats().attackSpeed;

      arena.castAbility(arena.blue, 'R');
      arena.tick();

      const buffedAttackSpeed = arena.blue.getStats().attackSpeed;
      expect(buffedAttackSpeed).toBeGreaterThan(baseAttackSpeed);
    });

    test('should apply 30% attack speed bonus at rank 1', () => {
      const baseAttackSpeed = arena.blue.getStats().attackSpeed;

      arena.castAbility(arena.blue, 'R');
      arena.tick();

      const buffedAttackSpeed = arena.blue.getStats().attackSpeed;
      // 30% bonus at rank 1
      const expectedMinBonus = baseAttackSpeed * 1.25; // Allow some tolerance
      expect(buffedAttackSpeed).toBeGreaterThanOrEqual(expectedMinBonus);
    });

    test('should reduce Q cooldown by 50% when cast during Ninja Mode (upfront CDR)', () => {
      // Get base Q cooldown by casting without Ninja Mode
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(700, 0) });
      const baseCooldown = arena.blue.getAbilityCooldown('Q');
      expect(baseCooldown).toBeGreaterThan(0);

      // Reset and activate Ninja Mode first
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'R');
      arena.tick();
      expect(arena.blue.isInNinjaMode()).toBe(true);

      // Now cast Q while in Ninja Mode - should have 50% reduced cooldown
      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(700, 0) });
      const reducedCooldown = arena.blue.getAbilityCooldown('Q');

      // Cooldown should be ~50% of base
      expect(reducedCooldown).toBeCloseTo(baseCooldown * 0.5, 1);
    });

    test('should reduce E cooldown by 50% when cast during Ninja Mode (upfront CDR)', () => {
      // Get base E cooldown by casting without Ninja Mode
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(200, 0) });
      const baseCooldown = arena.blue.getAbilityCooldown('E');
      expect(baseCooldown).toBeGreaterThan(0);

      // Reset and activate Ninja Mode first
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'R');
      arena.tick();
      expect(arena.blue.isInNinjaMode()).toBe(true);

      // Now cast E while in Ninja Mode - should have 50% reduced cooldown
      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(200, 0) });
      const reducedCooldown = arena.blue.getAbilityCooldown('E');

      // Cooldown should be ~50% of base
      expect(reducedCooldown).toBeCloseTo(baseCooldown * 0.5, 1);
    });

    test('should NOT reduce W cooldown even when cast during Ninja Mode (only Q and E get CDR)', () => {
      // Get base W cooldown by casting without Ninja Mode
      arena.castAbility(arena.blue, 'W');
      const baseCooldown = arena.blue.getAbilityCooldown('W');
      expect(baseCooldown).toBeGreaterThan(0);

      // Reset and activate Ninja Mode first
      arena.blue.resetCooldowns();
      arena.castAbility(arena.blue, 'R');
      arena.tick();
      expect(arena.blue.isInNinjaMode()).toBe(true);

      // Now cast W while in Ninja Mode - should have same cooldown (no CDR for W)
      arena.castAbility(arena.blue, 'W');
      const cooldownDuringNinjaMode = arena.blue.getAbilityCooldown('W');

      // W cooldown should be the same (no reduction)
      expect(cooldownDuringNinjaMode).toBeCloseTo(baseCooldown, 1);
    });

    test('should deactivate when duration expires', () => {
      arena.castAbility(arena.blue, 'R');
      arena.tick();
      expect(arena.blue.isInNinjaMode()).toBe(true);

      // Fast forward 15 seconds (tick uses dt=1/60, so 60 ticks per second)
      for (let i = 0; i < 15 * 60; i++) {
        arena.tick();
      }

      expect(arena.blue.isInNinjaMode()).toBe(false);
      expect(arena.blue.hasEffect('vex_ninja_mode')).toBe(false);
    });
  });

  describe('Energy Management', () => {
    test('should be able to cast Q, W, E, R with starting energy', () => {
      // At level 6: Energy pool = 435 (260 base + 5*35 growth)
      // Q: 30, W: 50, E: 40, R: 0 (Ninja Mode)
      const startingEnergy = arena.blue.maxResource;

      arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(500, 0) });
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'W');
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(200, 0) });
      arena.blue.resetCooldowns();

      arena.castAbility(arena.blue, 'R'); // Ninja Mode is self-targeted

      // Total: 30 + 50 + 40 + 0 = 120 energy used
      expect(arena.blue.resource).toBe(startingEnergy - 120);
    });
  });
});

// =============================================================================
// Passive: Assassin's Mark
// =============================================================================

describe("Vex passive - Assassin's Mark", () => {
  const onHit = (arena: TestArena, target: ServerEntity) =>
    passiveTriggerSystem.dispatchTrigger('on_hit', arena.blue, arena.context, { target });
  /** The proc on a target: a share of its max health */
  const procOn = (target: ServerEntity) => calculateAbilityValue(PASSIVE.damage!.scaling, 1, { maxHealth: target.maxHealth });

  test('the first two hits deal nothing more; the third deals 4% of the target max health as true damage', () => {
    const arena = vexArena();
    const hits = recordHits(arena.red);
    onHit(arena, arena.red);
    onHit(arena, arena.red);
    expect(hits).toEqual([]);
    expect(arena.blue.passiveState.stacks).toBe(2);

    onHit(arena, arena.red);
    expect(hits.length).toBe(1);
    expect(hits[0].type).toBe('true');
    expect(hits[0].amount).toBeCloseTo(arena.red.maxHealth * 0.04, 6);
    expect(hits[0].amount).toBeCloseTo(procOn(arena.red), 6);
  });

  test('the proc is true damage: armor takes nothing off it', () => {
    const arena = vexArena();
    arena.red.addModifier({ source: 'test-armor', flat: { armor: 300 } });
    for (let i = 0; i < 3; i++) onHit(arena, arena.red);
    const [dealt] = damageTaken(arena, arena.red.id);
    expect(dealt).toBeCloseTo(procOn(arena.red), 6);
  });

  test('after a proc the count starts over: the sixth hit procs again, not the fourth or fifth', () => {
    const arena = vexArena();
    const hits = recordHits(arena.red);
    for (let i = 0; i < 3; i++) onHit(arena, arena.red);
    expect(arena.blue.passiveState.stacks).toBe(0);
    onHit(arena, arena.red);
    onHit(arena, arena.red);
    expect(hits.length).toBe(1);
    onHit(arena, arena.red);
    expect(hits.length).toBe(2);
  });

  test('the count is shared between targets (design): two hits on a minion, the third on a champion procs on the champion', () => {
    const arena = vexArena();
    const minion = arena.addMinion(TEAM_RED, new Vector(0, 80));
    const championHits = recordHits(arena.red);
    const minionHits = recordHits(minion);
    onHit(arena, minion);
    onHit(arena, minion);
    onHit(arena, arena.red);
    expect(minionHits).toEqual([]);
    expect(championHits.length).toBe(1);
    expect(championHits[0].amount).toBeCloseTo(procOn(arena.red), 6);
  });

  test('the stacks fade 5 s after the last hit', () => {
    const arena = vexArena();
    const hits = recordHits(arena.red);
    onHit(arena, arena.red);
    onHit(arena, arena.red);
    arena.tickFrames(Math.ceil((PASSIVE.stackDuration! + 0.1) / DT));
    expect(arena.blue.passiveState.stacks).toBe(0);
    onHit(arena, arena.red);
    expect(hits).toEqual([]);
    expect(arena.blue.passiveState.stacks).toBe(1);
  });

  test('a hit within the 5 s keeps them: the third hit still procs', () => {
    const arena = vexArena();
    const hits = recordHits(arena.red);
    onHit(arena, arena.red);
    arena.tickFrames(Math.floor((PASSIVE.stackDuration! - 0.5) / DT));
    onHit(arena, arena.red);
    arena.tickFrames(Math.floor((PASSIVE.stackDuration! - 0.5) / DT));
    onHit(arena, arena.red);
    expect(hits.length).toBe(1);
  });

  test('it procs on a tower too (design): 4% of the tower max health', () => {
    const arena = vexArena(new Vector(3000, 3000));
    const tower = arena.addTower(TEAM_RED, new Vector(100, 0));
    const hits = recordHits(tower);
    for (let i = 0; i < 3; i++) onHit(arena, tower);
    expect(hits.length).toBe(1);
    expect(hits[0].amount).toBeCloseTo(tower.maxHealth * 0.04, 6);
  });

  test('a bigger target takes more: it scales with the target max health, not Vex', () => {
    const arena = vexArena();
    arena.red.setLevel(18);
    arena.red.setHealth(arena.red.maxHealth);
    const minion = arena.addMinion(TEAM_RED, new Vector(0, 80));
    const championHits = recordHits(arena.red);
    const minionHits = recordHits(minion);
    for (let i = 0; i < 3; i++) onHit(arena, arena.red);
    for (let i = 0; i < 3; i++) onHit(arena, minion);
    expect(championHits[0].amount).toBeCloseTo(arena.red.maxHealth * 0.04, 6);
    expect(minionHits[0].amount).toBeCloseTo(minion.maxHealth * 0.04, 6);
    expect(championHits[0].amount).toBeGreaterThan(minionHits[0].amount);
  });

  test('with real basic attacks: the third attack on a champion procs', () => {
    const arena = vexArena(new Vector(60, 0));
    const hits = recordHits(arena.red);
    const ad = adOf(arena.blue);
    expect(basicAttack(arena, arena.red, hits)).toEqual([{ amount: ad, type: 'physical', sourceId: arena.blue.id }]);
    expect(basicAttack(arena, arena.red, hits).length).toBe(1);
    const third = basicAttack(arena, arena.red, hits);
    expect(third.length).toBe(2);
    expect(third[1].type).toBe('true');
    expect(third[1].amount).toBeCloseTo(procOn(arena.red), 6);
  });
});

// =============================================================================
// Q: Shadow Shuriken
// =============================================================================

describe('Vex Q - Shadow Shuriken', () => {
  const shurikenDamage = (arena: TestArena, rank: number) =>
    calculateAbilityValue(Q.damage!.scaling, rank, { attackDamage: adOf(arena.blue) });

  test('the first enemy hit takes 40 + 70% AD physical damage at rank 1, and is marked for 4 s', () => {
    const arena = vexArena(new Vector(200, 0));
    const hits = recordHits(arena.red);
    expect(arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) }).success).toBe(true);
    stepProjectiles(arena, 0.6);
    expect(hits.length).toBe(1);
    expect(hits[0].type).toBe('physical');
    expect(hits[0].amount).toBeCloseTo(shurikenDamage(arena, 1), 6);
    const mark = arena.red.getEffect('vex_mark')!;
    expect(mark.sourceId).toBe(arena.blue.id);
    expect(mark.totalDuration).toBe(Q.effectDuration!);
  });

  test('at rank 5 it deals 160 + 70% AD', () => {
    const arena = vexArena(new Vector(200, 0));
    arena.blue.setLevel(18);
    arena.blue.maxAbility('Q');
    const hits = recordHits(arena.red);
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
    stepProjectiles(arena, 0.6);
    expect(hits[0].amount).toBeCloseTo(shurikenDamage(arena, 5), 6);
    expect(shurikenDamage(arena, 5)).toBeCloseTo(160 + 0.7 * adOf(arena.blue), 6);
  });

  test('the mark fades after its 4 s; a second shuriken refreshes it', () => {
    const arena = vexArena(new Vector(200, 0));
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
    stepProjectiles(arena, 0.6);
    stepProjectiles(arena, 3);
    const remaining = arena.red.getEffect('vex_mark')!.timeRemaining;
    arena.blue.resetCooldowns();
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
    stepProjectiles(arena, 0.6);
    expect(arena.red.getEffect('vex_mark')!.timeRemaining).toBeGreaterThan(remaining + 2);
    stepProjectiles(arena, Q.effectDuration! + 0.1);
    expect(arena.red.hasEffect('vex_mark')).toBe(false);
  });

  test('it stops at the first enemy it meets, minions included: the champion behind is untouched', () => {
    const arena = vexArena(new Vector(300, 0));
    const minion = arena.addMinion(TEAM_RED, new Vector(150, 0));
    const championHits = recordHits(arena.red);
    const minionHits = recordHits(minion);
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
    stepProjectiles(arena, 1);
    expect(minionHits.length).toBe(1);
    expect(minion.activeEffects.some(e => e.definitionId === 'vex_mark')).toBe(true);
    expect(championHits).toEqual([]);
    expect(arena.red.hasEffect('vex_mark')).toBe(false);
  });

  test('it flies past allies', () => {
    const arena = vexArena(new Vector(300, 0));
    const ally = arena.addMinion(TEAM_BLUE, new Vector(150, 0));
    const allyHits = recordHits(ally);
    const hits = recordHits(arena.red);
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
    stepProjectiles(arena, 1);
    expect(allyHits).toEqual([]);
    expect(hits.length).toBe(1);
  });

  test('it flies past towers and wards (they are not hit)', () => {
    const arena = vexArena(new Vector(330, 0));
    const tower = arena.addTower(TEAM_RED, new Vector(160, 0));
    const ward = new ServerWard({ id: 'red-ward', position: new Vector(80, 0), side: TEAM_RED, wardType: 'stealth', ownerId: 'player-red' });
    arena.context.addEntity(ward);
    const towerHits = recordHits(tower);
    const hits = recordHits(arena.red);
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
    stepProjectiles(arena, 1);
    expect(towerHits).toEqual([]);
    expect(ward.isDead).toBe(false);
    expect(hits.length).toBe(1);
  });

  test('it hits a jungle monster', () => {
    const arena = vexArena(new Vector(3000, 3000));
    const monster = arena.addJungleCreature(new Vector(200, 0));
    const hits = recordHits(monster);
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
    stepProjectiles(arena, 1);
    expect(hits.length).toBe(1);
  });

  test('an enemy at the end of its range is hit; one past it is not', () => {
    const reach = Q.range! + Q.projectileRadius!;
    const near = vexArena(new Vector(reach, 0));
    const nearHits = recordHits(near.red);
    near.castAbility(near.blue, 'Q', { targetPosition: new Vector(reach, 0) });
    stepProjectiles(near, 1.2);
    expect(nearHits.length).toBe(1);

    const far = vexArena(new Vector(3000, 3000));
    far.red.position.setFrom(new Vector(reach + far.red.getRadius() + 10, 0));
    const farHits = recordHits(far.red);
    far.castAbility(far.blue, 'Q', { targetPosition: new Vector(reach, 0) });
    stepProjectiles(far, 1.2);
    expect(farHits).toEqual([]);
  });

  test('in its 0.25 s cast time nothing is thrown or spent; then it goes off', () => {
    const arena = vexArena(new Vector(200, 0));
    const energy = arena.blue.resource;
    expect(arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0), casting: true }).success).toBe(true);
    expect(arena.blue.isCasting()).toBe(true);
    expect(arena.blue.resource).toBe(energy);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
    expect(arena.context.getAllEntities().some(e => e.entityType === EntityType.PROJECTILE)).toBe(false);

    arena.tickFrames(Math.ceil(0.25 / DT) + 1);
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.getAbilityCooldown('Q')).toBeGreaterThan(0);
    expect(arena.context.getAllEntities().some(e => e.entityType === EntityType.PROJECTILE)).toBe(true);
  });

  test('a stun in its cast time cancels it: no shuriken, nothing spent', () => {
    const arena = vexArena(new Vector(200, 0));
    arena.blue.setResource(100);
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0), casting: true });
    arena.blue.applyEffect('stun', 1, arena.red.id);
    arena.tickFrames(30);
    expect(arena.blue.isCasting()).toBe(false);
    expect(arena.blue.resource).toBeGreaterThanOrEqual(100);
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
    expect(arena.context.getAllEntities().some(e => e.entityType === EntityType.PROJECTILE)).toBe(false);
  });

  test('stunned or silenced it fails, with nothing spent', () => {
    for (const [effect, reason] of [['stun', 'stunned'], ['silence', 'silenced']] as const) {
      const arena = vexArena(new Vector(200, 0));
      arena.blue.applyEffect(effect, 1, arena.red.id);
      const energy = arena.blue.resource;
      const result = arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
      expect(result).toEqual({ success: false, failReason: reason });
      expect(arena.blue.resource).toBe(energy);
      expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
    }
  });

  test('without 30 energy it fails', () => {
    const arena = vexArena(new Vector(200, 0));
    arena.blue.setResource(Q.manaCost![0] - 1);
    expect(arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) }).failReason).toBe('not_enough_mana');
    expect(arena.blue.getAbilityCooldown('Q')).toBe(0);
  });

  test('its cooldown: 6 s at rank 1, 4 s at rank 5', () => {
    const arena = vexArena(new Vector(200, 0));
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
    expect(arena.blue.getAbilityCooldown('Q')).toBe(Q.cooldown![0]);
    arena.blue.setLevel(18);
    arena.blue.maxAbility('Q');
    arena.blue.resetCooldowns();
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
    expect(arena.blue.getAbilityCooldown('Q')).toBe(Q.cooldown![4]);
  });
});

// =============================================================================
// Q's mark: marked enemies take 10% more damage from Vex
// =============================================================================

describe('Vex Q - marked enemies take 10% more damage from Vex', () => {
  test('damage Vex deals to an enemy she marked is 10% higher', () => {
    const arena = vexArena();
    arena.red.applyEffect('vex_mark', 4, arena.blue.id);
    arena.context.flushEvents();
    arena.red.takeDamage(100, 'true', arena.blue.id, arena.context);
    const [dealt] = damageTaken(arena, arena.red.id);
    expect(dealt).toBeCloseTo(100 * MARK_BONUS, 6);
  });

  test('an unmarked enemy takes the plain damage', () => {
    const arena = vexArena();
    arena.red.takeDamage(100, 'true', arena.blue.id, arena.context);
    expect(damageTaken(arena, arena.red.id)).toEqual([100]);
  });

  test("someone else's damage to the marked enemy isn't raised", () => {
    const arena = vexArena();
    const ally = addChampion(arena, 'blue-ally', TEAM_BLUE, new Vector(-100, 0));
    arena.red.applyEffect('vex_mark', 4, arena.blue.id);
    arena.context.flushEvents();
    arena.red.takeDamage(100, 'true', ally.id, arena.context);
    expect(damageTaken(arena, arena.red.id)).toEqual([100]);
  });

  test("a mark someone else put doesn't raise this Vex's damage", () => {
    const arena = vexArena();
    arena.red.applyEffect('vex_mark', 4, 'another-vex');
    arena.context.flushEvents();
    arena.red.takeDamage(100, 'true', arena.blue.id, arena.context);
    expect(damageTaken(arena, arena.red.id)).toEqual([100]);
  });

  // (Against Magnus: Gorath's passive gains armor as he takes damage)
  test('physical damage is raised before armor', () => {
    const arena = vexArena(new Vector(200, 0), 'magnus');
    const armor = arena.red.getStats().armor;
    arena.red.applyEffect('vex_mark', 4, arena.blue.id);
    arena.context.flushEvents();
    arena.red.takeDamage(100, 'physical', arena.blue.id, arena.context);
    const [dealt] = damageTaken(arena, arena.red.id);
    expect(dealt).toBeCloseTo(calculatePhysicalDamage(100 * MARK_BONUS, armor), 6);
  });

  test('the shuriken that marks is not raised; the next one is', () => {
    const arena = vexArena(new Vector(200, 0), 'magnus');
    const raw = calculateAbilityValue(Q.damage!.scaling, 1, { attackDamage: adOf(arena.blue) });
    const armor = arena.red.getStats().armor;
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
    stepProjectiles(arena, 0.6);
    const [first] = damageTaken(arena, arena.red.id);
    expect(first).toBeCloseTo(calculatePhysicalDamage(raw, armor), 6);

    arena.blue.resetCooldowns();
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(380, 0) });
    stepProjectiles(arena, 0.6);
    const [second] = damageTaken(arena, arena.red.id);
    expect(second).toBeCloseTo(calculatePhysicalDamage(raw * MARK_BONUS, armor), 6);
  });

  test("the passive's proc on a marked enemy is raised too", () => {
    const arena = vexArena();
    arena.red.applyEffect('vex_mark', 4, arena.blue.id);
    for (let i = 0; i < 2; i++) passiveTriggerSystem.dispatchTrigger('on_hit', arena.blue, arena.context, { target: arena.red });
    arena.context.flushEvents();
    passiveTriggerSystem.dispatchTrigger('on_hit', arena.blue, arena.context, { target: arena.red });
    const [proc] = damageTaken(arena, arena.red.id);
    expect(proc).toBeCloseTo(arena.red.maxHealth * 0.04 * MARK_BONUS, 6);
  });

  test('a marked minion takes 10% more too', () => {
    const arena = vexArena();
    const minion = arena.addMinion(TEAM_RED, new Vector(0, 80));
    minion.applyEffect('vex_mark', 4, arena.blue.id);
    arena.context.flushEvents();
    minion.takeDamage(10, 'true', arena.blue.id, arena.context);
    const [dealt] = damageTaken(arena, minion.id);
    expect(dealt).toBeCloseTo(10 * MARK_BONUS, 6);
  });

  test('the bonus ends with the mark', () => {
    const arena = vexArena();
    arena.red.applyEffect('vex_mark', 4, arena.blue.id);
    arena.tickFrames(Math.ceil(4.1 / DT));
    arena.context.flushEvents();
    arena.red.takeDamage(100, 'true', arena.blue.id, arena.context);
    expect(damageTaken(arena, arena.red.id)).toEqual([100]);
  });
});

// =============================================================================
// W: Shadow Shroud
// =============================================================================

describe('Vex W - Shadow Shroud', () => {
  test('stealth and 20% more movement speed for 10 s, then both end', () => {
    const arena = vexArena(new Vector(3000, 3000));
    const speed = arena.blue.getStats().movementSpeed;
    arena.castAbility(arena.blue, 'W');
    expect(arena.blue.getEffect('vex_stealth')!.totalDuration).toBe(W.effectDuration!);
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(speed * 1.2, 6);

    arena.tickFrames(Math.ceil((W.effectDuration! - 0.2) / DT));
    expect(arena.blue.hasEffect('vex_stealth')).toBe(true);
    arena.tickFrames(Math.ceil(0.3 / DT));
    expect(arena.blue.hasEffect('vex_stealth')).toBe(false);
    expect(arena.blue.hasEffect('speed_20')).toBe(false);
    expect(arena.blue.getStats().movementSpeed).toBeCloseTo(speed, 6);
  });

  test('enemies right next to her cannot see her; her team can', () => {
    const arena = vexArena(new Vector(80, 0));
    arena.castAbility(arena.blue, 'W');
    const fog = arena.context.getFogOfWar();
    fog.updateVision(arena.context, 1);
    expect(fog.isVisibleTo(arena.blue, TEAM_RED)).toBe(false);
    expect(fog.isVisibleTo(arena.blue, TEAM_BLUE)).toBe(true);
  });

  test('a basic attack breaks it', () => {
    const arena = vexArena(new Vector(60, 0));
    arena.castAbility(arena.blue, 'W');
    const hits = recordHits(arena.red);
    basicAttack(arena, arena.red, hits);
    expect(hits.length).toBe(1);
    expect(arena.blue.hasEffect('vex_stealth')).toBe(false);
  });

  test('casting Q, E or R breaks it', () => {
    for (const slot of ['Q', 'E', 'R'] as const) {
      const arena = vexArena(new Vector(3000, 3000));
      arena.castAbility(arena.blue, 'W');
      expect(arena.castAbility(arena.blue, slot, { targetPosition: new Vector(150, 0) }).success).toBe(true);
      expect(arena.blue.hasEffect('vex_stealth')).toBe(false);
    }
  });

  test('its cooldown: 18 s at rank 1, 10 s at rank 5', () => {
    const arena = vexArena(new Vector(3000, 3000));
    arena.castAbility(arena.blue, 'W');
    expect(arena.blue.getAbilityCooldown('W')).toBe(W.cooldown![0]);
    arena.blue.setLevel(18);
    arena.blue.maxAbility('W');
    arena.blue.resetCooldowns();
    arena.castAbility(arena.blue, 'W');
    expect(arena.blue.getAbilityCooldown('W')).toBe(W.cooldown![4]);
  });
});

// =============================================================================
// E: Shadow Step
// =============================================================================

describe('Vex E - Shadow Step', () => {
  const empoweredBonus = (arena: TestArena, rank: number) =>
    calculateAbilityValue(E.damage!.scaling, rank, { attackDamage: adOf(arena.blue) });

  test('the dash itself deals no damage to an enemy it passes through (only the empowered attack does)', () => {
    const arena = vexArena(new Vector(100, 0));
    const hits = recordHits(arena.red);
    expect(arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(E.range!, 0) }).success).toBe(true);
    untilDashEnds(arena);
    expect(hits).toEqual([]);
    expect(arena.blue.hasEffect('vex_empowered')).toBe(true);
  });

  test("the dash doesn't hurt a minion it passes through either", () => {
    const arena = vexArena(new Vector(3000, 3000));
    const minion = arena.addMinion(TEAM_RED, new Vector(100, 10));
    const hits = recordHits(minion);
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(E.range!, 0) });
    untilDashEnds(arena);
    expect(hits).toEqual([]);
  });

  test("the next basic attack deals Shadow Step's damage once as bonus physical damage (30 + 50% AD at rank 1)", () => {
    const arena = vexArena(new Vector(3000, 3000));
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(E.range!, 0) });
    untilDashEnds(arena);
    arena.red.position.setFrom(arena.blue.position.added(new Vector(60, 0)));
    const hits = recordHits(arena.red);
    const ad = adOf(arena.blue);

    const empowered = basicAttack(arena, arena.red, hits);
    expect(empowered.length).toBe(2);
    expect(empowered[0]).toEqual({ amount: ad, type: 'physical', sourceId: arena.blue.id });
    expect(empowered[1].type).toBe('physical');
    expect(empowered[1].amount).toBeCloseTo(empoweredBonus(arena, 1), 6);
    expect(arena.blue.hasEffect('vex_empowered')).toBe(false);

    // The next one is a plain attack
    expect(basicAttack(arena, arena.red, hits).length).toBe(1);
  });

  test('at rank 5 the bonus is 110 + 50% AD', () => {
    const arena = vexArena(new Vector(3000, 3000));
    arena.blue.setLevel(18);
    arena.blue.maxAbility('E');
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(E.range!, 0) });
    untilDashEnds(arena);
    arena.red.position.setFrom(arena.blue.position.added(new Vector(60, 0)));
    const hits = recordHits(arena.red);
    const empowered = basicAttack(arena, arena.red, hits);
    expect(empowered[1].amount).toBeCloseTo(110 + 0.5 * adOf(arena.blue), 6);
  });

  test('the empowered attack works on a minion', () => {
    const arena = vexArena(new Vector(3000, 3000));
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(E.range!, 0) });
    untilDashEnds(arena);
    const minion = arena.addMinion(TEAM_RED, arena.blue.position.added(new Vector(45, 0)));
    const hits = recordHits(minion);
    const empowered = basicAttack(arena, minion, hits);
    expect(empowered.length).toBe(2);
    expect(empowered[1].amount).toBeCloseTo(empoweredBonus(arena, 1), 6);
  });

  test('unused, the empowered attack is gone after 4 s', () => {
    const arena = vexArena(new Vector(3000, 3000));
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(E.range!, 0) });
    arena.tickFrames(Math.ceil((E.effectDuration! + 0.1) / DT));
    expect(arena.blue.hasEffect('vex_empowered')).toBe(false);
    arena.red.position.setFrom(arena.blue.position.added(new Vector(60, 0)));
    const hits = recordHits(arena.red);
    expect(basicAttack(arena, arena.red, hits).length).toBe(1);
  });

  test('aimed past its range it dashes its 200 units; aimed nearer it stops at the point', () => {
    const far = vexArena(new Vector(3000, 3000));
    far.castAbility(far.blue, 'E', { targetPosition: new Vector(600, 0) });
    untilDashEnds(far);
    expect(far.blue.position.x).toBeCloseTo(E.dash!.distance, 0);

    const near = vexArena(new Vector(3000, 3000));
    near.castAbility(near.blue, 'E', { targetPosition: new Vector(90, 0) });
    untilDashEnds(near);
    expect(near.blue.position.x).toBeCloseTo(90, 0);
  });

  test('aimed at her own feet it fails, with nothing spent', () => {
    const arena = vexArena(new Vector(3000, 3000));
    const energy = arena.blue.resource;
    const result = arena.castAbility(arena.blue, 'E', { targetPosition: arena.blue.position.clone() });
    expect(result.success).toBe(false);
    expect(arena.blue.resource).toBe(energy);
    expect(arena.blue.getAbilityCooldown('E')).toBe(0);
    expect(arena.blue.hasEffect('vex_empowered')).toBe(false);
  });

  test('silenced it fails, with nothing spent', () => {
    const arena = vexArena(new Vector(3000, 3000));
    arena.blue.applyEffect('silence', 1, arena.red.id);
    const energy = arena.blue.resource;
    expect(arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(150, 0) }).failReason).toBe('silenced');
    expect(arena.blue.resource).toBe(energy);
  });

  test('a marked enemy within 260 resets it (design: a marked minion counts, and the mark stays)', () => {
    const arena = vexArena(new Vector(3000, 3000));
    const minion = arena.addMinion(TEAM_RED, new Vector(200, 50));
    minion.applyEffect('vex_mark', 4, arena.blue.id);
    expect(arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(150, 0) }).success).toBe(true);
    expect(arena.blue.getAbilityCooldown('E')).toBe(0);
    expect(minion.activeEffects.some(e => e.definitionId === 'vex_mark')).toBe(true);
  });

  test('a marked enemy farther than 260, or an unmarked one near, does not reset it', () => {
    const far = vexArena(new Vector(300, 0));
    far.red.applyEffect('vex_mark', 4, far.blue.id);
    far.castAbility(far.blue, 'E', { targetPosition: new Vector(-150, 0) });
    expect(far.blue.getAbilityCooldown('E')).toBe(E.cooldown![0]);

    const unmarked = vexArena(new Vector(150, 0));
    unmarked.castAbility(unmarked.blue, 'E', { targetPosition: new Vector(-150, 0) });
    expect(unmarked.blue.getAbilityCooldown('E')).toBe(E.cooldown![0]);
  });

  test('it costs 40 energy; its cooldown is 14 s at rank 1 and 6 s at rank 5', () => {
    const arena = vexArena(new Vector(3000, 3000));
    const energy = arena.blue.resource;
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(150, 0) });
    expect(arena.blue.resource).toBe(energy - E.manaCost![0]);
    expect(arena.blue.getAbilityCooldown('E')).toBe(E.cooldown![0]);
    untilDashEnds(arena);
    arena.blue.setLevel(18);
    arena.blue.maxAbility('E');
    arena.blue.resetCooldowns();
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(0, 0) });
    expect(arena.blue.getAbilityCooldown('E')).toBe(E.cooldown![4]);
  });
});

// =============================================================================
// R: Ninja Mode
// =============================================================================

describe('Vex R - Ninja Mode', () => {
  const kill = (arena: TestArena, victim: ServerEntity, killer: ServerEntity = arena.blue) =>
    victim.takeDamage(1e9, 'true', killer.id, arena.context);

  test('attack speed +30% / +45% / +60% by rank', () => {
    for (const rank of [1, 2, 3]) {
      const arena = vexArena(new Vector(3000, 3000));
      arena.blue.setLevel(18);
      arena.blue.abilityStates.R.rank = rank;
      const attackSpeed = arena.blue.getStats().attackSpeed;
      arena.castAbility(arena.blue, 'R');
      expect(arena.blue.getStats().attackSpeed).toBeCloseTo(attackSpeed * (1 + R.statTransform!.statModifiers!.attackSpeed![rank - 1]), 6);
    }
  });

  test('it lasts 15 s; its attack speed ends with it', () => {
    const arena = vexArena(new Vector(3000, 3000));
    const attackSpeed = arena.blue.getStats().attackSpeed;
    arena.castAbility(arena.blue, 'R');
    expect(arena.blue.getEffect('vex_ninja_mode')!.timeRemaining).toBe(R.effectDuration!);
    arena.tickFrames(Math.ceil((R.effectDuration! - 0.2) / DT));
    expect(arena.blue.isInNinjaMode()).toBe(true);
    arena.tickFrames(Math.ceil(0.3 / DT));
    expect(arena.blue.isInNinjaMode()).toBe(false);
    expect(arena.blue.getStats().attackSpeed).toBeCloseTo(attackSpeed, 6);
  });

  test("a second Ninja Mode, after the first ran out, gives the same attack speed (they don't build up)", () => {
    const arena = vexArena(new Vector(3000, 3000));
    const attackSpeed = arena.blue.getStats().attackSpeed;
    arena.castAbility(arena.blue, 'R');
    arena.tickFrames(Math.ceil((R.effectDuration! + 0.1) / DT));
    arena.blue.resetCooldowns();
    arena.castAbility(arena.blue, 'R');
    expect(arena.blue.getStats().attackSpeed).toBeCloseTo(attackSpeed * (1 + R.statTransform!.statModifiers!.attackSpeed![0]), 6);
  });

  test('a champion kill extends it by 2 s, its attack speed too', () => {
    const arena = vexArena(new Vector(100, 0));
    arena.castAbility(arena.blue, 'R');
    kill(arena, arena.red);
    expect(arena.red.isDead).toBe(true);
    expect(arena.blue.getEffect('vex_ninja_mode')!.timeRemaining).toBe(R.effectDuration! + 2);
    expect(arena.blue.getModifier('ninja_mode_vex_ninja_mode')!.timeRemaining).toBe(R.effectDuration! + 2);
  });

  test('kills extend it to 20 s at most', () => {
    const arena = vexArena(new Vector(100, 0));
    const victims = [arena.red, ...[1, 2, 3].map(i => addChampion(arena, `red-${i}`, TEAM_RED, new Vector(100, 40 * i)))];
    arena.castAbility(arena.blue, 'R');
    for (const victim of victims) kill(arena, victim);
    const effect = arena.blue.getEffect('vex_ninja_mode')!;
    expect(effect.totalDuration).toBe(20);
    expect(effect.timeRemaining).toBe(20);
  });

  test('a minion kill does not extend it', () => {
    const arena = vexArena(new Vector(3000, 3000));
    const minion = arena.addMinion(TEAM_RED, new Vector(60, 0));
    arena.castAbility(arena.blue, 'R');
    kill(arena, minion);
    expect(minion.isDead).toBe(true);
    expect(arena.blue.getEffect('vex_ninja_mode')!.timeRemaining).toBe(R.effectDuration!);
  });

  test('an assist does not extend it: only her kills do', () => {
    const arena = vexArena(new Vector(100, 0));
    const ally = addChampion(arena, 'blue-ally', TEAM_BLUE, new Vector(150, 50));
    arena.castAbility(arena.blue, 'R');
    arena.red.takeDamage(100, 'true', arena.blue.id, arena.context);
    kill(arena, arena.red, ally);
    expect(arena.red.isDead).toBe(true);
    expect(arena.blue.assists).toBe(1);
    expect(arena.blue.getEffect('vex_ninja_mode')!.timeRemaining).toBe(R.effectDuration!);
  });

  test('a kill outside Ninja Mode starts nothing', () => {
    const arena = vexArena(new Vector(100, 0));
    kill(arena, arena.red);
    expect(arena.blue.isInNinjaMode()).toBe(false);
  });

  test('it costs nothing; its cooldown is 100 / 80 / 60 s', () => {
    for (const rank of [1, 2, 3]) {
      const arena = vexArena(new Vector(3000, 3000));
      arena.blue.setLevel(18);
      arena.blue.abilityStates.R.rank = rank;
      const energy = arena.blue.resource;
      arena.castAbility(arena.blue, 'R');
      expect(arena.blue.resource).toBe(energy);
      expect(arena.blue.getAbilityCooldown('R')).toBe(R.cooldown![rank - 1]);
    }
  });
});

// =============================================================================
// Descriptions
// =============================================================================

describe('Vex descriptions say what her abilities do', () => {
  test("the passive's: every 3rd attack, 4% max health, structures too, the count shared and fading after 5 s", () => {
    expect(PASSIVE.description).toContain('Every 3rd basic attack');
    expect(PASSIVE.description).toContain('4%');
    expect(PASSIVE.description).toContain('structures');
    expect(PASSIVE.description).toContain('any target');
    expect(PASSIVE.description).toContain(`${PASSIVE.stackDuration} seconds`);
  });

  test("Q's: it stops at the first enemy, minions included; the mark lasts 4 s and adds 10%", () => {
    expect(Q.description).toContain('first enemy');
    expect(Q.description).toContain('minions');
    expect(Q.description).toContain(`${Q.effectDuration} seconds`);
    expect(Q.description).toContain('10%');
  });

  test("E's: the empowered attack, within its 4 s", () => {
    expect(E.description).toContain(`within ${E.effectDuration} seconds`);
  });

  test("R's: kills extend it (assists don't)", () => {
    expect(R.description).toContain('kills extend');
    expect(R.description).not.toContain('takedown');
  });
});
