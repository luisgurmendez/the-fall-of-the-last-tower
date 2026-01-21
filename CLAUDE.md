# Siege - Codebase Documentation

## Overview

Siege has evolved from a wave-based tower defense game into a **multiplayer MOBA** (Multiplayer Online Battle Arena). The game features server-authoritative networking, champion-based combat, and classic MOBA mechanics like lanes, minions, and towers.

> **Note**: This project was originally built for the js13kb game contest. The legacy tower defense code still exists but the focus has shifted to MOBA gameplay.

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

## Legacy: Tower Defense Game

The original tower defense mechanics are documented below for reference.

## Game Mechanics

### Core Gameplay
- **Objective**: Defend your castle from waves of enemy troops
- **Player controls**: Spawn troops (swordsmen/archers), select units, command them to attack specific targets or move to positions
- **Economy**: Earn money passively (+10/sec) and by killing enemies (+50 per kill)
- **Waves**: Enemy waves spawn with increasing difficulty (more troops, archers start at wave 4)

### Controls
- **Left-click drag**: Select multiple units
- **Left-click on unit**: Select single unit
- **Right-click on enemy**: Command selected units to attack
- **Right-click on ground**: Move selected units to position (military formation)
- **S**: Spawn swordsman (100 money)
- **A**: Spawn archer (60 money)
- **P**: Pause/unpause
- **R**: Restart
- **Z/X**: Decrease/increase game speed
- **,/.**: Zoom in/out
- **B**: Fullscreen

---

## Architecture

### Directory Structure

```
src/
├── @types/              # TypeScript type declarations
├── art/                 # Pixel art assets (bloodstains, trees)
├── behaviors/           # Interface definitions for object capabilities
├── config/              # Configuration constants
│   ├── gameConfig.ts    # World, camera, economy, spawn settings
│   ├── unitConfig.ts    # Unit stats and animations
│   └── waveConfig.ts    # Wave spawning configuration
├── controllers/         # System controllers (collisions, rendering, etc.)
├── controls/            # UI controls (buttons - currently unused)
├── core/                # Core game systems
│   ├── events/          # Event system (EventEmitter, GameEvents)
│   ├── input/           # Input handling (InputManager)
│   ├── camera.ts        # Camera with zoom/pan
│   ├── game.ts          # Main game loop
│   ├── gameContext.ts   # Per-frame game state
│   └── level.ts         # Level management
├── levels/              # Level definitions
├── mixins/              # Composable object functionality
├── objects/             # Game entities
│   ├── army/            # Unit implementations (swordsman, archer)
│   ├── castle/          # Castle entity
│   ├── particle/        # Particle effects
│   ├── player/          # Player controller
│   └── trebuchet/       # Trebuchet (incomplete/unused)
├── physics/             # Physics utilities (Vector)
├── render/              # Rendering utilities
├── sprites/             # Sprite system
│   ├── types.ts         # Type definitions
│   ├── SpriteManager.ts # Centralized sprite management
│   ├── PixelArtBuilder.ts
│   ├── PixelArtSpriteSheet.ts
│   └── PixelArtSpriteAnimator.ts
├── types/               # Common type definitions and guards
│   └── index.ts         # Targetable, Damageable, Selectable, etc.
└── utils/               # Utility functions
```

---

## Core Systems

### 1. Game Loop (`src/core/game.ts`)

```
Game.loop() → requestAnimationFrame →
  Game.update() →
    Level.update(gameApi) →
      [Initialize] → [Step] → [Dispose] → [Render]
```

- **Clock**: Tracks delta time with pause/resume support
- **GameSpeed**: Multiplier (0.1x to 3x) via z/x keys
- **GameApi**: Passes dt, canvas context, pause state to level

### 2. Level System (`src/core/level.ts`)

Each frame:
1. Build spatial hash from collidable objects
2. Calculate collisions using spatial hash
3. Generate GameContext with all runtime data
4. Initialize new objects (call `init()` once)
5. Step all stepable objects
6. Dispose objects marked for disposal
7. Render via RenderController

