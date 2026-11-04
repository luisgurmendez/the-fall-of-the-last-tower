/**
 * Elo for accounts (AccountStore.recordMatch applies it):
 *
 * - Every account starts at START_RATING.
 * - A match is rated when it isn't practice and has a human on each side
 *   (friends in a room against bots have no one to be rated against).
 * - A team's rating is the average of its humans': a guest counts as
 *   START_RATING, bots don't count.
 * - Each account moves by K · (result − expected), expected from the two
 *   teams' ratings. K is K_PROVISIONAL for an account's first
 *   PROVISIONAL_GAMES rated matches, K_SETTLED after. Ratings are whole
 *   numbers, never below MIN_RATING.
 * - Tiers go by the rating (TIERS).
 */

export const START_RATING = 1200;
export const PROVISIONAL_GAMES = 10;
export const K_PROVISIONAL = 40;
export const K_SETTLED = 24;
export const MIN_RATING = 100;

/** A champion in a match, as Elo sees it */
export interface RatedPlayer {
  /** Whose: the changes are keyed by it */
  key: string;
  side: number;
  isBot: boolean;
  /** The account's rating; null for a guest or a bot */
  rating: number | null;
  /** The account's rated matches so far */
  ratedGames: number;
}

export interface RatingChange {
  before: number;
  after: number;
}

export type TierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';

export interface Tier {
  id: TierId;
  name: string;
  /** The rating it starts at */
  from: number;
}

/** From the bottom up; a new account starts in the middle of Silver */
export const TIERS: readonly Tier[] = [
  { id: 'bronze', name: 'Bronze', from: Number.NEGATIVE_INFINITY },
  { id: 'silver', name: 'Silver', from: 1100 },
  { id: 'gold', name: 'Gold', from: 1300 },
  { id: 'platinum', name: 'Platinum', from: 1500 },
  { id: 'diamond', name: 'Diamond', from: 1700 },
  { id: 'master', name: 'Master', from: 1900 },
];

/** A rating to count with: one that isn't a number counts as the starting one */
function sane(rating: number | null): number {
  return rating !== null && Number.isFinite(rating) ? rating : START_RATING;
}

/** The chance (0-1) that a side rated `own` beats one rated `other` */
export function expectedScore(own: number, other: number): number {
  return 1 / (1 + 10 ** ((sane(other) - sane(own)) / 400));
}

/** How far a match moves an account with this many rated matches */
export function kFactor(ratedGames: number): number {
  return Number.isFinite(ratedGames) && ratedGames >= PROVISIONAL_GAMES ? K_SETTLED : K_PROVISIONAL;
}

/** Rated: not practice, and a human on each side */
export function isRated(practice: boolean, players: readonly RatedPlayer[]): boolean {
  if (practice) return false;
  const humans = players.filter(player => !player.isBot);
  return humans.some(player => player.side === 0) && humans.some(player => player.side === 1);
}

/** The average of a side's humans' ratings (guests at START_RATING); START_RATING with none */
export function teamRating(players: readonly RatedPlayer[], side: number): number {
  const humans = players.filter(player => player.side === side && !player.isBot);
  if (humans.length === 0) return START_RATING;
  return humans.reduce((sum, player) => sum + sane(player.rating), 0) / humans.length;
}

/**
 * Each account's rating before and after a match (rated or not: an unrated
 * one changes nothing), keyed by RatedPlayer.key. Guests and bots aren't in it.
 */
export function ratingChanges(players: readonly RatedPlayer[], winningSide: number): Map<string, RatingChange> {
  const changes = new Map<string, RatingChange>();
  if ((winningSide !== 0 && winningSide !== 1) || !isRated(false, players)) return changes;
  const ratings = [teamRating(players, 0), teamRating(players, 1)];
  for (const player of players) {
    if (player.isBot || player.rating === null) continue;
    const before = Math.round(sane(player.rating));
    const side = player.side === 1 ? 1 : 0;
    const expected = expectedScore(ratings[side], ratings[1 - side]);
    const result = player.side === winningSide ? 1 : 0;
    // (+ 0: no -0 from rounding a tiny loss)
    const after = Math.max(MIN_RATING, before + Math.round(kFactor(player.ratedGames) * (result - expected)) + 0);
    changes.set(player.key, { before, after });
  }
  return changes;
}

/** The tier a rating is in */
export function tierOf(rating: number): Tier {
  const value = sane(rating);
  let tier = TIERS[0];
  for (const candidate of TIERS) if (value >= candidate.from) tier = candidate;
  return tier;
}
