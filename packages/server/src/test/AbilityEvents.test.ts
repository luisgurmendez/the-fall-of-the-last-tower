/**
 * Events that tell clients an ability took effect later than its cast, so
 * its blow plays then: a targeted leap's `<id>_land` when it lands on its
 * target, and Lume's `lume_q_arrive` when her orb gets where it was sent.
 */
import { describe, test, expect } from 'bun:test';
import { Vector, GameEventType } from '@siege/shared';
import { createTestArena, type TestArena } from './ServerTestUtils';
import { ServerLightOrb } from '../simulation/ServerLightOrb';
import type { ServerEntity } from '../simulation/ServerEntity';

const DT = 1 / 60;

function castEvents(arena: TestArena, abilityId: string) {
  return arena.context.flushEvents().filter(event => event.type === GameEventType.ABILITY_CAST && event.data.abilityId === abilityId);
}

describe('Ability events', () => {
  for (const [championId, slot, abilityId] of [['warrior', 'R', 'warrior_ultimate'], ['uruk', 'R', 'uruk_r'], ['fenris', 'E', 'fenris_e']] as const) {
    test(`${abilityId} tells clients when it lands, at the target, and not before`, () => {
      const arena = createTestArena({ blueChampion: championId, redChampion: 'gorath', redPosition: new Vector(220, 0) });
      arena.castAbility(arena.blue, slot, { targetId: arena.red.id });
      expect(castEvents(arena, `${abilityId}_land`)).toHaveLength(0);
      for (let t = 0; t < 2 && arena.blue.forcedMovement; t += DT) arena.tick(DT);
      const [landed] = castEvents(arena, `${abilityId}_land`);
      expect(landed).toBeDefined();
      expect(landed.data.entityId).toBe(arena.blue.id);
      expect(landed.data.targetEntityId).toBe(arena.red.id);
      expect(Math.abs((landed.data.targetX as number) - arena.red.position.x)).toBeLessThan(1);
    });

    test(`${abilityId} that never lands (target dead) tells nothing`, () => {
      const arena = createTestArena({ blueChampion: championId, redChampion: 'gorath', redPosition: new Vector(220, 0) });
      arena.castAbility(arena.blue, slot, { targetId: arena.red.id });
      arena.red.takeDamage(1e9, 'true');
      for (let t = 0; t < 2 && arena.blue.forcedMovement; t += DT) arena.tick(DT);
      expect(castEvents(arena, `${abilityId}_land`)).toHaveLength(0);
    });
  }

  test("Lume's orb tells clients when it arrives where it was sent", () => {
    const arena = createTestArena({ blueChampion: 'lume', redChampion: 'gorath', redPosition: new Vector(3000, 3000) });
    const orb = new ServerLightOrb({ id: 'orb', position: new Vector(30, 0), side: arena.blue.side, ownerId: arena.blue.id });
    arena.context.addEntity(orb as unknown as ServerEntity);
    arena.castAbility(arena.blue, 'Q', { targetPosition: new Vector(300, 0), casting: true });
    let arrived: ReturnType<typeof castEvents> = [];
    let seconds = 0;
    for (; seconds < 2 && arrived.length === 0; seconds += DT) {
      arena.tickAll(DT);
      arrived = castEvents(arena, 'lume_q_arrive');
    }
    expect(arrived).toHaveLength(1);
    expect(arrived[0].data.targetX as number).toBeCloseTo(300, 0);
    // It took the orb its trip, not a fixed moment
    expect(seconds).toBeGreaterThan(0.3);
  });
});