### 3. Entity System

**Base Patterns:**
- `BaseObject`: Base class with position and unique ID
- **Mixins**: Composable functionality (PhysicableMixin, CollisionableMixin, PositionableMixin)
- **Behaviors**: Interface contracts (Stepable, Renderable, Initializable, Disposable, Attackable)

**Type Guards:**
```typescript
isStepable(obj)       // Has step() method
isRenderable(obj)     // Has render() method
isInitializable(obj)  // Has init() + shouldInitialize
isDisposable(obj)     // Has shouldDispose flag
isAttackable(obj)     // Has applyDamage() + health
```

### 4. Collision System

**Spatial Hashing** (`src/utils/spatiallyHashedObjects.ts`):
- Grid-based with 100px cell size
- Objects inserted into all overlapping cells
- Reduces collision checks from O(n²) to O(nearby)

**CollisionsController** (`src/controllers/CollisionsController.ts`):
- Tests Circle-Circle, Rectangle-Rectangle, Rectangle-Circle
- Injects collision arrays into each object

### 5. Physics System (`src/mixins/physics.ts`)

```typescript
velocity = velocity + (acceleration * dt)
velocity *= friction  // 0.8 default
velocity = clamp(velocity, maxSpeed)  // 300 default

position = position + (velocity * dt) + (0.5 * acceleration * dt²)
```

### 6. Rendering System (`src/controllers/RenderController.ts`)

1. Clear canvas
2. Apply camera transforms (translate, scale, zoom)
3. Render background (separate canvas for performance)
4. Sort objects by Y-position (pseudo-depth sorting)
5. Render "normal" elements (world-space)
6. Render "overlay" elements (screen-space, UI)

**RenderElement**: Wrapper for render functions with position type (normal/overlay)

### 7. Camera System (`src/core/camera.ts`)

- **Edge panning**: Move camera when mouse near screen edges
- **Zoom**: Mouse wheel or keyboard shortcuts
- **Bounds clamping**: Keep camera within world dimensions
- **Following**: Can follow an object (unused currently)

---

## Game Objects

### ArmyUnit (`src/objects/army/armyUnit.ts`)

Abstract base class for all combat units:

```typescript
abstract class ArmyUnit {
  side: 0 | 1;              // 0 = ally, 1 = enemy
  health, maxHealth, armor, maxArmor
  target: Target | null;    // Current attack target
  targetPosition: Vector;   // Move-to position
  attackRange, outOfSightRange
  attackCooldown: Cooldown
  spriteAnimator: PixelArtSpriteAnimator
}
```

**Step cycle:**
1. `beforeStep()`: Check death, update cooldowns/animator, process queued attacks
2. `fixTarget()`: Find targets using spatial hash, prioritize player-set targets
3. `attackIfPossible()`: Unit-specific attack logic
4. `move()`: Calculate movement toward target/position
5. `afterStep()`: Update position, handle collisions with castle/bounds

### Swordsman (`src/objects/army/swordsman/swordsman.ts`)

- **Health**: 100
- **Attack Range**: 12px (melee)
- **Attack Cooldown**: 5 frames
- **Damage**: 30
- **Sight Range**: 350px
- **Animation**: 3 walk frames, 7 attack frames (triggers damage at frame 4)

### Archer (`src/objects/army/archer/archer.ts`)

- **Health**: 10 (fragile)
- **Attack Range**: 800px (ranged)
- **Attack Cooldown**: 5 frames
- **Damage**: 15 (via Arrow projectile)
- **Sight Range**: 1600px
- Spawns Arrow objects instead of direct damage

### Arrow (`src/objects/army/archer/arrow.ts`)

- **Velocity**: 500 units/sec
- **TTL**: 2 seconds
- **Friction**: 0 (constant velocity)
- Checks collisions, applies 15 damage on hit
- Draws to background when TTL expires

### Castle (`src/objects/castle/castle.ts`)

