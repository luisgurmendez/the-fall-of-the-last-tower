/**
 * Jungle monsters and crowd control: a stun or a knockup holds a monster
 * (no step, no bite, no special attack: one winding up is interrupted), a
 * root keeps it in place (it still bites what's in reach), a slow slows it,
 * and its effects run out. Walking home after a reset it can't be held.
 * (Taunts on monsters: champions/Gorath.test.ts.)
 */

import { describe, test, expect } from 'bun:test';
import { Vector, getAbilityDefinition, MOBAConfig } from '@siege/shared';
import { createTestArena, type TestArena } from './ServerTestUtils';
import type { ServerJungleCreature } from '../simulation/ServerJungleCreature';

const FPS = 60;
const WOLF = MOBAConfig.JUNGLE.CREATURE_STATS.wolf;

/** A champion of `championId` at the origin, the enemy far away, and a monster at `at` fighting the champion */
function fight(championId: string, at: Vector, creatureType = 'wolf'): { arena: TestArena; creature: ServerJungleCreature } {
  const arena = createTestArena({ blueChampion: championId, redChampion: 'vex', redPosition: new Vector(3000, 3000) });
  const creature = arena.addJungleCreature(at, creatureType);
  creature.takeDamage(1, 'true', arena.blue.id, arena.context);
  return { arena, creature };
}

/** How many times the creature hits the champion while `run` runs */
function bitesDuring(arena: TestArena, creature: ServerJungleCreature, run: () => void): number {
  let bites = 0;
  const takeDamage = arena.blue.takeDamage.bind(arena.blue);
  arena.blue.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
    if (args[2] === creature.id) bites++;
    return takeDamage(...args);
  }) as typeof takeDamage;
  run();
  arena.blue.takeDamage = takeDamage;
  return bites;
}

function hasEffect(creature: ServerJungleCreature, effectId: string): boolean {
  return creature.activeEffects.some(effect => effect.definitionId === effectId);
}

