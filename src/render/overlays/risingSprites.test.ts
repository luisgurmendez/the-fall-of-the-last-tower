import { describe, it, expect } from 'vitest';
import { getAbilityDefinition } from '@siege/shared';
import { risingPose, risingSpritesNow, spawnRisingSprites } from './risingSprites';

const Q = getAbilityDefinition('nocthar_q')!;

describe('rising sprites (Nocthar\'s Grasping Hands)', () => {
  it('a Grasping Hands cast raises six hands in its circle, back to front', () => {
    const now = 1_000_000;
    spawnRisingSprites('nocthar_q', 500, 300, now);
    const hands = risingSpritesNow(now + 10);
    expect(hands.length).toBe(6);
    for (const hand of hands) expect(Math.hypot(hand.x - 500, hand.y - 300)).toBeLessThanOrEqual(Q.aoeRadius!);
    for (let i = 1; i < hands.length; i++) expect(hands[i].y).toBeGreaterThanOrEqual(hands[i - 1].y);
  });

  it('they are gone once they have grabbed and sunk back', () => {
    const now = 2_000_000;
    spawnRisingSprites('nocthar_q', 0, 0, now);
    expect(risingSpritesNow(now + Q.aoeDelay! * 1000).length).toBeGreaterThan(0);
    expect(risingSpritesNow(now + 3000).length).toBe(0);
  });

  it('other abilities raise nothing', () => {
    spawnRisingSprites('magnus_fireball', 0, 0, 3_000_000);
    expect(risingSpritesNow(3_000_010).length).toBe(0);
  });

  it('BUG: hidden through the warning, they come out open, then shut, then sink', () => {
    spawnRisingSprites('nocthar_q', 0, 0, 4_000_000);
    const set = risingSpritesNow(4_000_001)[0].set;
    const at = (t: number) => risingPose(set, t);
    // Through the warning: nothing shows (no spikes before the hands)
    expect(at(0).out).toBe(0);
    expect(at(set.lands - set.emerge - 1).out).toBe(0);
    // Just before it lands: out, and still open
    expect(at(set.lands - 1).out).toBeGreaterThan(0.95);
    expect(at(set.lands - 1).shut).toBe(0);
    // Fully out before they start to shut
    expect(at(set.lands).out).toBe(1);
    expect(at(set.lands + set.shut / 2).shut).toBeCloseTo(0.5, 5);
    // Shut, held, then sinking
    expect(at(set.lands + set.shut + set.hold / 2)).toEqual({ out: 1, shut: 1 });
    const sinking = at(set.lands + set.shut + set.hold + set.sink / 2);
    expect(sinking.out).toBeCloseTo(0.5, 5);
    expect(sinking.shut).toBe(1);
  });
});
