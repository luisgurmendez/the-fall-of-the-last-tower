/**
 * Ranks: the tier a rating is in, and how far it is toward the next one
 * (the profile's bar). Every tier but the last spans TIER_SPAN; Bronze has
 * no floor, so its bar starts TIER_SPAN under Silver.
 */

import { describe, it, expect } from 'bun:test';
import { TIERS, TIER_SPAN, tierFor, tierProgress } from '../config/ranks';

describe('tierFor', () => {
  it('goes by where each tier starts', () => {
    expect(tierFor(1099).id).toBe('bronze');
    expect(tierFor(1100).id).toBe('silver');
    expect(tierFor(1200).id).toBe('silver');
    expect(tierFor(1300).id).toBe('gold');
    expect(tierFor(1500).id).toBe('platinum');
    expect(tierFor(1700).id).toBe('diamond');
    expect(tierFor(1900).id).toBe('master');
    expect(tierFor(3000).id).toBe('master');
  });

  it('a very low rating is still Bronze', () => {
    expect(tierFor(100).id).toBe('bronze');
    expect(tierFor(-50).id).toBe('bronze');
  });

  it('the tiers climb TIER_SPAN apart', () => {
    for (let i = 2; i < TIERS.length; i++) expect(TIERS[i].from - TIERS[i - 1].from).toBe(TIER_SPAN);
  });
});

describe('tierProgress', () => {
  it('halfway through Silver', () => {
    const progress = tierProgress(1200);
    expect(progress.tier.id).toBe('silver');
    expect(progress.next?.id).toBe('gold');
    expect(progress.progress).toBeCloseTo(0.5);
    expect(progress.toNext).toBe(100);
  });

  it('right at a tier start: empty bar, a whole tier to go', () => {
    const progress = tierProgress(1300);
    expect(progress.tier.id).toBe('gold');
    expect(progress.progress).toBe(0);
    expect(progress.toNext).toBe(TIER_SPAN);
  });

  it('one point short of the next tier', () => {
    const progress = tierProgress(1699);
    expect(progress.tier.id).toBe('platinum');
    expect(progress.toNext).toBe(1);
    expect(progress.progress).toBeCloseTo(199 / 200);
  });

  it('Bronze: the bar starts a tier under Silver, and never goes under empty', () => {
    expect(tierProgress(1000).progress).toBeCloseTo(0.5);
    expect(tierProgress(1000).toNext).toBe(100);
    expect(tierProgress(400).progress).toBe(0);
  });

  it('Master is the top: full bar, nothing next', () => {
    const progress = tierProgress(2150);
    expect(progress.tier.id).toBe('master');
    expect(progress.next).toBeNull();
    expect(progress.progress).toBe(1);
    expect(progress.toNext).toBeNull();
  });

  it('a rating that is not a number reads as the bottom of Bronze', () => {
    expect(tierProgress(Number.NaN).tier.id).toBe('bronze');
    expect(tierProgress(Number.NaN).progress).toBe(0);
  });
});
