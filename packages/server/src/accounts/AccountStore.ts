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
 * - Each account counts its wins and losses, and has a rating (elo.ts).
 * - Matches that aren't practice are kept (recordMatch): every champion's
 *   line, for the accounts' profiles (profile) and each match's scoreboard
 *   (match). Keeping one counts its accounts' wins and losses and, when it's
 *   rated, moves their ratings, all in one transaction.
 *
 * A database from before ratings and match history gets them when opened
 * (migrate: the missing columns are added, every account at START_RATING).
 */

import { Database } from 'bun:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import type { ChampionMatchTotals } from '@siege/shared';
import { START_RATING, ratingChanges, isRated, tierOf, type RatedPlayer, type RatingChange, type TierId } from './elo';

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
  rating: number;
  peakRating: number;
  /** Rated matches played */
  ratedGames: number;
  tier: TierId;
}

/** Matches in a page of a profile */
export const PROFILE_PAGE = 20;
/** Champions in a profile's most played */
const PROFILE_CHAMPIONS = 10;

export type MatchMode = 'queue' | 'room';

/** A champion's line in a finished match, to keep */
export interface MatchPlayerRecord {
  /** Who played it in the match (rating changes are keyed by it) */
  playerId: string;
  /** The account it played with; null for a guest or a bot */
  accountId: number | null;
  /** The name shown (an account's, one typed in a room); null for none */
  name: string | null;
  isBot: boolean;
  championId: string;
  side: number;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  /** Item ids by inventory slot (null for an empty one) */
  items: (string | null)[];
  totals: ChampionMatchTotals;
}

/** A finished match, to keep */
export interface MatchRecord {
  mapId: string;
  /** From the queue, or a room of friends */
  mode: MatchMode;
  /** Practice isn't kept */
  practice: boolean;
  /** Seconds */
  duration: number;
  winningSide: number;
  players: MatchPlayerRecord[];
}

export interface RecordedMatch {
  matchId: number;
  rated: boolean;
  /** Each account's rating before and after, by player id */
  ratingChanges: Map<string, RatingChange>;
}

/** A champion an account played, and how it went */
export interface ChampionRecord {
  championId: string;
  games: number;
  wins: number;
}

export interface Profile {
  name: string;
  wins: number;
  losses: number;
  rating: number;
  peakRating: number;
  ratedGames: number;
  tier: TierId;
  /** Most played first (at most PROFILE_CHAMPIONS) */
  champions: ChampionRecord[];
}

/** A match in a profile: the match, and the account's line in it */
export interface MatchSummary {
  id: number;
  mapId: string;
  mode: MatchMode;
  rated: boolean;
  /** When it ended (ms) */
  endedAt: number;
  /** Seconds */
  duration: number;
  championId: string;
  side: number;
  won: boolean;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  items: (string | null)[];
  /** null when it wasn't rated */
  ratingBefore: number | null;
  ratingAfter: number | null;
}

/** A champion's line on a kept match's scoreboard */
export interface MatchPlayerLine {
  name: string | null;
  /** It played with an account (its name opens a profile) */
  account: boolean;
  isBot: boolean;
  championId: string;
  side: number;
  won: boolean;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  items: (string | null)[];
  totals: ChampionMatchTotals | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
}

/** A kept match, both teams */
export interface MatchDetail {
  id: number;
  mapId: string;
  mode: MatchMode;
  rated: boolean;
  endedAt: number;
  duration: number;
  winningSide: number;
  players: MatchPlayerLine[];
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
  rating: number;
  peak_rating: number;
  rated_games: number;
}

interface MatchRow {
  id: number;
  map_id: string;
  mode: string;
  rated: number;
  ended_at: number;
  duration: number;
  winning_side: number;
}

interface MatchPlayerRow {
  account_id: number | null;
  name: string | null;
  is_bot: number;
  champion_id: string;
  side: number;
  won: number;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  items: string;
  totals: string;
  rating_before: number | null;
  rating_after: number | null;
}

