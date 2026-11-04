/**
 * The match a player can go back to (GET /api/current-match), so the menu
 * offers only CONTINUE while it's live:
 *
 * - An account (its token): the live match it plays in, wherever it was
 *   started (another tab, another device), with the player's session to
 *   take it back. An account is one person, so a tab playing it now doesn't
 *   hide it: continuing takes the match over.
 * - A guest (the last match's player id and session token, kept by the
 *   browser): its match while it's live and nobody plays it. A player playing
 *   it in another tab is left alone, so two tabs can still play each other.
 *
 * An account can't start a second match while one is live (playsElsewhere:
 * READY answers in_match).
 */

import { timingSafeEqual } from 'node:crypto';

export interface CurrentMatch {
  playerId: string;
  sessionToken: string;
  championId: string;
  /** Seconds into the match */
  gameTime: number;
  practice: boolean;
}

/** What's asked with: the account's token, and the browser's last match */
export interface CurrentMatchAsk {
  accountToken?: string | null;
  playerId?: string | null;
  sessionToken?: string | null;
}

/** Where the answer comes from (server.ts: the accounts, sessions, rooms and connections) */
export interface CurrentMatchSources {
  accountForToken(token: string): { id: number } | null;
  /** The player an account last played a match as */
  playerOfAccount(accountId: number): string | undefined;
  /** The session token issued to a player */
  sessionOf(playerId: string): string | undefined;
  /** The player's match while it's live (not ended) */
  liveMatchOf(playerId: string): { championId: string; gameTime: number; practice: boolean } | null;
  /** Whether a connection plays the player now */
  isConnected(playerId: string): boolean;
}

export function findCurrentMatch(ask: CurrentMatchAsk, from: CurrentMatchSources): CurrentMatch | null {
  if (ask.accountToken) {
    const account = from.accountForToken(ask.accountToken);
    const playerId = account ? from.playerOfAccount(account.id) : undefined;
    const match = playerId ? describe(playerId, from) : null;
    if (match) return match;
  }

  const { playerId, sessionToken } = ask;
  if (!playerId || !sessionToken) return null;
  const session = from.sessionOf(playerId);
  if (session === undefined || !sameToken(session, sessionToken)) return null;
  if (from.isConnected(playerId)) return null;
  return describe(playerId, from);
}

/** Whether an account plays a live match as another player than this one */
export function playsElsewhere(accountId: number, playerId: string, from: CurrentMatchSources): boolean {
  const other = from.playerOfAccount(accountId);
  return other !== undefined && other !== playerId && from.liveMatchOf(other) !== null;
}

function describe(playerId: string, from: CurrentMatchSources): CurrentMatch | null {
  const live = from.liveMatchOf(playerId);
  const sessionToken = from.sessionOf(playerId);
  if (!live || sessionToken === undefined) return null;
  return { playerId, sessionToken, ...live };
}

/** Compared in constant time: a guessed token learns nothing from how long it took */
function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
