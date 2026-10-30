# Networking Protocol

This document describes the network protocol, state synchronization, and bandwidth optimization strategies.

## Overview

Siege uses WebSocket for real-time communication between clients and server. The protocol is JSON-based with delta compression for bandwidth efficiency.

## Connection

### Endpoint

```
WebSocket: ws://localhost:8080/ws
Health:    http://localhost:8080/health
```

### Connection Lifecycle

```
1. Client opens WebSocket connection
2. Server assigns connection ID
3. Client sends READY message with player info (and session token, if it has one)
4. On a player's first READY, server sends EVENT `{ event: 'session', sessionToken }`
5. Server adds player to queue or reconnects to game
6. On match: Server sends GAME_START
7. Game loop: Client INPUT → Server STATE_UPDATE
8. On end: Server sends GAME_END
9. Client disconnects
```

## Message Types

### Client → Server

```typescript
enum ClientMessageType {
  INPUT = 0,      // Game inputs (move, ability, etc.)
  PING = 1,       // Latency measurement
  READY = 2,      // Join queue with champion
  EVENT_ACK = 3,  // Acknowledge received events
}
```

### Server → Client

```typescript
enum ServerMessageType {
  FULL_STATE = 0,     // Complete game snapshot
  STATE_UPDATE = 1,   // Delta updates
  EVENT = 2,          // Game events
  ERROR = 3,          // Error messages
  PONG = 4,           // Ping response
  GAME_START = 5,     // Match begins
  GAME_END = 6,       // Match ends
}
```

## Input Messages

### Input Types

```typescript
enum InputType {
  MOVE = 0,           // Move to position
  ATTACK_MOVE = 1,    // Attack-move to position
  TARGET_UNIT = 2,    // Target specific unit
  STOP = 3,           // Stop all actions
  ABILITY = 4,        // Cast ability
  LEVEL_UP = 5,       // Level up ability
  BUY_ITEM = 6,       // Purchase item
  SELL_ITEM = 7,      // Sell item
  RECALL = 8,         // Return to base
  PING = 9,           // Map ping
  CHAT = 10,          // Chat message
}
```

### Input Structure

```typescript
interface ClientInput {
  seq: number;           // Sequence number for acknowledgment
  clientTime: number;    // Client timestamp for lag compensation
  type: InputType;

  // Movement inputs
  targetX?: number;
  targetY?: number;

  // Unit targeting
  targetEntityId?: string;

  // Ability inputs
  slot?: AbilitySlot;
  targetType?: 'none' | 'position' | 'unit';

  // Item inputs
  itemId?: string;

  // Ping inputs
  pingType?: 'alert' | 'missing' | 'assist' | 'on_my_way';

  // Chat
  message?: string;
}
```

### Input Validation

Server validates all inputs:

1. **Payload Shape**: Fields are checked per input type (finite numbers for coordinates,
   `Q/W/E/R` slots, known ward types, string IDs). Malformed inputs are rejected with
   `invalid_payload` before they reach the simulation
2. **Rate Limiting**: Max inputs per second per type
3. **Range Checks**: Target within ability range
4. **Resource Checks**: Sufficient mana
5. **Cooldown Checks**: Ability ready
6. **State Checks**: Not stunned/silenced

```typescript
// Rate limits per input type
const RATE_LIMITS = {
  MOVE: 20,        // 20 move commands/second
  ABILITY: 8,      // 8 ability casts/second
  ITEM_PURCHASE: 5,
  PING: 5,
};
```

## State Updates

### Full State Snapshot

Sent on initial connection or reconnection:

```typescript
interface FullStateSnapshot {
  tick: number;           // Server tick
  timestamp: number;      // Server time
  gameTime: number;       // Game elapsed time
  entities: EntitySnapshot[];  // All visible entities
  events: GameEvent[];    // Recent events
}
```

### Delta State Update

Sent every tick (30 Hz):

