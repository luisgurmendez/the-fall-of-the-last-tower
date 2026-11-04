/**
 * The match a player can go back to (src/game/currentMatch.ts, GET
 * /api/current-match): an account's live match wherever it was started, or a
 * guest's last match while it's live and nobody plays it; and an account
 * can't start a second match while one is live.
 */

import { describe, test, expect } from 'bun:test';
import { AccountStore } from '../accounts/AccountStore';
import { AccountRoutes } from '../accounts/accountRoutes';
import { findCurrentMatch, playsElsewhere, type CurrentMatchSources } from '../game/currentMatch';

interface Live { championId: string; gameTime: number; practice: boolean }

function sources(options: {
  accounts?: Record<string, number>;
  accountMatches?: Record<number, string>;
  sessions?: Record<string, string>;
  live?: Record<string, Live>;
  connected?: string[];
} = {}): CurrentMatchSources {
  return {
    accountForToken: token => {
      const id = options.accounts?.[token];
      return id === undefined ? null : { id };
    },
    playerOfAccount: id => options.accountMatches?.[id],
    sessionOf: playerId => options.sessions?.[playerId],
    liveMatchOf: playerId => options.live?.[playerId] ?? null,
    isConnected: playerId => options.connected?.includes(playerId) ?? false,
  };
}

const MATCH: Live = { championId: 'nocthar', gameTime: 300, practice: false };

describe('findCurrentMatch', () => {
  test('nothing asked: no match', () => {
    expect(findCurrentMatch({}, sources())).toBeNull();
  });

  test("an account's live match, with the session to take it back", () => {
    const from = sources({ accounts: { tok: 7 }, accountMatches: { 7: 'p1' }, sessions: { p1: 's1' }, live: { p1: MATCH } });
    expect(findCurrentMatch({ accountToken: 'tok' }, from)).toEqual({
      playerId: 'p1', sessionToken: 's1', championId: 'nocthar', gameTime: 300, practice: false,
    });
  });

  test("an account's match is offered even while another tab plays it (the account is one person)", () => {
    const from = sources({ accounts: { tok: 7 }, accountMatches: { 7: 'p1' }, sessions: { p1: 's1' }, live: { p1: MATCH }, connected: ['p1'] });
    expect(findCurrentMatch({ accountToken: 'tok' }, from)?.playerId).toBe('p1');
  });

  test('an account whose match ended, or that has none: no match', () => {
    expect(findCurrentMatch({ accountToken: 'tok' }, sources({ accounts: { tok: 7 } }))).toBeNull();
    const ended = sources({ accounts: { tok: 7 }, accountMatches: { 7: 'p1' }, sessions: { p1: 's1' } });
    expect(findCurrentMatch({ accountToken: 'tok' }, ended)).toBeNull();
  });

  test('a token that is no session: no match (and no session handed out)', () => {
    const from = sources({ accountMatches: { 7: 'p1' }, sessions: { p1: 's1' }, live: { p1: MATCH } });
    expect(findCurrentMatch({ accountToken: 'stolen-or-old' }, from)).toBeNull();
  });

  test("a guest's last match while it's live and nobody plays it", () => {
    const from = sources({ sessions: { g1: 's1' }, live: { g1: { ...MATCH, practice: true } } });
    expect(findCurrentMatch({ playerId: 'g1', sessionToken: 's1' }, from)).toEqual({
      playerId: 'g1', sessionToken: 's1', championId: 'nocthar', gameTime: 300, practice: true,
    });
  });

  test("a guest's match played in another tab now is left alone (two tabs can play each other)", () => {
    const from = sources({ sessions: { g1: 's1' }, live: { g1: MATCH }, connected: ['g1'] });
    expect(findCurrentMatch({ playerId: 'g1', sessionToken: 's1' }, from)).toBeNull();
  });

  test("a guest with the wrong session, or none, doesn't get the match", () => {
    const from = sources({ sessions: { g1: 's1' }, live: { g1: MATCH } });
    expect(findCurrentMatch({ playerId: 'g1', sessionToken: 'nope' }, from)).toBeNull();
    expect(findCurrentMatch({ playerId: 'g1' }, from)).toBeNull();
    expect(findCurrentMatch({ playerId: 'g1', sessionToken: '' }, from)).toBeNull();
  });

  test("a guest's match that ended: no match", () => {
    expect(findCurrentMatch({ playerId: 'g1', sessionToken: 's1' }, sources({ sessions: { g1: 's1' } }))).toBeNull();
  });

  test("an account without a match falls back to the tab's last match as a guest", () => {
    const from = sources({ accounts: { tok: 7 }, sessions: { g1: 's1' }, live: { g1: MATCH } });
    expect(findCurrentMatch({ accountToken: 'tok', playerId: 'g1', sessionToken: 's1' }, from)?.playerId).toBe('g1');
  });

  test("the account's match wins over the guest one", () => {
    const from = sources({
      accounts: { tok: 7 }, accountMatches: { 7: 'p1' },
      sessions: { p1: 's1', g1: 's2' }, live: { p1: MATCH, g1: { ...MATCH, championId: 'vex' } },
    });
    expect(findCurrentMatch({ accountToken: 'tok', playerId: 'g1', sessionToken: 's2' }, from)?.playerId).toBe('p1');
  });

  test('a live match without a session kept is not offered', () => {
    const from = sources({ accounts: { tok: 7 }, accountMatches: { 7: 'p1' }, live: { p1: MATCH } });
    expect(findCurrentMatch({ accountToken: 'tok' }, from)).toBeNull();
  });
});

