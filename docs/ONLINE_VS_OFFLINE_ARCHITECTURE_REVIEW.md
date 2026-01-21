# Architectural Review: Online vs Offline Game Modes

> **Date:** January 2025
> **Status:** Analysis Only (No Code Changes)
> **Author:** Architecture Review

## Executive Summary

The Siege codebase has evolved from a single-player tower defense game into a multiplayer MOBA with both offline (local simulation) and online (server-authoritative) modes. While functional, the current architecture exhibits **significant code duplication** between client and server, with approximately 60-70% of simulation logic existing in two separate implementations.

**Key Finding:** The offline and online modes were built as parallel systems rather than a unified architecture with different backends. This creates maintenance burden and risk of behavioral divergence.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Game Loop Comparison](#2-core-game-loop-comparison)
3. [Level Generation Systems](#3-level-generation-systems)
4. [Entity Systems - The Duplication Problem](#4-entity-systems---the-duplication-problem)
5. [State Management](#5-state-management)
6. [Input Handling](#6-input-handling)
7. [Rendering Systems](#7-rendering-systems)
8. [UI Components](#8-ui-components)
9. [Shared Package Analysis](#9-shared-package-analysis)
10. [Identified Issues](#10-identified-issues)
11. [Advantages of Current Architecture](#11-advantages-of-current-architecture)
12. [Disadvantages of Current Architecture](#12-disadvantages-of-current-architecture)
13. [Recommendations](#13-recommendations)

---

## 1. Architecture Overview

### Offline Mode (Local Simulation)
```
┌─────────────────────────────────────────────────────────┐
│                      Game.ts                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Clock     │  │InputManager │  │  RenderController│ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│                         │                               │
│                    ┌────▼────┐                          │
│                    │  Level  │ (mobaLevel.ts)           │
│                    └────┬────┘                          │
│        ┌───────────────┼───────────────┐               │
│   ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐        │
│   │Champion │    │   Minion  │   │   Tower   │        │
│   │(full sim)│   │(full sim) │   │(full sim) │        │
│   └─────────┘    └───────────┘   └───────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Online Mode (Server-Authoritative)
```
┌─────────────────────────────────────────────────────────┐
│                   OnlineGame.ts                         │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │   Clock     │  │InputManager │  │ NetworkClient  │  │
│  └─────────────┘  └─────────────┘  └───────┬────────┘  │
│                                            │            │
│                    ┌───────────────────────▼──────┐    │
│                    │    OnlineStateManager        │    │
│                    └───────────────┬──────────────┘    │
│                                    │                    │
│                    ┌───────────────▼──────────────┐    │
│                    │      EntityRenderer          │    │
│                    │   (renders snapshots)        │    │
│                    └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
          │
          │ WebSocket
          ▼
┌─────────────────────────────────────────────────────────┐
│                   Server (Bun)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐  │
│  │ GameRoom    │  │ Matchmaker  │  │ WebSocketServer│  │
│  └──────┬──────┘  └─────────────┘  └────────────────┘  │
│         │                                               │
│    ┌────▼────┐                                          │
│    │ServerGame│                                         │
│    └────┬────┘                                          │
│    ┌────▼─────────────────────────────┐                │
│    │     ServerChampion/Entities      │                │
│    │        (full simulation)         │                │
│    └──────────────────────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Core Game Loop Comparison

### Offline: `src/core/game.ts`

```typescript
// Simplified structure
class Game {
  private clock: Clock;
  private inputManager: InputManager;
  private level: Level;

  loop() {
    const api = this.generateGameApi();
    this.level.update(api);  // Full simulation
    requestAnimationFrame(() => this.loop());
  }
}
```

**Characteristics:**
- Full simulation runs client-side
- Supports pause/unpause
- Supports game speed (0.1x - 3x)
- All entity logic executes locally

### Online: `src/core/OnlineGame.ts`

```typescript
// Simplified structure
class OnlineGame {
  private clock: Clock;
  private inputManager: InputManager;
  private networkClient: NetworkClient;
  private stateManager: OnlineStateManager;
  private level: Level;

  loop() {
    const api = this.generateGameApi();
    this.level.update(api);  // Render-only, no simulation
    requestAnimationFrame(() => this.loop());
  }
}
```

**Characteristics:**
- Client only renders server state
- No pause (real-time multiplayer)
- Network client sends inputs, receives state
- Interpolation for smooth rendering

### Duplication Analysis

| Component | Game.ts | OnlineGame.ts | Duplicated? |
|-----------|---------|---------------|-------------|
| Canvas initialization | Yes | Yes | **~100%** |
| Clock creation | Yes | Yes | **~100%** |
| InputManager setup | Yes | Yes | **~100%** |
| Window event listeners | Yes | Yes | **~80%** |
| GameApi generation | Yes | Yes | **~90%** |
| Main loop structure | Yes | Yes | **~70%** |
| **Total Overlap** | | | **~50%** |

---

## 3. Level Generation Systems

### Offline: `src/levels/mobaLevel.ts`

Creates a fully simulated MOBA level:
- Player champion (actual Champion object with full logic)
- Enemy champion (AI-controlled)
- MOBAMap (nexuses, towers, lanes, jungle camps)
- ChampionController (handles player input directly)
- Fog of War (local calculation)
- Minion wave spawning (local timers)

### Online: `src/levels/onlineLevel.ts`

Creates a render-only level:
- MOBAMap with `renderOnly: true`
- EntityRenderer (reads from OnlineStateManager)
- OnlineInputHandler (sends commands to server)
- OnlineChampionAdapter (wraps snapshots for HUD)
- OnlineFogProvider (reads visibility from server)
- OnlineCameraController (follows networked position)

### Key Difference

```typescript
// Offline: Objects with full simulation
const champion = new Lyra(position, side);
champion.step(context);  // Updates position, health, abilities
champion.render(context); // Draws itself

// Online: Data snapshots rendered externally
const snapshot = stateManager.getEntity(entityId);
entityRenderer.renderChampion(snapshot); // Just draws data
```

### Adapter Pattern Required

Online mode requires adapters to bridge data snapshots to UI components:

```
ChampionSnapshot (data)
    → OnlineChampionAdapter
        → ChampionHUD (expects Champion-like interface)
```

**Adapters created:**
- `OnlineChampionAdapter` - Wraps ChampionSnapshot
- `OnlineAbilityAdapter` - Wraps AbilityState
- `OnlineTrinketAdapter` - Wraps trinket state
- `OnlineInventoryAdapter` - Wraps item states

---

## 4. Entity Systems - The Duplication Problem

This is the **most significant architectural issue** in the codebase.

### Client-Side Champion: `src/champions/Champion.ts`

**~1,960 lines** containing:
- Position, velocity, physics
- Health, mana, shields
- Damage calculation with armor/magic resist
- Abilities (Q, W, E, R) with cooldowns
- Effects/buffs/debuffs system
- Item inventory with passives
- Experience/leveling
- Movement and pathfinding
- Attack AI with targeting
- Collision detection

**Plus 7 champion implementations** (Lyra, Uruk, Elara, Magnus, etc.)

### Server-Side Champion: `packages/server/src/simulation/ServerChampion.ts`

**Same responsibilities**, different implementation:
- Health, mana, shields
- Damage calculation
- Abilities and cooldowns
- Effects and crowd control
- Items and stats
- No rendering (server has no visuals)

### Duplication Matrix

| System | Client Location | Server Location | % Duplicated |
|--------|-----------------|-----------------|--------------|
| Damage Calculation | `Champion.takeDamage()` | `ServerChampion.takeDamage()` | **~100%** |
| Stat Calculation | `Champion.getStats()` | `ServerChampion.calculateStat()` | **~100%** |
| Ability Cooldowns | `Ability.update()` | `AbilityState` tracking | **~80%** |
| Effect Processing | `Champion.applyEffect()` | ServerChampion effects | **~90%** |
| Item Systems | `purchaseItem()` | Server item handling | **~85%** |
| Resource Management | `consumeResource()` | Server tracking | **~100%** |
| CC Status | `getCrowdControlStatus()` | `computeCCStatus()` | **~95%** |

### Why This Matters

Both client and server need **identical math** for:

```typescript
// Damage formula - exists in BOTH places
const effectiveArmor = armor * (1 - armorPen);
const damageMultiplier = 100 / (100 + effectiveArmor);
const finalDamage = rawDamage * damageMultiplier;

// Stat scaling - exists in BOTH places
const stat = baseStat + (growthPerLevel * (level - 1));

// Effect stacking - exists in BOTH places
if (effect.stackBehavior === 'refresh') {
  existingEffect.duration = effect.duration;
} else if (effect.stackBehavior === 'stack') {
  existingEffect.stacks += 1;
}
```

**Risk:** Bug fixes must be applied to both implementations. If they diverge, client prediction won't match server reality.

---

## 5. State Management

### Offline: `src/core/gameContext.ts`

```typescript
class GameContext {
  readonly objects: GameObject[];      // All game entities
  readonly collisions: Collisions;     // Collision data
  readonly spatialHashing: SpatiallyHashedObjects;
  readonly fogOfWar?: FogOfWar;
  readonly navigationGrid?: NavigationGrid;
  // Passed to all step/render methods
}
```

- State lives in game objects themselves
- GameContext is immutable per-frame view
- Perfect consistency (no network delay)

### Online: `src/core/OnlineStateManager.ts`

```typescript
class OnlineStateManager {
  private entities: Map<string, InterpolatedEntity>;

  processStateUpdate(update: StateUpdate) {
    for (const delta of update.deltas) {
      this.processDelta(delta);
    }
  }

  getInterpolatedPosition(entityId: string): Vector {
    // Interpolate between last two server positions
    const t = timeSinceUpdate / interpolationDelay;
    return Vector.lerp(previous, current, t);
  }
}
```

- Server sends `StateUpdate` with delta compression
- Client interpolates between server ticks
- ~100ms interpolation delay for smooth animation
- User sees slightly old state (latency)

### State Flow Comparison

```
OFFLINE:
  User Input → Champion.step() → Immediate State Change → Render

ONLINE:
  User Input → NetworkClient → Server (50ms) → Process →
  StateUpdate → Client (50ms) → Interpolate → Render

  Total latency: 100-200ms before user sees result
```

---

## 6. Input Handling

### Offline: `src/objects/player/player.ts`

```typescript
class Player {
  step(context: GameContext) {
    if (this.inputManager.isMouseButtonJustPressed(2)) {
      // Right click - move or attack
      this.champion.moveTo(worldPos);
    }
    if (this.inputManager.isKeyJustPressed('q')) {
      // Q ability
      this.champion.castAbility('Q', target);
    }
  }
}
```

- Reads InputManager directly
- Commands apply immediately to local champion
- No validation needed (single-player)

### Online: `src/core/input/OnlineInputHandler.ts`

```typescript
class OnlineInputHandler {
  step(context: GameContext) {
    if (this.inputManager.isMouseButtonJustPressed(2)) {
      // Right click - send move command to server
      this.networkClient.sendMoveInput(worldX, worldY);
    }
    if (this.inputManager.isKeyJustPressed('q')) {
      // Q ability - send to server
      this.networkClient.sendAbilityInput('Q', targetType, targetX, targetY);
    }
  }
}
```

- Reads same InputManager
- Sends commands to server instead of applying locally
- Server validates and executes

### Duplication

Both classes:
- Read from InputManager
- Check same key bindings
- Convert screen to world coordinates
- Handle same command types

**~30% code overlap** in input reading logic.

---

## 7. Rendering Systems

### Offline Rendering

Each entity renders itself:

```typescript
class Champion {
  render(context: GameContext) {
    this.spriteAnimator.render(ctx, this.position);
    this.renderHealthBar(ctx);
    this.renderStatusEffects(ctx);
  }
}
```

- RenderController iterates objects, calls `render()`
- Animation state lives in object
- Camera transforms applied globally

### Online Rendering

EntityRenderer renders all snapshots:

```typescript
class EntityRenderer {
  render(context: GameContext) {
    for (const entity of this.stateManager.getAllEntities()) {
      switch (entity.snapshot.entityType) {
        case EntityType.CHAMPION:
          this.renderChampion(entity);
          break;
        case EntityType.MINION:
          this.renderMinion(entity);
          break;
        // ...
      }
    }
  }
}
```

- Single renderer handles all entity types
- Reads position from interpolated state
- Manages own animation state (client-side)
- Sprite cache for loaded images

### Rendering Comparison

| Aspect | Offline | Online |
|--------|---------|--------|
| Data Source | Object properties | Snapshots from StateManager |
| Animation State | Part of object | Client-side in renderer |
| Facing Direction | `champion.direction` | Inferred from movement |
| Health Display | `champion.health` | `snapshot.health` |
| Who Renders | Each object renders self | Central EntityRenderer |

---

## 8. UI Components

### ChampionHUD (Shared Successfully)

`src/ui/ChampionHUD.ts` works in both modes through interface compliance:

```typescript
interface HUDChampionData {
  getStats(): ChampionStats;
  getCurrentHealth(): number;
  getCurrentResource(): number;
  getAbility(slot: AbilitySlot): HUDAbility;
  getInventory(): ChampionInventory;
  getTrinket(): HUDTrinket | null;
  getBuffs(): StatModifier[];
}
```

- **Offline:** `Champion` class implements this directly
- **Online:** `OnlineChampionAdapter` wraps `ChampionSnapshot`

**This is a good pattern** - single UI component, multiple data sources.

### Components With Dual Implementations

| Component | Offline | Online | Why Separate? |
|-----------|---------|--------|---------------|
| Minimap | `Minimap.ts` | `OnlineMinimap.ts` | Different data source |
| Camera | `Camera.ts` | `OnlineCameraController.ts` | Different position source |
| Input | `Player.ts` | `OnlineInputHandler.ts` | Local vs network commands |
| Fog of War | `FogOfWar.ts` | `OnlineFogProvider.ts` | Different visibility source |

---

## 9. Shared Package Analysis

### `packages/shared/src/`

#### What IS Shared (Good)

**Type Definitions:**
```typescript
// Shared between client and server
export interface ChampionSnapshot { ... }
export interface StateUpdate { ... }
export interface InputMessage { ... }
export type AbilitySlot = 'Q' | 'W' | 'E' | 'R';
```

**Configuration:**
```typescript
export const MOBAConfig = {
  MAP_SIZE: { width: 3200, height: 3200 },
  TICK_RATE: 30,
  // ...
};
```

**Utility Functions:**
```typescript
export function calculateStat(base, growth, level) { ... }
export function calculatePhysicalDamage(damage, armor) { ... }
```

**Champion/Ability Definitions:**
```typescript
export const CHAMPION_DEFINITIONS = { warrior, magnus, elara, ... };
export const ABILITY_DEFINITIONS = { warrior_slash, magnus_fireball, ... };
```

#### What's NOT Shared (Problem)

**Damage Calculation Logic:**
- Client: `Champion.takeDamage()` - 50+ lines
- Server: `ServerChampion.takeDamage()` - 50+ lines
- Only final formula is shared, not the full logic

**Effect Processing:**
- Client: `Champion.applyEffect()` with stacking logic
- Server: Separate effect handling
- Completely separate implementations

**Ability Execution:**
- Client: `Ability.cast()` implementations per champion
- Server: `ServerAbilityExecutor` handles all abilities
- No shared execution logic

**Item Systems:**
- Client: Full item purchase/sell/passive logic
- Server: Duplicate item handling
- No shared code

---

## 10. Identified Issues

### Issue #1: Massive Simulation Duplication

**Location:**
- `src/champions/Champion.ts` (~2,000 lines)
- `packages/server/src/simulation/ServerChampion.ts`

**Problem:** All damage, effect, ability, and item logic exists twice.

**Impact:**
- Bug fixes must be applied to both
- Risk of behavioral divergence
- Double maintenance burden

**Severity:** HIGH

---

### Issue #2: Game Loop Duplication

**Location:**
- `src/core/game.ts`
- `src/core/OnlineGame.ts`

**Problem:** ~50% structural overlap (canvas setup, clock, input manager, window listeners).

**Impact:** Changes to core loop require editing two files.

**Severity:** MEDIUM

---

### Issue #3: Input Handler Duplication

**Location:**
- `src/objects/player/player.ts`
- `src/core/input/OnlineInputHandler.ts`

**Problem:** Same key bindings, coordinate conversion, command types in both.

**Impact:** Control scheme changes require two edits.

**Severity:** MEDIUM

---

### Issue #4: Adapter Object Creation Overhead

**Location:** `src/online/OnlineChampionAdapter.ts`

**Problem:** Creates multiple adapter objects potentially every frame.

**Impact:** GC pressure, runtime overhead.

**Severity:** LOW (but could become medium at scale)

---

### Issue #5: No Formal Interface Contracts

**Problem:** HUD expects "Champion-like" object but no formal TypeScript interface enforces this.

**Impact:** Easy to break HUD compatibility accidentally.

**Severity:** LOW

---

### Issue #6: Dual Minimap/Camera/Fog Implementations

**Location:** Multiple files for each system (offline vs online versions).

**Problem:** Similar visual output, completely separate code.

**Impact:** Visual consistency issues, double maintenance.

**Severity:** MEDIUM

---

## 11. Advantages of Current Architecture

### Clear Separation of Concerns
- Server handles authoritative simulation
- Client handles rendering and input
- Network protocol is well-defined

### Type Safety
- Shared types ensure client/server agreement on data shapes
- TypeScript catches many issues at compile time

### Working Adapter Pattern
- ChampionHUD reuse through adapters works well
- Single UI component serves both modes

### Flexible Offline Mode
- Can test/develop without server
- Full simulation locally useful for debugging
- Supports pause and speed control

### Clean Network Protocol
- Delta compression reduces bandwidth
- Clear message types
- Proper reconnection handling

---

## 12. Disadvantages of Current Architecture

### Massive Code Duplication
- ~60-70% of simulation logic exists twice
- Champions, abilities, effects, items all duplicated
- Very high maintenance burden

### Divergence Risk
- Client and server implementations can drift
- Client prediction may not match server
- Bugs could manifest differently in each mode

### No Shared Simulation Engine
- Can't run "headless" games on client for testing
- Can't replay server games on client
- No deterministic simulation guarantee

### Adapter Complexity
- Multiple adapter classes for online mode
- Translation layer adds cognitive overhead
- Potential for adapter bugs

### Testing Difficulty
- Can't easily compare offline vs online behavior
- No automated parity testing
- Manual QA required for both modes

### Performance Concerns
- Online mode creates many short-lived objects
- No object pooling for adapters/snapshots
- Could cause GC pauses at scale

---

## 13. Recommendations

### Short-Term (Low Risk)

1. **Extract Common Game Initialization**
   - Create shared factory for canvas, clock, input setup
   - Both Game and OnlineGame use it

2. **Formalize Champion Interface**
   - Create `IChampionData` interface
   - Both Champion and OnlineChampionAdapter implement it
   - TypeScript enforces HUD compatibility

3. **Consolidate Input Reading**
   - Extract key binding definitions to shared config
   - Share coordinate conversion utilities

### Medium-Term (Medium Risk)

4. **Extract Simulation Logic to Shared Package**
   - Move damage calculation to `@siege/shared`
   - Move effect processing logic to shared
   - Both client and server import and use

5. **Unify Entity Rendering**
   - Create renderer that works with both local objects and snapshots
   - Single rendering path, different data sources

6. **Add Parity Tests**
   - Automated tests comparing offline vs online behavior
   - Catch divergence early

### Long-Term (High Risk)

7. **Shared Simulation Engine**
   - Single simulation implementation in `@siege/shared`
   - Server runs it authoritatively
   - Client runs it for prediction
   - Guaranteed identical behavior

8. **Deterministic Replay System**
   - Server sends input log instead of state
   - Client replays inputs locally
   - Perfect visual consistency

9. **Entity Component System**
   - Formal ECS architecture
   - Components shared between client/server
   - Systems can be selectively included

---

## Conclusion

The current architecture successfully delivers both offline and online gameplay, but at the cost of significant code duplication. The **biggest risk** is behavioral divergence between client and server implementations during ongoing development.

**Priority Actions:**
1. Extract damage/stat calculation to shared package
2. Create formal interfaces for UI compatibility
3. Add automated parity testing

The adapter pattern for UI reuse is a good model that should be extended. The long-term goal should be a shared simulation engine that both client and server use, eliminating the duplication problem entirely.

---

## Appendix: File Inventory

### Core Systems
| File | Mode | Purpose |
|------|------|---------|
| `src/core/game.ts` | Offline | Main game loop |
| `src/core/OnlineGame.ts` | Online | Network game loop |
| `src/core/gameContext.ts` | Offline | Per-frame state |
| `src/core/OnlineStateManager.ts` | Online | Network state |

### Levels
| File | Mode | Purpose |
|------|------|---------|
| `src/levels/mobaLevel.ts` | Offline | Full simulation level |
| `src/levels/onlineLevel.ts` | Online | Render-only level |

### Champions
| File | Mode | Purpose |
|------|------|---------|
| `src/champions/Champion.ts` | Offline | Base champion class |
| `src/champions/implementations/*` | Offline | Specific champions |
| `packages/server/src/simulation/ServerChampion.ts` | Server | Server champion |

### Adapters
| File | Mode | Purpose |
|------|------|---------|
| `src/online/OnlineChampionAdapter.ts` | Online | Snapshot → HUD |
| `src/online/OnlineFogProvider.ts` | Online | Server visibility |

### Rendering
| File | Mode | Purpose |
|------|------|---------|
| `src/render/EntityRenderer.ts` | Online | Renders snapshots |
| `src/champions/Champion.render()` | Offline | Self-rendering |

### Shared
| File | Consumers | Purpose |
|------|-----------|---------|
| `packages/shared/src/types/*` | All | Type definitions |
| `packages/shared/src/config/*` | All | Configuration |
| `packages/shared/src/champions/*` | All | Champion definitions |
| `packages/shared/src/abilities/*` | All | Ability definitions |
