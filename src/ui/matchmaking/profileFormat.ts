/**
 * How the profile screen (profileScreen.ts) writes a match and an account:
 * a match's length, the KDA and its ratio, the rating change, when it was
 * played, the win rate, and the rating with its tier; the overview's recent
 * form, rating trend (a sparkline) and the bar toward the next tier.
 */

import { tierProgress } from "@siege/shared";

/** The tiers' names (packages/server/src/accounts/elo.ts has their ratings) */
const TIER_NAMES: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  master: 'Master',
};

/** "20:34", or "1:01:02" for an hour or more */
export function formatDuration(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = (total % 60).toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

export function formatKda(kills: number, deaths: number, assists: number): string {
  return `${kills} / ${deaths} / ${assists}`;
}

/** (kills + assists) / deaths, "Perfect" with kills or assists and no deaths */
export function kdaRatio(kills: number, deaths: number, assists: number): string {
  if (deaths === 0) return kills + assists > 0 ? 'Perfect' : '0.00';
  return ((kills + assists) / deaths).toFixed(2);
}

/** "+20", "−12", "±0"; nothing for an unrated match */
export function formatRatingChange(before: number | null, after: number | null): string {
  if (before === null || after === null) return '';
  const change = after - before;
  if (change === 0) return '±0';
  return change > 0 ? `+${change}` : `−${-change}`;
}

/** "5 min ago", "yesterday", "4 days ago", then the date */
export function formatPlayedAt(endedAt: number, now: number = Date.now()): string {
  const ago = now - endedAt;
  const minutes = Math.floor(ago / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(endedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "60%"; "–" with no games */
export function winRate(wins: number, losses: number): string {
  const games = wins + losses;
  return games > 0 ? `${Math.round((wins / games) * 100)}%` : '–';
}

export function tierName(tier: string | undefined): string {
  return (tier !== undefined && TIER_NAMES[tier]) || '';
}

/** "1240 Silver", or "Unranked" before the first rated match */
export function ratingLine(account: { rating?: number; tier?: string; ratedGames?: number }): string {
  if (!account.ratedGames || account.rating === undefined) return 'Unranked';
  return `${account.rating} ${tierName(account.tier)}`.trim();
}

/** A match's result and rating, as the overview reads it (the profile lists them newest first) */
interface Played {
  won: boolean;
  ratingBefore: number | null;
  ratingAfter: number | null;
}

/** The latest results, oldest first (read left to right), at most `count` */
export function recentForm(matches: readonly Played[], count: number): ('W' | 'L')[] {
  return matches.slice(0, count).map((match) => (match.won ? 'W' as const : 'L' as const)).reverse();
}

/** The rating through the rated matches, oldest first, from before the first of them */
export function ratingTrend(matches: readonly Played[]): number[] {
  const rated = matches.filter((match) => match.ratingBefore !== null && match.ratingAfter !== null).reverse();
  if (rated.length === 0) return [];
  return [rated[0].ratingBefore!, ...rated.map((match) => match.ratingAfter!)];
}

/** SVG polyline points for values across a box, the highest at the top ("" for fewer than two) */
export function sparkline(values: readonly number[], width: number, height: number, margin: number): string {
  if (values.length < 2) return '';
  const low = Math.min(...values);
  const high = Math.max(...values);
  const round = (value: number) => Math.round(value * 10) / 10;
  return values.map((value, i) => {
    const x = margin + (i / (values.length - 1)) * (width - margin * 2);
    const y = high === low ? height / 2 : margin + ((high - value) / (high - low)) * (height - margin * 2);
    return `${round(x)},${round(y)}`;
  }).join(' ');
}

/** The bar toward the next tier: how full (0-100) and what it says */
export function tierBar(rating: number): { percent: number; label: string } {
  const { next, progress, toNext } = tierProgress(rating);
  if (!next || toNext === null) return { percent: 100, label: 'Top tier' };
  return { percent: Math.round(progress * 100), label: `${toNext} to ${next.name}` };
}
