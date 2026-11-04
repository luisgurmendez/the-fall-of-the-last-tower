/**
 * Ranged monsters shoot when their art does: the dragon's fire and the
 * thornspitter's spit leave its mouth at the attack strip's breath frame
 * (the 6th of 9), not as the attack starts, and from in front of it. A stun
 * before then stops the shot.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { GameEventType, Vector } from '@siege/shared';
import { createTestArena } from './ServerTestUtils';
import { ServerTargetedProjectile } from '../simulation/ServerTargetedProjectile';
import type { ServerJungleCreature } from '../simulation/ServerJungleCreature';

function shots(arena: ReturnType<typeof createTestArena>, creature: ServerJungleCreature): ServerTargetedProjectile[] {
  return arena.context.getAllEntities()
    .filter((e): e is ServerTargetedProjectile => e instanceof ServerTargetedProjectile && e.sourceId === creature.id);
}

/** A monster provoked by the blue champion standing within its reach */
function provoked(creatureType: string) {
  const arena = createTestArena({ blueChampion: 'magnus', redChampion: 'magnus', bluePosition: new Vector(0, 0), redPosition: new Vector(3000, 3000) });
  const creature = arena.addJungleCreature(new Vector(150, 0), creatureType) as ServerJungleCreature;
  creature.takeDamage(1, 'true', arena.blue.id, arena.context);
  return { arena, creature };
}

/** Ticks until it starts an attack (its BASIC_ATTACK event), up to a limit */
function untilAttack(arena: ReturnType<typeof createTestArena>, creature: ServerJungleCreature): boolean {
  for (let i = 0; i < 240; i++) {
    arena.context.flushEvents();
    creature.update(1 / 60, arena.context);
    if (arena.context.flushEvents().some(e => e.type === GameEventType.BASIC_ATTACK && e.data.entityId === creature.id)) return true;
  }
  return false;
}

describe('Ranged monsters shoot from their mouth at their breath frame', () => {
  for (const creatureType of ['dragon', 'thornspitter']) {
    test(`${creatureType}: nothing as the attack starts, the shot a moment later, from in front of it`, () => {
      const { arena, creature } = provoked(creatureType);
      expect(untilAttack(arena, creature)).toBe(true);
      expect(shots(arena, creature)).toHaveLength(0);
      // A fifth of a second in: still drawing breath
      for (let i = 0; i < 6; i++) creature.update(1 / 60, arena.context);
      expect(shots(arena, creature)).toHaveLength(0);
      for (let i = 0; i < 30; i++) creature.update(1 / 60, arena.context);
      const [shot] = shots(arena, creature);
      expect(shot).toBeDefined();
      // Left from in front of it, toward its target (blue, at the origin)
      expect(shot.position.x).toBeLessThan(creature.position.x);
    });
  }

  test('a stun before the breath stops the shot', () => {
    const { arena, creature } = provoked('dragon');
    expect(untilAttack(arena, creature)).toBe(true);
    creature.applyEffect('stun', 1, arena.blue.id);
    for (let i = 0; i < 40; i++) creature.update(1 / 60, arena.context);
    expect(shots(arena, creature)).toHaveLength(0);
  });
});
