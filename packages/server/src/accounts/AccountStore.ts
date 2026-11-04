/**
 * Accounts: a name and a password, kept in SQLite (bun:sqlite) in
 * DATA_DIR/accounts.db (server.ts; a volume on Fly).
 *
 * - Names are 3 to 16 letters, digits, _ or - (any alphabet), one account per
 *   name however it's capitalized or composed (the key is the name in NFC,
 *   lowercased). The name is kept as typed, for showing.
 * - Passwords are 6 to 128 characters; only an argon2id hash is kept
 *   (Bun.password).
 * - Signing up or in gives a session token: 32 random bytes, of which only a
 *   SHA-256 hash is kept. A session lasts SESSION_DAYS; signing out ends it.
 *   A wrong name and a wrong password get the same answer.
 * - Each account counts its wins and losses (matchResults says whose).
 */

import { Database } from 'bun:sqlite';
import { createHash, randomBytes } from 'node:crypto';

export const SESSION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const NAME_PATTERN = /^[\p{L}\p{M}\p{N}_-]{3,16}$/u;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 128;

export interface Account {
  id: number;
  name: string;
  wins: number;
  losses: number;
}

export type AccountError = 'bad_name' | 'bad_password' | 'name_taken' | 'wrong_login';

export type AccountResult =
  | { ok: true; account: Account; token: string }
  | { ok: false; error: AccountError };

interface AccountRow {
  id: number;
  name: string;
  password_hash: string;
  wins: number;
  losses: number;
}

/** The name as shown: as typed, without spaces around (NFC, so it counts letters as written) */
function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const clean = name.trim().normalize('NFC');
  return NAME_PATTERN.test(clean) ? clean : null;
}

/** One account per name, however capitalized */
function nameKey(name: string): string {
  return name.normalize('NFC').toLowerCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toAccount(row: AccountRow): Account {
  return { id: row.id, name: row.name, wins: row.wins, losses: row.losses };
}

export class AccountStore {
  private readonly db: Database;
  private readonly now: () => number;

  /** @param file The database file, or ':memory:' (tests) */
  constructor(file: string, options: { now?: () => number } = {}) {
    this.now = options.now ?? Date.now;
    this.db = new Database(file, { create: true });
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        name_key TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        expires_at INTEGER NOT NULL
      );
    `);
  }

  async register(name: unknown, password: unknown): Promise<AccountResult> {
    const clean = cleanName(name);
    if (clean === null) return { ok: false, error: 'bad_name' };
    if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      return { ok: false, error: 'bad_password' };
    }
    if (this.findByName(clean)) return { ok: false, error: 'name_taken' };

    const hash = await Bun.password.hash(password);
    // Taken while hashing (two sign-ups at once): the unique key says so
    try {
      this.db.query('INSERT INTO accounts (name, name_key, password_hash, created_at) VALUES (?, ?, ?, ?)')
        .run(clean, nameKey(clean), hash, this.now());
    } catch {
      return { ok: false, error: 'name_taken' };
    }
    const row = this.findByName(clean)!;
    return { ok: true, account: toAccount(row), token: this.startSession(row.id) };
  }

  async login(name: unknown, password: unknown): Promise<AccountResult> {
    const clean = cleanName(name);
    const row = clean === null ? null : this.findByName(clean);
    if (!row || typeof password !== 'string' || password.length > PASSWORD_MAX) return { ok: false, error: 'wrong_login' };
    if (!(await Bun.password.verify(password, row.password_hash))) return { ok: false, error: 'wrong_login' };
    return { ok: true, account: toAccount(row), token: this.startSession(row.id) };
  }

  /** The account a session token is, while its session lasts */
  accountForToken(token: unknown): Account | null {
    if (typeof token !== 'string' || token.length === 0) return null;
    const row = this.db.query(`
      SELECT accounts.* FROM sessions JOIN accounts ON accounts.id = sessions.account_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(hashToken(token), this.now()) as AccountRow | null;
    return row ? toAccount(row) : null;
  }

  /** End a session (signing out) */
  logout(token: unknown): void {
    if (typeof token !== 'string') return;
    this.db.query('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }

  recordResult(accountId: number, won: boolean): void {
    this.db.query(`UPDATE accounts SET ${won ? 'wins = wins + 1' : 'losses = losses + 1'} WHERE id = ?`).run(accountId);
  }

  close(): void {
    this.db.close();
  }

  private findByName(name: string): AccountRow | null {
    return this.db.query('SELECT * FROM accounts WHERE name_key = ?').get(nameKey(name)) as AccountRow | null;
  }

  private startSession(accountId: number): string {
    const token = randomBytes(32).toString('base64url');
    this.db.query('DELETE FROM sessions WHERE expires_at <= ?').run(this.now());
    this.db.query('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)')
      .run(hashToken(token), accountId, this.now() + SESSION_DAYS * DAY_MS);
    return token;
  }
}

/** A match's results for the accounts in it: each human with an account, won or lost by side */
export function matchResults(
  players: { playerId: string; side: number; isBot?: boolean }[],
  accountOf: (playerId: string) => number | undefined,
  winningSide: number,
): { accountId: number; won: boolean }[] {
  const results: { accountId: number; won: boolean }[] = [];
  for (const player of players) {
    if (player.isBot) continue;
    const accountId = accountOf(player.playerId);
    if (accountId !== undefined) results.push({ accountId, won: player.side === winningSide });
  }
  return results;
}