describe('Jungle monsters obey crowd control', () => {
  test("BUG: Gorath's slam slows a monster chasing him by 40%", () => {
    const { arena, creature } = fight('gorath', new Vector(150, 0));
    arena.castAbility(arena.blue, 'Q');
    expect(hasEffect(creature, 'slow_40')).toBe(true);
    const x = creature.position.x;
    arena.tickAllFrames(10);
    expect(x - creature.position.x).toBeCloseTo(WOLF.movementSpeed * 0.6 * (10 / FPS), 0);
  });

  test("an unslowed monster chases at its full speed (the slam's control)", () => {
    const { arena, creature } = fight('gorath', new Vector(150, 0));
    const x = creature.position.x;
    arena.tickAllFrames(10);
    expect(x - creature.position.x).toBeCloseTo(WOLF.movementSpeed * (10 / FPS), 0);
  });

  test('BUG: the slow runs out', () => {
    const { arena, creature } = fight('gorath', new Vector(150, 0));
    arena.castAbility(arena.blue, 'Q');
    arena.tickAllFrames((getAbilityDefinition('gorath_slam')!.effectDuration! + 0.1) * FPS);
    expect(hasEffect(creature, 'slow_40')).toBe(false);
  });

  test("BUG: Gorath's earthquake knocks it up: no step and no bite while airborne, then it fights again", () => {
    const { arena, creature } = fight('gorath', new Vector(60, 0));
    const quake = getAbilityDefinition('gorath_earthquake')!;
    arena.castAbility(arena.blue, 'R');
    expect(hasEffect(creature, 'knockup')).toBe(true);
    expect(creature.ccStatus.canMove).toBe(false);
    expect(creature.ccStatus.canAttack).toBe(false);
    // Out of its reach while it's airborne: it doesn't follow
    arena.blue.position.setFrom(new Vector(-60, 0));
    const at = creature.position.clone();
    const airborne = bitesDuring(arena, creature, () => arena.tickAllFrames((quake.effectDuration! - 0.1) * FPS));
    expect(airborne).toBe(0);
    expect(creature.position.distanceTo(at)).toBeLessThan(0.01);

    const after = bitesDuring(arena, creature, () => arena.tickAllFrames(2 * FPS));
    expect(after).toBeGreaterThan(0);
  });

  test("BUG: Kael's charge slows a monster it runs through", () => {
    const { arena, creature } = fight('warrior', new Vector(120, 0));
    arena.castAbility(arena.blue, 'E', { targetPosition: new Vector(400, 0) });
    arena.tickAllFrames(30);
    expect(hasEffect(creature, 'slow_30')).toBe(true);
  });

  test("BUG: Kael's Heroic Strike stuns a monster: it doesn't bite for the stun", () => {
    const { arena, creature } = fight('warrior', new Vector(200, 0));
    arena.castAbility(arena.blue, 'R', { targetId: creature.id });
    for (let i = 0; i < 2 * FPS && arena.blue.forcedMovement; i++) arena.tickAll();
    expect(hasEffect(creature, 'stun')).toBe(true);
    const stunned = bitesDuring(arena, creature, () => arena.tickAllFrames(1 * FPS));
    expect(stunned).toBe(0);
  });

  test('BUG: a root keeps it in place, but it still bites what is in reach', () => {
    const near = fight('gorath', new Vector(60, 0));
    near.creature.applyEffect('root', 1.5, near.arena.blue.id);
    expect(bitesDuring(near.arena, near.creature, () => near.arena.tickAllFrames(1.2 * FPS))).toBeGreaterThan(0);

    const far = fight('gorath', new Vector(200, 0));
    far.creature.applyEffect('root', 1.5, far.arena.blue.id);
    const at = far.creature.position.clone();
    far.arena.tickAllFrames(1.2 * FPS);
    expect(far.creature.position.distanceTo(at)).toBeLessThan(0.01);
    far.arena.tickAllFrames(1 * FPS);
    expect(far.creature.position.distanceTo(at)).toBeGreaterThan(10);
  });

  test('BUG: a stun in a buff monster\'s windup interrupts its slam: it never lands', () => {
    const { arena, creature } = fight('gorath', new Vector(80, 0), 'blue_buff');
    for (let i = 0; i < 10 * FPS && !creature.isWindingUp(); i++) arena.tickAll();
    expect(creature.isWindingUp()).toBe(true);

    let slammed = false;
    const takeDamage = arena.blue.takeDamage.bind(arena.blue);
    arena.blue.takeDamage = ((...args: Parameters<typeof takeDamage>) => {
      if (args[2] === creature.id && args[1] === 'magic') slammed = true;
      return takeDamage(...args);
    }) as typeof takeDamage;
    arena.castAbility(arena.blue, 'R');
    arena.tickAllFrames(2 * FPS);
    expect(creature.isWindingUp()).toBe(false);
    expect(slammed).toBe(false);
  });

  test("BUG: its effects show in its debug info and end; it's free once they do", () => {
    const { arena, creature } = fight('gorath', new Vector(150, 0));
    creature.applyEffect('stun', 0.5, arena.blue.id);
    creature.applyEffect('slow_30', 0.5, arena.blue.id);
    expect(creature.ccStatus.isStunned).toBe(true);
    const debug = creature.debugInfo(arena.context);
    expect(debug.state).toBe('stunned');
    expect(debug.notes).toContain('slowed 30%');
    arena.tickAllFrames(0.6 * FPS);
    expect(creature.ccStatus.isStunned).toBe(false);
    expect(creature.activeEffects.length).toBe(0);
    expect(creature.debugInfo(arena.context).state).toBe('aggro');
  });

  test("BUG: walking home after a reset it can't be held", () => {
    const { arena, creature } = fight('gorath', new Vector(150, 0));
    arena.blue.position.setFrom(new Vector(2000, 0));
    for (let i = 0; i < 2 * FPS && !creature.isReturning(); i++) arena.tickAll();
    expect(creature.isReturning()).toBe(true);
    creature.applyEffect('stun', 2, arena.blue.id);
    expect(creature.activeEffects.length).toBe(0);
    expect(creature.ccStatus.canMove).toBe(true);
  });
});
