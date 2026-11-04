import { describe, it, expect } from 'vitest';
import { getAbilityDefinition } from '@siege/shared';
import { risingSpritesNow, spawnRisingSprites } from './risingSprites';

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
});
