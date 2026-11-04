/**
 * Elo (src/accounts/elo.ts): every account starts at START_RATING. A match
 * that isn't practice, with a human on each side, is rated. A team's rating
 * is the average of its humans' (a guest counts as START_RATING, bots don't
 * count). Each account moves by K · (result − expected), K being bigger for
 * its first PROVISIONAL_GAMES rated matches. Tiers go by the rating.
 */

import { describe, test, expect } from 'bun:test';
import {
  START_RATING, PROVISIONAL_GAMES, K_PROVISIONAL, K_SETTLED, MIN_RATING,
  expectedScore, kFactor, isRated, teamRating, ratingChanges, tierOf, TIERS,
  type RatedPlayer,
} from '../accounts/elo';

function account(side: number, rating: number, ratedGames = 20, key = `a${side}-${rating}`): RatedPlayer {
  return { key, side, isBot: false, rating, ratedGames };
}
function guest(side: number, key = `guest-${side}`): RatedPlayer {
  return { key, side, isBot: false, rating: null, ratedGames: 0 };
}
function bot(side: number, key = `bot-${side}`): RatedPlayer {
  return { key, side, isBot: true, rating: null, ratedGames: 0 };
}

describe('Expected score', () => {
  test('equal ratings: an even match', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 10);
  });

  test('400 points apart: the stronger one is expected to win 10 to 1', () => {
    expect(expectedScore(1600, 1200)).toBeCloseTo(10 / 11, 10);
    expect(expectedScore(1200, 1600)).toBeCloseTo(1 / 11, 10);
  });

  test('both sides add up to 1', () => {
    for (const [a, b] of [[1000, 1300], [1500, 900], [1234, 1235]]) {
      expect(expectedScore(a, b) + expectedScore(b, a)).toBeCloseTo(1, 10);
    }
  });

  test('a rating that isn\'t a number counts as the starting one', () => {
    expect(expectedScore(Number.NaN, START_RATING)).toBeCloseTo(0.5, 10);
    expect(expectedScore(START_RATING, Number.POSITIVE_INFINITY)).toBeCloseTo(0.5, 10);
  });
});

describe('K', () => {
  test('bigger for the first rated matches, then settled', () => {
    expect(kFactor(0)).toBe(K_PROVISIONAL);
    expect(kFactor(PROVISIONAL_GAMES - 1)).toBe(K_PROVISIONAL);
    expect(kFactor(PROVISIONAL_GAMES)).toBe(K_SETTLED);
    expect(kFactor(500)).toBe(K_SETTLED);
    expect(K_PROVISIONAL).toBeGreaterThan(K_SETTLED);
  });

  test('a count that isn\'t a number: provisional', () => {
    expect(kFactor(Number.NaN)).toBe(K_PROVISIONAL);
    expect(kFactor(-3)).toBe(K_PROVISIONAL);
  });
});

describe('Which matches are rated', () => {
  test('a human on each side', () => {
    expect(isRated(false, [account(0, 1200), account(1, 1200)])).toBe(true);
    expect(isRated(false, [guest(0), account(1, 1200)])).toBe(true);
    expect(isRated(false, [account(0, 1200), bot(0), guest(1), bot(1)])).toBe(true);
  });

  test('practice never is', () => {
    expect(isRated(true, [account(0, 1200), account(1, 1200)])).toBe(false);
  });

  test('humans against bots only is not (no one to rate against)', () => {
    expect(isRated(false, [account(0, 1200), account(0, 1300), bot(1), bot(1)])).toBe(false);
    expect(isRated(false, [bot(0), account(1, 1200)])).toBe(false);
    expect(isRated(false, [bot(0), bot(1)])).toBe(false);
    expect(isRated(false, [])).toBe(false);
  });
});

describe("A team's rating", () => {
  test("the average of its humans'", () => {
    expect(teamRating([account(0, 1000), account(0, 1400), account(1, 2000)], 0)).toBe(1200);
  });

  test('a guest counts as the starting rating, a bot not at all', () => {
    expect(teamRating([account(0, 1500), guest(0)], 0)).toBe((1500 + START_RATING) / 2);
    expect(teamRating([account(0, 1500), bot(0), bot(0)], 0)).toBe(1500);
  });

  test('no humans: the starting rating (never NaN)', () => {
    expect(teamRating([bot(0)], 0)).toBe(START_RATING);
    expect(teamRating([], 1)).toBe(START_RATING);
  });

  test('a rating that isn\'t a number counts as the starting one', () => {
    expect(teamRating([account(0, Number.NaN), account(0, 1400)], 0)).toBe((START_RATING + 1400) / 2);
  });
});

