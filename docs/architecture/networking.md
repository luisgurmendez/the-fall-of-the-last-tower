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
  DEBUG = 4,      // Debug overlay on/off: { enabled } (practice matches, see debug.md)
  LOBBY = 5,      // Something about the player's room (LobbyRequest, see matchmaking.md)
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
  DEBUG_STATE = 7,    // What the server thinks about the units in sight (see debug.md)
  LOBBY_STATE = 8,    // The player's room (LobbyState, see matchmaking.md)
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
  PLACE_WARD = 11,    // Place a ward
  SURRENDER = 12,     // Concede the match
  SUMMONER_SPELL = 13,// Cast a summoner spell (D or F)
  USE_ITEM = 14,      // Use the item in a slot { slot, targetX, targetY } (items.md, Actives)
  EMOTE = 15,         // An emote over the champion
  PRACTICE_TOOL = 16, // A practice tool { tool, x?, y? } (practice matches only; practice.md)
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
  STATE     = 1 << 8,   // dead, recalling; a jungle creature's leash, patience and isReturning
  TRINKET   = 1 << 9,
  GOLD      = 1 << 10,
  SHIELDS   = 1 << 11,
  PASSIVE   = 1 << 12,
  STATS     = 1 << 13,  // champion attack damage, ability power, armor, magic resist, attack and movement speed, attack range
  SCORE     = 1 << 14,  // kills, deaths, assists, creep score
  DASH      = 1 << 15,  // isDashing, dashAbilityId, dashTargetX/Y
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

### Inhibitor Snapshot

```typescript
interface InhibitorSnapshot {
  entityId: string;
  entityType: EntityType.INHIBITOR;
  side: Side;
  lane: 'top' | 'mid' | 'bot';

  x: number;
  y: number;

  health: number;
  maxHealth: number;
  isDestroyed: boolean;
  /** Game time (seconds) it rebuilds at while destroyed, else null */
  respawnAt: number | null;
  /** Can't be damaged yet (its lane still has a tower standing) */
  isProtected?: boolean;
}
```

A destroyed inhibitor stays in the game (it has no `isDead` field, so the serializer never treats it as gone) and rebuilds; see [map.md](map.md).

## Bandwidth Optimization

Measured for one player in a 5v5 practice match (`GameRoom` driven headless, the JSON of each `STATE_UPDATE`):

| Minute | Full snapshot of what they see | The delta sent | Delta per second (30 Hz) | On the wire, compressed |
|---|---|---|---|---|
| 1 | 21 KB | 5.3 KB | ~155 KB/s | ~30 KB/s |
| 5 | 34 KB | 10-11 KB | ~300 KB/s | ~65 KB/s |
| 15 | 32 KB | 8 KB (peaks of 48 KB) | ~240 KB/s | ~50 KB/s |

