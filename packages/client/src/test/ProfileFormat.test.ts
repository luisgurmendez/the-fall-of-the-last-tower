/**
 * How the profile screen writes a match (src/ui/matchmaking/profileFormat.ts):
 * its length, the KDA and its ratio, the rating change, when it was played,
 * the win rate, the tier and the rating line.
 */
import { describe, it, expect } from 'bun:test';
import {
  formatDuration, formatKda, kdaRatio, formatRatingChange, formatPlayedAt, winRate, tierName, ratingLine,
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