```typescript
interface StateUpdate {
  tick: number;
  timestamp: number;
  gameTime: number;
  inputAcks: Record<string, number>;  // Last acked input per player
  deltas: EntityDelta[];              // Changed entities
  events: GameEvent[];                // New events
  lastEventId?: number;               // For reliable delivery
}
```

### Entity Delta

Only changed fields are sent:

```typescript
interface EntityDelta {
  entityId: string;
  changeMask: number;         // Bitmask of changed fields
  data: Partial<EntitySnapshot>;
}
```

### Change Mask

Bitmask indicating which fields changed:

```typescript
enum EntityChangeMask {
  POSITION  = 1 << 0,   // x, y
  HEALTH    = 1 << 1,   // health, maxHealth
  RESOURCE  = 1 << 2,   // mana/energy
  LEVEL     = 1 << 3,   // champion level
  EFFECTS   = 1 << 4,   // active buffs/debuffs
  ABILITIES = 1 << 5,   // cooldowns, ranks
  ITEMS     = 1 << 6,   // inventory
  TARGET    = 1 << 7,   // current target
  STATE     = 1 << 8,   // dead, recalling
}
```

## Entity Snapshots

### Champion Snapshot

```typescript
interface ChampionSnapshot {
  entityId: string;
  entityType: EntityType.CHAMPION;
  side: number;
  championId: string;
  playerId: string;

  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  targetEntityId?: string;

  health: number;
  maxHealth: number;
  resource: number;
  maxResource: number;
  level: number;
  experience: number;

  attackDamage: number;
  abilityPower: number;
  armor: number;
  magicResist: number;
  attackSpeed: number;
  movementSpeed: number;

  isDead: boolean;
  respawnTimer: number;
  isRecalling: boolean;
  recallProgress: number;

  abilities: Record<AbilitySlot, AbilityState>;
  activeEffects: ActiveEffectState[];
  items: ItemState[];
  gold: number;

  kills: number;
  deaths: number;
  assists: number;
  cs: number;
}
```

### Minion Snapshot

```typescript
interface MinionSnapshot {
  entityId: string;
  entityType: EntityType.MINION;
  side: number;
  minionType: MinionType;

  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  targetEntityId?: string;

  health: number;
  maxHealth: number;
  isDead: boolean;
}
```

### Tower Snapshot

```typescript
interface TowerSnapshot {
  entityId: string;
  entityType: EntityType.TOWER;
  side: number;
  lane: LaneId;
  tier: TowerTier;

  x: number;
  y: number;

  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  targetEntityId?: string;
}
```

## Bandwidth Optimization

### Delta Compression

Only send changed fields (60-70% reduction):

```typescript
// Instead of full snapshot every tick...
// Old: 80 bytes per champion × 10 champions = 800 bytes

// With delta compression:
// Typical: 15 bytes per champion (only position)
// Result: ~150 bytes per tick
```

### Entity Prioritization

Nearby entities update more frequently:

```typescript
class EntityPrioritizer {
  prioritizeEntities(
    entities: ServerEntity[],
    playerChampion: ServerChampion,
    playerId: string,
    tick: number
  ): ServerEntity[] {
    // High priority: Always send
    // - Local champion
    // - Enemies within 1000 units
    // - Entities attacking player

    // Medium priority: Every 2 ticks
    // - Allies
    // - Entities 1000-2000 units away

    // Low priority: Every 5 ticks
    // - Distant entities
    // - Neutral camps
  }
}
```

### Fog of War Filtering

Only send visible entities:

```typescript
getVisibleEntities(forSide: Side): ServerEntity[] {
  return this.fogOfWar.getVisibleEntities(this, forSide);
}
```

An enemy entity is sent only if all of these hold (see `FogOfWarServer.calculateVisibility`):

