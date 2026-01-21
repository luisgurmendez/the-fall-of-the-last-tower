# Unit Collision System

This document describes the collision detection and resolution system for champions and minions.

## Overview

The collision system prevents units from overlapping by:
1. Detecting circle-circle collisions between entities
2. Separating overlapping units with mass-based pushing
3. Using spatial partitioning for O(n) performance

## Game Loop Integration

Collision resolution happens after entity updates but before fog of war:

```
ServerGameContext.update(dt)
│
├─ 1. updateEntities()      ← Units move toward targets
├─ 2. resolveCollisions()   ← Push overlapping units apart
├─ 3. updateFogOfWar()
├─ 4. checkMinionWaveSpawn()
└─ 5. removeDeadEntities()
```

## Collision Detection

### Circle-Circle Detection

All units have a collision radius. Two units collide when their radii overlap:

```typescript
function checkCollision(a: ServerEntity, b: ServerEntity): boolean {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const distSq = dx * dx + dy * dy;  // Squared distance (avoid sqrt)
  const minDist = a.getRadius() + b.getRadius();
  return distSq < minDist * minDist;
}
```

### Unit Radii

| Unit Type | Radius | Notes |
|-----------|--------|-------|
| Champion | 25 | Standard champion size |
| Melee Minion | 20 | |
| Caster Minion | 20 | |
| Tower | 50 | Immovable (infinite mass) |

## Collision Resolution

### Separation Algorithm

When two units overlap, they're pushed apart along the line connecting their centers:

```typescript
function calculateSeparation(a: ServerEntity, b: ServerEntity): Vector {
  const direction = Vector.direction(a.position, b.position);
  const distance = a.position.distanceTo(b.position);
  const overlap = (a.getRadius() + b.getRadius()) - distance;

  if (overlap <= 0) return Vector.zero();

  return direction.scaled(overlap);
}
```

### Mass System

Units have different masses affecting how much they're pushed:

| Unit Type | Mass | Behavior |
|-----------|------|----------|
| Champion | 100 | Pushed equally by other champions |
| Melee Minion | 50 | Pushed more by champions |
| Caster Minion | 30 | Pushed even more easily |
| Tower | Infinity | Never moves, others pushed fully |

**Mass ratio calculation:**
```typescript
const massA = a.getMass();
const massB = b.getMass();
const totalMass = massA + massB;

// Heavier units move less
const ratioA = massB / totalMass;  // A's movement factor
const ratioB = massA / totalMass;  // B's movement factor

// Apply separation
a.position.add(separation.scaled(-ratioA));
b.position.add(separation.scaled(ratioB));
```

**Example**: Champion (100) vs Minion (50)
- Champion moves: 50/150 = 33% of separation distance
- Minion moves: 100/150 = 67% of separation distance

## Spatial Partitioning

For performance, entities are placed in a spatial grid. Collision checks only happen between entities in nearby cells.

### Grid Structure

```typescript
class SpatialGrid {
  cellSize: number = 100;  // Game units per cell
  cells: Map<string, ServerEntity[]>;

  // Cell key from position
  getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  // Query nearby entities
  getNearby(position: Vector, radius: number): ServerEntity[] {
    // Only check cells within range
    // ...
  }
}
```

### Performance

| Algorithm | Complexity | 100 entities | 1000 entities |
|-----------|------------|--------------|---------------|
| Naive | O(n²) | 4,950 checks | 499,500 checks |
| Spatial Grid | O(n) | ~100-200 checks | ~1,000-2,000 checks |

## Configuration

```typescript
interface CollisionConfig {
  separationStrength: number;    // 0-1, how hard to push (default: 1.0)
  maxSeparationDistance: number; // Max push per tick (default: 50)
  spatialGridCellSize: number;   // Grid cell size (default: 100)
  useSpatialGrid: boolean;       // Enable optimization (default: true)
}
```

## Collision Interface

Entities implement these methods to participate in collision:

```typescript
abstract class ServerEntity {
  // Whether entity participates in collision
  isCollidable(): boolean { return false; }

  // Collision radius
  getRadius(): number { return 0; }

  // Collision mass (Infinity for immovable)
  getMass(): number { return 100; }
}
```

## Special Cases

### Same Position

When units spawn at the exact same position (distance ≈ 0), they're pushed in a random direction to avoid division by zero:

```typescript
if (distance < 0.001) {
  const angle = Math.random() * Math.PI * 2;
  return new Vector(
    Math.cos(angle) * overlap,
    Math.sin(angle) * overlap
  );
}
```

### Dead Units

Dead units are excluded from collision (`isCollidable()` returns false when `isDead` is true).

### Infinite Mass

When one unit has infinite mass (like a tower), only the other unit moves:

```typescript
if (!isFinite(massA)) {
  b.position.add(separation);  // B moves fully
  return;
}
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/server/src/systems/CollisionSystem.ts` | Detection and resolution |
| `packages/server/src/systems/SpatialGrid.ts` | Spatial partitioning |
| `packages/server/src/simulation/ServerEntity.ts` | Base collision interface |
| `packages/server/src/simulation/ServerChampion.ts` | Champion collision (radius: 25, mass: 100) |
| `packages/server/src/simulation/ServerMinion.ts` | Minion collision (radius: 20, mass: 30-50) |
| `packages/server/src/game/ServerGameContext.ts` | Integration into game loop |
| `packages/server/src/test/CollisionSystem.test.ts` | Unit tests |

## Testing

Run collision tests:
```bash
cd packages/server
bun test src/test/CollisionSystem.test.ts
```

## Visual Verification

When testing in-game:
1. Champions should not walk through each other
2. Minions should spread out instead of stacking
3. Champions should push minions more than vice versa
4. Units should not get stuck on towers