/** Columns added to accounts after it was first made, with what an old account gets */
const ADDED_ACCOUNT_COLUMNS: [name: string, definition: string][] = [
  ['rating', `INTEGER NOT NULL DEFAULT ${START_RATING}`],
  ['peak_rating', `INTEGER NOT NULL DEFAULT ${START_RATING}`],
  ['rated_games', 'INTEGER NOT NULL DEFAULT 0'],
];

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
  return {
    id: row.id, name: row.name, wins: row.wins, losses: row.losses,
    rating: row.rating, peakRating: row.peak_rating, ratedGames: row.rated_games, tier: tierOf(row.rating).id,
  };
}

/** JSON kept in a column, or `fallback` if it can't be read */
function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function isMatchId(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
}

/** A whole, finite number to keep (the stats are counts) */
function count(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function toMatchLine(player: MatchPlayerRow) {
  return {
    championId: player.champion_id,
    side: player.side,
    won: player.won === 1,
    level: player.level,
    kills: player.kills,
    deaths: player.deaths,
    assists: player.assists,
    cs: player.cs,
    gold: player.gold,
    items: parseJson<(string | null)[]>(player.items, []),
    ratingBefore: player.rating_before,
    ratingAfter: player.rating_after,
  };
}

function toMatchFacts(match: MatchRow) {
  return {
    id: match.id,
    mapId: match.map_id,
    mode: match.mode as MatchMode,
    rated: match.rated === 1,
    endedAt: match.ended_at,
    duration: match.duration,
  };
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
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        map_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        rated INTEGER NOT NULL,
        ended_at INTEGER NOT NULL,
        duration REAL NOT NULL,
        winning_side INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS match_players (
        match_id INTEGER NOT NULL REFERENCES matches(id),
        account_id INTEGER REFERENCES accounts(id),
        name TEXT,
        is_bot INTEGER NOT NULL,
        champion_id TEXT NOT NULL,
        side INTEGER NOT NULL,
        won INTEGER NOT NULL,
        level INTEGER NOT NULL,
        kills INTEGER NOT NULL,
        deaths INTEGER NOT NULL,
        assists INTEGER NOT NULL,
        cs INTEGER NOT NULL,
        gold INTEGER NOT NULL,
        items TEXT NOT NULL,
        totals TEXT NOT NULL,
        rating_before INTEGER,
        rating_after INTEGER
      );
      CREATE INDEX IF NOT EXISTS match_players_by_account ON match_players (account_id, match_id);
      CREATE INDEX IF NOT EXISTS match_players_by_match ON match_players (match_id);
    `);
    this.migrate();
  }

  /** The columns a database from before them lacks (its accounts keep what they had) */
  private migrate(): void {
    const columns = new Set((this.db.query('PRAGMA table_info(accounts)').all() as { name: string }[]).map(column => column.name));
    for (const [name, definition] of ADDED_ACCOUNT_COLUMNS) {
      if (!columns.has(name)) this.db.exec(`ALTER TABLE accounts ADD COLUMN ${name} ${definition}`);
    }
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

  /**
   * Keep a finished match: every champion's line, its accounts' wins and
   * losses, and their new ratings when it's rated (elo.ts), in one
   * transaction (a line that can't be kept throws, and nothing is kept).
   * Practice isn't kept: null. An account that doesn't exist, or one already
   * in the match, plays as a guest.
   */
  recordMatch(record: MatchRecord): RecordedMatch | null {
    if (record.practice) return null;
    return this.db.transaction((): RecordedMatch => {
      const seen = new Set<number>();
      const accounts = record.players.map(player => {
        if (player.isBot || player.accountId === null || seen.has(player.accountId)) return null;
        const row = this.db.query('SELECT * FROM accounts WHERE id = ?').get(player.accountId) as AccountRow | null;
        if (row) seen.add(row.id);
        return row;
      });
      const players: RatedPlayer[] = record.players.map((player, i) => ({
        key: player.playerId,
        side: player.side,
        isBot: player.isBot,
        rating: accounts[i]?.rating ?? null,
        ratedGames: accounts[i]?.rated_games ?? 0,
      }));
      const rated = isRated(false, players);
      const changes = rated ? ratingChanges(players, record.winningSide) : new Map<string, RatingChange>();

      const { id: matchId } = this.db.query(`
        INSERT INTO matches (map_id, mode, rated, ended_at, duration, winning_side) VALUES (?, ?, ?, ?, ?, ?) RETURNING id
      `).get(record.mapId, record.mode, rated ? 1 : 0, this.now(), record.duration, record.winningSide) as { id: number };

      const insertLine = this.db.query(`
        INSERT INTO match_players (match_id, account_id, name, is_bot, champion_id, side, won, level, kills, deaths,
          assists, cs, gold, items, totals, rating_before, rating_after)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updateRating = this.db.query(
        'UPDATE accounts SET rating = ?, peak_rating = MAX(peak_rating, ?), rated_games = rated_games + 1 WHERE id = ?',
      );
      record.players.forEach((player, i) => {
        const account = accounts[i];
        const won = player.side === record.winningSide;
        const change = changes.get(player.playerId) ?? null;
        insertLine.run(
          matchId, account?.id ?? null, player.name, player.isBot ? 1 : 0, player.championId, player.side, won ? 1 : 0,
          count(player.level), count(player.kills), count(player.deaths), count(player.assists), count(player.cs), count(player.gold),
          JSON.stringify(player.items), JSON.stringify(player.totals), change?.before ?? null, change?.after ?? null,
        );
        if (!account) return;
        this.recordResult(account.id, won);
        if (change) updateRating.run(change.after, change.after, account.id);
      });
      return { matchId, rated, ratingChanges: changes };
    })();
  }

  /**
   * An account's profile and a page of its latest matches (newest first;
   * `before`: the ones before that match id), or null if no account has
   * that name
   */
  profile(name: unknown, options: { before?: number } = {}): { profile: Profile; matches: MatchSummary[]; more: boolean } | null {
    const clean = cleanName(name);
    const row = clean === null ? null : this.findByName(clean);
    if (!row) return null;
    const { wins, losses, rating, peakRating, ratedGames, tier } = toAccount(row);
    const champions = (this.db.query(`
      SELECT champion_id, COUNT(*) AS games, SUM(won) AS wins FROM match_players WHERE account_id = ?
      GROUP BY champion_id ORDER BY games DESC, wins DESC, champion_id LIMIT ?
    `).all(row.id, PROFILE_CHAMPIONS) as { champion_id: string; games: number; wins: number }[])
      .map(champion => ({ championId: champion.champion_id, games: champion.games, wins: champion.wins }));

    const before = isMatchId(options.before) ? options.before : Number.MAX_SAFE_INTEGER;
    const rows = this.db.query(`
      SELECT matches.*, match_players.* FROM match_players JOIN matches ON matches.id = match_players.match_id
      WHERE match_players.account_id = ? AND matches.id < ? ORDER BY matches.id DESC LIMIT ?
    `).all(row.id, before, PROFILE_PAGE + 1) as (MatchRow & MatchPlayerRow)[];
    return {
      profile: { name: row.name, wins, losses, rating, peakRating, ratedGames, tier, champions },
      matches: rows.slice(0, PROFILE_PAGE).map(match => ({ ...toMatchFacts(match), ...toMatchLine(match) })),
      more: rows.length > PROFILE_PAGE,
    };
  }

  /** A kept match with both teams' lines, or null */
  match(id: unknown): MatchDetail | null {
    if (!isMatchId(id)) return null;
    const match = this.db.query('SELECT * FROM matches WHERE id = ?').get(id) as MatchRow | null;
    if (!match) return null;
    const players = (this.db.query('SELECT * FROM match_players WHERE match_id = ? ORDER BY rowid').all(id) as MatchPlayerRow[])
      .map(player => ({
        name: player.name,
        account: player.account_id !== null,
        isBot: player.is_bot === 1,
        ...toMatchLine(player),
        totals: parseJson<ChampionMatchTotals | null>(player.totals, null),
      }));
    return { ...toMatchFacts(match), winningSide: match.winning_side, players };
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