- **Health**: 20,000
- **Collision**: Circle with 200px radius
- Spawns smoke particles when damaged
- Triggers game over on destruction

### Player (`src/objects/player/player.ts`)

Handles all player input:
- Unit selection (click-drag rectangle)
- Target assignment (right-click)
- Unit spawning (S/A keys)
- Passive income generation (+10/sec)

### WaveController (`src/objects/waveController.ts`)

- Spawns waves every 40 frames (cooldown)
- **Swordsmen per wave**: (wave - 1) * 5 + 1
- **Archers per wave**: max(0, (wave - 4) * 5)
- Tracks high score in localStorage

---

## Sprite System

### Overview

The sprite system uses BigInt encoding to store pixel art in a compact format. While originally a 13KB optimization, the system has been modernized with proper types and a management layer while maintaining the encoding format.

### Type Definitions (`src/sprites/types.ts`)

```typescript
type PixelArt = [
  value: bigint,         // BigInt encoding all pixel indices
  width: number,         // Width in pixels
  height: number,        // Height in pixels
  cardinality: number,   // Number of colors (palette size)
  palette: ColorPalette  // Array of hex colors (undefined = transparent)
]

interface AnimationDefinition {
  frames: number[];        // Frame indices in sprite sheet
  frameDuration: number;   // Duration per frame in seconds
  loop?: boolean;          // Whether animation loops
}
```

### PixelArt Encoding (`src/sprites/PixelArtBuilder.ts`)

**Decoding algorithm:**
```typescript
for each pixel (x, y):
  colorIndex = value % cardinality
  color = palette[colorIndex]
  value = value / cardinality
```

**Utility methods:**
- `buildCanvas(pixelart, scale)` - Render pixel art to canvas
- `withPalette(pixelart, newPalette)` - Create copy with different palette
- `replaceColor(pixelart, source, target)` - Replace specific color

### SpriteManager (`src/sprites/SpriteManager.ts`)

Singleton for centralized sprite management:
- `registerSpriteSheet(key, sprites)` - Register and cache a sprite sheet
- `getSpriteSheet(key)` - Retrieve cached sprite sheet
- `createAnimator(key, idleFrame)` - Create animator from registered sheet
- `registerTeamSprites(baseKey, sprites, side)` - Register with team color modification

### Sprite Animation (`src/sprites/PixelArtSpriteAnimator.ts`)

- `addAnimation(name, frames, duration, loop)` - Register animation
- `playAnimation(name, { interrupt, restart })` - Play animation with options
- `stopAnimation()` - Stop and return to idle frame
- `render(ctx, position, mirrored)` - Render current frame
- `renderWithOptions(ctx, position, options)` - Render with scale/rotation/alpha

---

## 13KB Tricks & Optimizations

### Code-Level

1. **Mixins over inheritance**: Smaller compiled code
2. **Single-letter variable names** in hot paths
3. **Type guards instead of instanceof**: Duck typing
4. **Spatial hashing**: O(n) instead of O(n²) collisions
5. **BigInt sprite encoding**: Massive space savings
6. **Shared sprite sheets**: Ally/enemy use same sprites with color swap

### Build-Level

1. **Google Closure Compiler**: Advanced minification
2. **Roadroller**: Bytecode compression with tuned parameters
3. **ECT compression**: Additional binary compression
4. **Minimal HTML/CSS**: Only essential markup

---

## Recent Refactoring

The following improvements have been made to modernize the codebase:

### Configuration System (`src/config/`)
- `gameConfig.ts` - Centralized game constants (world size, camera, economy, spawning)
- `unitConfig.ts` - All unit stats (health, damage, animation frames, etc.)
- `waveConfig.ts` - Wave spawning configuration with scaling functions

### Event System (`src/core/events/`)
- `EventEmitter.ts` - Type-safe event emitter with on/once/off/emit
- `GameEvents.ts` - Game event constants and typed payloads
- `gameEventBus.ts` - Singleton event bus for game-wide communication

