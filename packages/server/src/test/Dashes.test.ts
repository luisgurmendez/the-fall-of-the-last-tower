/**
 * Dashes, leaps and knockbacks:
 * - A targeted leap (Kael's Heroic Strike, Urûk's Fatal Strike, Fenris's
 *   Pounce) flies to its target, following it, over walls, and does
 *   everything when it lands next to it: nothing at the cast, nothing to
 *   what it passes over.
 * - Any other dash, and a knockback, stops at a wall: it never comes out
 *   on the far side. Zhak'rul's burrow goes under them.
 */

import { describe, test, expect } from 'bun:test';
import { Vector, CHAMPION_DEFINITIONS, TEAM_BLUE, TEAM_RED, getAbilityDefinition, MOBAConfig, type AbilitySlot } from '@siege/shared';
import { createTestArena, TestChampion, type TestArena } from './ServerTestUtils';
import { findWallCrossing } from './wallSpots';

const DT = 1 / 60;

/** The targeted leaps, and what each puts on its target */
const LEAPS: { championId: string; slot: AbilitySlot; effect?: string }[] = [
  { championId: 'warrior', slot: 'R', effect: 'stun' },
  { championId: 'uruk', slot: 'R' },
  { championId: 'fenris', slot: 'E', effect: 'slow_40' },
];

function leapArena(championId: string, redAt = new Vector(200, 0)): TestArena {
  const arena = createTestArena({ blueChampion: championId, redChampion: 'gorath', redPosition: redAt });
  arena.blue.setLevel(6);
  arena.red.setLevel(6);
  // (Leveling up raises max health, not health)
  arena.red.setHealth(arena.red.maxHealth);
  return arena;
}

/** Tick until the blue champion's dash ends (or the time runs out) */
function untilLanded(arena: TestArena, seconds = 2): void {
  for (let t = 0; t < seconds && (t === 0 || arena.blue.forcedMovement); t += DT) arena.tick(DT);
}

function reach(a: TestChampion, b: TestChampion): number {
  return a.getRadius() + b.getRadius();
}

