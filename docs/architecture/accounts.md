# Accounts

Accounts are optional and basic: a name and a password. Signed in, a player plays under their
account's name (rooms, the chat) and their wins and losses count. Guests play as before.

## Server

| File | What it does |
|------|--------------|
| `packages/server/src/accounts/AccountStore.ts` | The accounts and sessions, in SQLite (`bun:sqlite`); `matchResults` (who won, who lost) |
| `packages/server/src/accounts/accountRoutes.ts` | The HTTP API, answered by `BunWebSocketServer` before its files (`httpHandler`) |

- **Where:** `DATA_DIR/accounts.db` (`DATA_DIR` defaults to `./data`, which is `packages/server/data`
  locally, git-ignored and kept out of the Docker image). On Fly it must be a volume, or every
  restart (each deploy, each idle stop) loses the accounts: see [deploy.md](deploy.md#accounts-volume).
- **Names:** 3 to 16 letters (any alphabet), digits, `_` or `-`; spaces around are dropped. One account
  per name however it's capitalized or composed (the key is the name in NFC, lowercased); shown as typed.
- **Passwords:** 6 to 128 characters. Only an argon2id hash is kept (`Bun.password`).
- **Sessions:** signing up or in gives a token (32 random bytes); only its SHA-256 is kept. A session
  lasts `SESSION_DAYS` (90); signing out ends it. A wrong name and a wrong password get the same answer.
- **Results:** when a match that isn't practice ends, each human signed in gets a win or a loss
  (`matchResults`, `GameRoom.isPractice()`). Rooms count, bots or not.

### API

| Request | Answer |
|---------|--------|
| `POST /api/register` `{ name, password }` | `{ account, token }`; 400 `bad_name` / `bad_password`, 409 `name_taken` |
| `POST /api/login` `{ name, password }` | `{ account, token }`; 401 `wrong_login` |
| `GET /api/me`, `Authorization: Bearer <token>` | `{ account }`; 401 `no_session` |
| `POST /api/logout`, the same header | 204 |

`account` is `{ id, name, wins, losses }`. Bodies over 2 KB get 413; one address gets at most 10
sign-ups and sign-ins a minute (429 `too_many_attempts`; behind Fly the address is `Fly-Client-IP`).
Tokens travel in a header, not a cookie, so the API allows any origin (CORS `*`): a page can't act
for a player without their token. In development the client (Vite, :3100) calls the game server
(:8080).

### In the game

READY carries `accountToken`. `server.ts` keeps the account per player (`playerAccounts`) while
they're connected or in a match: in a room the account's name replaces the one typed, and every
match's `PlayerInfo.name` is the account's (rooms already named everyone). `GAME_START`'s players
carry `name`; the chat shows `Name (Champion)` when it's known.

## Client

- `src/ui/matchmaking/account.ts`: `AccountClient` signs up, in and out against the game server's
  address (`apiBaseUrl`: `ws://host/ws` → `http://host`), and keeps `{ token, account }` in
  `localStorage["siege-account"]` (never the password). `refresh()` gets the latest wins and losses
  and drops a token the server no longer knows (it keeps the account if the server can't be reached).
- `src/ui/matchmaking/accountScreen.ts`: the line under the main menu's links ("Playing as a guest ·
  Sign in", or "Name 3W 2L · Sign out") and the sign-in screen (`#screen-account`). The menu refreshes
  the account when it comes back after a match.
- Signed in, the room screen's name field shows the account's name and can't be changed.

Tests: `packages/server/src/test/Accounts.test.ts`, `AccountRoutes.test.ts`,
`packages/client/src/test/AccountClient.test.ts`.
