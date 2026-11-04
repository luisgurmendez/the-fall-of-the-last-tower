/**
 * The player's account, from the menu: signing up, in and out through the
 * game server's account API (packages/server/src/accounts/accountRoutes.ts,
 * at the game server's address), and the token and account kept in the
 * browser (localStorage, "siege-account"; never the password). The token
 * goes with READY, so the player plays under their account's name and their
 * wins and losses count.
 */

export const ACCOUNT_STORAGE_KEY = 'siege-account';

export interface AccountInfo {
  id: number;
  name: string;
  wins: number;
  losses: number;
}

export interface StoredAccount {
  token: string;
  account: AccountInfo;
}

export type AccountAnswer = { ok: true } | { ok: false; error: string };

/** The part of the browser's Storage this needs */
export interface AccountStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The account API's address: the game server's (its socket's URL), over http or https */
export function apiBaseUrl(wsUrl: string): string {
  const url = new URL(wsUrl);
  return `${url.protocol === 'wss:' ? 'https:' : 'http:'}//${url.host}`;
}

function isAccountInfo(value: unknown): value is AccountInfo {
  const account = value as AccountInfo | null;
  return typeof account === 'object' && account !== null && typeof account.id === 'number' &&
    typeof account.name === 'string' && typeof account.wins === 'number' && typeof account.losses === 'number';
}

/** What the browser kept, if it's an account */
export function parseStoredAccount(raw: unknown): StoredAccount | null {
  const stored = raw as StoredAccount | null;
  if (typeof stored !== 'object' || stored === null || typeof stored.token !== 'string' || !isAccountInfo(stored.account)) return null;
  return { token: stored.token, account: stored.account };
}

const ERROR_MESSAGES: Record<string, string> = {
  bad_name: 'Names are 3 to 16 letters, digits, _ or -',
  bad_password: 'Passwords are 6 to 128 characters',
  name_taken: 'That name is taken',
  wrong_login: 'Wrong name or password',
  too_many_attempts: 'Too many tries: wait a minute',
  offline: "Can't reach the server",
};

export function accountErrorMessage(error: string): string {
  return ERROR_MESSAGES[error] ?? 'Something went wrong, try again';
}

type Listener = (current: StoredAccount | null) => void;

export class AccountClient {
  private stored: StoredAccount | null;
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly baseUrl: string,
    private readonly storage: AccountStorage | null,
    private readonly fetchFn: (url: string, init?: RequestInit) => Promise<Response> = (url, init) => fetch(url, init),
  ) {
    this.stored = this.load();
  }

  /** The account signed in, with its token, or null */
  current(): StoredAccount | null {
    return this.stored;
  }

  register(name: string, password: string): Promise<AccountAnswer> {
    return this.signIn('/api/register', name, password);
  }

  login(name: string, password: string): Promise<AccountAnswer> {
    return this.signIn('/api/login', name, password);
  }

  /** The latest wins and losses; signed out if the server no longer knows the token */
  async refresh(): Promise<void> {
    const stored = this.stored;
    if (!stored) return;
    try {
      const response = await this.fetchFn(`${this.baseUrl}/api/me`, { headers: { Authorization: `Bearer ${stored.token}` } });
      if (response.status === 401) {
        this.set(null);
        return;
      }
      const body = await response.json() as { account?: unknown };
      if (response.ok && isAccountInfo(body.account)) this.set({ token: stored.token, account: body.account });
    } catch {
      // Unreachable for now: keep the account
    }
  }

  /** Forget the account here, and end its session on the server if it can be reached */
  async logout(): Promise<void> {
    const stored = this.stored;
    this.set(null);
    if (!stored) return;
    try {
      await this.fetchFn(`${this.baseUrl}/api/logout`, { method: 'POST', headers: { Authorization: `Bearer ${stored.token}` } });
    } catch {
      // Forgotten here anyway; the session runs out on its own
    }
  }

  /** Hear every change; returns how to stop */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async signIn(path: string, name: string, password: string): Promise<AccountAnswer> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
    } catch {
      return { ok: false, error: 'offline' };
    }
    let body: { account?: unknown; token?: unknown; error?: unknown };
    try {
      body = await response.json();
    } catch {
      return { ok: false, error: 'server_error' };
    }
    if (response.ok && typeof body.token === 'string' && isAccountInfo(body.account)) {
      this.set({ token: body.token, account: body.account });
      return { ok: true };
    }
    return { ok: false, error: typeof body.error === 'string' ? body.error : 'server_error' };
  }

  private load(): StoredAccount | null {
    try {
      return parseStoredAccount(JSON.parse(this.storage?.getItem(ACCOUNT_STORAGE_KEY) ?? 'null'));
    } catch {
      return null;
    }
  }

  private set(stored: StoredAccount | null): void {
    this.stored = stored;
    try {
      if (stored) this.storage?.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(stored));
      else this.storage?.removeItem(ACCOUNT_STORAGE_KEY);
    } catch {
      // Not kept past this page
    }
    for (const listener of this.listeners) listener(stored);
  }
}
