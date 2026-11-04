# Accounts

Accounts are optional and basic: a name and a password. Signed in, a player plays under their
account's name (rooms, the chat), their wins and losses count, they have a rating (Elo), and their
matches are kept for their profile. Guests play as before.

## Server

| File | What it does |
|------|--------------|
| `packages/server/src/accounts/AccountStore.ts` | The accounts and sessions, the match history and ratings, in SQLite (`bun:sqlite`) |
| `packages/server/src/accounts/elo.ts` | Elo: which matches are rated, team ratings, rating changes, tiers |
| `packages/server/src/accounts/matchRecord.ts` | What's kept of a finished match (`matchRecordOf`: the final stats with who played each champion) |
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
  (`AccountStore.recordMatch`, `GameRoom.isPractice()`). Rooms count, bots or not.

### Match history and ratings

When a match that isn't practice ends, `server.ts` (`recordMatch`) keeps it with
`AccountStore.recordMatch(matchRecordOf(...))`. One transaction does it all: if any line can't be
kept, nothing is. It:
- keeps the match;
- keeps every champion's line (accounts, guests and bots);
- counts the accounts' wins and losses;
- when the match is rated, moves the accounts' ratings.

An account found twice in one match counts once: its second line is kept as a guest's. So is an
account that doesn't exist.

| Table | What it holds |
|-------|---------------|
| `accounts` | Also `rating` (1200 to start), `peak_rating`, `rated_games` |
| `matches` | `id`, `map_id`, `mode` (`queue` or `room`), `rated`, `ended_at` (ms), `duration` (s), `winning_side` |
| `match_players` | One row per champion: `match_id`, `account_id` (null for guests and bots), `name`, `is_bot`, `champion_id`, `side`, `won`, `level`, K/D/A, `cs`, `gold`, `items` (JSON), `totals` (JSON, the scoreboard's `ChampionMatchTotals`), `rating_before` and `rating_after` (null unless rated) |

**Older databases:** one from before ratings gets the columns when it's opened (`migrate`: `PRAGMA
table_info`, then `ALTER TABLE ADD COLUMN`). Every account gets 1200 and keeps its wins, losses and
sessions.

**Elo** (`elo.ts`):
- **Starting rating:** every account starts at 1200.
- **Rated matches:** a match is rated when it isn't practice and has a human on each side. Friends
  in a room against bots aren't rated; there's no one to rate them against. It's still a win or a
  loss, and it's kept.
- **Team rating:** a team's rating is the average of its humans'. A guest counts as 1200; bots don't
  count.
- **Changes:** each account moves by `K · (result − expected)`, where `expected = 1 / (1 + 10^((other −
  own) / 400))` from the two team ratings.
  - K is 40 for an account's first 10 rated matches, 24 after.
  - Ratings are whole numbers and never drop below 100.
  - The winner never loses rating, and the loser never gains.
- **Tiers:**

  | Tier | Rating |
  |------|--------|
  | Bronze | below 1100 |
  | Silver | 1100–1299 |
  | Gold | 1300–1499 |
  | Platinum | 1500–1699 |
  | Diamond | 1700–1899 |
  | Master | 1900 and up |

  A new account is in the middle of Silver, so one loss doesn't drop it a tier. Before its first
  rated match an account shows as Unranked.

### API

| Request | Answer |
|---------|--------|
| `POST /api/register` `{ name, password }` | `{ account, token }`; 400 `bad_name` / `bad_password`, 409 `name_taken` |
| `POST /api/login` `{ name, password }` | `{ account, token }`; 401 `wrong_login` |
| `GET /api/me`, `Authorization: Bearer <token>` | `{ account }`; 401 `no_session` |
| `POST /api/logout`, the same header | 204 |
| `GET /api/current-match` (the bearer token, or a guest's `X-Siege-Player` + `X-Siege-Session`) | `{ match }`: `{ playerId, sessionToken, championId, gameTime, practice }` or null (the menu's CONTINUE: see [networking.md](networking.md#reconnection)) |
| `GET /api/profile/<name>` (`?before=<match id>`: the next page) | `{ profile, matches, more }`; 404 `no_account`, 400 `bad_request` for a bad page |
| `GET /api/matches/<id>` | `{ match }`; 404 `no_match`, 400 `bad_request` for an id that isn't one |

`account` is `{ id, name, wins, losses, rating, peakRating, ratedGames, tier }`.

Profiles and matches are public, like the names in matches.
- **Profile names:** any capitalization works, written for a URL (`encodeURIComponent`).
- **`profile`:** `{ name, wins, losses, rating, peakRating, ratedGames, tier, champions }`.
  `champions` is the 10 most played, each `{ championId, games, wins }`.
- **`matches`:** 20 at a time, newest first. Each one is:
  - **the match:** `id`, `mapId`, `mode`, `rated`, `endedAt`, `duration`;
  - **the account's line:** `championId`, `side`, `won`, `level`, K/D/A, `cs`, `gold`, `items`,
    `ratingBefore` and `ratingAfter` (null when unrated).
- **`more`:** whether older matches are left.
- **`match`:** the match's facts, `winningSide`, and `players`. Each line in `players` has its
  `name`, `account` (whether it played with one), `isBot`, its stats, `totals` and its rating change. Bodies over 2 KB get 413; one address gets at most 10
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
- `src/ui/matchmaking/accountScreen.ts`: the line under the main menu's links and the sign-in screen
  (`#screen-account`). The line reads:
  - signed out: "Playing as a guest · Sign in";
  - signed in: "Name 1240 Silver 3W 2L · Profile · Sign out", with "Unranked" before a rated match.

  The menu refreshes the account when it comes back after a match.
- `src/ui/matchmaking/profileScreen.ts`: the profile (`#screen-profile`, no logo or tips over it).
  - **What it shows:** the rating and tier, the peak, wins, losses and win rate, the 5 most played
    champions, and the latest matches.
  - **Each match:** the champion, result, mode and map, KDA, CS, gold, items, length, when it was
    played, and the rating change. MORE loads the next page.
  - **A click on a match:** opens its scoreboard under it, both teams. A name with an account on the
    scoreboard opens that account's profile.

  `profileFormat.ts` writes its numbers: length, KDA and ratio, rating change, "5 min ago", win
  rate, the rating line. `AccountClient.profile(name, before?)` and `match(id)` fetch them.
- Signed in, the room screen's name field shows the account's name and can't be changed.

Tests:
- **Server** (`packages/server/src/test/`): `Accounts.test.ts`, `AccountRoutes.test.ts`,
  `MatchHistory.test.ts`, `MatchRecord.test.ts`, `Elo.test.ts`, and the match history in
  `GameEnd.test.ts`.
- **Client** (`packages/client/src/test/`): `AccountClient.test.ts`, `ProfileFormat.test.ts`.