describe('Rating changes', () => {
  test('equal 1v1: the winner gains what the loser loses, K/2 each', () => {
    const changes = ratingChanges([account(0, 1200, 20, 'a'), account(1, 1200, 20, 'b')], 0);
    expect(changes.get('a')).toEqual({ before: 1200, after: 1200 + K_SETTLED / 2 });
    expect(changes.get('b')).toEqual({ before: 1200, after: 1200 - K_SETTLED / 2 });
  });

  test('an upset moves more than an expected win', () => {
    const upset = ratingChanges([account(0, 1000, 20, 'weak'), account(1, 1400, 20, 'strong')], 0);
    const expected = ratingChanges([account(0, 1000, 20, 'weak'), account(1, 1400, 20, 'strong')], 1);
    const upsetGain = upset.get('weak')!.after - 1000;
    const expectedGain = expected.get('strong')!.after - 1400;
    expect(upsetGain).toBeGreaterThan(expectedGain);
    expect(upsetGain).toBe(Math.round(K_SETTLED * (1 - 1 / 11)));
    expect(expectedGain).toBe(Math.round(K_SETTLED * (1 / 11)));
  });

  test('the winner never loses rating and the loser never gains', () => {
    const changes = ratingChanges([account(0, 2400, 50, 'giant'), account(1, 600, 50, 'small')], 0);
    expect(changes.get('giant')!.after).toBeGreaterThanOrEqual(2400);
    expect(changes.get('small')!.after).toBeLessThanOrEqual(600);
  });

  test('provisional accounts move more', () => {
    const changes = ratingChanges([account(0, 1200, 0, 'new'), account(1, 1200, 30, 'old')], 0);
    expect(changes.get('new')!.after - 1200).toBe(K_PROVISIONAL / 2);
    expect(changes.get('old')!.after - 1200).toBe(-K_SETTLED / 2);
  });

  test('the switch is at PROVISIONAL_GAMES rated matches', () => {
    const before = ratingChanges([account(0, 1200, PROVISIONAL_GAMES - 1, 'a'), account(1, 1200, 20, 'b')], 0);
    const at = ratingChanges([account(0, 1200, PROVISIONAL_GAMES, 'a'), account(1, 1200, 20, 'b')], 0);
    expect(before.get('a')!.after - 1200).toBe(K_PROVISIONAL / 2);
    expect(at.get('a')!.after - 1200).toBe(K_SETTLED / 2);
  });

  test('2v2: by the teams\' averages, each account by its own K', () => {
    const players = [account(0, 1100, 20, 'a1'), account(0, 1300, 20, 'a2'), account(1, 1500, 20, 'b1'), account(1, 1100, 20, 'b2')];
    const changes = ratingChanges(players, 0);
    const expected = expectedScore(1200, 1300);
    expect(changes.get('a1')!.after).toBe(1100 + Math.round(K_SETTLED * (1 - expected)));
    expect(changes.get('a2')!.after).toBe(1300 + Math.round(K_SETTLED * (1 - expected)));
    expect(changes.get('b1')!.after).toBe(1500 + Math.round(K_SETTLED * (0 - (1 - expected))));
    expect(changes.get('b2')!.after).toBe(1100 + Math.round(K_SETTLED * (0 - (1 - expected))));
  });

  test('guests and bots get no change (they have no rating)', () => {
    const changes = ratingChanges([account(0, 1200, 20, 'a'), guest(1, 'g'), bot(1, 'bot')], 0);
    expect([...changes.keys()]).toEqual(['a']);
    expect(changes.get('a')).toEqual({ before: 1200, after: 1212 });
  });

  test('an unrated match changes nothing', () => {
    expect(ratingChanges([account(0, 1200), bot(1)], 0).size).toBe(0);
  });

  test('ratings are whole numbers and never NaN', () => {
    const changes = ratingChanges([account(0, Number.NaN, Number.NaN, 'x'), account(1, 1234.5, 3, 'y')], 1);
    for (const { before, after } of changes.values()) {
      expect(Number.isInteger(before)).toBe(true);
      expect(Number.isInteger(after)).toBe(true);
    }
    expect(changes.get('x')!.before).toBe(START_RATING);
  });

  test('a rating never drops below MIN_RATING', () => {
    const changes = ratingChanges([account(0, MIN_RATING, 0, 'floor'), account(1, MIN_RATING, 0, 'other')], 1);
    expect(changes.get('floor')!.after).toBe(MIN_RATING);
  });

  test('a winning side that is neither: no one wins, no change', () => {
    expect(ratingChanges([account(0, 1200), account(1, 1200)], 7).size).toBe(0);
  });
});

describe('Tiers', () => {
  test('by the rating, from the bottom up', () => {
    expect(tierOf(0).id).toBe('bronze');
    expect(tierOf(START_RATING).id).toBe('silver');
    expect(tierOf(5000).id).toBe('master');
  });

  test("each tier starts at its rating and holds up to the next one's", () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(tierOf(TIERS[i].from).id).toBe(TIERS[i].id);
      expect(tierOf(TIERS[i].from - 1).id).toBe(TIERS[i - 1].id);
    }
  });

  test('a new account is in the middle of its tier (one loss doesn\'t drop it)', () => {
    const start = TIERS.findIndex(tier => tier.id === tierOf(START_RATING).id);
    expect(START_RATING - TIERS[start].from).toBeGreaterThan(K_PROVISIONAL);
    expect(TIERS[start + 1].from - START_RATING).toBeGreaterThan(K_PROVISIONAL);
  });

  test('a rating that isn\'t a number: the starting tier', () => {
    expect(tierOf(Number.NaN).id).toBe(tierOf(START_RATING).id);
  });
});
