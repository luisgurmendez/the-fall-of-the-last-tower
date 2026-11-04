/**
 * Match history and ratings (src/accounts/AccountStore.ts): a match that
 * isn't practice is kept (every champion's line: accounts, guests and bots),
 * its accounts' wins and losses count, and when it's rated (elo.ts) their
 * ratings move, all at once or not at all. An account's profile has its
 * rating, tier, record, most played champions and latest matches (newest
 * first, by pages); a match has both teams' lines. Databases from before
 * ratings get them (1200 each), keeping their accounts.
 */

import { describe, test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccountStore, PROFILE_PAGE, type AccountResult, type MatchPlayerRecord, type MatchRecord } from '../accounts/AccountStore';
import { START_RATING, K_PROVISIONAL } from '../accounts/elo';

const TOTALS = {
  damageToChampions: 1000, damageDealt: 5000, damageTaken: 2000, healing: 300, damageToStructures: 400,
  goldEarned: 6000, wardsPlaced: 2, wardsDestroyed: 1, largestKillingSpree: 3,
};

function ok(result: AccountResult) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result;
}

function line(playerId: string, side: number, overrides: Partial<MatchPlayerRecord> = {}): MatchPlayerRecord {
  return {
    playerId, side, accountId: null, name: null, isBot: false, championId: 'vex',
    level: 9, kills: 4, deaths: 2, assists: 7, cs: 88, gold: 5400,
    items: ['long_sword', null, null, null, null, null], totals: TOTALS,
    ...overrides,
  };
}

function match(players: MatchPlayerRecord[], overrides: Partial<MatchRecord> = {}): MatchRecord {
  return { mapId: 'vale', mode: 'queue', practice: false, duration: 1234.5, winningSide: 0, players, ...overrides };
}

async function setup(names: string[] = ['Luis', 'Ana']) {
  let now = 1_700_000_000_000;
  const store = new AccountStore(':memory:', { now: () => now });
  const ids: number[] = [];
  for (const name of names) ids.push(ok(await store.register(name, 'secreto1')).account.id);
  return { store, ids, advance: (ms: number) => { now += ms; } };
}