Most of a delta at minute 5: minions (~5 KB, many and always moving), ability states (~1.9 KB: `cooldownRemaining` changes every tick, so every champion's abilities go out 30 times a second), `entityId`/`entityType`/`side` repeated in every delta (~2.2 KB) and positions with full float precision (~1.7 KB). Those are the places to look if it needs to get smaller.

### WebSocket Compression

The server turns on permessage-deflate (`perMessageDeflate` in `BunWebSocketServer`), which every browser supports: the browser decompresses natively, with nothing to change in the client. Messages of 256 bytes and up are compressed (`COMPRESS_MIN_BYTES`); smaller ones, like `PONG`, go as they are.

It uses Bun's `'shared'` compressor (one for every socket, each message on its own). A 5v5 state update goes about 5x smaller on the wire (measured through a byte-counting proxy: 134 → 25 KB/s in the first minute). Bun's per-socket compressors (`'dedicated'`, `'32KB'`), which keep context across messages, compressed these less (3.6-3.9x) and take memory per socket. Compressing costs the server about 65 µs per message on an M-series Mac: with 10 players at 30 Hz, under 1 ms of each 33 ms tick.

### Delta Compression

`StateSerializer.createDeltaUpdates` keeps the last snapshot sent to each player:

- **New entities** get their full snapshot.
- **Changed entities** get only the changed fields.
- **Entities that left the visible set** get a removal delta. If the entity still exists (it walked into fog or a bush), the delta says `outOfSight: true` and the client drops it quietly. If it's gone from the game (died, destroyed, expired), the delta says `isDead: true, isDestroyed: true` and the client plays its death effects. Minions and monsters are removed from the game in the tick they die, so this removal delta is the only death the client sees.
- **Score and dashes:** kills, deaths, assists and creep score go under `SCORE` when one changes, and the dash state (`isDashing`, its ability and end point) under `DASH`. Before they had bits of their own they only reached clients in full snapshots, so the scoreboard stayed at 0/0/0 and dashes weren't drawn. A champion field that isn't covered by some mask bit never reaches clients in deltas.
- **Projectiles, zones, wards, Lume's orb and inhibitors** have no change tracking of their own: any of their fields that changed is sent under `STATE` (a cleared one as `null`). When an inhibitor falls, its delta has `health: 0`, `isDestroyed: true` and `respawnAt`; when it rebuilds, `health`, `isDestroyed: false` and `respawnAt: null`; `isProtected` when its lane's last tower falls. Before, only their position and health were, so a zone's remaining time never counted down on clients and Lume's orb, destroyed when she dies but kept in the game until it comes back, stayed drawn in its last state.
- **Champion stats** (attack damage, ability power, armor, magic resist, attack and movement speed, attack range, and the health and resource regenerated per second, which change in and out of combat) are sent under `STATS` whenever items, levels, buffs, slows or transforms (Vile's R) change them. The level delta also carries `experienceToNextLevel` for the XP bar.
- **Minion move targets.** Following the lane moves a minion's `targetX/targetY` every tick. They are sent when the minion starts or stops moving, when its attack target changes, or when the target is more than 48 units from the one the client has (`MINION_TARGET_RESEND_DISTANCE`). The client uses them to play the walk animation (a `null` target means standing) and to face the right way.
- **Dead entities.** The client removes an entity from its entity map as soon as a delta marks it dead. A dead champion (allies see theirs) still changes while it waits: its gold, kills and assists (a burn or an ally finishing a kill), its cooldowns and effects. So the serializer keeps sending a dead champion's changed fields, and the client keeps the champion aside (`OnlineStateManager.deadChampions`, merged through the `onAbsentDelta` hook) for the HUD and the Tab scoreboard; other dead entities get nothing until they come back. A champion that respawns gets its full snapshot again, because the client rebuilds it from scratch; with only the changed fields, it came back without its `championId`.
- **Kills reach every scoreboard.** An enemy out of sight sends no deltas, so a `CHAMPION_KILL` event carries `scores`: the new kills, deaths and assists of the victim, the killer and the assistants. The Tab scoreboard shows the higher of those and the champion's last seen line.

### Entity Prioritization (not in use)

`EntityPrioritizer` (`packages/server/src/network/EntityPrioritizer.ts`) can send distant entities less often, but matches don't use it: `GameRoom.broadcastState` sends every visible entity's changes every tick (simpler, and no entities left stale). It would send:

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

...or, instead of 3 and 4, it holds an effect that reveals it to its source's team
(`revealsHolder` on the server's effect definition: Kip's mark, `kip_mark`) and the viewer is
that team: it's sent from the fog and from bushes (a stealthed champion still isn't, rule 1).
The client opens a small window in its own fog around such an enemy (`src/online/markReveal.ts`,
60 units, used by `OnlineFogProvider`), so the fog overlay isn't drawn over it.

Towers, inhibitors and nexuses are always visible. Hidden entities are never serialized for that
team, so a modified client can't reveal them.

The client fog (`src/core/FogOfWar.ts`) uses the same `WallGrid`. Each revealer works out how
far it sees in each of 180 directions before a wall stops it, and only lights cells within
that limit. The fog therefore shows the same shadows behind walls as the server's filtering.
`FogOfWarRenderer` eases each cell's opacity toward its state (0.12 s to clear, 0.3 s to cover),
so cells at the edge of a wall's shadow, which flip as revealers move, don't blink.

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

Events requiring reliable delivery (`shouldSendReliably`):
- Champion kills
- Tower destruction
- Inhibitors destroyed and rebuilt (`INHIBITOR_DESTROYED`, `INHIBITOR_RESPAWNED`)
- Epic monsters slain, camps cleared (`DRAGON_KILLED`, `CAMP_CLEARED`)
- Level ups, the nexus destroyed
- Practice tools used, and which toggles are on (`PRACTICE_TOOLS`; [practice.md](practice.md))

Most events go to every player; `GameRoom` filters the unreliable ones per player with
`reachesSide` (`network/eventAudience.ts`): a `PING` only to its team, an `EMOTE` to its team and
to a side that sees the champion, a `CHAT` message to its team or, sent to all, to both sides (see
[signals.md](signals.md)).

Each reliable event is resent every 10 ticks (up to 10 times) until the client acknowledges it. The client
(`NetworkClient.withoutRepeatedEvents`) passes each event on once: messages arrive in order, so an
event with an `eventId` no higher than the highest seen is a resend and is dropped. When new ones
arrive it sends `EVENT_ACK { lastEventId }`, which `server.ts` routes to
`GameRoom.handleEventAck`. (Before the client acknowledged them and dropped resends, every kill was
announced, sounded and put in the kill feed several times.)

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
| Client Render Rate | The screen's (60-120 Hz) | Positions eased over ~1.2 ticks (infrastructure.md) |
| Playout delay | 20-100 ms | Updates are applied at the pace they were sent, as far behind as the connection's jitter needs (infrastructure.md, `src/core/state/playout.ts`) |
| Input Send Rate | 60 Hz | Responsive input capture |

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

**One socket per player.** `NetworkClient` has one socket at a time: `connect()`
while one is opening waits for it, reconnect attempts follow one another (a failed
attempt's close schedules the next), and a socket it let go of (`disconnect()`)
is ignored, so its late close doesn't cut the new one off. `MatchConnection`
disconnects its previous client before making a new one. If a player's READY
still comes from a second connection (another tab with the same `sessionStorage`,
a socket a reconnect left), the newer one takes the player over
(`packages/server/src/network/playerConnections.ts`): the old one stops getting
state and its inputs are dropped, and the server closes it with
`CONNECTION_REPLACED_CODE` (4000). The client doesn't reconnect on that code
(it would take the player back) and goes to the menu with "This match is open
in another tab or window."

The client keeps the token in `NetworkClient` and `MatchmakingUI` persists it in
`sessionStorage` (in `src/ui/matchmaking/matchConnection.ts`), so rejoining after a
page reload works too.

**CONTINUE.** The server remembers each player's live match, so the menu offers only
**▶ CONTINUE** while there is one (the champion and the match's clock under it).
- **Asking:** the menu asks `GET /api/current-match` on startup, when it's shown again, and when
  the player signs in or out.
- **Answer for an account** (bearer token): its live match wherever it was started
  (`accountMatches` in `server.ts`, set when a match starts). This holds even while another tab
  plays it.
- **Answer for a guest:** the browser's last match (`localStorage["siege-last-match"]`, its player id
  and token, written on GAME_START, sent as `X-Siege-Player` and `X-Siege-Session`), while it's live
  and no connection plays it.
- **Continuing:** the tab takes the match's player id and token (`MatchConnection.adopt`) and sends
  READY with mode `resume`. The reconnect path above sends the match back. A match that ended
  meanwhile answers ERROR `match_over`, and nothing else starts.
- **One match per account:** a READY from an account already in a live match as another player
  gets ERROR `in_match` (the client goes back to the menu, which offers CONTINUE).

The logic is in `packages/server/src/game/currentMatch.ts`, with tests in `CurrentMatch.test.ts`
(server and client). While a player is away for more than 5 s a bot plays their champion
(see [matchmaking.md](matchmaking.md#a-bot-plays-for-who-left)). The server forgets a
player's token when they disconnect while not in a game.