1. It is not a stealthed champion (e.g. Vex's Shadow Shroud)
2. Its own `isVisibleTo(side)` allows it, if it defines one. Stealth wards stay hidden
   unless an enemy control ward reveals them, and stealthed traps stay hidden
3. It is not hidden in a bush the viewer has no vision in
4. It is within sight range of one of the viewer's vision sources, and no wall blocks the
   line between them (`WallGrid.hasLineOfSight`, shared with the client)

Towers and nexuses are always visible. Hidden entities are never serialized for that
team, so a modified client can't reveal them.

The client fog (`src/core/FogOfWar.ts`) uses the same `WallGrid`. Each revealer works out how
far it sees in each of 180 directions before a wall stops it, and only lights cells within
that limit. The fog therefore shows the same shadows behind walls as the server's filtering.

### Joining a match: full state, then buffered deltas

At `GAME_START` the server sends a `FULL_STATE` and starts streaming `STATE_UPDATE` deltas. The client shows a loading screen before `OnlineGame` exists, so `MatchmakingUI` buffers both the full state and the deltas that arrive meanwhile (in `MatchConnection`, `src/ui/matchmaking/matchConnection.ts`). A new full state clears the delta buffer. When the game starts, it applies the full state and then replays the buffered deltas in order. The server assumes every delta was applied, so a change made during loading that never changes again (for example `isProtected` on towers) would otherwise never reach the client.

## Reliable Event Delivery

Important events use sequence IDs and acknowledgment:

```typescript
class ReliableEventQueue {
  // Queue events for all players
  queueEventForAll(playerIds: string[], event: GameEvent, tick: number);

  // Get events to send (new + retries)
  getEventsToSend(playerId: string, tick: number): GameEvent[];

  // Mark events as received
  acknowledgeEvents(playerId: string, lastEventId: number);
}
```

Events requiring reliable delivery:
- Champion kills
- Tower destruction
- Objective captures
- Game end

## Latency Measurement

### Ping/Pong

```typescript
// Client sends
{ type: ClientMessageType.PING, data: { timestamp: Date.now() } }

// Server responds
{
  type: ServerMessageType.PONG,
  data: {
    clientTimestamp: originalTimestamp,
    serverTimestamp: Date.now()
  }
}

// Client calculates
latency = Date.now() - clientTimestamp;
```

### Heartbeat

Ping sent every 5 seconds to maintain connection and measure latency.

## Game Tick Timing

| Parameter | Value | Description |
|-----------|-------|-------------|
| Server Tick Rate | 30 Hz | 33.3ms per tick |
| Snapshot Rate | 30 Hz | State sent every tick |
| Client Render Rate | 60 Hz | Smooth via interpolation |
| Input Send Rate | 60 Hz | Responsive input capture |
| Interpolation Delay | 100ms | 3 snapshots buffered |

## Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/network.ts` | Message type definitions |
| `packages/server/src/network/BunWebSocketServer.ts` | WebSocket server |
| `packages/server/src/network/StateSerializer.ts` | Delta compression |
| `packages/server/src/network/EntityPrioritizer.ts` | Bandwidth optimization |
| `packages/server/src/network/ReliableEventQueue.ts` | Reliable delivery |
| `packages/server/src/network/InputHandler.ts` | Input validation |
| `packages/client/src/network/NetworkClient.ts` | Client networking |
| `src/core/OnlineStateManager.ts` | Client state: applies full state, deltas and events |
| `src/core/state/deltas.ts` | Client: merges snapshots and deltas into the entity map |
| `src/core/state/gameEvents.ts` | Client: turns game events into effects |

## Error Handling

### Connection Errors

```typescript
// Server sends error
{
  type: ServerMessageType.ERROR,
  data: { error: 'Invalid input: ability on cooldown' }
}
```

### Reconnection

1. Client detects disconnect
2. Attempt reconnect (up to 5 times, 2s delay)
3. Send READY message with the session token
4. Server checks the token (player IDs are public, so the token proves ownership).
   A wrong or missing token gets ERROR `invalid_session`
5. Server checks for active game
6. If in game: Send FULL_STATE snapshot
7. Resume game with current state

The client keeps the token in `NetworkClient` and `MatchmakingUI` persists it in
`sessionStorage` (in `src/ui/matchmaking/matchConnection.ts`), so rejoining after a
page reload works too. The server forgets a
player's token when they disconnect while not in a game.