describe('Recording a match', () => {
  test('a 1v1 between accounts: kept, counted and rated', async () => {
    const { store, ids: [luis, ana] } = await setup();
    const recorded = store.recordMatch(match([
      line('p1', 0, { accountId: luis, name: 'Luis' }),
      line('p2', 1, { accountId: ana, name: 'Ana', championId: 'gorath' }),
    ]));
    expect(recorded).not.toBeNull();
    expect(recorded!.rated).toBe(true);
    expect(recorded!.ratingChanges.get('p1')).toEqual({ before: START_RATING, after: START_RATING + K_PROVISIONAL / 2 });
    expect(recorded!.ratingChanges.get('p2')).toEqual({ before: START_RATING, after: START_RATING - K_PROVISIONAL / 2 });

    const luisProfile = store.profile('Luis')!;
    expect(luisProfile.profile).toMatchObject({ name: 'Luis', wins: 1, losses: 0, rating: 1220, peakRating: 1220, ratedGames: 1, tier: 'silver' });
    const anaProfile = store.profile('Ana')!;
    expect(anaProfile.profile).toMatchObject({ wins: 0, losses: 1, rating: 1180, peakRating: START_RATING, ratedGames: 1 });
  });

  test('the account carries its rating and tier everywhere', async () => {
    const { store, ids: [luis, ana] } = await setup();
    const token = ok(await store.login('Luis', 'secreto1')).token;
    store.recordMatch(match([line('p1', 0, { accountId: luis }), line('p2', 1, { accountId: ana })]));
    expect(store.accountForToken(token)).toMatchObject({ name: 'Luis', rating: 1220, peakRating: 1220, ratedGames: 1, tier: 'silver' });
    expect(ok(await store.login('Ana', 'secreto1')).account).toMatchObject({ rating: 1180, ratedGames: 1 });
  });

  test('a new account: 1200, no rated matches, its tier', async () => {
    const { store } = await setup();
    expect(ok(await store.register('Nuevo', 'secreto1')).account).toMatchObject({ rating: START_RATING, peakRating: START_RATING, ratedGames: 0, tier: 'silver' });
  });

  test('every champion has a line: accounts, guests and bots', async () => {
    const { store, ids: [luis] } = await setup();
    const { matchId } = store.recordMatch(match([
      line('p1', 0, { accountId: luis, name: 'Luis' }),
      line('bot-1', 0, { isBot: true, championId: 'kael' }),
      line('guest', 1, { name: 'Pepe', championId: 'gorath' }),
      line('bot-2', 1, { isBot: true }),
    ]))!;
    const kept = store.match(matchId)!;
    expect(kept).toMatchObject({ id: matchId, mapId: 'vale', mode: 'queue', rated: true, winningSide: 0, duration: 1234.5 });
    expect(kept.players).toHaveLength(4);
    expect(kept.players.map(p => [p.name, p.account, p.isBot, p.side, p.won])).toEqual([
      ['Luis', true, false, 0, true],
      [null, false, true, 0, true],
      ['Pepe', false, false, 1, false],
      [null, false, true, 1, false],
    ]);
    expect(kept.players[0]).toMatchObject({
      championId: 'vex', level: 9, kills: 4, deaths: 2, assists: 7, cs: 88, gold: 5400,
      items: ['long_sword', null, null, null, null, null], totals: TOTALS, ratingBefore: 1200, ratingAfter: 1220,
    });
    expect(kept.players[2]).toMatchObject({ ratingBefore: null, ratingAfter: null });
  });

  test('friends against bots: kept and counted, not rated', async () => {
    const { store, ids: [luis, ana] } = await setup();
    const recorded = store.recordMatch(match([
      line('p1', 0, { accountId: luis }), line('p2', 0, { accountId: ana }),
      line('bot-1', 1, { isBot: true }), line('bot-2', 1, { isBot: true }),
    ], { mode: 'room' }))!;
    expect(recorded.rated).toBe(false);
    expect(recorded.ratingChanges.size).toBe(0);
    expect(store.profile('Luis')!.profile).toMatchObject({ wins: 1, rating: START_RATING, ratedGames: 0 });
    const [summary] = store.profile('Luis')!.matches;
    expect(summary).toMatchObject({ mode: 'room', rated: false, won: true, ratingBefore: null, ratingAfter: null });
  });

  test('practice is not kept and counts for nothing', async () => {
    const { store, ids: [luis, ana] } = await setup();
    expect(store.recordMatch(match([line('p1', 0, { accountId: luis }), line('p2', 1, { accountId: ana })], { practice: true }))).toBeNull();
    expect(store.profile('Luis')!).toMatchObject({ profile: { wins: 0, losses: 0, rating: START_RATING }, matches: [] });
  });

  test('all at once or not at all: a line that can\'t be kept keeps nothing', async () => {
    const { store, ids: [luis, ana] } = await setup();
    const broken = match([
      line('p1', 0, { accountId: luis }),
      line('p2', 1, { accountId: ana, championId: null as never }),
    ]);
    expect(() => store.recordMatch(broken)).toThrow();
    expect(store.profile('Luis')!).toMatchObject({ profile: { wins: 0, losses: 0, rating: START_RATING, ratedGames: 0 }, matches: [] });
    expect(store.profile('Ana')!.profile).toMatchObject({ wins: 0, losses: 0, rating: START_RATING });
    expect(store.match(1)).toBeNull();
  });

  test('ratings build on the ones kept, match after match', async () => {
    const { store, ids: [luis, ana] } = await setup();
    for (let i = 0; i < 3; i++) store.recordMatch(match([line('p1', 0, { accountId: luis }), line('p2', 1, { accountId: ana })]));
    const { profile } = store.profile('Luis')!;
    expect(profile.ratedGames).toBe(3);
    expect(profile.rating).toBeGreaterThan(1220);
    expect(profile.rating).toBeLessThan(1260);
    expect(profile.peakRating).toBe(profile.rating);
    expect(store.profile('Ana')!.profile.rating).toBe(2 * START_RATING - profile.rating);
  });

  test('the peak stays when the rating drops', async () => {
    const { store, ids: [luis, ana] } = await setup();
    store.recordMatch(match([line('p1', 0, { accountId: luis }), line('p2', 1, { accountId: ana })], { winningSide: 0 }));
    store.recordMatch(match([line('p1', 0, { accountId: luis }), line('p2', 1, { accountId: ana })], { winningSide: 1 }));
    expect(store.profile('Luis')!.profile.peakRating).toBe(1220);
    expect(store.profile('Luis')!.profile.rating).toBeLessThan(1220);
  });

  test('one account twice in a match counts once (the second line as a guest)', async () => {
    const { store, ids: [luis, ana] } = await setup();
    const { matchId, ratingChanges } = store.recordMatch(match([
      line('p1', 0, { accountId: luis }), line('p1-again', 0, { accountId: luis }),
      line('p2', 1, { accountId: ana }),
    ]))!;
    expect(store.profile('Luis')!.profile).toMatchObject({ wins: 1, ratedGames: 1 });
    expect(ratingChanges.has('p1-again')).toBe(false);
    expect(store.match(matchId)!.players[1]).toMatchObject({ account: false, ratingBefore: null });
  });

  test('an account that does not exist: its line is a guest\'s', async () => {
    const { store, ids: [luis] } = await setup(['Luis']);
    const { matchId } = store.recordMatch(match([line('p1', 0, { accountId: luis }), line('ghost', 1, { accountId: 999, name: 'Ghost' })]))!;
    expect(store.match(matchId)!.players[1]).toMatchObject({ account: false, name: 'Ghost' });
  });
});

