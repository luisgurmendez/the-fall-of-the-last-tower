/**
 * Signing in from the menu (src/ui/matchmaking/account.ts): the account API
 * lives at the game server's address (http for ws, https for wss). Signing
 * up or in keeps the token and the account in the browser; a token the
 * server no longer knows is dropped; signing out forgets it even if the
 * server can't be reached. Errors read as sentences.
 */
import { describe, it, expect } from 'bun:test';
import { ACCOUNT_STORAGE_KEY, AccountClient, accountErrorMessage, apiBaseUrl, parseStoredAccount } from '@/ui/matchmaking/account';

function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => { data[key] = value; },
    removeItem: (key: string) => { delete data[key]; },
  };
}

type Call = { url: string; method: string; body?: unknown; authorization?: string | null };

/** A fake server: answers each path with what the test says */
function fakeFetch(answers: Record<string, () => { status: number; body?: unknown } | Error>) {
  const calls: Call[] = [];
  const fetchFn = async (url: string | URL | Request, init: RequestInit = {}) => {
    const path = new URL(String(url)).pathname;
    const headers = new Headers(init.headers);
    calls.push({ url: String(url), method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined, authorization: headers.get('Authorization') });
    const answer = answers[path]?.() ?? { status: 404, body: { error: 'not_found' } };
    if (answer instanceof Error) throw answer;
    return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), { status: answer.status });
  };
  return { fetchFn: fetchFn as typeof fetch, calls };
}

const LUIS = { id: 1, name: 'Luis', wins: 3, losses: 2 };

describe('apiBaseUrl', () => {
  it("the game server's address, over http or https", () => {
    expect(apiBaseUrl('ws://localhost:8080/ws')).toBe('http://localhost:8080');
    expect(apiBaseUrl('wss://retroleague.fly.dev/ws')).toBe('https://retroleague.fly.dev');
    expect(apiBaseUrl('ws://192.168.1.5:8080')).toBe('http://192.168.1.5:8080');
  });
});

describe('parseStoredAccount', () => {
  it('a stored account with its token', () => {
    expect(parseStoredAccount({ token: 't', account: LUIS })).toEqual({ token: 't', account: LUIS });
  });

  it('anything else is no account', () => {
    for (const raw of [null, undefined, 'x', 42, {}, { token: 't' }, { account: LUIS }, { token: 5, account: LUIS }, { token: 't', account: { name: 'x' } }]) {
      expect(parseStoredAccount(raw)).toBeNull();
    }
  });
});

describe('accountErrorMessage', () => {
  it('says what went wrong', () => {
    expect(accountErrorMessage('bad_name')).toContain('3 to 16');
    expect(accountErrorMessage('bad_password')).toContain('6');
    expect(accountErrorMessage('name_taken')).toContain('taken');
    expect(accountErrorMessage('wrong_login')).toContain('Wrong');
    expect(accountErrorMessage('too_many_attempts')).toContain('minute');
    expect(accountErrorMessage('offline')).toContain('server');
    expect(accountErrorMessage('something_else').length).toBeGreaterThan(0);
  });
});

