import { describe, expect, it } from 'vitest';
import { retimedFrame } from './stripBody';

const frames = (release: number | undefined, hitShare: number) =>
  Array.from({ length: 20 }, (_, i) => retimedFrame(i / 20, 9, release, hitShare));

describe('strip timing', () => {
  it('plays straight without a blow frame', () => {
    expect(frames(undefined, 0.5)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8]);
  });

  it('shows the blow frame just before the damage lands', () => {
    // Magnus: still for eight frames, throwing on the last, his damage landing halfway
    const magnus = frames(8, 0.5);
    const blowAt = magnus.indexOf(8) / 20;
    expect(blowAt).toBeGreaterThan(0.35);
    expect(blowAt).toBeLessThanOrEqual(0.5);
    // Every frame before it still plays, in order
    expect(magnus.slice(0, magnus.indexOf(8))).toEqual([...magnus.slice(0, magnus.indexOf(8))].sort((a, b) => a - b));
    expect(new Set(magnus).size).toBe(9);
  });

  it('keeps the blow on screen when the damage lands at the very end', () => {
    // Gorath: the hammer hits the ground on frame 7, his damage when the animation ends
    const gorath = frames(7, 1);
    expect(gorath.indexOf(7) / 20).toBeGreaterThan(0.85);
    expect(gorath[19]).toBeGreaterThanOrEqual(7);
  });
});
