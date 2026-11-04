# Plan: cooldowns while dead, Continue, profile and match history, Elo, practice tools

Asked on 2026-11-04. Five pieces; each is its own commit (or a few) on `iterate/gameplay`, built
test first. The big ones are built side by side on their own branches and merged.

| # | Piece | Where | Branch |
|---|-------|-------|--------|
| 1 | Cooldowns keep counting while dead | server | `iterate/gameplay` |
| 2 | The server remembers your match: the menu only offers CONTINUE | server + client | `iterate/gameplay` |
| 3 | Match history and a profile (not practice) | server (SQLite, API) + client | `feat/profile-elo` |
| 4 | Elo | server + client | `feat/profile-elo` |
| 5 | Practice tools (level, teleport, cooldowns, health, mana, gold...) | server + client | `feat/practice-tools` |

## 1. Cooldowns while dead

Today `ServerChampion.update` returns early while dead (`updateDead`), so nothing ticks.
While dead these keep counting, as alive:
- **Abilities:** cooldowns and charges coming back.
- **Summoner spells.**
- **The trinket.**
- **Item passives' cooldowns.**
- **The passive's cooldown.**

Item actives already count by game time. A recast window or a cast in progress doesn't
survive a death.

## 2. CONTINUE

Today a player's session (player id + token) lives in the tab's `sessionStorage`. A closed tab
loses its match, and after a reload the player has to go through PLAY → champion select → START
before the server sends them back in.

- **Server:** `GET /api/current-match` answers `{ match: { playerId, sessionToken, championId, gameTime,
  practice } | null }` for:
  - **An account** (`Authorization: Bearer <account token>`): the live match it plays in, wherever it
    was started (any tab, any device).
  - **A guest** (`X-Siege-Player` + `X-Siege-Session` headers, the last match's id and token): its
    match if it's still live and the player isn't connected to it now. A player playing in another
    tab is left alone, so two tabs can still play each other.

  The server keeps `accountMatches` (account → player id) for live matches. A READY from an account
  already in a live match as another player gets ERROR `in_match`, so an account can't be in two
  matches.
- **Client:** the menu asks on startup and whenever it's shown again.
  - **With a live match:** PLAY becomes **▶ CONTINUE** (the champion and the match's clock under
    it), and the modes aren't offered.
  - **CONTINUE:** it takes the match's player id and token into the tab and sends READY, and the
    server's reconnect path does the rest (GAME_START, FULL_STATE).
  - **Guests:** the last match's id and token are also kept in `localStorage`, so a new tab finds
    them.

## 3. Match history and profile

- **Which matches:** every match that isn't practice (queue and rooms), as the wins and losses
  already count.
- **SQLite** (AccountStore's database):
  - `matches`: id, map, mode (`queue` | `room`), rated, ended_at, duration, winning side.
  - `match_players`: one row per champion (accounts, guests and bots). It has:
    - the account id (or null), the name shown, whether it's a bot, the champion, the side, the
      result;
    - level, K/D/A, CS, gold, items, the `totals` of the scoreboard (JSON);
    - the rating before and after (accounts in rated matches).
- **API:**
  - `GET /api/profile/<name>`: the account, its rating, tier, W/L, and its latest matches (paged,
    `?before=<matchId>`).
  - `GET /api/matches/<id>`: one match's whole scoreboard.

  Profiles are public, like the in-game names.
- **Client:**
  - **Opening it:** a Profile screen, from the account line under the menu.
  - **Its contents:** rating and tier, W/L and win rate, most played champions, and the latest
    matches. Each match row has the champion, result, KDA, CS, duration, date and rating change;
    a click on it opens that match's scoreboard.

## 4. Elo

- **Starting point:** each account starts at 1200.
- **Which matches are rated:** one that isn't practice, with at least one human on each side. A
  room where friends play bots isn't rated: there's no one to rate against. It's still a win or
  a loss, and it's in the history.
- **Team rating:** the average of its humans' ratings. Guests count as 1200; bots don't count.
- **Change:** each signed-in human gets `K · (result − expected)`, with
  `expected = 1 / (1 + 10^((other − own) / 400))` from the two team ratings. K is 40 for an account's
  first 10 rated matches, 24 after.
- **Tiers, shown by the rating:** Bronze < 1000 ≤ Silver < 1200 ≤ Gold < 1400 ≤ Platinum < 1600 ≤
  Diamond < 1800 ≤ Master.

## 5. Practice tools

Practice matches only (`GameRoom.isPractice()`); the server ignores them elsewhere.
- **The tools:**
  - level up (+1) and level 18;
  - +1000 gold;
  - reset cooldowns (abilities, summoners, items);
  - refill health and mana;
  - teleport (the next click on the map);
  - toggles: no cooldowns, invulnerable, bots stand still.
- **The input:** `InputType.PRACTICE_TOOL` (`{ tool, x?, y? }`). `GameRoom.handleInput` handles it
  itself, like SURRENDER, through `game/practiceTools.ts`.
- **On the client:**
  - a panel opened with F2 or from the Escape menu, shown only in practice;
  - GAME_START carries `practice`;
  - the tools work from the panel's buttons and their keys.
