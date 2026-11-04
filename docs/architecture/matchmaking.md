# Matchmaking System

This document describes the matchmaking system that pairs players into games.

## Overview

The current matchmaking implementation is a simple FIFO (First-In-First-Out) queue designed for MVP 1v1 matches. Players are matched purely by arrival time.

## Architecture

```
┌─────────────┐     READY      ┌─────────────┐
│   Client    │ ──────────────► │  Matchmaker │
└─────────────┘                 └──────┬──────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │   Queue Array   │
                              │ [P1, P2, P3...] │
                              └────────┬────────┘
                                       │
                                When 2 players queued
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ GameRoomManager │
                              │  Create Room    │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │   GAME_START    │
                              │  to both players│
                              └─────────────────┘
```

## Queue Entry

Each queued player is represented as:

```typescript
interface QueueEntry {
  playerId: string;      // Unique player identifier
  championId: string;    // Selected champion (default: 'warrior')
  joinTime: number;      // Timestamp for timeout detection
}
```

## Matchmaking Flow

### 1. Player Joins Queue

```typescript
// Client sends READY message
{
  type: ClientMessageType.READY,
  data: {
    playerId: 'player-123',
    championId: 'warrior'
  }
}
```

### 2. Server Adds to Queue

```typescript
addToQueue(playerId: string, championId: string): void {
  // Check if already in queue
  if (this.queue.some(e => e.playerId === playerId)) {
    return;
  }

  this.queue.push({
    playerId,
    championId,
    joinTime: Date.now(),
  });

  // Immediately try to form a match
  this.tryMatch();
}
```

### 3. Match Attempt

```typescript
tryMatch(): boolean {
  const neededPlayers = this.playersPerTeam * 2;  // 1v1 = 2 players

  if (this.queue.length < neededPlayers) {
    return false;  // Not enough players
  }

  // Take first N players from queue
  const matchedPlayers = this.queue.splice(0, neededPlayers);

  // Assign teams
  const players = matchedPlayers.map((entry, index) => ({
    playerId: entry.playerId,
    championId: entry.championId,
    side: index < this.playersPerTeam ? 0 : 1,  // 0=Blue, 1=Red
  }));

  // Notify server via callback
  this.onMatchFound({ players });

  return true;
}
```

### 4. Game Room Creation

When a match is found, the server:

1. Creates a new `GameRoom` with matched players
2. Starts the game (spawns champions)
3. Sends `GAME_START` to all players with:
   - `gameId`: Unique game identifier
   - `yourSide`: Which team (0=Blue, 1=Red)
   - `players`: Array with all player info and entity IDs

## Practice Mode