describe('Targeted leaps', () => {
  for (const { championId, slot, effect } of LEAPS) {
    const definition = getAbilityDefinition(CHAMPION_DEFINITIONS[championId].abilities[slot])!;

    describe(`${definition.id} (${championId} ${slot})`, () => {
      test('nothing lands at the cast: the target is untouched until the leap reaches it', () => {
        const arena = leapArena(championId);
        const health = arena.red.health;
        expect(arena.castAbility(arena.blue, slot, { targetId: arena.red.id }).success).toBe(true);
        expect(arena.red.health).toBe(health);
        if (effect) expect(arena.red.hasEffect(effect)).toBe(false);
        expect(arena.blue.forcedMovement).not.toBeNull();
        expect(arena.blue.dashAbilityId).toBe(definition.id);
      });

      test('it lands next to the target and hits it once', () => {
        const arena = leapArena(championId);
        const health = arena.red.health;
        let hits = 0;
        const takeDamage = arena.red.takeDamage.bind(arena.red);
        arena.red.takeDamage = ((...args: Parameters<typeof takeDamage>) => { hits++; return takeDamage(...args); }) as typeof takeDamage;

        arena.castAbility(arena.blue, slot, { targetId: arena.red.id });
        untilLanded(arena);

        expect(arena.blue.forcedMovement).toBeNull();
        expect(arena.blue.position.distanceTo(arena.red.position)).toBeLessThanOrEqual(reach(arena.blue, arena.red) + 2);
        expect(arena.red.health).toBeLessThan(health);
        expect(hits).toBe(1);
        if (effect) expect(arena.red.hasEffect(effect)).toBe(true);
      });

      test("it goes to the target, not the cursor", () => {
        const arena = leapArena(championId);
        arena.castAbility(arena.blue, slot, { targetId: arena.red.id, targetPosition: new Vector(100, 180) });
        untilLanded(arena);
        expect(arena.blue.position.distanceTo(arena.red.position)).toBeLessThanOrEqual(reach(arena.blue, arena.red) + 2);
        expect(Math.abs(arena.blue.position.y)).toBeLessThan(5);
      });

      test('what it passes over is untouched', () => {
        const arena = leapArena(championId, new Vector(260, 0));
        const minion = arena.addMinion(TEAM_RED, new Vector(120, 0));
        const health = minion.health;
        arena.castAbility(arena.blue, slot, { targetId: arena.red.id });
        untilLanded(arena);
        expect(minion.health).toBe(health);
        expect(minion.activeEffects.length).toBe(0);
      });

      test('it follows a target that moves away during the leap', () => {
        const arena = leapArena(championId);
        const health = arena.red.health;
        arena.castAbility(arena.blue, slot, { targetId: arena.red.id });
        for (let t = 0; t < 1.5 && arena.blue.forcedMovement; t += DT) {
          arena.red.position.y += 60 * DT;
          arena.tick(DT);
        }
        expect(arena.blue.position.distanceTo(arena.red.position)).toBeLessThanOrEqual(reach(arena.blue, arena.red) + 4);
        expect(arena.red.health).toBeLessThan(health);
      });

      test('a target that dies during the leap: it ends there, and nothing is applied', () => {
        const arena = leapArena(championId);
        arena.castAbility(arena.blue, slot, { targetId: arena.red.id });
        arena.tick(DT);
        arena.red.takeDamage(1e9, 'true');
        expect(arena.red.isDead).toBe(true);
        untilLanded(arena);
        expect(arena.blue.forcedMovement).toBeNull();
        if (effect) expect(arena.red.hasEffect(effect)).toBe(false);
      });

      test('a target that blinks far away: the leap gives up without hitting it', () => {
        const arena = leapArena(championId);
        const health = arena.red.health;
        arena.castAbility(arena.blue, slot, { targetId: arena.red.id });
        arena.tick(DT);
        arena.red.position.setFrom(new Vector(1400, 0));
        untilLanded(arena, 3);
        expect(arena.blue.forcedMovement).toBeNull();
        expect(arena.red.health).toBeGreaterThanOrEqual(health);
        expect(arena.blue.position.x).toBeLessThan(800);
      });

      test('an enemy out of range: it fails, nothing spent, nothing moves', () => {
        const arena = leapArena(championId, new Vector(definition.range! + 200, 0));
        const mana = arena.blue.resource;
        const result = arena.castAbility(arena.blue, slot, { targetId: arena.red.id });
        expect(result.success).toBe(false);
        expect(result.failReason).toBe('out_of_range');
        expect(arena.blue.resource).toBe(mana);
        expect(arena.blue.forcedMovement).toBeNull();
      });

      test('it leaps over a wall to a target on the other side', () => {
        const wall = findWallCrossing(30, 90);
        const arena = leapArena(championId, new Vector(wall.right + 50, wall.y));
        arena.blue.position.setFrom(new Vector(wall.left - 50, wall.y));
        const health = arena.red.health;
        const result = arena.castAbility(arena.blue, slot, { targetId: arena.red.id });
        expect(result.success).toBe(true);
        untilLanded(arena);
        expect(arena.blue.position.x).toBeGreaterThan(wall.right);
        expect(arena.red.health).toBeLessThan(health);
      });
    });
  }

  test("Heroic Strike's stun lasts its full time from the landing (not from the cast)", () => {
    const arena = leapArena('warrior', new Vector(250, 0));
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
    untilLanded(arena);
    const stun = arena.red.getActiveEffects().find(effect => effect.definitionId === 'stun')!;
    expect(stun).toBeDefined();
    expect(stun.timeRemaining).toBeGreaterThan(1.2);
  });

  test("Fatal Strike hits harder the less health the target has when it lands", () => {
    const full = leapArena('uruk');
    const fullHealth = full.red.health;
    full.castAbility(full.blue, 'R', { targetId: full.red.id });
    untilLanded(full);
    const dealtFull = fullHealth - full.red.health;

    const hurt = leapArena('uruk');
    hurt.red.setHealth(hurt.red.maxHealth * 0.4);
    const hurtHealth = hurt.red.health;
    hurt.castAbility(hurt.blue, 'R', { targetId: hurt.red.id });
    untilLanded(hurt);
    expect(hurtHealth - hurt.red.health).toBeGreaterThan(dealtFull * 1.2);
  });
});

// =============================================================================
// Walls
// =============================================================================

/** Dashes aimed at a point: each must stop at a wall in its way */
const AIMED_DASHES: { championId: string; slot: AbilitySlot }[] = [
  { championId: 'warrior', slot: 'E' },
  { championId: 'vex', slot: 'E' },
  { championId: 'oitboil', slot: 'E' },
  { championId: 'elora', slot: 'E' },
  { championId: 'hop', slot: 'E' },
];

