/**
 * Accounts (src/accounts/AccountStore.ts): a name and a password, kept in
 * SQLite. Names are 3 to 16 letters, digits, _ or -, one per name however
 * it's capitalized. Passwords are 6 to 128 characters and only their hash
 * is kept. Signing up or in gives a session token (only its hash is kept);
 * a session lasts SESSION_DAYS, signing out ends it. Each account counts
 * its wins and losses.
 */

import { describe, test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccountStore, SESSION_DAYS, matchResults, type AccountResult } from '../accounts/AccountStore';

const DAY_MS = 24 * 60 * 60 * 1000;

function store(now = () => 1_000_000) {
  return new AccountStore(':memory:', { now });
}

function ok(result: AccountResult) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result;
}

describe('Signing up', () => {
  test('gives an account with no games yet and a token that is it', async () => {
    const accounts = store();
    const { account, token } = ok(await accounts.register('Luis', 'secreto1'));
    expect(account).toMatchObject({ name: 'Luis', wins: 0, losses: 0 });
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(accounts.accountForToken(token)).toMatchObject({ id: account.id, name: 'Luis' });
  });

  test('names: 3 to 16 letters, digits, _ or -', async () => {
    const accounts = store();
    for (const name of ['abc', 'a'.repeat(16), 'Luis_99', 'x-y', 'Ñandú', '日本語']) {
      expect((await accounts.register(name, 'secreto1')).ok).toBe(true);
    }
  });

  test('a name too short, too long, with spaces or symbols, or empty is refused', async () => {
    const accounts = store();
    for (const name of ['ab', 'a'.repeat(17), 'a b', 'x<y>', 'hi!', '', '   ', 'tab\there']) {
      expect(await accounts.register(name, 'secreto1')).toEqual({ ok: false, error: 'bad_name' });
    }
  });

  test('a name that isn\'t a string is refused', async () => {
    const accounts = store();
    for (const name of [null, undefined, 42, ['Luis'], { name: 'Luis' }]) {
      expect(await accounts.register(name as never, 'secreto1')).toEqual({ ok: false, error: 'bad_name' });
    }
  });

  test('spaces around the name are dropped', async () => {
    const accounts = store();
    expect(ok(await accounts.register('  Luis  ', 'secreto1')).account.name).toBe('Luis');
  });

  test('a name taken, however it is capitalized or written, is refused', async () => {
    const accounts = store();
    ok(await accounts.register('Luis', 'secreto1'));
    expect(await accounts.register('Luis', 'otra-clave')).toEqual({ ok: false, error: 'name_taken' });
    expect(await accounts.register('LUIS', 'otra-clave')).toEqual({ ok: false, error: 'name_taken' });
    ok(await accounts.register('Ñandu', 'secreto1'));
    // The same letters written as n + combining tilde
    expect(await accounts.register('Ñandu', 'secreto1')).toEqual({ ok: false, error: 'name_taken' });
  });

  test('passwords: 6 to 128 characters', async () => {
    const accounts = store();
    expect((await accounts.register('six', '123456')).ok).toBe(true);
    expect((await accounts.register('long', 'x'.repeat(128))).ok).toBe(true);
    expect(await accounts.register('short', '12345')).toEqual({ ok: false, error: 'bad_password' });
    expect(await accounts.register('toolong', 'x'.repeat(129))).toEqual({ ok: false, error: 'bad_password' });
    expect(await accounts.register('notstr', 123456 as never)).toEqual({ ok: false, error: 'bad_password' });
  });

  test('a bad name is reported before a bad password', async () => {
    expect(await store().register('a', '1')).toEqual({ ok: false, error: 'bad_name' });
  });

  test('the password is kept only as a hash, the token only as a hash', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'siege-accounts-'));
    try {
      const file = join(dir, 'accounts.db');
      const accounts = new AccountStore(file);
      const { token } = ok(await accounts.register('Luis', 'my-secret-pass'));
      accounts.close();
      const db = new Database(file, { readonly: true });
      const dump = JSON.stringify([db.query('SELECT * FROM accounts').all(), db.query('SELECT * FROM sessions').all()]);
      db.close();
      expect(dump).not.toContain('my-secret-pass');
      expect(dump).not.toContain(token);
      expect(dump).toContain('$argon2');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Signing in', () => {
  test('the right password gives a new token for the account', async () => {
    const accounts = store();
    const signedUp = ok(await accounts.register('Luis', 'secreto1'));
    const signedIn = ok(await accounts.login('Luis', 'secreto1'));
    expect(signedIn.account.id).toBe(signedUp.account.id);
    expect(signedIn.token).not.toBe(signedUp.token);
    expect(accounts.accountForToken(signedIn.token)?.id).toBe(signedUp.account.id);
  });

  test('the name however capitalized, with spaces around', async () => {
    const accounts = store();
    ok(await accounts.register('Luis', 'secreto1'));
    expect((await accounts.login(' LUIS ', 'secreto1')).ok).toBe(true);
  });

  test('a wrong password and an unknown name say the same', async () => {
    const accounts = store();
    ok(await accounts.register('Luis', 'secreto1'));
    expect(await accounts.login('Luis', 'secreto2')).toEqual({ ok: false, error: 'wrong_login' });
    expect(await accounts.login('Nobody', 'secreto1')).toEqual({ ok: false, error: 'wrong_login' });
    expect(await accounts.login('Luis', 'SECRETO1')).toEqual({ ok: false, error: 'wrong_login' });
  });

  test('nonsense in either field is a wrong login', async () => {
    const accounts = store();
    ok(await accounts.register('Luis', 'secreto1'));
    expect(await accounts.login(null as never, 'secreto1')).toEqual({ ok: false, error: 'wrong_login' });
    expect(await accounts.login('Luis', null as never)).toEqual({ ok: false, error: 'wrong_login' });
    expect(await accounts.login('x'.repeat(5000), 'y'.repeat(5000))).toEqual({ ok: false, error: 'wrong_login' });
  });

  test('two browsers at once: both sessions work', async () => {
    const accounts = store();
    const first = ok(await accounts.register('Luis', 'secreto1')).token;
    const second = ok(await accounts.login('Luis', 'secreto1')).token;
    expect(accounts.accountForToken(first)).not.toBeNull();
    expect(accounts.accountForToken(second)).not.toBeNull();
  });
});

