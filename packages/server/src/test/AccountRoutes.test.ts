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
