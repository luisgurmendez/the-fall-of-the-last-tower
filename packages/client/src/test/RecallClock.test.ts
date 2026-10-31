/**
 * The recall clock (src/core/state/recallClock.ts): the server sends a
 * recall's progress only when it starts, so the client counts it on.
 */
import { describe, it, expect } from 'bun:test';
import { recallElapsed } from '@/core/state/recallClock';

describe('recallElapsed', () => {
  it('counts on from the progress the server sent when the recall started', () => {
    expect(recallElapsed('a', true, 0.5, 10)).toBeCloseTo(0.5);
    // The server sends nothing more; the client's clock moves on
    expect(recallElapsed('a', true, 0.5, 12)).toBeCloseTo(2.5);
  });

  it('starts over with the next recall', () => {
    recallElapsed('b', true, 0, 20);
    expect(recallElapsed('b', false, 0, 23)).toBe(0);
    expect(recallElapsed('b', true, 0, 30)).toBe(0);
    expect(recallElapsed('b', true, 0, 31)).toBeCloseTo(1);
  });
});
