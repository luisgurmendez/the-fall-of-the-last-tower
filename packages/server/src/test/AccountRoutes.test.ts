/**
 * The accounts' HTTP API (src/accounts/accountRoutes.ts), next to the game's
 * socket: POST /api/register and /api/login take { name, password } and
 * answer { account, token }; GET /api/me and POST /api/logout take the token
 * as "Authorization: Bearer <token>". Errors answer { error }. Bodies over
 * 2 KB are refused, and so are more than 10 sign-ups or sign-ins a minute
 * from one address. Any page may call it (tokens aren't cookies).
 */

import { describe, test, expect } from 'bun:test';
import { AccountStore } from '../accounts/AccountStore';
import { AccountRoutes, LOGIN_ATTEMPTS_PER_MINUTE } from '../accounts/accountRoutes';

const BASE = 'http://localhost:8080';

function setup() {
  let now = 1_000_000;
  const store = new AccountStore(':memory:', { now: () => now });
  const routes = new AccountRoutes(store, { now: () => now });
  const call = (path: string, init: RequestInit = {}, ip = '1.2.3.4') => routes.handle(new Request(BASE + path, init), ip);
  const post = (path: string, body: unknown, ip?: string) =>
    call(path, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, ip);
  const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });
  return { routes, store, call, post, bearer, advance: (ms: number) => { now += ms; } };
}

async function json(response: Response | null): Promise<any> {
  expect(response).not.toBeNull();
  return response!.json();
}

