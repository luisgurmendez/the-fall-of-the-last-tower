/**
 * The hit flash (src/core/state/entities.ts): full right after a hit, gone
 * a moment later.
 */
import { describe, it, expect } from 'bun:test';
import { createDefaultAnimationState, getHitFlash, type InterpolatedEntity } from '@/core/state/entities';

function entityHitAt(hitTime: number): InterpolatedEntity {
  return { animation: { ...createDefaultAnimationState(), hitTime } } as InterpolatedEntity;
}

describe('getHitFlash', () => {
  it('is 0 for an entity never hit', () => {
    expect(getHitFlash(entityHitAt(-Infinity))).toBe(0);
    expect(getHitFlash(undefined)).toBe(0);
  });

  it('starts near 1 and fades out', () => {
    expect(getHitFlash(entityHitAt(performance.now()))).toBeGreaterThan(0.9);
    expect(getHitFlash(entityHitAt(performance.now() - 60))).toBeLessThan(0.6);
    expect(getHitFlash(entityHitAt(performance.now() - 500))).toBe(0);
  });
});
