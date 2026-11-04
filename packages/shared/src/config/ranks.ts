/**
 * Ranks: the tiers ratings fall in (the server rates accounts:
 * packages/server/src/accounts/elo.ts), and how far a rating is toward the
 * next tier (the profile's bar). A new account starts at 1200, in the
 * middle of Silver, so one loss doesn't drop it a tier.
 */

export type TierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';

export interface Tier {
  id: TierId;
  name: string;
  /** The rating it starts at */
  from: number;
}

/** How many points each tier spans (all but the last; Bronze's bar uses it too) */
export const TIER_SPAN = 200;

/** From the bottom up */
export const TIERS: readonly Tier[] = [
  { id: 'bronze', name: 'Bronze', from: Number.NEGATIVE_INFINITY },
  { id: 'silver', name: 'Silver', from: 1100 },
  { id: 'gold', name: 'Gold', from: 1300 },
  { id: 'platinum', name: 'Platinum', from: 1500 },
  { id: 'diamond', name: 'Diamond', from: 1700 },
  { id: 'master', name: 'Master', from: 1900 },
];

/** The tier a rating is in (one that isn't a number: Bronze) */
export function tierFor(rating: number): Tier {
  let tier = TIERS[0];
  if (!Number.isFinite(rating)) return tier;
  for (const candidate of TIERS) if (rating >= candidate.from) tier = candidate;
  return tier;
}

export interface TierProgress {
  tier: Tier;
  /** The tier above; null at the top */
  next: Tier | null;
  /** 0 at the tier's start, 1 at the next one's (1 at the top) */
  progress: number;
  /** Points to the next tier; null at the top */
  toNext: number | null;
}

/** How far a rating is through its tier toward the next */
export function tierProgress(rating: number): TierProgress {
  const tier = tierFor(rating);
  const next = TIERS[TIERS.indexOf(tier) + 1] ?? null;
  if (!next) return { tier, next, progress: 1, toNext: null };
  if (!Number.isFinite(rating)) return { tier, next, progress: 0, toNext: TIER_SPAN };
  const start = Number.isFinite(tier.from) ? tier.from : next.from - TIER_SPAN;
  const progress = Math.min(1, Math.max(0, (rating - start) / (next.from - start)));
  return { tier, next, progress, toNext: Math.ceil(next.from - rating) };
}