describe('Account API', () => {
  test('paths outside /api/ are not its', async () => {
    const { call } = setup();
    expect(await call('/')).toBeNull();
    expect(await call('/ws')).toBeNull();
    expect(await call('/health')).toBeNull();
    expect(await call('/apix')).toBeNull();
  });

  test('sign up: the account and a token', async () => {
    const { post } = setup();
    const response = await post('/api/register', { name: 'Luis', password: 'secreto1' });
    expect(response!.status).toBe(200);
    const body = await json(response);
    expect(body.account).toMatchObject({ name: 'Luis', wins: 0, losses: 0 });
    expect(typeof body.token).toBe('string');
    expect(JSON.stringify(body)).not.toContain('secreto1');
  });

  test('sign up refused: why', async () => {
    const { post } = setup();
    await post('/api/register', { name: 'Luis', password: 'secreto1' });
    const taken = await post('/api/register', { name: 'luis', password: 'secreto1' });
    expect(taken!.status).toBe(409);
    expect(await json(taken)).toEqual({ error: 'name_taken' });
    const badName = await post('/api/register', { name: 'a', password: 'secreto1' });
    expect(badName!.status).toBe(400);
    expect(await json(badName)).toEqual({ error: 'bad_name' });
    const badPassword = await post('/api/register', { name: 'Other', password: '1' });
    expect(badPassword!.status).toBe(400);
    expect(await json(badPassword)).toEqual({ error: 'bad_password' });
  });

  test('sign in: a token; wrong: 401', async () => {
    const { post } = setup();
    await post('/api/register', { name: 'Luis', password: 'secreto1' });
    const good = await post('/api/login', { name: 'Luis', password: 'secreto1' });
    expect(good!.status).toBe(200);
    expect((await json(good)).account.name).toBe('Luis');
    const bad = await post('/api/login', { name: 'Luis', password: 'nope-nope' });
    expect(bad!.status).toBe(401);
    expect(await json(bad)).toEqual({ error: 'wrong_login' });
  });

  test('me: the account of the token; none or a bad one: 401', async () => {
    const { post, call, bearer } = setup();
    const { token } = await json(await post('/api/register', { name: 'Luis', password: 'secreto1' }));
    const me = await call('/api/me', bearer(token));
    expect(me!.status).toBe(200);
    expect((await json(me)).account).toMatchObject({ name: 'Luis' });
    expect((await call('/api/me'))!.status).toBe(401);
    expect((await call('/api/me', bearer('nonsense')))!.status).toBe(401);
    expect((await call('/api/me', { headers: { Authorization: token } }))!.status).toBe(401);
  });

  test('sign out: the token is no longer anyone', async () => {
    const { post, call, bearer } = setup();
    const { token } = await json(await post('/api/register', { name: 'Luis', password: 'secreto1' }));
    const out = await call('/api/logout', { method: 'POST', ...bearer(token) });
    expect(out!.status).toBe(204);
    expect((await call('/api/me', bearer(token)))!.status).toBe(401);
  });

  test('a body that isn\'t JSON, or isn\'t an object: 400', async () => {
    const { post } = setup();
    for (const body of ['not json', '"a string"', '[1,2]', 'null', '']) {
      const response = await post('/api/login', body);
      expect(response!.status).toBe(400);
      expect(await json(response)).toEqual({ error: 'bad_request' });
    }
  });

  test('a body over 2 KB: 413, and it isn\'t read as an attempt', async () => {
    const { post } = setup();
    const response = await post('/api/register', { name: 'Luis', password: 'x'.repeat(3000) });
    expect(response!.status).toBe(413);
  });

  test('the wrong method: 405; an unknown path: 404', async () => {
    const { call } = setup();
    expect((await call('/api/login'))!.status).toBe(405);
    expect((await call('/api/me', { method: 'POST' }))!.status).toBe(405);
    expect((await call('/api/nothing'))!.status).toBe(404);
  });

  test('more than 10 sign-ins a minute from one address: 429, until the minute passes', async () => {
    const { post, advance } = setup();
    expect(LOGIN_ATTEMPTS_PER_MINUTE).toBe(10);
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_MINUTE; i++) {
      expect((await post('/api/login', { name: 'Luis', password: `guess${i}xx` }))!.status).toBe(401);
    }
    const blocked = await post('/api/login', { name: 'Luis', password: 'guess-more' });
    expect(blocked!.status).toBe(429);
    expect(await json(blocked)).toEqual({ error: 'too_many_attempts' });
    // Another address isn't held back
    expect((await post('/api/login', { name: 'Luis', password: 'guess-more' }, '5.6.7.8'))!.status).toBe(401);
    advance(60_000);
    expect((await post('/api/login', { name: 'Luis', password: 'guess-more' }))!.status).toBe(401);
  });

  test('sign-ups count toward the same limit', async () => {
    const { post } = setup();
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_MINUTE; i++) await post('/api/register', { name: `user${i}`, password: 'secreto1' });
    expect((await post('/api/register', { name: 'oneMore', password: 'secreto1' }))!.status).toBe(429);
  });

  test('me and sign out aren\'t limited', async () => {
    const { post, call, bearer } = setup();
    const { token } = await json(await post('/api/register', { name: 'Luis', password: 'secreto1' }));
    for (let i = 0; i < 30; i++) expect((await call('/api/me', bearer(token)))!.status).toBe(200);
  });

  test('any page may call it: CORS headers, and the preflight', async () => {
    const { call, post } = setup();
    const preflight = await call('/api/login', { method: 'OPTIONS' });
    expect(preflight!.status).toBe(204);
    expect(preflight!.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(preflight!.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(preflight!.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    const response = await post('/api/register', { name: 'Luis', password: 'secreto1' });
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response!.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('Profiles and matches', () => {
  const TOTALS = {
    damageToChampions: 1, damageDealt: 2, damageTaken: 3, healing: 4, damageToStructures: 5,
    goldEarned: 6, wardsPlaced: 7, wardsDestroyed: 8, largestKillingSpree: 9,
  };
  const line = (playerId: string, side: number, accountId: number | null, name: string | null) => ({
    playerId, side, accountId, name, isBot: false, championId: 'vex', level: 6, kills: 1, deaths: 2, assists: 3,
    cs: 40, gold: 2000, items: [null, null, null, null, null, null], totals: TOTALS,
  });

  async function withMatch() {
    const context = setup();
    const luis = (await json(await context.post('/api/register', { name: 'Luis', password: 'secreto1' }))).account;
    const ana = (await json(await context.post('/api/register', { name: 'Ana', password: 'secreto1' }))).account;
    const recorded = context.store.recordMatch({
      mapId: 'vale', mode: 'queue', practice: false, duration: 600, winningSide: 0,
      players: [line('p1', 0, luis.id, 'Luis'), line('p2', 1, ana.id, 'Ana')],
    })!;
    return { ...context, matchId: recorded.matchId };
  }

  test("an account's profile: its rating, tier, record, champions and latest matches", async () => {
    const { call, matchId } = await withMatch();
    const response = await call('/api/profile/Luis');
    expect(response!.status).toBe(200);
    const body = await json(response);
    expect(body.profile).toMatchObject({ name: 'Luis', wins: 1, losses: 0, rating: 1220, peakRating: 1220, ratedGames: 1, tier: 'silver' });
    expect(body.profile.champions).toEqual([{ championId: 'vex', games: 1, wins: 1, kills: 1, deaths: 2, assists: 3 }]);
    expect(body.profile.averages).toMatchObject({ games: 1, kills: 1, deaths: 2, assists: 3 });
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0]).toMatchObject({ id: matchId, won: true, championId: 'vex', ratingBefore: 1200, ratingAfter: 1220 });
    expect(body.more).toBe(false);
  });

  test('a profile is public and never shows a password or a token', async () => {
    const { call } = await withMatch();
    const text = JSON.stringify(await json(await call('/api/profile/Luis')));
    expect(text).not.toContain('secreto1');
    expect(text).not.toContain('password');
    expect(text).not.toContain('token');
  });

  test('the name however capitalized, and written as a URL writes it', async () => {
    const { call, post } = await withMatch();
    expect((await json(await call('/api/profile/luis'))).profile.name).toBe('Luis');
    await post('/api/register', { name: 'Ñandú', password: 'secreto1' });
    expect((await json(await call(`/api/profile/${encodeURIComponent('ñandú')}`))).profile.name).toBe('Ñandú');
  });

  test('no such account: 404 no_account', async () => {
    const { call } = await withMatch();
    for (const path of ['/api/profile/Nadie', '/api/profile/', '/api/profile/a', `/api/profile/${'x'.repeat(40)}`]) {
      const response = await call(path);
      expect(response!.status).toBe(404);
      expect(await json(response)).toEqual({ error: 'no_account' });
    }
  });

  test('a name that is not a name, or a nested path: 400 or 404, never a crash', async () => {
    const { call } = await withMatch();
    expect((await call('/api/profile/%E0%A4%A'))!.status).toBe(400);
    expect((await call('/api/profile/Luis/more'))!.status).toBe(404);
  });

  test('pages: before=<match id> gives the ones before it; a bad one is 400', async () => {
    const { call, matchId } = await withMatch();
    expect((await json(await call(`/api/profile/Luis?before=${matchId}`))).matches).toEqual([]);
    expect((await json(await call(`/api/profile/Luis?before=${matchId + 1}`))).matches).toHaveLength(1);
    for (const before of ['abc', '-1', '0', '1.5', '1e3', '', '99999999999999999999']) {
      const response = await call(`/api/profile/Luis?before=${before}`);
      expect(response!.status).toBe(400);
      expect(await json(response)).toEqual({ error: 'bad_request' });
    }
  });

  test('a match: both teams', async () => {
    const { call, matchId } = await withMatch();
    const response = await call(`/api/matches/${matchId}`);
    expect(response!.status).toBe(200);
    const { match } = await json(response);
    expect(match).toMatchObject({ id: matchId, mapId: 'vale', mode: 'queue', rated: true, duration: 600, winningSide: 0 });
    expect(match.players.map((p: { name: string; won: boolean; account: boolean }) => [p.name, p.won, p.account]))
      .toEqual([['Luis', true, true], ['Ana', false, true]]);
    expect(match.players[0].totals).toEqual(TOTALS);
  });

  test('a match never kept: 404 no_match; an id that is not one: 400', async () => {
    const { call } = await withMatch();
    const missing = await call('/api/matches/999');
    expect(missing!.status).toBe(404);
    expect(await json(missing)).toEqual({ error: 'no_match' });
    for (const id of ['abc', '-1', '0', '1.5', '1e2', '%20', '99999999999999999999']) {
      expect((await call(`/api/matches/${id}`))!.status).toBe(400);
    }
    expect((await call('/api/matches/'))!.status).toBe(404);
    expect((await call('/api/matches/1/2'))!.status).toBe(404);
  });

  test('only GET', async () => {
    const { call, matchId } = await withMatch();
    expect((await call('/api/profile/Luis', { method: 'POST' }))!.status).toBe(405);
    expect((await call(`/api/matches/${matchId}`, { method: 'DELETE' }))!.status).toBe(405);
  });

  test('signing in and me carry the rating and the tier', async () => {
    const { post, call, bearer } = await withMatch();
    const { account, token } = await json(await post('/api/login', { name: 'Luis', password: 'secreto1' }));
    expect(account).toMatchObject({ rating: 1220, tier: 'silver', ratedGames: 1 });
    expect((await json(await call('/api/me', bearer(token)))).account).toMatchObject({ rating: 1220, tier: 'silver' });
  });
});
