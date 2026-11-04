/**
 * How the profile screen writes a match (src/ui/matchmaking/profileFormat.ts):
 * its length, the KDA and its ratio, the rating change, when it was played,
 * the win rate, the tier and the rating line.
 */
import { describe, it, expect } from 'bun:test';
import {
  formatDuration, formatKda, kdaRatio, formatRatingChange, formatPlayedAt, winRate, tierName, ratingLine,
  recentForm, ratingTrend, sparkline, tierBar,
} from '@/ui/matchmaking/profileFormat';

describe('formatDuration', () => {
  it('minutes and seconds, hours when it took that long', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(1234.9)).toBe('20:34');
    expect(formatDuration(3600 + 62)).toBe('1:01:02');
  });

  it('nonsense: 0:00', () => {
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });
});

describe('KDA', () => {
  it('kills / deaths / assists', () => {
    expect(formatKda(4, 2, 7)).toBe('4 / 2 / 7');
  });

  it('the ratio: (kills + assists) / deaths, "Perfect" without deaths', () => {
    expect(kdaRatio(4, 2, 7)).toBe('5.50');
    expect(kdaRatio(0, 3, 0)).toBe('0.00');
    expect(kdaRatio(3, 0, 1)).toBe('Perfect');
    expect(kdaRatio(0, 0, 0)).toBe('0.00');
  });
});

describe('formatRatingChange', () => {
  it('signed, with no change written as ±0', () => {
    expect(formatRatingChange(1200, 1220)).toBe('+20');
    expect(formatRatingChange(1220, 1208)).toBe('−12');
    expect(formatRatingChange(1200, 1200)).toBe('±0');
  });

  it('an unrated match: nothing', () => {
    expect(formatRatingChange(null, null)).toBe('');
    expect(formatRatingChange(1200, null)).toBe('');
  });
});

describe('formatPlayedAt', () => {
  const now = Date.UTC(2026, 10, 4, 18, 0, 0);
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it('how long ago, then the date', () => {
    expect(formatPlayedAt(now - 20_000, now)).toBe('just now');
    expect(formatPlayedAt(now - 5 * MINUTE, now)).toBe('5 min ago');
    expect(formatPlayedAt(now - 3 * HOUR, now)).toBe('3 h ago');
    expect(formatPlayedAt(now - DAY - HOUR, now)).toBe('yesterday');
    expect(formatPlayedAt(now - 4 * DAY, now)).toBe('4 days ago');
    expect(formatPlayedAt(Date.UTC(2026, 8, 12, 12), now)).toMatch(/12/);
  });

  it('a clock that ran ahead: just now', () => {
    expect(formatPlayedAt(now + 10 * MINUTE, now)).toBe('just now');
  });
});

describe('winRate', () => {
  it('a whole percentage; no games, a dash', () => {
    expect(winRate(3, 2)).toBe('60%');
    expect(winRate(1, 2)).toBe('33%');
    expect(winRate(0, 0)).toBe('–');
  });
});

describe('the tier and the rating line', () => {
  it("the tier's name", () => {
    expect(tierName('silver')).toBe('Silver');
    expect(tierName('master')).toBe('Master');
    expect(tierName(undefined)).toBe('');
    expect(tierName('nonsense')).toBe('');
  });

  it('the rating and tier; unranked before a rated match', () => {
    expect(ratingLine({ rating: 1240, tier: 'silver', ratedGames: 3 })).toBe('1240 Silver');
    expect(ratingLine({ rating: 1200, tier: 'silver', ratedGames: 0 })).toBe('Unranked');
    expect(ratingLine({})).toBe('Unranked');
  });
});

// Newest first, as the profile lists them
const played = (won: boolean, ratingBefore: number | null, ratingAfter: number | null) => ({ won, ratingBefore, ratingAfter });

describe('recentForm', () => {
  it('the latest results, oldest first (read left to right)', () => {
    // Newest: a win, before it two losses
    expect(recentForm([played(true, null, null), played(false, null, null), played(false, null, null)], 10)).toEqual(['L', 'L', 'W']);
  });

  it('at most the count asked', () => {
    const matches = Array.from({ length: 15 }, (_, i) => played(i % 2 === 0, null, null));
    expect(recentForm(matches, 10)).toHaveLength(10);
    // The newest is last
    expect(recentForm(matches, 10).at(-1)).toBe('W');
  });

  it('no matches: nothing', () => {
    expect(recentForm([], 10)).toEqual([]);
  });
});

describe('ratingTrend', () => {
  it('the rating through the rated matches, oldest first, starting from before the first', () => {
    const matches = [played(true, 1220, 1238), played(false, 1240, 1220), played(true, 1200, 1240)];
    expect(ratingTrend(matches)).toEqual([1200, 1240, 1220, 1238]);
  });

  it('unrated matches are skipped', () => {
    const matches = [played(true, 1220, 1240), played(false, null, null), played(true, 1200, 1220)];
    expect(ratingTrend(matches)).toEqual([1200, 1220, 1240]);
  });

  it('no rated matches: no trend', () => {
    expect(ratingTrend([played(true, null, null)])).toEqual([]);
    expect(ratingTrend([])).toEqual([]);
  });
});

describe('sparkline', () => {
  it('spreads the values across the width, the highest at the top', () => {
    expect(sparkline([1200, 1300, 1250], 100, 50, 0)).toBe('0,50 50,0 100,25');
  });

  it('a flat line sits in the middle', () => {
    expect(sparkline([1200, 1200], 100, 50, 0)).toBe('0,25 100,25');
  });

  it('keeps a margin inside the box', () => {
    expect(sparkline([0, 10], 100, 50, 5)).toBe('5,45 95,5');
  });

  it('fewer than two values: no line', () => {
    expect(sparkline([1200], 100, 50, 0)).toBe('');
    expect(sparkline([], 100, 50, 0)).toBe('');
  });
});

describe('tierBar', () => {
  it('how far through the tier, and what is next', () => {
    expect(tierBar(1257)).toEqual({ percent: 79, label: '43 to Gold' });
  });

  it('at the top tier: full, and says so', () => {
    expect(tierBar(1950)).toEqual({ percent: 100, label: 'Top tier' });
  });

  it('just reached a tier: empty', () => {
    expect(tierBar(1300)).toEqual({ percent: 0, label: '200 to Platinum' });
  });
});
