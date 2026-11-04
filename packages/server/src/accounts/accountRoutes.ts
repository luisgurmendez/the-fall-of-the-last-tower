/**
 * The accounts' HTTP API, served next to the game's socket
 * (BunWebSocketServer hands it every /api/ request):
 *
 * - POST /api/register { name, password } → { account, token } (400 bad_name
 *   or bad_password, 409 name_taken)
 * - POST /api/login { name, password } → { account, token } (401 wrong_login)
 * - GET /api/me, Authorization: Bearer <token> → { account } (401)
 * - POST /api/logout, the same header → 204
 * - GET /api/current-match → { match } (null without one): the match to go
 *   back to, for the account's bearer token or a guest's last match
 *   (X-Siege-Player, X-Siege-Session); see game/currentMatch.ts
 *
 * Bodies over MAX_BODY_BYTES are refused (413). One address gets at most
 * LOGIN_ATTEMPTS_PER_MINUTE sign-ups and sign-ins a minute (429). Tokens
 * travel in a header, not a cookie, so any page may call it (CORS *: no
 * page can act for a player without their token).
 */

import type { AccountStore, AccountResult } from './AccountStore';
import type { CurrentMatch, CurrentMatchAsk } from '../game/currentMatch';

export const LOGIN_ATTEMPTS_PER_MINUTE = 10;
const MAX_BODY_BYTES = 2048;
const MINUTE_MS = 60_000;

const HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
};

const PREFLIGHT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Siege-Player, X-Siege-Session',
  'Access-Control-Max-Age': '600',
};

const ERROR_STATUS: Record<string, number> = { bad_name: 400, bad_password: 400, name_taken: 409, wrong_login: 401 };

function reply(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: HEADERS });
}

/** The token in "Authorization: Bearer <token>" */
function bearerToken(request: Request): string | null {
  const match = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '');
  return match ? match[1] : null;
}

export class AccountRoutes {
  private readonly now: () => number;
  /** Each address's recent sign-ups and sign-ins (ms) */
  private readonly attempts = new Map<string, number[]>();

  /** The match a player can go back to (none without matches: tests, tools) */
  private readonly currentMatch: (ask: CurrentMatchAsk) => CurrentMatch | null;

  constructor(
    private readonly store: AccountStore,
    options: { now?: () => number; currentMatch?: (ask: CurrentMatchAsk) => CurrentMatch | null } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.currentMatch = options.currentMatch ?? (() => null);
  }

  /** The answer to an /api/ request; null for any other path */
  async handle(request: Request, clientIp: string): Promise<Response | null> {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return null;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: PREFLIGHT_HEADERS });

    switch (pathname) {
      case '/api/register':
      case '/api/login': {
        if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
        const body = await this.readBody(request);
        if (body instanceof Response) return body;
        if (!this.allowAttempt(clientIp)) return reply(429, { error: 'too_many_attempts' });
        const result = pathname === '/api/register'
          ? await this.store.register(body.name, body.password)
          : await this.store.login(body.name, body.password);
        return this.answer(result);
      }
      case '/api/me': {
        if (request.method !== 'GET') return reply(405, { error: 'method_not_allowed' });
        const account = this.store.accountForToken(bearerToken(request));
        return account ? reply(200, { account }) : reply(401, { error: 'no_session' });
      }
      case '/api/current-match': {
        if (request.method !== 'GET') return reply(405, { error: 'method_not_allowed' });
        const match = this.currentMatch({
          accountToken: bearerToken(request),
          playerId: request.headers.get('X-Siege-Player'),
          sessionToken: request.headers.get('X-Siege-Session'),
        });
        return reply(200, { match });
      }
      case '/api/logout': {
        if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
        this.store.logout(bearerToken(request));
        return reply(204);
      }
      default:
        return reply(404, { error: 'not_found' });
    }
  }

  private answer(result: AccountResult): Response {
    if (result.ok) return reply(200, { account: result.account, token: result.token });
    return reply(ERROR_STATUS[result.error] ?? 400, { error: result.error });
  }

  /** The JSON object sent, or the answer refusing it */
  private async readBody(request: Request): Promise<Record<string, unknown> | Response> {
    // Said to be too big: not even read
    if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return reply(413, { error: 'too_large' });
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return reply(413, { error: 'too_large' });
    try {
      const body = JSON.parse(text);
      if (typeof body === 'object' && body !== null && !Array.isArray(body)) return body;
    } catch {
      // Not JSON
    }
    return reply(400, { error: 'bad_request' });
  }

  /** Whether an address may try again this minute (and count it) */
  private allowAttempt(clientIp: string): boolean {
    const now = this.now();
    const recent = (this.attempts.get(clientIp) ?? []).filter(time => now - time < MINUTE_MS);
    if (recent.length >= LOGIN_ATTEMPTS_PER_MINUTE) {
      this.attempts.set(clientIp, recent);
      return false;
    }
    recent.push(now);
    this.attempts.set(clientIp, recent);
    // Forget addresses that went quiet, so the map doesn't grow forever
    if (this.attempts.size > 10_000) {
      for (const [ip, times] of this.attempts) if (times.every(time => now - time >= MINUTE_MS)) this.attempts.delete(ip);
    }
    return true;
  }
}
