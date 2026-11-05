import { describe, expect, it } from 'vitest';
import { abilityBlowShare, blowFrames, retimedFrame } from './stripBody';

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

  it("an ability's blow comes after its cast time when its animation started with the cast", () => {
    // Calamitus Q: a 0.6 s cast, the burst 0.12 s after it, a 1.2 s animation in all
    expect(abilityBlowShare(0.6, 0.12, 1.2)).toBeCloseTo(0.6, 5);
    // Without a cast before it, the impact alone
    expect(abilityBlowShare(0, 0.12, 0.6)).toBeCloseTo(0.2, 5);
    // Never past the end
    expect(abilityBlowShare(1, 1, 1.5)).toBe(1);
    expect(abilityBlowShare(0.5, 0.2, 0)).toBe(1);
  });
});

describe('blow frames facing up or down the screen', () => {
  const timing = {
    attackBlow: 7,
    abilityBlows: { gorath_slam: 7, gorath_taunt: 3 },
    facing: { north: { attackBlow: 5, abilityBlows: { gorath_slam: 6 } } },
  };

  it("a direction drawn on its own lands its blows on its own frames, the rest on the side view's", () => {
    expect(blowFrames(timing, 'north')).toEqual({ attackBlow: 5, abilityBlows: { gorath_slam: 6, gorath_taunt: 3 } });
  });

  it("a direction without its own, or the side view, uses the side view's", () => {
    expect(blowFrames(timing, 'south')).toEqual({ attackBlow: 7, abilityBlows: { gorath_slam: 7, gorath_taunt: 3 } });
    expect(blowFrames(timing, null)).toEqual({ attackBlow: 7, abilityBlows: { gorath_slam: 7, gorath_taunt: 3 } });
  });
});
