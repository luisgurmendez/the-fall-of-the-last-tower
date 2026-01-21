# Siege Rework - Improvement Plan

This document outlines a comprehensive plan to transform the 13KB-optimized codebase into a maintainable, modular, and extensible game foundation.

---

## Phase 1: Bug Fixes (Priority: Critical)

### 1.1 Camera Bounds Bug
**File**: `src/core/camera.ts:217-223`

**Problem**: Uses `world.w` for vertical bounds instead of `world.h`.

**Current code**:
```typescript
if (adjustTop) {
  this.position.y = world.w / 2 - viewportWithZoom.h / 2;  // WRONG
}
if (adjustBottom) {
  this.position.y = -world.w / 2 + viewportWithZoom.h / 2;  // WRONG
}
```

**Fix**:
```typescript
if (adjustTop) {
  this.position.y = world.h / 2 - viewportWithZoom.h / 2;
}
if (adjustBottom) {
  this.position.y = -world.h / 2 + viewportWithZoom.h / 2;
}
```

### 1.2 Archer Spawn Cooldown Bug
**File**: `src/objects/player/player.ts:212`

**Problem**: Checks wrong cooldown when spawning archers.

**Current code**:
```typescript
if (this.shouldSpawnArcher && !this.spawnSwordsmanCooldown.isCooling() && gctx.money > 60)
```

**Fix**:
```typescript
if (this.shouldSpawnArcher && !this.spawnArcherCooldown.isCooling() && gctx.money > 60)
```

### 1.3 Vector Zero-Length Normalization
**File**: `src/physics/vector.ts`

**Problem**: Normalizing a zero-length vector produces NaN.

**Fix**: Add safety check in normalize():
```typescript
normalize(): Vector {
  const len = this.length();
  if (len === 0) return this;  // or return new Vector(0, 0)
  return this.scalar(1 / len);
}
```

### 1.4 Enemy Unit Initial Direction
**Files**: `src/objects/army/swordsman/swordsman.ts:43`, `src/objects/army/archer/archer.ts`

**Problem**: All units face right on spawn; enemies should face left.

**Fix**: Set direction based on side in constructor:
```typescript
this.direction = new Vector(side === 0 ? 1 : -1, 0);
```

### 1.5 LocalStorage Error Handling
**File**: `src/objects/waveController.ts:18,24`

**Problem**: No error handling for localStorage (fails in private browsing).

**Fix**:
```typescript
private getWaveRecord(): string | null {
  try {
    return localStorage.getItem('lg-siege:wr');
  } catch {
    return null;
  }
}

private setWaveRecord(wave: number): void {
  try {
    localStorage.setItem('lg-siege:wr', wave.toString());
  } catch {
    // Silent fail in private browsing
  }
}
```

---

## Phase 2: Configuration & Constants

### 2.1 Create Central Configuration File

Create `src/config/gameConfig.ts`:

```typescript
export const GameConfig = {
  // World
  WORLD_SIZE: 5000,
  PLAYABLE_AREA_BOUNDS: {
    maxX: 2500,
    maxY: 2500,
  },

  // Camera
  CAMERA: {
    MIN_ZOOM: 0.4,
    MAX_ZOOM: 14,
    EDGE_SCROLL_THRESHOLD: 150,
    EDGE_SCROLL_SPEED: 20,
  },

  // Economy
  ECONOMY: {
    STARTING_MONEY: 130,
    PASSIVE_INCOME: 10,
    PASSIVE_INCOME_INTERVAL: 1,
    KILL_REWARD: 50,
  },

  // Spawning
  SPAWN: {
    ALLY_X: -1500,
    ALLY_Y_VARIANCE: 400,
    ENEMY_X: 2000,
    ENEMY_Y_VARIANCE: 300,
  },
} as const;
```

### 2.2 Create Unit Configuration

Create `src/config/unitConfig.ts`:

```typescript
export const UnitConfig = {
  SWORDSMAN: {
    HEALTH: 100,
    ARMOR: 0,
    ATTACK_RANGE: 12,
    ATTACK_COOLDOWN: 5,
    DAMAGE: 30,
    SIGHT_RANGE: 350,
    SPEED: 300,
    ACCELERATION: 400,
    COST: 100,
    SPAWN_COOLDOWN: 0.5,
    COLLISION_WIDTH: 18,
    COLLISION_HEIGHT: 26,
  },
  ARCHER: {
    HEALTH: 10,
    ARMOR: 0,
    ATTACK_RANGE: 800,
    ATTACK_COOLDOWN: 5,
    DAMAGE: 15,
    SIGHT_RANGE: 1600,
    SPEED: 300,
    ACCELERATION: 400,
    COST: 60,
    SPAWN_COOLDOWN: 1,
    COLLISION_WIDTH: 18,
    COLLISION_HEIGHT: 26,
  },
  ARROW: {
    SPEED: 500,
    TTL: 2,
    LENGTH: 14,
  },
  CASTLE: {
    HEALTH: 20000,
    RADIUS: 200,
  },
} as const;
```

