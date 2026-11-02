# Siege - Codebase Documentation

## Overview

Siege is a **multiplayer MOBA** (Multiplayer Online Battle Arena) game. The game features server-authoritative networking, champion-based combat, and classic MOBA mechanics like lanes, minions, and towers.

> **Note**: This project was originally built for the js13kb game contest as a tower defense game. The legacy tower defense code and offline single-player mode have been **removed**. The game is now **online-only** with server-authoritative gameplay.

> **Name**: players see the game as **Wildcrown** (`src/config/brand.ts`: the logo, the browser tab). "Siege" is only the codebase's name (packages, `@siege/shared`, storage keys).

> **Maps**: `packages/shared/src/config/maps.ts` lists them: Wildcrown Vale (5v5, the jungle) and The Narrows (one lane, 1v1, the practice chip's ARAM). The server builds each match on its map (`ServerGameContext.mapConfig`: read the map from there, never from the global `MOBAConfig`, in server code); a client calls `useMap()` when a match is found, which swaps the map into `MOBAConfig`. See [docs/architecture/map.md](docs/architecture/map.md#maps).

---

## IMPORTANT: Use `null` for Clearable Values (Not `undefined`)

> **Pattern for Delta Updates**
>
> When a property can be "cleared" (e.g., movement target when a champion stops), use `null` instead of `undefined`:
>
> ```typescript
> // In snapshot types (packages/shared/src/types/network.ts):
> targetX?: number | null;  // Can be cleared
> targetY?: number | null;  // Can be cleared
> targetEntityId?: string | null;  // Can be cleared
>
> // In server toSnapshot() methods:
> targetX: this.targetPosition?.x ?? null,  // Send null when cleared
> targetEntityId: this.targetEntityId,       // Already null, don't convert
>
> // In client code, check with != null:
> const hasMoveTarget = moveTargetX != null && moveTargetY != null;
> ```
>
> **Why this matters:**
> - JavaScript spread operator `{ ...a, ...b }` does NOT copy properties with `undefined` values
> - This causes stale values to persist in delta updates
> - `null` is explicitly copied by spread and JSON serialization
>
> **Semantic meaning:**
> - `null` = "this value has been explicitly cleared"
> - Property absent in delta = "no change to this value"
> - `undefined` = ambiguous, avoid for clearable state
>
> **Affected properties:**
> - `targetX`, `targetY` - movement targets
> - `targetEntityId` - attack/focus targets
> - Any state that transitions between "has value" and "no value"

---

## MOBA Architecture Documentation

> **IMPORTANT: Keep documentation up to date!**
> When modifying any of the systems below, update the corresponding documentation file.
> This ensures the docs remain accurate and useful for future development.

For detailed documentation on the multiplayer MOBA systems, see the following files:

| Topic | Documentation File | Description |
|-------|-------------------|-------------|
| **Infrastructure** | [docs/architecture/infrastructure.md](docs/architecture/infrastructure.md) | Server-client architecture, game loop, WebSocket communication |
| **Networking** | [docs/architecture/networking.md](docs/architecture/networking.md) | Network protocol, state synchronization, delta compression |
| **Matchmaking** | [docs/architecture/matchmaking.md](docs/architecture/matchmaking.md) | Player queue, match creation, team assignment |
| **Champions** | [docs/architecture/champions.md](docs/architecture/champions.md) | Champion classes, stats, leveling, damage calculation |
| **Abilities** | [docs/architecture/abilities.md](docs/architecture/abilities.md) | Ability system, targeting, cooldowns, scaling |
| **Effects & Buffs** | [docs/architecture/effects-and-buffs.md](docs/architecture/effects-and-buffs.md) | Buff/debuff system, crowd control, stat modifiers |
| **Collision** | [docs/architecture/collision.md](docs/architecture/collision.md) | Unit collision detection, separation, spatial grid |
| **VFX** | [docs/architecture/vfx.md](docs/architecture/vfx.md) | Visual effects system, particles, ability VFX |
| **Map & Terrain** | [docs/architecture/map.md](docs/architecture/map.md) | The maps, layout, walls, river, pathfinding, wall collision |
| **Jungle** | [docs/architecture/jungle.md](docs/architecture/jungle.md) | Camps, neutral monster AI, buffs, dragon, camp timers |
| **Lanes & Minions** | [docs/architecture/minions.md](docs/architecture/minions.md) | Waves, lane following, minion targeting and call for help |
| **Items & Shop** | [docs/architecture/items.md](docs/architecture/items.md) | Item catalog, shop UI, item icons (PixelLab) |
| **Simulation** | [docs/architecture/simulation.md](docs/architecture/simulation.md) | Headless scenarios, bots, PNG frames, HTTP sandbox for agents |
| **Summoner Spells** | [docs/architecture/summoner-spells.md](docs/architecture/summoner-spells.md) | The D/F spells: picks, casting, HUD, icons and VFX |
| **Audio** | [docs/architecture/audio.md](docs/architecture/audio.md) | Sound effects and ambience: generation (ElevenLabs), the engine, heard from the camera |
| **Debug mode** | [docs/architecture/debug.md](docs/architecture/debug.md) | F3 in practice: what the server thinks about each unit (paths, targets, ranges, states, bots' decisions) |

### Quick Reference

**Server packages:**
- `packages/server/` - Authoritative game server (Bun runtime); `src/bots/` practice bots, `src/sim/` headless simulation, `src/navigation/` terrain and pathfinding, `scenarios/` simulation scenarios
- `packages/shared/` - Shared types and configuration
- `packages/client/` - Client networking layer

**Key server files:**
- `packages/server/src/server.ts` - Server entry point
- `packages/server/src/game/GameRoom.ts` - Match orchestration
- `packages/server/src/simulation/ServerChampion.ts` - Champion logic

**Key client files:**
- `src/core/OnlineGame.ts` - Multiplayer game client
- `src/core/OnlineStateManager.ts` - Server state tracking
- `src/ui/matchmaking/MatchmakingUI.ts` - Matchmaking UI

### Documentation Update Guidelines

**Update the corresponding doc when you:**

| If you change... | Update this doc |
|------------------|-----------------|
| Server/client architecture, game loop, WebSocket server | `infrastructure.md` |
| Message types, state sync, delta compression, bandwidth | `networking.md` |
| Queue system, match creation, team balancing | `matchmaking.md` |
| Champion stats, classes, leveling, damage formulas | `champions.md` |
| Ability definitions, targeting, cooldowns, scaling | `abilities.md` |
| Buffs, debuffs, CC types, effect stacking | `effects-and-buffs.md` |
| Collision detection, unit separation, spatial grid | `collision.md` |
| Visual effects, particles, ability VFX | `vfx.md` |
| Map layout, walls, pathfinding, terrain collision | `map.md` |
| Jungle camps, creature AI, jungle buffs | `jungle.md` |
| Minion waves, lane following, minion targeting | `minions.md` |
| Items, the shop, item icons | `items.md` |
| Simulation framework, scenarios, bots | `simulation.md` |
| Summoner spells | `summoner-spells.md` |
| Sounds, the audio engine | `audio.md` |
| The debug overlay, a unit's debug info | `debug.md` |

**When adding new systems**, create a new doc file in `docs/architecture/` and add a reference here.

---

## Client Architecture

### Directory Structure

```
src/
├── @types/              # TypeScript type declarations
├── art/                 # Pixel art assets
├── audio/               # Sound: catalog, AudioManager (heard from the camera), which moment plays what; try them at /sound-lab.html
├── behaviors/           # Interface definitions for object capabilities
├── config/              # Configuration constants
│   └── gameConfig.ts    # World, camera, economy settings
├── controllers/         # System controllers (collisions, rendering)
├── debug/               # F3's debug overlay (DebugOverlay: what the server thinks), the performance profiler (F4), the VFX and sound labs
├── core/                # Core game systems
│   ├── events/          # Event system (EventEmitter, GameEvents)
│   ├── input/           # Input handling (InputManager, OnlineInputHandler)
│   ├── state/           # OnlineStateManager's parts: deltas, game events, entity VFX, floating numbers, ...
│   ├── camera.ts        # Camera with zoom/pan
│   ├── OnlineGame.ts    # Multiplayer game class
│   ├── OnlineStateManager.ts  # Server state tracking (coordinator, owns the entity map)
│   ├── gameContext.ts   # Per-frame game state
│   └── level.ts         # Level management
├── gpu/                 # WebGL2 layer drawn into the 2D canvas: GPURenderer, ground/ (terrain shader), fx/ (effects with bloom)
├── levels/              # Level definitions
│   └── onlineLevel.ts   # Online multiplayer level
├── map/                 # MOBA map rendering
├── objects/             # Game entities (rendering only)
├── online/              # Online adapters
│   └── OnlineChampionAdapter.ts  # Server state → HUD interface
├── physics/             # Physics utilities (Vector)
├── render/              # Rendering utilities
│   ├── EntityRenderer.ts  # Coordinator: interpolation, sorting, dispatch by entity type
│   ├── entities/        # One renderer per entity type (minion, tower, jungle creature, ...)
│   ├── champions/       # Per-champion drawing (sprites, projectiles, marks) + registry
│   └── overlays/        # Health bars, status icons, floating numbers, ability effects
├── sprites/             # Sprite system
├── types/               # Common type definitions
├── ui/                  # UI components
│   ├── ChampionHUD.ts   # HUD display (coordinator: state, hover, layout)
│   ├── hud/             # HUD panels, tooltips, layout constants and types
│   ├── AnnouncementBanner.ts  # Kills, towers, dragon, match result
│   ├── DeathOverlay.ts  # Respawn countdown
│   ├── LowHealthVignette.ts   # Red screen edges at low health
│   ├── matchmaking/     # Matchmaking UI (MatchmakingUI coordinator, screens, connection)
│   ├── title/           # The animated title screen behind the menu: a pixel-art valley, the champions marching through it, the pixel logo
│   └── shop/            # Shop UI
├── utils/               # Utility functions
├── vfx/                 # Visual effects system (drawn on the GPU by src/gpu/fx/; tune them at /vfx-lab.html)
│   ├── effects/         # VFX primitives (2D drawing functions, the fallback)
│   ├── recipes.ts       # Shorthands for effect configs (sparks, flames, smoke, shockwave, light, pillar...)
│   ├── champions/       # Per-champion ability VFX definitions
│   ├── world.ts         # World VFX (hits, level up, deaths, recall, towers)
│   ├── VFXManager.ts    # Central VFX manager (coordinator: scheduling, active lists, draw order)
│   ├── active/          # Spawn, update and draw per effect family (particles, shapes, trails, ...)
│   ├── VFXParticlePool.ts  # Particle object pooling
│   └── VFXRegistry.ts   # Ability VFX registry (loads champions/ and world.ts)
└── vision/              # Bush visibility (client-side rendering)
```

---

## Client Systems

### 1. Online Game (`src/core/OnlineGame.ts`)

The client game loop for multiplayer:
- Uses **NetworkClient** for server communication
- Creates **OnlineStateManager** to track server state
- Renders at 60 Hz with interpolation from 30 Hz server updates

### 2. State Manager (`src/core/OnlineStateManager.ts`)

Tracks and interpolates server state for smooth rendering:
- Stores entity snapshots from server
- Interpolates positions between server updates
- Provides local player entity access

It owns the entity map and delegates to `src/core/state/`: `deltas.ts` (snapshot
and delta merging), `gameEvents.ts` (game events → animations, VFX, floating
numbers, announcements), `entityVFX.ts` (death/respawn/level-up VFX),
`entities.ts` (entity record, interpolation, animation queries) and the stores
the renderers read (`abilityEffects.ts`, `floatingNumbers.ts`, `campTimers.ts`,
`announcements.ts`). See [docs/architecture/infrastructure.md](docs/architecture/infrastructure.md).

### 3. Online Input Handler (`src/core/input/OnlineInputHandler.ts`)

Captures player input and sends to server:
- Right-click → Move command (or attack the unit under the cursor)
- A + left-click → Attack-move (attacks enemies that come in range on the way)
- Q/W/E/R → Ability cast (Ctrl + key levels it)
- S → Stop
- B → Recall
- D / F → Summoner spells
- 4 / 5 → Hold to aim a ward / control ward (bought in the shop), release to place it

Escape opens the in-match menu (`src/ui/GameMenu.ts`: resume, surrender).

### 4. Entity Renderer (`src/render/EntityRenderer.ts`)

Renders all entities based on server state:
- Champions with health bars
- Minions with sprites
- Towers and Nexus
- Projectiles

### 5. Rendering System (`src/controllers/RenderController.ts`)

The canvas is backed at the screen's resolution (2 canvas pixels per CSS pixel on a retina screen) with a base transform, so everything is laid out and drawn in CSS pixels: use `Dimensions` for the screen size, not `canvas.width` (`src/core/canvas.ts`). The GPU layer and the fog are drawn at lower resolution and stretched.

1. Clear canvas
2. Apply camera transforms (translate, scale, zoom)
3. Render background
4. Sort objects by Y-position (depth sorting)
5. Render world-space elements
6. Render fog of war overlay
7. Render UI overlays

### 6. Camera System (`src/core/camera.ts`)

- **Edge panning**: Move camera when mouse near screen edges (constant speed; leaving the window through an edge keeps panning until the pointer returns or the window loses focus)
- **Zoom**: Mouse wheel or keyboard shortcuts, from 560 to 900 world units across the screen (on a wide window, as far out as fits 500 top to bottom); it starts as far out as it goes (`GameConfig.CAMERA` in `src/config/gameConfig.ts`)
- **Bounds clamping**: Keep camera within world dimensions

---

## Sprite System

### Overview

The sprite system uses BigInt encoding to store pixel art in a compact format (originally for 13KB contest).

### Type Definitions (`src/sprites/types.ts`)

```typescript
type PixelArt = [
  value: bigint,         // BigInt encoding all pixel indices
  width: number,         // Width in pixels
  height: number,        // Height in pixels
  cardinality: number,   // Number of colors (palette size)
  palette: ColorPalette  // Array of hex colors (undefined = transparent)
]
```

### SpriteManager (`src/sprites/SpriteManager.ts`)

Singleton for centralized sprite management:
- `registerSpriteSheet(key, sprites)` - Register and cache a sprite sheet
- `getSpriteSheet(key)` - Retrieve cached sprite sheet
- `createAnimator(key, idleFrame)` - Create animator from registered sheet

---

## Development Notes

### Running the Project

```bash
# Start the server
cd packages/server
bun run src/server.ts

# Start the client (in another terminal)
npm run serve
```

### Testing

```bash
# Run every workspace's tests (server, client networking, shared, protocol)
npm run test:packages

# Run server tests
cd packages/server
bun test

# Run specific test file
bun test FogOfWarComprehensive
```

### Type checking

```bash
npx tsc --noEmit -p .                    # client (src/) + packages/client
cd packages/server && npm run typecheck  # shared + server, including tests
```

### Seeing gameplay changes without a browser (agents: use this)

Gameplay changes (minions, jungle, abilities, bots, map) can be checked headlessly:

```bash
cd packages/server
bun run sim list                 # available scenarios
bun run sim minion-waves-mid     # prints a report; writes sim-output/minion-waves-mid/{sheet,final}.png
```

Look at `sheet.png` (frames over time) to see what happened, read `report.md` for deaths, damage and the log, and add a scenario in
`packages/server/scenarios/` with `check()` assertions for new behavior; scenarios run in `bun test`.
For step-by-step play there is an HTTP sandbox (`bun run sim:serve`). See [docs/architecture/simulation.md](docs/architecture/simulation.md).

To play the real client alone, use the **PRACTICE** button on champion select (you vs bots; the chip beside it picks 1v1, 3v3, 5v5 or ARAM: 1v1 on The Narrows). In practice, **F3** (fn+F3 on a Mac, or the Escape menu) turns on the debug overlay: each unit's path, target, hitbox, ranges and state, and the bots' decisions ([docs/architecture/debug.md](docs/architecture/debug.md)).

### Debug starting level

Champions start at level 1. To test ultimates locally, start the server with
`SIEGE_STARTING_LEVEL=6 bun run src/server.ts` (see `GameConfig.DEBUG` in
`packages/shared/src/config/GameConfig.ts`).

---

## Future Considerations

### Completed Improvements
- ✅ Extract configuration constants (src/config/)
- ✅ Add proper error handling (localStorage, vector normalization)
- ✅ Implement proper event system (src/core/events/)
- ✅ Improve code organization (types, input manager, sprite manager)
- ✅ Add TypeScript types (removed most `any` casts)
- ✅ Remove offline mode (online-only now)
- ✅ Server-side champion tests

### Remaining Tasks
1. Add more client unit tests
2. Replace BigInt sprite encoding with PNG images
3. Add music (sound effects: see docs/architecture/audio.md)
4. Improve UI with proper HUD components
5. Add more champions and abilities
