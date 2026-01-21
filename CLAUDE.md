# Siege - Codebase Documentation

## Overview

Siege is a **multiplayer MOBA** (Multiplayer Online Battle Arena) game. The game features server-authoritative networking, champion-based combat, and classic MOBA mechanics like lanes, minions, and towers.

> **Note**: This project was originally built for the js13kb game contest as a tower defense game. The legacy tower defense code and offline single-player mode have been **removed**. The game is now **online-only** with server-authoritative gameplay.

---

## CRITICAL: Stale .js Files in packages/shared/src/

> **⚠️ IMPORTANT FOR AI ASSISTANTS AND DEVELOPERS ⚠️**
>
> The `packages/shared/src/` directory contains **both** `.ts` (TypeScript) and `.js` (JavaScript) files.
> Vite resolves to the `.js` files at runtime, NOT the `.ts` files.
>
> **When adding new exports to `packages/shared/src/index.ts`:**
> 1. You MUST also update `packages/shared/src/index.js` with the same exports
> 2. If adding a new module/folder (e.g., `champions/`), you MUST create corresponding `.js` files
> 3. Failure to do this will cause runtime errors like: `does not provide an export named 'X'`
>
> **Example of the bug pattern:**
> - Adding `export * from './champions';` to `index.ts` ✓
> - Forgetting to add it to `index.js` ✗ → Runtime error!
>
> **Affected directories with .js files:**
> - `packages/shared/src/` (index.js)
> - `packages/shared/src/math/` (Vector.js, shapes.js)
> - `packages/shared/src/types/` (various .js files)
> - `packages/shared/src/config/` (various .js files)
> - `packages/shared/src/utils/` (various .js files)
> - `packages/shared/src/champions/` (index.js, ChampionRegistry.js)
> - `packages/shared/src/abilities/` (index.js, AbilityRegistry.js)
>
> **TODO:** These stale .js files should ideally be deleted and Vite configured to resolve .ts directly.

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

### Quick Reference

**Server packages:**
- `packages/server/` - Authoritative game server (Bun runtime)
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

**When adding new systems**, create a new doc file in `docs/architecture/` and add a reference here.

---

## Client Architecture

### Directory Structure

```
src/
├── @types/              # TypeScript type declarations
├── art/                 # Pixel art assets
├── behaviors/           # Interface definitions for object capabilities
├── config/              # Configuration constants
│   └── gameConfig.ts    # World, camera, economy settings
├── controllers/         # System controllers (collisions, rendering)
├── core/                # Core game systems
│   ├── events/          # Event system (EventEmitter, GameEvents)
│   ├── input/           # Input handling (InputManager, OnlineInputHandler)
│   ├── camera.ts        # Camera with zoom/pan
│   ├── OnlineGame.ts    # Multiplayer game class
│   ├── OnlineStateManager.ts  # Server state tracking
│   ├── gameContext.ts   # Per-frame game state
│   └── level.ts         # Level management
├── levels/              # Level definitions
│   └── onlineLevel.ts   # Online multiplayer level
├── map/                 # MOBA map rendering
├── objects/             # Game entities (rendering only)
├── online/              # Online adapters
│   └── OnlineChampionAdapter.ts  # Server state → HUD interface
├── physics/             # Physics utilities (Vector)
├── render/              # Rendering utilities
│   └── EntityRenderer.ts  # Renders server entities
├── sprites/             # Sprite system
├── types/               # Common type definitions
├── ui/                  # UI components
│   ├── ChampionHUD.ts   # HUD display
│   ├── matchmaking/     # Matchmaking UI
│   └── shop/            # Shop UI
├── utils/               # Utility functions
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

### 3. Online Input Handler (`src/core/input/OnlineInputHandler.ts`)

Captures player input and sends to server:
- Right-click → Move command
- Q/W/E/R → Ability cast
- S → Stop
- B → Recall

### 4. Entity Renderer (`src/render/EntityRenderer.ts`)

Renders all entities based on server state:
- Champions with health bars
- Minions with sprites
- Towers and Nexus
- Projectiles

### 5. Rendering System (`src/controllers/RenderController.ts`)

1. Clear canvas
2. Apply camera transforms (translate, scale, zoom)
3. Render background
4. Sort objects by Y-position (depth sorting)
5. Render world-space elements
6. Render fog of war overlay
7. Render UI overlays

### 6. Camera System (`src/core/camera.ts`)

- **Edge panning**: Move camera when mouse near screen edges
- **Zoom**: Mouse wheel or keyboard shortcuts
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
# Run server tests
cd packages/server
bun test

# Run specific test file
bun test FogOfWarComprehensive
```

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
3. Add sound effects and music
4. Improve UI with proper HUD components
5. Add more champions and abilities
