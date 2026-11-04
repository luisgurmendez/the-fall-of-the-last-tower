/**
 * Going back to a live match from the menu. The server remembers each
 * player's match (GET /api/current-match: packages/server/src/game/currentMatch.ts):
 * an account's wherever it was started, or the browser's last match while
 * nobody plays it. While there's one, the menu offers only CONTINUE.
 *
 * The browser keeps its last match (player id and session token) in
 * localStorage, so a new tab finds it after the old one was closed; the tab
 * playing keeps its own in sessionStorage (matchConnection.ts).
 */

export const LAST_MATCH_KEY = "siege-last-match";

/** Where the last match is kept (localStorage; a stand-in in tests) */
export interface MatchStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LastMatch {
  playerId: string;
  sessionToken: string;
}

export interface CurrentMatch extends LastMatch {
  championId: string;
  /** Seconds into the match */
  gameTime: number;
  practice: boolean;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export function rememberLastMatch(storage: MatchStorage | null, match: LastMatch): void {
  try {
    storage?.setItem(LAST_MATCH_KEY, JSON.stringify(match));
  } catch {
    // Storage full or refused: a new tab just won't find it
  }
}

export function readLastMatch(storage: MatchStorage | null): LastMatch | null {
  try {
    const value = JSON.parse(storage?.getItem(LAST_MATCH_KEY) ?? "null");
    return isLastMatch(value) ? { playerId: value.playerId, sessionToken: value.sessionToken } : null;
  } catch {
    return null;
  }
}

/** Forget the last match (only if it's that player's, when one is named) */
export function forgetLastMatch(storage: MatchStorage | null, playerId?: string): void {
  if (playerId !== undefined && readLastMatch(storage)?.playerId !== playerId) return;
  try {
    storage?.removeItem(LAST_MATCH_KEY);
  } catch {
    // Nothing to forget
  }
}

/**
 * The match to go back to, if any. Not reaching the server (or a strange
 * answer) reads as none: the menu stays as it is.
 */
export async function fetchCurrentMatch(
  baseUrl: string,
  accountToken: string | undefined,
  last: LastMatch | null,
  fetchFn: FetchFn = (url, init) => fetch(url, init),
): Promise<CurrentMatch | null> {
  // In headers, never in the address (addresses end up in logs)
  const headers: Record<string, string> = {};
  if (accountToken) headers.Authorization = `Bearer ${accountToken}`;
  if (last) {
    headers["X-Siege-Player"] = last.playerId;
    headers["X-Siege-Session"] = last.sessionToken;
  }
  try {
    const response = await fetchFn(`${baseUrl}/api/current-match`, { headers });
    if (!response.ok) return null;
    const { match } = await response.json();
    return isCurrentMatch(match) ? match : null;
  } catch {
    return null;
  }
}

/** The line under CONTINUE: "Practice · Nocthar · 12:34" */
export function continueLabel(match: CurrentMatch, championName: (id: string) => string): string {
  const seconds = Math.max(0, Math.floor(match.gameTime));
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return [match.practice ? "Practice" : null, championName(match.championId), clock].filter(Boolean).join(" · ");
}

function isLastMatch(value: unknown): value is LastMatch {
  const match = value as LastMatch | null;
  return typeof match?.playerId === "string" && match.playerId.length > 0 &&
    typeof match.sessionToken === "string" && match.sessionToken.length > 0;
}

function isCurrentMatch(value: unknown): value is CurrentMatch {
  const match = value as CurrentMatch | null;
  return isLastMatch(match) && typeof match.championId === "string" &&
    typeof match.gameTime === "number" && typeof match.practice === "boolean";
}