### 2.3 Create Wave Configuration

Create `src/config/waveConfig.ts`:

```typescript
export const WaveConfig = {
  SPAWN_INTERVAL: 40,  // frames

  // Wave scaling formulas
  getSwordsmenCount: (wave: number) => (wave - 1) * 5 + 1,
  getArcherCount: (wave: number) => Math.max(0, (wave - 4) * 5),

  // When archers start spawning
  ARCHER_START_WAVE: 4,
} as const;
```

---

## Phase 3: Code Organization & Modularity

### 3.1 Event System

Create `src/core/events/EventEmitter.ts`:

```typescript
type EventCallback<T = any> = (data: T) => void;

export class EventEmitter {
  private listeners = new Map<string, Set<EventCallback>>();

  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<T>(event: string, data?: T): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  clear(): void {
    this.listeners.clear();
  }
}

// Game-wide event types
export enum GameEvent {
  UNIT_SPAWNED = 'unit:spawned',
  UNIT_DIED = 'unit:died',
  UNIT_ATTACKED = 'unit:attacked',
  WAVE_STARTED = 'wave:started',
  WAVE_COMPLETED = 'wave:completed',
  GAME_OVER = 'game:over',
  MONEY_CHANGED = 'money:changed',
  CASTLE_DAMAGED = 'castle:damaged',
}
```

### 3.2 Input Manager

Create `src/core/input/InputManager.ts`:

```typescript
export class InputManager {
  private keys = new Set<string>();
  private mousePosition = { x: 0, y: 0 };
  private mouseButtons = new Set<number>();
  private listeners: (() => void)[] = [];

  init(canvas: HTMLCanvasElement): void {
    const onKeyDown = (e: KeyboardEvent) => this.keys.add(e.key);
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key);
    const onMouseMove = (e: MouseEvent) => {
      this.mousePosition.x = e.clientX;
      this.mousePosition.y = e.clientY;
    };
    const onMouseDown = (e: MouseEvent) => this.mouseButtons.add(e.button);
    const onMouseUp = (e: MouseEvent) => this.mouseButtons.delete(e.button);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);

    this.listeners.push(
      () => window.removeEventListener('keydown', onKeyDown),
      () => window.removeEventListener('keyup', onKeyUp),
      () => canvas.removeEventListener('mousemove', onMouseMove),
      () => canvas.removeEventListener('mousedown', onMouseDown),
      () => canvas.removeEventListener('mouseup', onMouseUp),
    );
  }

  isKeyDown(key: string): boolean {
    return this.keys.has(key);
  }

  isKeyPressed(key: string): boolean {
    // Implement with frame tracking
  }

  getMousePosition(): { x: number; y: number } {
    return { ...this.mousePosition };
  }

  isMouseButtonDown(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  dispose(): void {
    this.listeners.forEach(unsub => unsub());
    this.listeners = [];
  }
}
```

### 3.3 Refactor Player Controller

Split `player.ts` into smaller, focused classes:

```
src/objects/player/
├── Player.ts              # Main player controller
├── SelectionManager.ts    # Unit selection logic
├── CommandManager.ts      # Unit commanding (move, attack)
├── SpawnManager.ts        # Unit spawning
└── EconomyManager.ts      # Money handling
```

### 3.4 Extract Formation Logic

Create `src/utils/FormationUtils.ts`:

```typescript
export class FormationUtils {
  static getGridPositions(
    center: Vector,
    unitCount: number,
    options: {
      spacing?: number;
      unitsPerRow?: number;
    } = {}
  ): Vector[] {
    const { spacing = 25, unitsPerRow = 10 } = options;
    const positions: Vector[] = [];

    const rows = Math.ceil(unitCount / unitsPerRow);
    const offsetX = (Math.min(unitCount, unitsPerRow) - 1) * spacing / 2;
    const offsetY = (rows - 1) * spacing / 2;

    for (let i = 0; i < unitCount; i++) {
      const row = Math.floor(i / unitsPerRow);
      const col = i % unitsPerRow;
      positions.push(new Vector(
        center.x + col * spacing - offsetX,
        center.y + row * spacing - offsetY
      ));
    }

    return positions;
  }
}
```