describe('Dashes stop at walls', () => {
  const wall = findWallCrossing(30, 90);

  function atWall(championId: string, startX = wall.left - 40): TestArena {
    const arena = createTestArena({ blueChampion: championId, redChampion: 'gorath', redPosition: new Vector(wall.x, wall.y + 2000) });
    arena.blue.position.setFrom(new Vector(startX, wall.y));
    return arena;
  }

  function settle(arena: TestArena): void {
    untilLanded(arena);
    arena.context.terrain.resolveCircle(arena.blue.position, arena.blue.getRadius());
  }

  for (const { championId, slot } of AIMED_DASHES) {
    test(`${championId} ${slot} dashing into a wall ends on its side of it`, () => {
      const arena = atWall(championId);
      expect(arena.castAbility(arena.blue, slot, { targetPosition: new Vector(wall.right + 400, wall.y) }).success).toBe(true);
      untilLanded(arena);
      // Not inside the wall, and not past it
      expect(MOBAConfig.WALL_FIELD.distance(arena.blue.position.x, arena.blue.position.y)).toBeGreaterThanOrEqual(0);
      expect(arena.blue.position.x).toBeLessThan(wall.left + 1);
      settle(arena);
      expect(arena.blue.position.x).toBeLessThan(wall.left);
    });

    test(`${championId} ${slot} dashing away from a wall it stands against goes its full way`, () => {
      const arena = atWall(championId, wall.left - 30);
      const definition = getAbilityDefinition(CHAMPION_DEFINITIONS[championId].abilities[slot])!;
      const start = arena.blue.position.x;
      arena.castAbility(arena.blue, slot, { targetPosition: new Vector(start - 1000, wall.y) });
      untilLanded(arena);
      expect(start - arena.blue.position.x).toBeGreaterThan(definition.dash!.distance - 2);
    });
  }

  test("Vile's recast to a spot past a wall stops at the wall", () => {
    const arena = atWall('vile');
    arena.blue.enableRecast('Q', new Vector(wall.right + 60, wall.y), 1, 3);
    expect(arena.castAbility(arena.blue, 'Q').success).toBe(true);
    settle(arena);
    expect(arena.blue.position.x).toBeLessThan(wall.left);
  });

  test("Zhak'rul's burrow goes under the wall", () => {
    const thick = findWallCrossing(30, 90, 200);
    const arena = createTestArena({ blueChampion: 'zhakrul', redChampion: 'gorath', redPosition: new Vector(thick.x, thick.y + 2000) });
    arena.blue.position.setFrom(new Vector(thick.left - 60, thick.y));
    expect(arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(thick.right + 120, thick.y) }).success).toBe(true);
    settle(arena);
    expect(arena.blue.position.x).toBeGreaterThan(thick.right);
  });

  test("a champion kicked into a wall (Hop's Hop) stops at it", () => {
    const arena = createTestArena({ blueChampion: 'hop', redChampion: 'gorath', redPosition: new Vector(wall.left - 40, wall.y) });
    arena.blue.position.setFrom(new Vector(wall.left - 40 - 90, wall.y));
    arena.blue.setLevel(6);
    expect(arena.castAbility(arena.blue, 'R', { targetId: arena.red.id }).success).toBe(true);
    for (let t = 0; t < 2 && arena.red.forcedMovement; t += DT) arena.tick(DT);
    arena.context.terrain.resolveCircle(arena.red.position, arena.red.getRadius());
    expect(arena.red.position.x).toBeLessThan(wall.left);
  });

  test("a champion pulled across a wall (Protobot's claw) stops at it", () => {
    const arena = createTestArena({ blueChampion: 'protobot', redChampion: 'gorath', redPosition: new Vector(wall.right + 60, wall.y) });
    arena.blue.position.setFrom(new Vector(wall.left - 200, wall.y));
    arena.castAbility(arena.blue, 'Q', { targetPosition: arena.red.position.clone() });
    arena.tickAllFrames(90);
    arena.context.terrain.resolveCircle(arena.red.position, arena.red.getRadius());
    expect(arena.red.position.x).toBeGreaterThan(wall.right);
  });

  test('a dash in the open goes its full distance', () => {
    const arena = createTestArena({ blueChampion: 'warrior', redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(1000, 0) });
    untilLanded(arena);
    expect(arena.blue.position.x).toBeCloseTo(getAbilityDefinition('warrior_charge')!.dash!.distance, 0);
  });

  test('a dash to a point nearer than its distance stops at the point', () => {
    const arena = createTestArena({ blueChampion: 'vex', redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(90, 0) });
    untilLanded(arena);
    expect(arena.blue.position.x).toBeCloseTo(90, 0);
  });
});

describe('Allies are untouched by leaps', () => {
  test("a leap doesn't touch an allied minion it passes over", () => {
    const arena = leapArena('warrior', new Vector(250, 0));
    const ally = arena.addMinion(TEAM_BLUE, new Vector(120, 0));
    const health = ally.health;
    arena.castAbility(arena.blue, 'R', { targetId: arena.red.id });
    untilLanded(arena);
    expect(ally.health).toBe(health);
    expect(ally.activeEffects.length).toBe(0);
  });
});
