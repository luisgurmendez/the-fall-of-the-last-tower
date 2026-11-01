import { describe, expect, it } from 'vitest';
import Vector from '@/physics/vector';
import { EntityType, type EntitySnapshot } from '@siege/shared';
import { advanceEntity, createDefaultAnimationState, setServerPosition, type InterpolatedEntity } from './entities';

function entityAt(x: number, y: number, now: number): InterpolatedEntity {
  return {
    snapshot: { entityId: 'e1', entityType: EntityType.MINION, x, y } as unknown as EntitySnapshot,
    position: new Vector(x, y),
    previousPosition: new Vector(x, y),
    serverPosition: new Vector(x, y),
    positionTime: now,
    drawnAt: now,
    lastUpdateTime: now,
    animation: createDefaultAnimationState(),
  };
}

describe('position easing', () => {
  it('eases toward a new server position over about a tick, every frame', () => {
    const entity = entityAt(0, 0, 0);
    advanceEntity(entity, 0);
    setServerPosition(entity, 4, 0, 0);
    const steps: number[] = [];
    for (let now = 8; now <= 40; now += 8) {
      const before = entity.position.x;
      advanceEntity(entity, now);
      steps.push(entity.position.x - before);
    }
    // Moving every frame, never past the server's position
    expect(steps.every(step => step > 0)).toBe(true);
    expect(entity.position.x).toBeCloseTo(4);
  });

  it('keeps moving in the frame a new position arrives', () => {
    // A unit walking 4 units a tick (30 a second), drawn 120 times a second
    const entity = entityAt(0, 0, 0);
    let nextUpdate = 33;
    let x = 0;
    for (let now = 0; now <= 300; now += 8) {
      if (now >= nextUpdate) {
        x += 4;
        setServerPosition(entity, x, 0, now);
        nextUpdate += 33;
      }
      const before = entity.position.x;
      advanceEntity(entity, now);
      if (now > 40) expect(entity.position.x).toBeGreaterThan(before);
    }
  });

  it('jumps straight to a teleport', () => {
    const entity = entityAt(0, 0, 0);
    setServerPosition(entity, 500, 0, 10);
    advanceEntity(entity, 10);
    expect(entity.position.x).toBe(500);
  });
});
