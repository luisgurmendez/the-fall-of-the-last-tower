/**
 * Health bar damage trails (src/render/overlays/damageTrail.ts): the health
 * a hit took stays shown for a moment, then drains to the new health.
 */
import { describe, it, expect } from 'bun:test';
import { getTrailHealth } from '@/render/overlays/damageTrail';

describe('getTrailHealth', () => {
  it('starts at the current health', () => {
    expect(getTrailHealth('trail-a', 500, 0)).toBe(500);
  });

  it('holds where it was after a hit, then drains to the new health', () => {
    getTrailHealth('trail-b', 500, 0);
    expect(getTrailHealth('trail-b', 400, 100)).toBe(500);
    expect(getTrailHealth('trail-b', 400, 300)).toBe(500);

    const draining = getTrailHealth('trail-b', 400, 600);
    expect(draining).toBeLessThan(500);
    expect(draining).toBeGreaterThan(400);

    expect(getTrailHealth('trail-b', 400, 2000)).toBe(400);
  });

  it('a new hit restarts the hold', () => {
    getTrailHealth('trail-c', 500, 0);
    getTrailHealth('trail-c', 450, 0);
    getTrailHealth('trail-c', 400, 300);
    expect(getTrailHealth('trail-c', 400, 500)).toBe(500);
  });

  it('follows healing up at once', () => {
    getTrailHealth('trail-d', 500, 0);
    getTrailHealth('trail-d', 300, 100);
    expect(getTrailHealth('trail-d', 600, 200)).toBe(600);
  });
});
