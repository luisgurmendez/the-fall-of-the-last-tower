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
(`'wildcrown'` by default, or `'narrows'`, always 1v1; see [map.md](map.md#maps)) and an optional `botChampionId` (the 1v1
bot's champion). `GAME_START` carries the match's `mapId`. The server skips the queue and starts a match immediately (`buildPracticeMatch` in
`packages/server/src/bots/practiceMatch.ts`): the player in mid on blue, and server-side bots in every other role on both sides:
- **1v1**: a `LaneBot` in mid on red.
- **3v3**: `LaneBot`s in top, mid and bot.
- **5v5**: top, mid, bot, a support (`SupportBot`, sticking with its team's bot laner) and a jungler (`JungleBot`).

Bots pick champions that suit their role when free (a tank on top, a healer as support, a fighter in the jungle), never two of
the same on a team, and summoner spells by role (the junglers Reap). Each bot is a `PlayerInfo` with `isBot: true` (ID
`bot-<playerId>-<side>-<role>`); `GameRoom` runs it through `BotDriver` each tick before processing inputs, and never sends it
state. The client's **PRACTICE** button on champion select uses this; the chip beside it cycles the match: 1V1, 3V3, 5V5 on
Wildcrown Vale, and ARAM (1v1 on The Narrows), remembered in localStorage `siege-practice-mode`. See [simulation.md](simulation.md#bots).

## Rooms (play with friends)

Champion select's **ROOM** button opens the room screen (`src/ui/matchmaking/lobbyScreen.ts`):
the player's name (kept in localStorage), **CREATE ROOM**, or a friend's code and **JOIN**.

- The client connects and sends `READY` with `mode: 'lobby'`, `lobby: { create: true }` or
  `{ code }` and `name`. The server (`server.ts`) keeps rooms in a `LobbyManager`
  (`packages/server/src/game/LobbyManager.ts`): a 5-letter code (no 0/O or 1/I/L), the host
  (its creator; the next player when the host leaves), the map, the players per side (1, 3
  or 5, never fewer than the fuller side; joining past it grows it) and its players, each
  with a side, champion, summoner spells and name (sanitized, up to 16 characters). A room
  holds 10; a join goes to the side with fewer players. A failed join answers an `ERROR`
  (`lobby_not_found`, `lobby_full`), shown on the room screen.
- Every change sends each player the room's `LOBBY_STATE` (`LobbyState`: code, host, map,
  size, players). The room screen shows the code (with a copy button), the host's map and
  size selects, both sides with each player's portrait, name and champion, empty slots as
  bots, and LEAVE, CHAMPION (back to champion select, whose button then reads BACK TO ROOM
  and sends the new champion: `LOBBY { action: 'update' }`), SWITCH SIDE and, for the host,
  START.
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

`GameRoom.checkWinConditions` ends the match when a nexus dies: it broadcasts the final state, then sends `GAME_END` (`GameEndData`) with the winning side, the match length and every champion's final stats (`GameRoom.getFinalStats`: level, K/D/A, CS, gold, items). The client shows VICTORY or DEFEAT for 3 seconds, then the final scoreboard (`TabScoreboard`, titled with the result) until the player clicks or presses a key (or 60 seconds pass), then returns to the menu.

A player can also surrender from the Escape menu (`src/ui/GameMenu.ts`, two clicks). The client sends a `SURRENDER` input, which `GameRoom.handleInput` handles itself instead of queueing it. Once every human on that side has surrendered (just them in 1v1 and practice), the other side wins through the same `endGame` as a destroyed nexus. Bots can't surrender.

## Abandoned Rooms

When every human in a room disconnects, `GameRoomManager` keeps the room for `abandonTimeoutMs` (60s) so players can reconnect,
then closes it. A reconnect cancels the timer.

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
| `src/ui/matchmaking/championSelect.ts`, `queueScreen.ts` | Champion select and queue screens |
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
