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
| `src/ui/matchmaking/MatchmakingUI.ts` | Client UI for queue |

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