---

## Phase 4: Type Safety & Interfaces

### 4.1 Strict Type Definitions

Create `src/types/index.ts`:

```typescript
export type Side = 0 | 1;  // 0 = ally, 1 = enemy

export interface Damageable {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  applyDamage(damage: number): void;
}

export interface Targetable {
  readonly position: Vector;
  readonly collisionMask: Shape;
  readonly id: string;
}

export type Target = Damageable & Targetable;

export interface UnitStats {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  attackRange: number;
  attackCooldown: number;
  damage: number;
  sightRange: number;
  speed: number;
  acceleration: number;
}
```

### 4.2 Remove `any` Casts

Current code has many `(obj as any)` casts. Replace with proper type guards:

```typescript
// Before
if ((this.hoveringTarget as any).side === 1) { ... }

// After
function isArmyUnit(obj: unknown): obj is ArmyUnit {
  return obj instanceof ArmyUnit;
}

if (this.hoveringTarget && isArmyUnit(this.hoveringTarget) && this.hoveringTarget.side === 1) { ... }
```

---

## Phase 5: Sprite System Modernization

### 5.1 Replace BigInt Encoding with Standard Formats

Since file size is no longer a constraint, use standard image formats:

```typescript
// New approach: Load sprites from PNG files
export class SpriteLoader {
  private cache = new Map<string, HTMLImageElement>();

  async load(path: string): Promise<HTMLImageElement> {
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(path, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = path;
    });
  }
}
```

### 5.2 Sprite Atlas Support

Create `src/sprites/SpriteAtlas.ts`:

```typescript
interface SpriteDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SpriteAtlas {
  private image: HTMLImageElement;
  private sprites: Map<string, SpriteDefinition>;

  constructor(image: HTMLImageElement, definitions: Record<string, SpriteDefinition>) {
    this.image = image;
    this.sprites = new Map(Object.entries(definitions));
  }

  draw(
    ctx: CanvasRenderingContext2D,
    spriteName: string,
    x: number,
    y: number,
    options: { scale?: number; flip?: boolean } = {}
  ): void {
    const sprite = this.sprites.get(spriteName);
    if (!sprite) return;

    const { scale = 1, flip = false } = options;

    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(
      this.image,
      sprite.x, sprite.y, sprite.width, sprite.height,
      -sprite.width * scale / 2, -sprite.height * scale / 2,
      sprite.width * scale, sprite.height * scale
    );
    ctx.restore();
  }
}
```

---

## Phase 6: Performance & Memory

### 6.1 Object Pooling

Create `src/utils/ObjectPool.ts`:

```typescript
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize = 100) {
    this.factory = factory;
    this.reset = reset;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    return this.pool.pop() ?? this.factory();
  }

  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }
}

// Usage for particles
const particlePool = new ObjectPool(
  () => new Particle(0),
  (p) => { p.ttl = 0; p.shouldDispose = false; }
);
```

### 6.2 Incremental Spatial Hash Updates

Instead of rebuilding the entire spatial hash each frame:

```typescript
class SpatialHashManager {
  private hash: SpatiallyHashedObjects;
  private trackedObjects = new Map<string, Vector>();

  update(objects: BaseObject[]): void {
    // Only update moved objects
    objects.forEach(obj => {
      const lastPos = this.trackedObjects.get(obj.id);
      if (!lastPos || !lastPos.equals(obj.position)) {
        this.hash.remove(obj.id);
        this.hash.insert(obj);
        this.trackedObjects.set(obj.id, obj.position.clone());
      }
    });
  }
}
```

---

## Phase 7: Testing Infrastructure

### 7.1 Unit Test Setup

Add Jest configuration and create test files:

```
tests/
├── physics/
│   └── vector.test.ts
├── utils/
│   ├── spatialHash.test.ts
│   └── intersections.test.ts
├── objects/
│   ├── cooldown.test.ts
│   └── armyUnit.test.ts
└── controllers/
    └── collisions.test.ts
```

Example test:

```typescript
// tests/physics/vector.test.ts
import Vector from '@/physics/vector';

describe('Vector', () => {
  describe('normalize', () => {
    it('should return unit vector', () => {
      const v = new Vector(3, 4);
      const normalized = v.normalize();
      expect(normalized.length()).toBeCloseTo(1);
    });

    it('should handle zero vector', () => {
      const v = new Vector(0, 0);
      const normalized = v.normalize();
      expect(normalized.x).toBe(0);
      expect(normalized.y).toBe(0);
    });
  });
});
```

