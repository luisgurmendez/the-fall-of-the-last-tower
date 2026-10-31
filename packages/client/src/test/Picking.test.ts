/**
 * Pointing at units (src/core/input/picking.ts): anywhere on the drawn
 * body counts, buildings up their height, and champions win ties.
 */
import { describe, it, expect } from 'bun:test';
import { EntityType } from '@siege/shared';
import { pickScore } from '@/core/input/picking';

const at = { x: 0, y: 0 };

describe('pickScore', () => {
  it("picks a champion by its head, not only its feet", () => {
    expect(pickScore({ x: 0, y: -32 }, at, { entityType: EntityType.CHAMPION })).not.toBeNull();
    expect(pickScore({ x: 0, y: 30 }, at, { entityType: EntityType.CHAMPION })).not.toBeNull();
    expect(pickScore({ x: 60, y: 0 }, at, { entityType: EntityType.CHAMPION })).toBeNull();
  });

  it('picks a tower up its height', () => {
    expect(pickScore({ x: 0, y: -120 }, at, { entityType: EntityType.TOWER })).not.toBeNull();
    expect(pickScore({ x: 0, y: 60 }, at, { entityType: EntityType.TOWER })).toBeNull();
  });

  it('prefers a champion over a minion at the same distance', () => {
    const point = { x: 10, y: 0 };
    const champion = pickScore(point, at, { entityType: EntityType.CHAMPION })!;
    const minion = pickScore(point, at, { entityType: EntityType.MINION, minionType: 'melee' })!;
    expect(champion).toBeLessThan(minion);
  });

  it('sizes monsters by kind', () => {
    const point = { x: 45, y: 0 };
    expect(pickScore(point, at, { entityType: EntityType.JUNGLE_CAMP, creatureType: 'spider' })).toBeNull();
    expect(pickScore(point, at, { entityType: EntityType.JUNGLE_CAMP, creatureType: 'dragon' })).not.toBeNull();
  });
});