`READY` accepts `mode: 'practice'`, an optional `practiceSize` (players per team: 1, 3 or 5; default 1), an optional `mapId`
(`'vale'` by default, or `'narrows'`, always 1v1; see [map.md](map.md#maps)) and an optional `botChampionId` (the 1v1
bot's champion). `GAME_START` carries the match's `mapId`. The server skips the queue and starts a match immediately (`buildPracticeMatch` in
`packages/server/src/bots/practiceMatch.ts`): the player in mid on blue, and server-side bots in every other role on both sides:
- **1v1**: a `LaneBot` in mid on red.
- **3v3**: `LaneBot`s in top, mid and bot.
- **5v5**: top, mid, bot, a support (`SupportBot`, sticking with its team's bot laner) and a jungler (`JungleBot`).

Bots pick champions that suit their role when free (a tank on top, a healer as support, a fighter in the jungle), never two of
the same on a team, and summoner spells by role (the junglers Reap). Each bot is a `PlayerInfo` with `isBot: true` (ID
`bot-<playerId>-<side>-<role>`); `GameRoom` runs it through `BotDriver` each tick before processing inputs, and never sends it
state. The client's **PRACTICE** card uses this; its chips pick the match: 1V1, 3V3, 5V5 on
The Vale, and ARAM (1v1 on The Narrows), remembered in localStorage `siege-practice-mode`. See [simulation.md](simulation.md#bots).

## The client's flow: how to play, then the champion

The menu's **PLAY** opens the mode screen (`src/ui/matchmaking/modeSelect.ts`), three cards:

- **PRACTICE**: you against bots; chips pick 1V1, 3V3, 5V5 or ARAM. *Choose champion* opens
  champion select for it, whose context line reads e.g. "PRACTICE · 5V5 · THE VALE"
  and whose **START** sends `READY` in practice mode.
- **WITH FRIENDS**: the player's name (kept in localStorage `siege-player-name`), **CREATE
  ROOM**, or a friend's code and **JOIN**. Champion select opens once the room's first
  `LOBBY_STATE` arrives; a failed join (`lobby_not_found`, `lobby_full`, the server
  unreachable) shows its error on the card.
- **ONLINE 1V1**: champion select, then **FIND MATCH** joins the queue.

Champion select (`championSelect.ts`) remembers the last champion picked (localStorage
`siege-champion`), which is also the one a room starts with. BACK goes to the mode screen. Its
cards wrap into even rows of at most 10 (`championGrid.ts`: 17 champions are rows of 9 and 8), and
the screen scrolls when it doesn't fit the window.

## Rooms (play with friends)

Made or joined from the mode screen's WITH FRIENDS card (above).

- The client connects and sends `READY` with `mode: 'lobby'`, `lobby: { create: true }` or
  `{ code }` and `name`. The server (`server.ts`) keeps rooms in a `LobbyManager`
  (`packages/server/src/game/LobbyManager.ts`): a 5-letter code (no 0/O or 1/I/L), the host
  (its creator; the next player when the host leaves), the map, the players per side (1, 3
  or 5, never fewer than the fuller side; joining past it grows it) and its players, each
  with a side, champion, summoner spells and name (sanitized, up to 16 characters). A room
  holds 10; a join goes to the side with fewer players. A failed join answers an `ERROR`
  (`lobby_not_found`, `lobby_full`), shown on the mode screen.
- Every change sends each player the room's `LOBBY_STATE` (`LobbyState`: code, host, map,
  size, players). Champion select shows the room around the champions (`roomPanel.ts`): the
  code (with a copy button) and the host's map and size selects in place of the title, blue's
  players on the left of the detail panel and red's on the right (portrait, name, champion;
  empty slots are bots), and LEAVE, SWITCH SIDE and, for the host, START.
- Picks go to the room as they're made: picking a champion or a summoner spell sends
  `LOBBY { action: 'update' }`, so everyone sees it. A champion a teammate plays is grayed
  out and can't be picked; the server (`LobbyManager.update`) keeps the player's champion if
  a teammate has it, and the client shows whatever champion the room says it has. Switching
  sides can still put two of a champion on a side.
- Requests: `ClientMessageType.LOBBY` (`LobbyRequest`: `update`, `switch_side`, `settings`
  (host only), `start` (host only), `leave`). Disconnecting, or sending `READY` in another
  mode, leaves the room; an empty room is gone.
- `start` turns the room into a match: `buildLobbyMatch` (`bots/practiceMatch.ts`) keeps the
  players on their sides and fills each side's empty slots with bots, the jungle and support
  first, then top, bot and mid, on champions nobody on their side plays. No debug overlay
  (it shows what the server sees).

`GAME_START` carries `yourPlayerId`, so a client with teammates finds its own champion
(`findLocalPlayer` in `src/ui/matchmaking/types.ts`; before, it took the first player on its
side). Tests: `packages/server/src/test/Lobbies.test.ts`.

## Game End

`GameRoom.checkWinConditions` ends the match when a nexus dies: it broadcasts the final state, then sends `GAME_END` (`GameEndData`) with the winning side, the match length and every champion's final stats (`GameRoom.getFinalStats`: level, K/D/A, CS, gold, items, and its `totals` over the match). A match that isn't practice is kept in the match history first (`server.ts` `recordMatch`, see [accounts.md](accounts.md#match-history-and-ratings)); when it was rated, `GAME_END` also carries `ratingChanges` (each signed-in player's rating before and after, by player id), and the client's VICTORY or DEFEAT banner says the new rating. A room knows where it came from (`GameRoom.mode`: `queue`, or `room` for a room of friends). The client shows VICTORY or DEFEAT for 3 seconds, then the final scoreboard (`TabScoreboard`, titled with the result; its gold is the gold earned) until the player continues (its Continue button, Enter, Space or Escape, after 1.5 seconds so a click mid-fight doesn't skip it), then returns to the menu.

### Post-match stats

The final scoreboard has a second page, Stats (its header's buttons, or Tab, switch): a column per champion, blue team then red, and a line per stat, each cell with a bar against the line's best (the best in gold), the local player's column lit (`src/ui/matchStats.ts`). The stats are each champion's `ChampionMatchTotals`, kept on the server by `ChampionMatchStats` (`champion.matchStats`):

| Stat | Counted |
|------|---------|
| Damage to champions, damage dealt, damage to structures | `ServerChampion.onDamageDealt`: after resistances, what a shield soaked included; dealt is to anything |
| Damage taken | `ServerChampion.takeDamage`, shields included |
| Healing | `ServerEntity.heal` credits its `sourceId`'s champion: itself (lifesteal, potions) or others |
| Gold earned | `grantGold` and the passive income (not selling) |
| Minions killed | the champion's CS |
| Wards placed, wards destroyed | `ServerGameContext.placeWard`; a ward's death credits its killer |
| Largest killing spree | kills (`RewardSystem`) without a death in between |

A player can also surrender from the Escape menu (`src/ui/GameMenu.ts`, two clicks). The client sends a `SURRENDER` input, which `GameRoom.handleInput` handles itself instead of queueing it. Once every human on that side has surrendered (just them in 1v1 and practice), the other side wins through the same `endGame` as a destroyed nexus. Bots can't surrender.

## Names

A match knows a player's name when they gave one: the name typed in a room, or their account's
(signed in, it wins over the typed one; see [accounts.md](accounts.md)). `PlayerInfo.name` carries it
into `GAME_START`'s players; bots and guests in the queue have none. Matches that aren't practice
count a win or a loss for each signed-in player, are kept in the match history, and move ratings when
there's a human on each side.

## A Bot Plays for Who Left

When a player loses their connection, `GameRoom` notes when (`awaySince`, game time). After
`TAKEOVER_DELAY` (5 s; a page reload is quicker, and then nothing happens) a `LaneBot` plays their
champion in the lane it's nearest (`takeoverLane` in `src/bots/takeover.ts`: the nearest lane path,
mid in a base where they all meet). It plays like a practice bot: it levels abilities, buys the
recommended build with the champion's gold, recalls, fights. Everyone gets a `PLAYER_CONNECTION`
event (`status: 'bot'`), shown as a line in the chat.

When they reconnect the bot lets go at once (`BotDriver.remove`), the champion stops where it is
(not walking on where the bot was going), their input sequence starts afresh (a reloaded page
numbers from 1), and everyone gets `PLAYER_CONNECTION` `status: 'back'`.
A second disconnect is taken over again by one bot. `GameRoom.isBotPlaying(playerId)` tells. The
camera of a rejoining client starts over its champion (`OnlineCameraController` snaps to the first
position it gets, locked or not). Tests: `packages/server/src/test/Takeover.test.ts`.

## Abandoned Rooms

When every human in a room disconnects, `GameRoomManager` keeps the room for `abandonTimeoutMs` (60s) so players can reconnect,
then closes it. A reconnect cancels the timer. Bots play for them meanwhile.

## Queue Management

### Queue Position

Players can query their queue position:

```typescript
getQueuePosition(playerId: string): number {
  return this.queue.findIndex(e => e.playerId === playerId) + 1;
  // Returns 0 if not in queue
}
```

### Queue Status Event

Server sends queue status to clients:

```typescript
{
  type: ServerMessageType.EVENT,
  data: {
    event: 'queue_joined',
    position: 1,
    queueSize: 2,
  }
}
```

### Leaving Queue

Players are removed from queue on:

1. **Disconnect**: Automatic removal
2. **Match Found**: Removed and placed in game
3. **Timeout**: Removed after 5 minutes

```typescript
removeFromQueue(playerId: string): boolean {
  const index = this.queue.findIndex(e => e.playerId === playerId);
  if (index >= 0) {
    this.queue.splice(index, 1);
    return true;
  }
  return false;
}
```

### Timeout Cleanup

A periodic cleanup removes stale queue entries:

```typescript
// Run every 60 seconds
cleanupTimedOut(): void {
  const now = Date.now();
  const timeout = 5 * 60 * 1000;  // 5 minutes

  this.queue = this.queue.filter(
    entry => now - entry.joinTime < timeout
  );
}
```

## Configuration

```typescript
interface MatchmakerConfig {
  playersPerTeam: number;     // Default: 1 (for 1v1)
  onMatchFound: (match: MatchResult) => void;
}
```

Environment variable:
```bash
PLAYERS_PER_TEAM=1  # 1v1 mode
PLAYERS_PER_TEAM=5  # 5v5 mode
```

## Match Result

When players are matched:

```typescript
interface MatchResult {
  players: Array<{
    playerId: string;
    championId: string;
    side: number;  // 0 = Blue, 1 = Red
  }>;
}
```

## Statistics

```typescript
getStats(): { queueSize: number; matchReady: boolean } {
  return {
    queueSize: this.queue.length,
    matchReady: this.queue.length >= this.playersPerTeam * 2,
  };
}
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/server/src/matchmaking/Matchmaker.ts` | Matchmaking logic |
| `packages/server/src/server.ts` | Integration with server |
| `src/ui/matchmaking/MatchmakingUI.ts` | Client UI for queue (coordinates the screens below) |
| `src/ui/matchmaking/matchConnection.ts` | Client connection: sends READY with the champion and mode, buffers state during loading |
| `src/ui/matchmaking/modeSelect.ts` | The mode screen: practice (and which match), rooms (name, create, join by code), the online queue |
| `src/ui/matchmaking/championSelect.ts`, `queueScreen.ts` | Champion select and queue screens |
| `src/ui/matchmaking/roomPanel.ts` | A room on champion select: code, settings, both sides' players |
| `src/ui/matchmaking/matchFound.ts`, `matchAssets.ts` | Loading screen: a card per player (portrait, champion, player or "Bot", summoner spells, loading bar) and a rotating tip, while `preloadMatchAssets` loads the match's champions, structures, minions, monsters, map art and item icons; the bar follows what's loaded, takes at least 1.5s and gives up waiting at 15s |

## Future Improvements

The current implementation is MVP-level. Future improvements could include:

### MMR-Based Matching

```typescript
interface QueueEntry {
  playerId: string;
  championId: string;
  mmr: number;          // Skill rating
  joinTime: number;
  searchRange: number;  // Expands over time
}

tryMatch(): boolean {
  // Sort by join time
  // For each player, find opponent within MMR range
  // Expand range over time for fairness
}
```

### Role Selection (5v5)

```typescript
interface QueueEntry {
  playerId: string;
  championId: string;
  preferredRoles: ['mid', 'top'];  // Ordered preference
  joinTime: number;
}
```

### Team Balancing

```typescript
// Ensure teams have similar average MMR
const blueTeamMMR = blueTeam.reduce((sum, p) => sum + p.mmr, 0) / 5;
const redTeamMMR = redTeam.reduce((sum, p) => sum + p.mmr, 0) / 5;
// Swap players if imbalanced
```

### Ranked/Unranked Queues

```typescript
type QueueType = 'ranked' | 'unranked' | 'custom';

class Matchmaker {
  private queues: Map<QueueType, QueueEntry[]> = new Map();
}
```
