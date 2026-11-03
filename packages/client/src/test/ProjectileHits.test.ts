/**
 * Where a projectile disappears (src/core/state/projectileHits.ts): its
 * impact plays only if it hit someone (Elora's arrow pinned the ground at
 * the end of its range, as if it had hit). One that ran its range out
 * just goes.
 */
import { describe, it, expect } from 'bun:test';
import { EntityType } from '@siege/shared';
import Vector from '@/physics/vector';
import { projectileHit } from '@/core/state/projectileHits';
import type { InterpolatedEntity } from '@/core/state/entities';

function entity(snapshot: Record<string, unknown>, x: number, y: number): InterpolatedEntity {
  return { snapshot: { ...snapshot, x, y }, position: new Vector(x, y), serverPosition: new Vector(x, y) } as unknown as InterpolatedEntity;
}
const arrow = (x: number, y: number) => entity({ entityId: 'arrow', entityType: EntityType.PROJECTILE, side: 0, radius: 18, speed: 600 }, x, y);
const champion = (side: number, x: number, y: number) => entity({ entityId: `c${side}${x}`, entityType: EntityType.CHAMPION, side, isDead: false }, x, y);

describe('projectile hits', () => {
  it('hit: an enemy unit where it disappeared (a tick behind it counts)', () => {
    expect(projectileHit(arrow(100, 0), [champion(1, 140, 0)])).toBe(true);
    expect(projectileHit(arrow(100, 0), [entity({ entityId: 'm', entityType: EntityType.MINION, side: 1 }, 100, 30)])).toBe(true);
    expect(projectileHit(arrow(100, 0), [entity({ entityId: 'j', entityType: EntityType.JUNGLE_CAMP, side: 2 }, 80, 0)])).toBe(true);
  });

  it('ran out: nothing there, or only allies, structures, other projectiles', () => {
    expect(projectileHit(arrow(100, 0), [])).toBe(false);
    expect(projectileHit(arrow(100, 0), [champion(1, 400, 0)])).toBe(false);
    expect(projectileHit(arrow(100, 0), [champion(0, 100, 0)])).toBe(false);
    expect(projectileHit(arrow(100, 0), [entity({ entityId: 't', entityType: EntityType.TOWER, side: 1 }, 100, 0)])).toBe(false);
    expect(projectileHit(arrow(100, 0), [entity({ entityId: 'p', entityType: EntityType.PROJECTILE, side: 1 }, 100, 0)])).toBe(false);
  });

  it('a dead unit there is no hit', () => {
    expect(projectileHit(arrow(100, 0), [entity({ entityId: 'c', entityType: EntityType.CHAMPION, side: 1, isDead: true }, 100, 0)])).toBe(false);
  });
});