### Input System (`src/core/input/`)
- `InputManager.ts` - Centralized keyboard/mouse input handling
- Methods: `isKeyDown()`, `isKeyJustPressed()`, `isMouseButtonDown()`, etc.
- Screen-to-world coordinate conversion

### Type System (`src/types/index.ts`)
- Common interfaces: `Targetable`, `Damageable`, `Sided`, `Selectable`, `Commandable`
- Type guards: `isSided()`, `isSelectable()`, `isCommandable()`, etc.

### Sprite System (`src/sprites/`)
- `types.ts` - Comprehensive type definitions
- `SpriteManager.ts` - Centralized sprite loading and caching
- `PixelArtBuilder.ts` - Enhanced with documentation and utility methods
- `PixelArtSpriteSheet.ts` - Added `drawSpriteWithOptions()` for advanced rendering
- `PixelArtSpriteAnimator.ts` - Improved API with options objects

---

## Known Issues (Remaining)

1. Event listeners in camera wheel handler not stored for removal
2. Selection rectangle O(n) performance with many units

### Fixed in Refactoring
- ~~Camera bounds bug~~ (fixed in camera.ts)
- ~~Archer spawn cooldown bug~~ (fixed in player.ts)
- ~~Vector.normalize() NaN risk~~ (added zero-length check)
- ~~LocalStorage error handling~~ (added try-catch)
- ~~Enemy facing wrong direction~~ (fixed initial direction based on side)
- ~~Magic numbers~~ (extracted to config files)

---

## GameContext (`src/core/gameContext.ts`)

The GameContext object passed each frame contains:

```typescript
class GameContext {
  readonly dt: number;                    // Delta time
  readonly isPaused: boolean;
  readonly objects: BaseObject[];         // All game objects
  readonly canvasRenderingContext: CanvasRenderingContext2D;
  readonly camera: Camera;
  readonly worldDimensions: Rectangle;
  readonly money: number;
  readonly collisions: Collisions;        // Collision map
  readonly spatialHashing: SpatiallyHashedObjects;
  readonly background: Background;
  readonly castle: Castle | undefined;

  setMoney(amount: number): void;
  pause(): void;
  unPause(): void;
}
```

---

## File Relationships

```
index.ts
└── Game
    └── Level (battlefield.ts)
        ├── Camera
        ├── Background
        ├── Castle
        ├── Player (handles input)
        ├── WaveController (spawns enemies)
        ├── Swordsman[] (ally & enemy)
        ├── Archer[] (ally & enemy)
        └── Arrow[] (projectiles)

Controllers:
├── CollisionsController (spatial + collision detection)
└── RenderController (camera transforms, sorting, drawing)

Utilities:
├── SpatiallyHashedObjects (O(1) spatial queries)
├── Vector (2D math)
├── Cooldown (timer utility)
└── PixelArtBuilder (sprite decoding)
```

---

## Development Notes

### Running the Project

```bash
npm install
npm run serve    # Development server
npm run build    # Production build (with 13KB optimization)
```

### Build Pipeline

1. TypeScript compilation
2. Vite bundling
3. Google Closure Compiler minification
4. Roadroller compression (if enabled)
5. ZIP archive creation
6. Size validation (<13KB)

---

## Future Considerations

### Completed Improvements
- ✅ Extract configuration constants (src/config/)
- ✅ Add proper error handling (localStorage, vector normalization)
- ✅ Implement proper event system (src/core/events/)
- ✅ Improve code organization (types, input manager, sprite manager)
- ✅ Add TypeScript types (removed most `any` casts)

### Remaining Tasks
1. Add unit tests (Jest/Vitest)
2. Integrate InputManager into Player class
3. Use EventBus for game state changes (money, wave, game over)
4. Consider ECS architecture for scalability
5. Replace BigInt sprite encoding with PNG images (now that 13KB constraint is removed)
6. Add sound effects and music
7. Improve UI with proper HUD components
8. Add more unit types and abilities