describe('A profile', () => {
  test('an account no one has: null', async () => {
    const { store } = await setup();
    expect(store.profile('Nadie')).toBeNull();
    expect(store.profile('')).toBeNull();
    expect(store.profile(42 as never)).toBeNull();
  });

  test('found however the name is capitalized', async () => {
    const { store } = await setup();
    expect(store.profile('luis')!.profile.name).toBe('Luis');
    expect(store.profile('  LUIS ')!.profile.name).toBe('Luis');
  });

  test('the latest matches first, each with its own line and the match\'s facts', async () => {
    const { store, ids: [luis, ana], advance } = await setup();
    store.recordMatch(match([line('p1', 0, { accountId: luis, championId: 'vex' }), line('p2', 1, { accountId: ana })], { mapId: 'vale' }));
    advance(60_000);
    store.recordMatch(match([line('p1', 1, { accountId: luis, championId: 'kael', kills: 10 }), line('p2', 0, { accountId: ana })], { mapId: 'narrows', winningSide: 1, duration: 600 }));
    const { matches, more } = store.profile('Luis')!;
    expect(more).toBe(false);
    expect(matches.map(m => m.championId)).toEqual(['kael', 'vex']);
    expect(matches[0]).toMatchObject({ mapId: 'narrows', mode: 'queue', rated: true, duration: 600, side: 1, won: true, kills: 10, deaths: 2, assists: 7, cs: 88, gold: 5400 });
    expect(matches[0].endedAt - matches[1].endedAt).toBe(60_000);
    expect(matches[0].items).toEqual(['long_sword', null, null, null, null, null]);
    expect(matches[0].ratingAfter! - matches[0].ratingBefore!).toBeGreaterThan(0);
  });

  test('by pages: PROFILE_PAGE at a time, then the ones before the last seen', async () => {
    const { store, ids: [luis, ana] } = await setup();
    const total = PROFILE_PAGE + 5;
    for (let i = 0; i < total; i++) store.recordMatch(match([line('p1', 0, { accountId: luis }), line('p2', 1, { accountId: ana })]));
    const first = store.profile('Luis')!;
    expect(first.matches).toHaveLength(PROFILE_PAGE);
    expect(first.more).toBe(true);
    const ids = first.matches.map(m => m.id);
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);

    const second = store.profile('Luis', { before: ids[ids.length - 1] })!;
    expect(second.matches).toHaveLength(5);
    expect(second.more).toBe(false);
    expect(second.matches.every(m => m.id < ids[ids.length - 1])).toBe(true);
    expect(store.profile('Luis', { before: 1 })!.matches).toEqual([]);
  });

  test("only the account's own matches", async () => {
    const { store, ids: [luis, ana, eve] } = await setup(['Luis', 'Ana', 'Eve']);
    store.recordMatch(match([line('p1', 0, { accountId: luis }), line('p2', 1, { accountId: ana })]));
    store.recordMatch(match([line('p3', 0, { accountId: eve }), line('p2', 1, { accountId: ana })]));
    expect(store.profile('Luis')!.matches).toHaveLength(1);
    expect(store.profile('Ana')!.matches).toHaveLength(2);
  });

  test('most played champions: games and wins each, most played first', async () => {
    const { store, ids: [luis, ana] } = await setup();
    const play = (championId: string, winningSide: number) =>
      store.recordMatch(match([line('p1', 0, { accountId: luis, championId }), line('p2', 1, { accountId: ana })], { winningSide }));
    play('kael', 0); play('vex', 0); play('vex', 1); play('vex', 0); play('kael', 1);
    play('gorath', 0);
    // (Each line is 4 / 2 / 7: the champions add up their KDA)
    expect(store.profile('Luis')!.profile.champions).toEqual([
      { championId: 'vex', games: 3, wins: 2, kills: 12, deaths: 6, assists: 21 },
      { championId: 'kael', games: 2, wins: 1, kills: 8, deaths: 4, assists: 14 },
      { championId: 'gorath', games: 1, wins: 1, kills: 4, deaths: 2, assists: 7 },
    ]);
  });

  test('averages per match: KDA, CS, gold and damage to champions', async () => {
    const { store, ids: [luis, ana] } = await setup();
    store.recordMatch(match([
      line('p1', 0, { accountId: luis, kills: 10, deaths: 2, assists: 4, cs: 200, gold: 12000, totals: { ...TOTALS, damageToChampions: 20000 } }),
      line('p2', 1, { accountId: ana }),
    ]));
    store.recordMatch(match([
      line('p1', 1, { accountId: luis, kills: 2, deaths: 6, assists: 8, cs: 100, gold: 6000, totals: { ...TOTALS, damageToChampions: 10000 } }),
      line('p2', 0, { accountId: ana }),
    ]));
    expect(store.profile('Luis')!.profile.averages).toEqual({
      games: 2, kills: 6, deaths: 4, assists: 6, cs: 150, gold: 9000, damageToChampions: 15000,
    });
  });

  test('no matches yet: no averages', async () => {
    const { store } = await setup();
    expect(store.profile('Luis')!.profile.averages).toBeNull();
  });
});

