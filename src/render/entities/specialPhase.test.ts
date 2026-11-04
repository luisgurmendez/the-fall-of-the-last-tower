import { describe, expect, it } from 'vitest';
import { MOBAConfig } from '@siege/shared';
import { specialPhase } from './jungleCreature';

const windup = MOBAConfig.JUNGLE.SPECIAL_ATTACKS.dragon.windup;
/** The server's animation for it: the windup, then 0.45 s of breath */
const cast = { casting: true, duration: windup + 0.45 };

describe("a monster's special attack: its windup, then its strike", () => {
  it('winds up through its windup', () => {
    const half = specialPhase('dragon', cast, (windup / 2) / cast.duration);
    expect(half.windup).toBeCloseTo(0.5, 5);
    expect(half.strike).toBeNull();
  });

  it('then strikes (the dragon breathes) until the animation ends', () => {
    const start = specialPhase('dragon', cast, windup / cast.duration);
    expect(start.windup).toBe(0);
    expect(start.strike).toBeCloseTo(0, 5);
    expect(specialPhase('dragon', cast, 1).strike).toBeCloseTo(1, 5);
  });

  it('not casting: neither', () => {
    expect(specialPhase('dragon', { casting: false }, 0)).toEqual({ windup: 0, strike: null });
  });

  it('an animation as long as the windup alone (an older server): all windup, no strike until it ends', () => {
    const old = { casting: true, duration: windup };
    expect(specialPhase('dragon', old, 0.9).strike).toBeNull();
    expect(specialPhase('dragon', old, 0.9).windup).toBeCloseTo(0.9, 5);
  });
});