describe('Sessions', () => {
  test('signing out ends that session, not the others', async () => {
    const accounts = store();
    const first = ok(await accounts.register('Luis', 'secreto1')).token;
    const second = ok(await accounts.login('Luis', 'secreto1')).token;
    accounts.logout(first);
    expect(accounts.accountForToken(first)).toBeNull();
    expect(accounts.accountForToken(second)).not.toBeNull();
  });

  test('signing out twice, or with a token that is no session, does nothing', async () => {
    const accounts = store();
    const token = ok(await accounts.register('Luis', 'secreto1')).token;
    accounts.logout(token);
    expect(() => accounts.logout(token)).not.toThrow();
    expect(() => accounts.logout('nonsense')).not.toThrow();
    expect(() => accounts.logout(42 as never)).not.toThrow();
  });

  test('a session lasts SESSION_DAYS', async () => {
    let now = 1_000_000;
    const accounts = store(() => now);
    const token = ok(await accounts.register('Luis', 'secreto1')).token;
    now += (SESSION_DAYS * DAY_MS) - 1;
    expect(accounts.accountForToken(token)).not.toBeNull();
    now += 1;
    expect(accounts.accountForToken(token)).toBeNull();
  });

  test('a token that is no session, or not a token, is nobody', () => {
    const accounts = store();
    for (const token of ['', 'x', 'a'.repeat(64), null, undefined, 42, {}]) {
      expect(accounts.accountForToken(token as never)).toBeNull();
    }
  });

  test('accounts and sessions outlive the server (kept in a file)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'siege-accounts-'));
    try {
      const file = join(dir, 'accounts.db');
      const first = new AccountStore(file);
      const { token, account } = ok(await first.register('Luis', 'secreto1'));
      first.recordResult(account.id, true);
      first.close();

      const second = new AccountStore(file);
      expect(second.accountForToken(token)).toMatchObject({ name: 'Luis', wins: 1, losses: 0 });
      expect((await second.login('Luis', 'secreto1')).ok).toBe(true);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Wins and losses', () => {
  test('each result counts', async () => {
    const accounts = store();
    const { account, token } = ok(await accounts.register('Luis', 'secreto1'));
    accounts.recordResult(account.id, true);
    accounts.recordResult(account.id, true);
    accounts.recordResult(account.id, false);
    expect(accounts.accountForToken(token)).toMatchObject({ wins: 2, losses: 1 });
  });

  test('an account that does not exist: nothing breaks', () => {
    expect(() => store().recordResult(999, true)).not.toThrow();
  });

  test("a match's results: the humans with accounts, won or lost by side", () => {
    const players = [
      { playerId: 'a', side: 0 as const },
      { playerId: 'b', side: 1 as const },
      { playerId: 'guest', side: 0 as const },
      { playerId: 'bot-1', side: 1 as const, isBot: true },
    ];
    const accountOf = (playerId: string) => ({ a: 1, b: 2, 'bot-1': 3 } as Record<string, number>)[playerId];
    expect(matchResults(players, accountOf, 0)).toEqual([
      { accountId: 1, won: true },
      { accountId: 2, won: false },
    ]);
    expect(matchResults(players, accountOf, 1)).toEqual([
      { accountId: 1, won: false },
      { accountId: 2, won: true },
    ]);
  });
});
