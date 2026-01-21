# Infrastructure Architecture

This document describes the server-client infrastructure of Siege, a server-authoritative MOBA game.

## Overview

Siege follows a classic client-server model where the **server is the authoritative source of truth**. All game logic runs on the server; clients send inputs and receive state updates.

```
┌─────────────┐         WebSocket          ┌─────────────────┐
│   Client    │ ◄─────────────────────────► │     Server      │
│  (Browser)  │    JSON messages            │  (Bun Runtime)  │
└─────────────┘                             └─────────────────┘
      │                                            │
      │                                            │
      ▼                                            ▼
┌─────────────┐                            ┌─────────────────┐
│ OnlineGame  │                            │ GameRoomManager │
│ StateManager│                            │    GameRoom     │
│ InputHandler│                            │   ServerGame    │
└─────────────┘                            └─────────────────┘
```

## Server Components

### Entry Point (`packages/server/src/server.ts`)

The main server file initializes all components and handles message routing:

1. **BunWebSocketServer** - WebSocket connection management
2. **GameRoomManager** - Manages multiple concurrent games
3. **Matchmaker** - Queues and matches players

### Game Room (`packages/server/src/game/GameRoom.ts`)

Each game match is contained in a GameRoom that orchestrates:

- **ServerGame**: Fixed 30 Hz tick loop
- **ServerGameContext**: Authoritative game state (entities, champions, minions)
- **InputHandler**: Validates and processes player inputs
- **StateSerializer**: Delta compression for bandwidth optimization

### Game Loop (`packages/server/src/game/ServerGame.ts`)

The server runs a fixed 30 Hz game loop (33.3ms per tick):

```typescript
// Simplified game loop
setInterval(() => {
  const dt = 1 / 30; // Fixed timestep

  // 1. Process queued inputs
  inputHandler.processInputs(context);

  // 2. Update all entities
  context.update(dt);

  // 3. Broadcast state to players
  broadcastState(tick);

  tick++;
}, 1000 / 30);
```

### Server Context (`packages/server/src/game/ServerGameContext.ts`)

Manages all game state:

- **Entity Registry**: All entities (champions, minions, towers)
- **Player Mapping**: Player ID → Champion entity mapping
- **Minion Spawning**: Waves every 30 seconds per lane
- **Fog of War**: Visibility calculations per team

## Client Components

### Online Game (`src/core/OnlineGame.ts`)

The client game class for multiplayer:

- Uses **NetworkClient** for server communication
- Creates **OnlineStateManager** to track server state
- Generates **OnlineLevel** for rendering

### State Manager (`src/core/OnlineStateManager.ts`)

Tracks and interpolates server state:

```typescript
interface InterpolatedEntity {
  snapshot: EntitySnapshot;    // Raw server data
  position: Vector;            // Current interpolated position
  previousPosition: Vector;    // For interpolation
  lastUpdateTime: number;      // When last updated
}
```

### Input Handler (`src/core/input/OnlineInputHandler.ts`)

Captures player input and sends to server:

- Right-click → Move command
- Q/W/E/R → Ability cast
- S → Stop
- B → Recall

## Communication Protocol

### Connection Flow

```
1. Client connects to ws://server:8080/ws
2. Client sends READY message with playerId
3. Server adds to matchmaking queue
4. When match found, server sends GAME_START
5. Game loop: Client sends INPUT, Server sends STATE_UPDATE
6. On game end, server sends GAME_END
```

### Message Types

**Client → Server:**
- `INPUT` (0): Movement, abilities, items
- `PING` (1): Latency measurement
- `READY` (2): Join queue with champion selection
- `EVENT_ACK` (3): Acknowledge received events

**Server → Client:**
- `FULL_STATE` (0): Complete snapshot (on connect)
- `STATE_UPDATE` (1): Delta updates (every tick)
- `EVENT` (2): Game events (kills, objectives)
- `PONG` (4): Ping response
- `GAME_START` (5): Match begins
- `GAME_END` (6): Match concludes

## Key Files

| File | Purpose |
|------|---------|
| `packages/server/src/server.ts` | Server entry point |
| `packages/server/src/game/GameRoom.ts` | Match orchestration |
| `packages/server/src/game/ServerGame.ts` | 30 Hz tick loop |
| `packages/server/src/game/ServerGameContext.ts` | Entity management |
| `packages/server/src/network/BunWebSocketServer.ts` | WebSocket server |
| `src/core/OnlineGame.ts` | Client multiplayer game |
| `src/core/OnlineStateManager.ts` | Client state tracking |

## Scalability Considerations

- Each GameRoom runs independently
- GameRoomManager can spawn multiple concurrent games
- State updates use delta compression (60-70% bandwidth reduction)
- Entity prioritization sends nearby entities more frequently