describe('AccountClient', () => {
  const base = 'http://localhost:8080';

  it('starts signed out, or with what the browser kept', () => {
    expect(new AccountClient(base, memoryStorage(), fakeFetch({}).fetchFn).current()).toBeNull();
    const kept = memoryStorage({ [ACCOUNT_STORAGE_KEY]: JSON.stringify({ token: 't', account: LUIS }) });
    expect(new AccountClient(base, kept, fakeFetch({}).fetchFn).current()).toEqual({ token: 't', account: LUIS });
  });

  it('broken data in the browser: signed out', () => {
    const kept = memoryStorage({ [ACCOUNT_STORAGE_KEY]: '{oops' });
    expect(new AccountClient(base, kept, fakeFetch({}).fetchFn).current()).toBeNull();
  });

  it('signing up keeps the token and the account', async () => {
    const storage = memoryStorage();
    const { fetchFn, calls } = fakeFetch({ '/api/register': () => ({ status: 200, body: { account: LUIS, token: 'tok' } }) });
    const client = new AccountClient(base, storage, fetchFn);
    expect(await client.register('Luis', 'secreto1')).toEqual({ ok: true });
    expect(client.current()).toEqual({ token: 'tok', account: LUIS });
    expect(JSON.parse(storage.data[ACCOUNT_STORAGE_KEY])).toEqual({ token: 'tok', account: LUIS });
    expect(calls[0]).toMatchObject({ url: `${base}/api/register`, method: 'POST', body: { name: 'Luis', password: 'secreto1' } });
  });

  it('the password is not kept', async () => {
    const storage = memoryStorage();
    const { fetchFn } = fakeFetch({ '/api/login': () => ({ status: 200, body: { account: LUIS, token: 'tok' } }) });
    await new AccountClient(base, storage, fetchFn).login('Luis', 'secreto1');
    expect(JSON.stringify(storage.data)).not.toContain('secreto1');
  });

  it('a refused sign-in says why and keeps nothing', async () => {
    const storage = memoryStorage();
    const { fetchFn } = fakeFetch({ '/api/login': () => ({ status: 401, body: { error: 'wrong_login' } }) });
    const client = new AccountClient(base, storage, fetchFn);
    expect(await client.login('Luis', 'nope-nope')).toEqual({ ok: false, error: 'wrong_login' });
    expect(client.current()).toBeNull();
    expect(storage.data[ACCOUNT_STORAGE_KEY]).toBeUndefined();
  });

  it("the server can't be reached: offline", async () => {
    const { fetchFn } = fakeFetch({ '/api/login': () => new Error('network down') });
    expect(await new AccountClient(base, memoryStorage(), fetchFn).login('Luis', 'secreto1')).toEqual({ ok: false, error: 'offline' });
  });

  it('an answer that isn\'t JSON: an error, not a crash', async () => {
    const fetchFn = (async () => new Response('<html>oops</html>', { status: 502 })) as unknown as typeof fetch;
    expect(await new AccountClient(base, memoryStorage(), fetchFn).login('Luis', 'secreto1')).toEqual({ ok: false, error: 'server_error' });
  });

  it('refresh: the latest wins and losses for the token kept', async () => {
    const kept = memoryStorage({ [ACCOUNT_STORAGE_KEY]: JSON.stringify({ token: 'tok', account: LUIS }) });
    const { fetchFn, calls } = fakeFetch({ '/api/me': () => ({ status: 200, body: { account: { ...LUIS, wins: 4 } } }) });
    const client = new AccountClient(base, kept, fetchFn);
    await client.refresh();
    expect(client.current()?.account.wins).toBe(4);
    expect(calls[0].authorization).toBe('Bearer tok');
  });

  it('refresh with a token the server no longer knows: signed out', async () => {
    const kept = memoryStorage({ [ACCOUNT_STORAGE_KEY]: JSON.stringify({ token: 'old', account: LUIS }) });
    const { fetchFn } = fakeFetch({ '/api/me': () => ({ status: 401, body: { error: 'no_session' } }) });
    const client = new AccountClient(base, kept, fetchFn);
    await client.refresh();
    expect(client.current()).toBeNull();
    expect(kept.data[ACCOUNT_STORAGE_KEY]).toBeUndefined();
  });

  it("refresh while the server can't be reached keeps the account", async () => {
    const kept = memoryStorage({ [ACCOUNT_STORAGE_KEY]: JSON.stringify({ token: 'tok', account: LUIS }) });
    const { fetchFn } = fakeFetch({ '/api/me': () => new Error('down') });
    const client = new AccountClient(base, kept, fetchFn);
    await client.refresh();
    expect(client.current()).toEqual({ token: 'tok', account: LUIS });
  });

  it('refresh signed out asks nothing', async () => {
    const { fetchFn, calls } = fakeFetch({});
    await new AccountClient(base, memoryStorage(), fetchFn).refresh();
    expect(calls).toHaveLength(0);
  });

  it("signing out forgets the account, tells the server, and works even if it can't be reached", async () => {
    const kept = memoryStorage({ [ACCOUNT_STORAGE_KEY]: JSON.stringify({ token: 'tok', account: LUIS }) });
    const { fetchFn, calls } = fakeFetch({ '/api/logout': () => new Error('down') });
    const client = new AccountClient(base, kept, fetchFn);
    await client.logout();
    expect(client.current()).toBeNull();
    expect(kept.data[ACCOUNT_STORAGE_KEY]).toBeUndefined();
    expect(calls[0]).toMatchObject({ method: 'POST', authorization: 'Bearer tok' });
  });

  it('listeners hear every change', async () => {
    const { fetchFn } = fakeFetch({
      '/api/login': () => ({ status: 200, body: { account: LUIS, token: 'tok' } }),
      '/api/logout': () => ({ status: 204 }),
    });
    const client = new AccountClient(base, memoryStorage(), fetchFn);
    const heard: (string | null)[] = [];
    client.subscribe(current => heard.push(current?.account.name ?? null));
    await client.login('Luis', 'secreto1');
    await client.logout();
    expect(heard).toEqual(['Luis', null]);
  });

  it('an account kept from before ratings still reads (no rating yet)', () => {
    const kept = memoryStorage({ [ACCOUNT_STORAGE_KEY]: JSON.stringify({ token: 't', account: LUIS }) });
    expect(new AccountClient(base, kept, fakeFetch({}).fetchFn).current()?.account.rating).toBeUndefined();
  });

  it('refresh keeps the rating and tier the server says', async () => {
    const kept = memoryStorage({ [ACCOUNT_STORAGE_KEY]: JSON.stringify({ token: 'tok', account: LUIS }) });
    const rated = { ...LUIS, rating: 1234, peakRating: 1250, ratedGames: 12, tier: 'silver' };
    const { fetchFn } = fakeFetch({ '/api/me': () => ({ status: 200, body: { account: rated } }) });
    const client = new AccountClient(base, kept, fetchFn);
    await client.refresh();
    expect(client.current()?.account).toEqual(rated);
  });
});

