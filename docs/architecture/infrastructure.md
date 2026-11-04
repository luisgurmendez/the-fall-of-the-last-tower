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
  position: Vector;            // Where it's drawn, eased toward serverPosition
  previousPosition: Vector;    // Where it was drawn when serverPosition arrived
  serverPosition: Vector;      // The server's latest position
  positionTime: number;        // When the easing toward it started
  drawnAt: number;             // When position was last eased
  lastUpdateTime: number;      // When last updated
  animation: EntityAnimationState; // Attack/cast animation from events
}
```

**Playout.** State updates aren't applied as they arrive: over the internet they
come unevenly (one late, then the next ones right behind it, since a WebSocket
keeps them in order), and applied on arrival the units stall and then jump.
`OnlineGame` hands each one to `OnlineStateManager.receiveStateUpdate()`, and
`advance()` applies those whose time has come: each at its tick's time plus a
delay (`src/core/state/playout.ts`). The delay is what the connection needs:
how late 95% of the last 3 s of updates came after the earliest ones, between
20 ms (a steady connection) and `GameConfig.NETWORK.INTERPOLATION_DELAY`
(100 ms); it changes a little at a time (the playout runs up to 10% faster or
slower meanwhile). An update later than that is applied as soon as it arrives.
Whole updates wait, not only positions, so a hit's damage number and a death stay
in step with where the units are drawn. A full state is applied at once and drops
the waiting updates it covers; the updates buffered during the loading screen
are applied at once too (`processStateUpdate`). With more than a second's worth
waiting (no frames run in a hidden tab), the oldest are applied as they arrive.
The debug overlay's DEBUG_STATE (F3) isn't delayed, so it's that much ahead.

Every frame, before drawing, `OnlineStateManager.advance()` eases each entity's
`position` toward the server's latest one over a little more than a tick
(`setServerPosition` and `advanceEntity` in `src/core/state/entities.ts`), from
where it was last drawn, so units and projectiles move every frame instead of in
steps 30 times a second. A step longer than 120 units in one tick (a blink, a
recall, a respawn) is not eased. A new projectile starts drawn at whoever fired
it, a tick back into its flight. Everything that reads `position` (sprites,
health bars, GPU effects, auras) sees the eased one.

`OnlineStateManager` owns the entity map, game time and the local player, and
hands the work to modules in `src/core/state/`:

| Module | Does |
|--------|------|
| `deltas.ts` | Merges full snapshots and entity deltas into the entity map (`null` clears a field, absent means no change) |
| `gameEvents.ts` | Turns game events into animations, ability effects and VFX, hit sparks, floating numbers (only the local champion's: damage it deals or takes, its gold, XP and heals), camp timers and announcements |
| `entityVFX.ts` | Death, respawn, level up and recall VFX from entity deltas |
| `entities.ts` | `InterpolatedEntity`, interpolation and animation queries |
| `playout.ts` | `StatePlayout`: when each state update is applied (the delay the connection needs) |
| `abilityEffects.ts` | Legacy ability effect shapes and colors |
| `floatingNumbers.ts`, `campTimers.ts`, `announcements.ts` | The numbers, camp timers and messages the renderers and HUD read |
| `damageTaken.ts` | Damage the local champion took over the last 10 s, by source, for the death recap (`DeathOverlay`). A DAMAGE event on a champion carries `sourceType`, `sourceChampionId` and `sourceCreatureType`, so a source the client can't see still gets a name |

For each `STATE_UPDATE` it applies the deltas first, then the events, in order.

### Input Handler (`src/core/input/OnlineInputHandler.ts`)

Captures player input and sends to server:

- Right-click → Move command
- Q/W/E/R → Ability cast (as the player's cast mode says)
- S → Stop
- B → Recall

The keys are the player's bindings (defaults shown); see [controls.md](controls.md).

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
- `GAME_END` (6): Match concludes (winning side, length, every champion's final stats)

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
| `src/core/state/` | Delta merging, game event handling and other client state modules |

## Scalability Considerations

- Each GameRoom runs independently
- GameRoomManager can spawn multiple concurrent games
- State updates send only what changed (about a third of a full snapshot in a 5v5), and the WebSocket compresses them (permessage-deflate, about 5x smaller); see [networking.md](networking.md#bandwidth-optimization)