describe('playsElsewhere', () => {
  test('an account in a live match as another player is playing elsewhere', () => {
    const from = sources({ accountMatches: { 7: 'p1' }, live: { p1: MATCH } });
    expect(playsElsewhere(7, 'p2', from)).toBe(true);
  });

  test('the same player (a reconnect) is not elsewhere', () => {
    const from = sources({ accountMatches: { 7: 'p1' }, live: { p1: MATCH } });
    expect(playsElsewhere(7, 'p1', from)).toBe(false);
  });

  test('a match that ended frees the account', () => {
    expect(playsElsewhere(7, 'p2', sources({ accountMatches: { 7: 'p1' } }))).toBe(false);
    expect(playsElsewhere(7, 'p2', sources())).toBe(false);
  });
});

describe('GET /api/current-match', () => {
  function setup(from: CurrentMatchSources | undefined) {
    const store = new AccountStore(':memory:');
    const routes = new AccountRoutes(store, from ? { currentMatch: ask => findCurrentMatch(ask, from) } : {});
    const get = (headers: Record<string, string> = {}, method = 'GET') =>
      routes.handle(new Request('http://localhost:8080/api/current-match', { method, headers }), '1.2.3.4');
    return { get };
  }

  test("answers the account's match from its bearer token", async () => {
    const { get } = setup(sources({ accounts: { tok: 7 }, accountMatches: { 7: 'p1' }, sessions: { p1: 's1' }, live: { p1: MATCH } }));
    const response = await get({ Authorization: 'Bearer tok' });
    expect(response!.status).toBe(200);
    expect((await response!.json()).match.playerId).toBe('p1');
  });

  test("answers a guest's match from its headers", async () => {
    const { get } = setup(sources({ sessions: { g1: 's1' }, live: { g1: MATCH } }));
    const response = await get({ 'X-Siege-Player': 'g1', 'X-Siege-Session': 's1' });
    expect((await response!.json()).match.championId).toBe('nocthar');
  });

  test('answers null without a match', async () => {
    const { get } = setup(sources());
    const response = await get();
    expect(response!.status).toBe(200);
    expect(await response!.json()).toEqual({ match: null });
  });

  test('a server without matches (tests, tools) answers null', async () => {
    const { get } = setup(undefined);
    expect(await (await get())!.json()).toEqual({ match: null });
  });

  test('only GET', async () => {
    const { get } = setup(sources());
    expect((await get({}, 'POST'))!.status).toBe(405);
  });

  test("its headers are allowed from other origins (the dev client's)", async () => {
    const { get } = setup(sources());
    const preflight = await get({}, 'OPTIONS');
    const allowed = preflight!.headers.get('Access-Control-Allow-Headers') ?? '';
    expect(allowed).toContain('X-Siege-Player');
    expect(allowed).toContain('X-Siege-Session');
  });
});