---

## Phase 8: Documentation & Code Style

### 8.1 Add JSDoc Comments

```typescript
/**
 * Represents a 2D physics-enabled game entity.
 * @example
 * const unit = new Swordsman(new Vector(0, 0), 0);
 * unit.step(gameContext);
 */
export abstract class ArmyUnit extends BaseArmyUnit {
  /**
   * Applies damage to the unit, consuming armor first.
   * @param rawDamage - The amount of damage before armor reduction
   * @returns The actual damage dealt after armor
   */
  applyDamage(rawDamage: number): number {
    // ...
  }
}
```

### 8.2 Consistent Naming Conventions

- **Classes**: PascalCase (`SpatiallyHashedObjects`)
- **Methods/Functions**: camelCase (`calculateCollision`)
- **Constants**: SCREAMING_SNAKE_CASE (`ATTACK_RANGE`)
- **Interfaces**: PascalCase with `I` prefix optional (`Stepable` or `IStepable`)
- **Type aliases**: PascalCase (`CollisionableObject`)
- **Files**: camelCase for utilities, PascalCase for classes

---

## Phase 9: Architecture Improvements

### 9.1 Consider Entity-Component-System (ECS)

For a more scalable architecture if adding many unit types:

```typescript
// Components
interface HealthComponent { health: number; maxHealth: number; }
interface PositionComponent { x: number; y: number; }
interface VelocityComponent { vx: number; vy: number; }
interface RenderComponent { sprite: string; }
interface CombatComponent { damage: number; range: number; }

// Systems
class MovementSystem {
  update(entities: Entity[], dt: number): void {
    entities
      .filter(e => e.has('position', 'velocity'))
      .forEach(e => {
        e.position.x += e.velocity.vx * dt;
        e.position.y += e.velocity.vy * dt;
      });
  }
}
```

### 9.2 State Machine for Unit AI

```typescript
enum UnitState {
  IDLE,
  MOVING,
  ATTACKING,
  DYING,
}

class UnitStateMachine {
  private state: UnitState = UnitState.IDLE;
  private unit: ArmyUnit;

  update(ctx: GameContext): void {
    switch (this.state) {
      case UnitState.IDLE:
        if (this.unit.target) this.transition(UnitState.MOVING);
        break;
      case UnitState.MOVING:
        if (this.isInRange()) this.transition(UnitState.ATTACKING);
        else if (!this.unit.target) this.transition(UnitState.IDLE);
        break;
      case UnitState.ATTACKING:
        if (!this.isInRange()) this.transition(UnitState.MOVING);
        break;
    }
  }
}
```

---

## Implementation Order

### Immediate (Bug Fixes)
1. Fix camera bounds bug
2. Fix archer spawn cooldown bug
3. Fix vector normalization
4. Fix enemy initial direction
5. Add localStorage error handling

### Short-term (Maintainability)
6. Create configuration files
7. Remove magic numbers
8. Add type safety (remove `any` casts)
9. Add JSDoc comments
10. Setup ESLint/Prettier

### Medium-term (Architecture)
11. Implement EventEmitter
12. Create InputManager
13. Refactor Player into smaller classes
14. Add object pooling for particles
15. Modernize sprite system

### Long-term (Future-proofing)
16. Add unit tests
17. Consider ECS architecture
18. Add state machines for AI
19. Create level editor tools
20. Add sound system

---

## Removed 13KB Optimizations

The following tricks should be reverted for readability:

| Optimization | Replacement |
|-------------|-------------|
| Single-letter IDs (`'c'`, `'bg'`) | Descriptive IDs (`'castle'`, `'background'`) |
| BigInt sprite encoding | PNG sprites with atlas |
| Compressed variable names | Descriptive names |
| Inline magic numbers | Named constants |
| Mixin-heavy inheritance | Clearer class hierarchy |
| Type guards only | Proper class inheritance + guards |

---

## Notes for Next Iteration

When changing game dynamics, the architecture should support:

1. **New unit types**: Add to `UnitConfig`, create class extending `ArmyUnit`
2. **New weapons**: Create projectile class, add to archer/new ranged units
3. **New game modes**: Level system already supports different configurations
4. **Multiplayer prep**: EventEmitter can be extended for network sync
5. **Save/Load**: GameContext can be serialized with minor additions