describe('Profiles and matches', () => {
  const base = 'http://localhost:8080';
  const PROFILE = {
    profile: { name: 'Luis', wins: 3, losses: 2, rating: 1240, peakRating: 1260, ratedGames: 5, tier: 'silver', champions: [{ championId: 'vex', games: 3, wins: 2 }] },
    matches: [{ id: 9, championId: 'vex', won: true }],
    more: true,
  };

  it("a profile: asked by name (written for a URL), with its page", async () => {
    const { fetchFn, calls } = fakeFetch({ '/api/profile/%C3%91and%C3%BA': () => ({ status: 200, body: PROFILE }) });
    const client = new AccountClient(base, memoryStorage(), fetchFn);
    expect(await client.profile('Ñandú')).toEqual({ ok: true, ...PROFILE } as never);
    expect(calls[0]).toMatchObject({ url: `${base}/api/profile/%C3%91and%C3%BA`, method: 'GET' });
  });

  it('the next page: the matches before the last one seen', async () => {
    const { fetchFn, calls } = fakeFetch({ '/api/profile/Luis': () => ({ status: 200, body: PROFILE }) });
    await new AccountClient(base, memoryStorage(), fetchFn).profile('Luis', 9);
    expect(calls[0].url).toBe(`${base}/api/profile/Luis?before=9`);
  });

  it('a name with a slash or a question mark stays one name', async () => {
    const { fetchFn, calls } = fakeFetch({});
    await new AccountClient(base, memoryStorage(), fetchFn).profile('a/b?c');
    expect(calls[0].url).toBe(`${base}/api/profile/a%2Fb%3Fc`);
  });

  it('no such account, a broken answer, or no server: says which', async () => {
    const missing = fakeFetch({ '/api/profile/Nadie': () => ({ status: 404, body: { error: 'no_account' } }) });
    expect(await new AccountClient(base, memoryStorage(), missing.fetchFn).profile('Nadie')).toEqual({ ok: false, error: 'no_account' });
    const broken = fakeFetch({ '/api/profile/Luis': () => ({ status: 200, body: { profile: 'nope' } }) });
    expect(await new AccountClient(base, memoryStorage(), broken.fetchFn).profile('Luis')).toEqual({ ok: false, error: 'server_error' });
    const down = fakeFetch({ '/api/profile/Luis': () => new Error('down') });
    expect(await new AccountClient(base, memoryStorage(), down.fetchFn).profile('Luis')).toEqual({ ok: false, error: 'offline' });
  });

  it('a match: by its id', async () => {
    const match = { id: 9, mapId: 'vale', players: [{ name: 'Luis', championId: 'vex' }] };
    const { fetchFn, calls } = fakeFetch({ '/api/matches/9': () => ({ status: 200, body: { match } }) });
    expect(await new AccountClient(base, memoryStorage(), fetchFn).match(9)).toEqual({ ok: true, match } as never);
    expect(calls[0].url).toBe(`${base}/api/matches/9`);
  });

  it('a match no one kept, or an answer without one: says which', async () => {
    const missing = fakeFetch({ '/api/matches/5': () => ({ status: 404, body: { error: 'no_match' } }) });
    expect(await new AccountClient(base, memoryStorage(), missing.fetchFn).match(5)).toEqual({ ok: false, error: 'no_match' });
    const broken = fakeFetch({ '/api/matches/5': () => ({ status: 200, body: {} }) });
    expect(await new AccountClient(base, memoryStorage(), broken.fetchFn).match(5)).toEqual({ ok: false, error: 'server_error' });
  });

  it('error messages for them', () => {
    expect(accountErrorMessage('no_account')).toContain('account');
    expect(accountErrorMessage('no_match')).toContain('match');
  });
});