describe('A match', () => {
  test('one that was never kept: null', async () => {
    const { store } = await setup();
    expect(store.match(1)).toBeNull();
    expect(store.match(-1)).toBeNull();
    expect(store.match(Number.NaN)).toBeNull();
    expect(store.match(1.5)).toBeNull();
  });
});

describe('A database from before ratings', () => {
  test('gets them (1200 each, no rated matches), keeping its accounts, results and sessions', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'siege-old-accounts-'));
    try {
      const file = join(dir, 'accounts.db');
      // The schema as it was before match history
      const old = new Database(file, { create: true });
      old.exec(`
        CREATE TABLE accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), expires_at INTEGER NOT NULL);
      `);
      old.query('INSERT INTO accounts (name, name_key, password_hash, wins, losses, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('Viejo', 'viejo', await Bun.password.hash('secreto1'), 3, 2, 1);
      old.close();

      const store = new AccountStore(file);
      const { account, token } = ok(await store.login('Viejo', 'secreto1'));
      expect(account).toMatchObject({ name: 'Viejo', wins: 3, losses: 2, rating: START_RATING, peakRating: START_RATING, ratedGames: 0 });
      expect(store.profile('viejo')!.matches).toEqual([]);
      store.close();

      // Opened again: nothing is added twice, and it all stayed
      const again = new AccountStore(file);
      expect(again.accountForToken(token)).toMatchObject({ name: 'Viejo', wins: 3, losses: 2, rating: START_RATING });
      const other = ok(await again.register('Otro', 'secreto1')).account;
      const { matchId } = again.recordMatch(match([line('p1', 0, { accountId: account.id }), line('p2', 1, { accountId: other.id })]))!;
      expect(again.match(matchId)!.players).toHaveLength(2);
      expect(again.profile('Viejo')!.profile).toMatchObject({ wins: 4, losses: 2, ratedGames: 1 });
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
