# Collision Masks & Animation Synchronization Plan

## Executive Summary

This document outlines a comprehensive plan to solve three interconnected problems in Siege:

1. **Collision Masks** - Replace sprite-size-based collision with configurable collision shapes
2. **Attack Animation Sync** - Synchronize damage application with attack animation keyframes
3. **Ability Animation Sync** - Synchronize projectile/effect spawning with ability animations

These problems are interconnected because they all require **shared metadata between server and client** that defines timing, shapes, and triggers for game entities.

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Problem Deep Dive](#2-problem-deep-dive)
3. [Proposed Solution: Colocated Entity Metadata](#3-proposed-solution-colocated-entity-metadata)
4. [Collision Mask Implementation](#4-collision-mask-implementation)
5. [Animation Timing System](#5-animation-timing-system)
6. [Server-Side Action Scheduling](#6-server-side-action-scheduling)
7. [Alternative Approaches Considered](#7-alternative-approaches-considered)
8. [Migration Strategy](#8-migration-strategy)
9. [Impact Analysis](#9-impact-analysis)
10. [Implementation Phases](#10-implementation-phases)

---

## 1. Current Architecture Analysis

### 1.1 Collision Detection (Current)

**Location:** `packages/server/src/systems/CollisionSystem.ts`

**Current Implementation:**
```typescript
// Champions have hardcoded radius of 25 units
getRadius(): number {
  return 25;
}

// Collision check uses squared distance
const distSq = (posA.x - posB.x)² + (posA.y - posB.y)²;
const radiusSum = radiusA + radiusB;
if (distSq < radiusSum * radiusSum) {
  // Collision detected
}
```

**Issues:**
- Fixed 25-unit radius for ALL champions regardless of visual size
- No support for non-circular collision shapes
- No offset support (collision center might differ from sprite center)
- Sprites can be 64x64+ pixels while collision is only 25 units

### 1.2 Attack System (Current)

**Location:** `packages/server/src/simulation/ServerChampion.ts`

**Current Flow:**
```
1. Server: performBasicAttack(target) called
2. Server: Damage calculated and applied IMMEDIATELY
3. Server: GameEvent.BASIC_ATTACK emitted with animationDuration
4. Client: Receives event, plays attack animation
5. Client: Animation plays for animationDuration
```

**Problem:** Damage happens at frame 0, but attack animation might have a 300ms wind-up before the "hit" frame.

### 1.3 Ability/Projectile System (Current)

**Location:** `packages/server/src/simulation/ServerAbilityExecutor.ts`

**Current Flow:**
```
1. Player presses ability key
2. Server receives cast command
3. Server validates (mana, cooldown, range)
4. Server executes ability IMMEDIATELY:
   - Creates projectile at current position
   - Applies instant effects
5. Server emits ABILITY_CAST event
6. Client plays ability animation
```

**Problem:** Projectile spawns at frame 0, but the "cast point" in the animation might be at frame 8 (when the character's hand reaches forward, for example).

---

## 2. Problem Deep Dive

### 2.1 Why Collision Masks Matter

Consider a champion with a sword:
```
┌────────────────────────────────┐
│   Visual Sprite (64x64)        │
│                                │
│    🗡️   ●───●                  │  ← Sword extends beyond body
│        /│\                     │
│        / \                     │
│   ◄────────────────►           │
│   Collision should only be     │
│   the body, not the sword      │
│                                │
│   ┌──────────┐                 │
│   │ Collision│ (24x40 rect)    │
│   │  Mask    │                 │
│   └──────────┘                 │
└────────────────────────────────┘
```

**Real-world examples:**
- Warrior champion swinging a large sword: Visual = 80px, Collision = 30px body
- Mage champion with flowing robes: Visual = 56px, Collision = 24px body
- Dragon jungle camp with wings spread: Visual = 120px, Collision = 60px body
- Tower with decorative spire: Visual = 96px, Collision = 48px base

### 2.2 Why Animation Sync Matters

**Attack Animation Timeline (Current vs Ideal):**

```
CURRENT (Broken):
Time:     0ms────100ms────200ms────300ms────400ms
Server:   [DAMAGE]
Client:   [Wind-up══════════[HIT]════════Wind-down]
          ↑                  ↑
          Damage here       Animation shows hit here
          (too early!)

IDEAL (Synchronized):
Time:     0ms────100ms────200ms────300ms────400ms
Server:   [Start]═══════════[DAMAGE]
Client:   [Wind-up══════════[HIT]════════Wind-down]
          ↑                  ↑
          Server waits       Both damage and visual
                             happen together
```

**Why this matters for gameplay:**
- Players expect visual feedback to match game state
- Dodge timing feels wrong when damage precedes visual
- Competitive integrity suffers when animation misleads
- Attack speed scaling needs to affect wind-up proportionally

### 2.3 Why Projectile Sync Matters

**Ability Cast Timeline:**

```
CURRENT (Broken):
Time:     0ms────100ms────200ms────300ms────400ms
Server:   [PROJECTILE SPAWNS]
Client:   [Cast animation══════════════════════]
          ↑                 ↑
          Projectile here   Hand reaches forward here
          (too early!)

IDEAL (Synchronized):
Time:     0ms────100ms────200ms────300ms────400ms
Server:   [Cast Start]═════[PROJECTILE]
Client:   [Cast animation══[Cast Point]═══════]
                           ↑
                           Both projectile and visual
                           happen together
```

---

## 3. Proposed Solution: Colocated Entity Metadata

### 3.1 Core Concept

**Colocate collision and animation data with entity definitions** - each entity type defines its own collision shape and animation timing alongside its stats and abilities.

This follows the principle of **data locality**: all information about an entity lives in one place, making it easier to add new entities and maintain existing ones.

### 3.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       packages/shared/src/                           │
│                                                                      │
│  types/                                                              │
│  ├── collision.ts      ← NEW: CollisionShape types                  │
│  ├── animation.ts      ← NEW: AnimationData, Keyframe types         │
│  ├── minions.ts        ← ADD: collision & animations to MinionStats │
│  └── structures.ts     ← ADD: collision to TowerStats, NexusStats   │
│                                                                      │
│  champions/definitions/                                              │
│  ├── warrior.ts        ← ADD: collision & animations to definition  │
│  ├── magnus.ts         ← ADD: collision & animations to definition  │
│  ├── elara.ts          ← ADD: collision & animations to definition  │
│  ├── vex.ts            ← ADD: collision & animations to definition  │
│  └── gorath.ts         ← ADD: collision & animations to definition  │
│                                                                      │
│  config/                                                             │
│  └── MOBAConfig.ts     ← ADD: collision & animations to jungle camps│
└─────────────────────────────────────────────────────────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────────┐  ┌─────────────────────────────────┐
│     packages/server/        │  │          src/ (client)           │
│                             │  │                                  │
│ • Use collision shapes      │  │ • Use collision for visuals     │
│ • Schedule action triggers  │  │ • Play animations with keyframes│
│ • Track animation state     │  │ • Sync effects to keyframes     │
│ • Apply damage at keyframe  │  │                                  │
└─────────────────────────────┘  └──────────────────────────────────┘
```

### 3.3 Benefits of Colocation

1. **Single source of truth** - All entity data in one file
2. **Easy to add entities** - Copy a definition file, modify everything in one place
3. **No registry synchronization** - No risk of collision registry being out of sync with entity definitions
4. **Better discoverability** - Reading a champion file shows everything about that champion
5. **Easier code review** - Changes to an entity are isolated to one file

### 3.4 Data Structures

```typescript
// packages/shared/src/types/collision.ts

interface CollisionShape {
  type: 'circle' | 'rectangle' | 'capsule';
}

interface CircleCollision extends CollisionShape {
  type: 'circle';
  radius: number;
  offset?: { x: number; y: number };  // From entity center
}

interface RectangleCollision extends CollisionShape {
  type: 'rectangle';
  width: number;
  height: number;
  offset?: { x: number; y: number };
}

interface CapsuleCollision extends CollisionShape {
  type: 'capsule';
  radius: number;
  height: number;  // Total height including caps
  offset?: { x: number; y: number };
}

type EntityCollision = CircleCollision | RectangleCollision | CapsuleCollision;
```

```typescript
// packages/shared/src/types/animation.ts

interface AnimationKeyframe {
  frame: number;           // Frame index where this triggers
  trigger: KeyframeTrigger;
}

type KeyframeTrigger =
  | { type: 'damage' }                           // Apply attack damage
  | { type: 'projectile' }                       // Spawn projectile
  | { type: 'effect'; effectId: string }         // Apply effect/buff
  | { type: 'sound'; soundId: string }           // Play sound
  | { type: 'vfx'; vfxId: string }               // Spawn visual effect

interface AnimationData {
  id: string;
  totalFrames: number;
  baseFrameDuration: number;  // Duration per frame at 1.0 speed (in seconds)
  loop: boolean;
  keyframes: AnimationKeyframe[];
}

interface EntityAnimations {
  idle: AnimationData;
  walk: AnimationData;
  attack?: AnimationData;
  death?: AnimationData;
}

interface ChampionAnimations extends EntityAnimations {
  abilities: Record<string, AnimationData>;  // Keyed by ability ID
}
```

---

## 4. Collision Mask Implementation

### 4.1 Collision Data in Entity Definitions

Instead of a separate registry, collision shapes are defined alongside each entity.

**Champion Example** (`packages/shared/src/champions/definitions/warrior.ts`):

```typescript
import { ChampionDefinition } from '../../types/champions';
import { CircleCollision } from '../../types/collision';
import { ChampionAnimations } from '../../types/animation';

// Collision shape for Warrior
const collision: CircleCollision = {
  type: 'circle',
  radius: 14,
  offset: { x: 0, y: 4 }  // Slightly offset down for feet
};

// Animation data for Warrior
const animations: ChampionAnimations = {
  idle: { id: 'idle', totalFrames: 4, baseFrameDuration: 0.2, loop: true, keyframes: [] },
  walk: { id: 'walk', totalFrames: 8, baseFrameDuration: 0.1, loop: true, keyframes: [] },
  attack: {
    id: 'attack',
    totalFrames: 6,
    baseFrameDuration: 0.083,  // 500ms total at 1.0 AS
    loop: false,
    keyframes: [
      { frame: 3, trigger: { type: 'damage' } },
      { frame: 3, trigger: { type: 'sound', soundId: 'sword_hit' } }
    ]
  },
  death: { id: 'death', totalFrames: 8, baseFrameDuration: 0.125, loop: false, keyframes: [] },
  abilities: {
    'warrior_slash': {
      id: 'warrior_slash',
      totalFrames: 8,
      baseFrameDuration: 0.05,
      loop: false,
      keyframes: [
        { frame: 4, trigger: { type: 'damage' } },
        { frame: 4, trigger: { type: 'vfx', vfxId: 'slash_arc' } }
      ]
    }
    // ... other abilities
  }
};

export const WarriorDefinition: ChampionDefinition = {
  id: 'warrior',
  name: 'Kael',
  title: 'The Bladestorm',
  championClass: 'warrior',
  attackType: 'melee',
  resourceType: 'mana',

  // NEW: Collision and animation data
  collision,
  animations,
  attackAnimationSpeedScale: true,  // Attack animation scales with AS

  baseStats: { /* ... existing stats ... */ },
  growthStats: { /* ... existing stats ... */ },
  abilities: { /* ... existing abilities ... */ },
  passive: { /* ... existing passive ... */ }
};
```

**Minion Example** (`packages/shared/src/types/minions.ts`):

```typescript
export interface MinionStats {
  // Existing stats...
  health: number;
  armor: number;
  attackDamage: number;
  // ...

  // NEW: Collision and animation data
  collision: EntityCollision;
  animations: EntityAnimations;
}

export const DEFAULT_MINION_STATS: Record<MinionType, MinionStats> = {
  melee: {
    health: 477,
    armor: 0,
    // ... existing stats ...

    collision: { type: 'circle', radius: 10 },
    animations: {
      idle: { id: 'idle', totalFrames: 4, baseFrameDuration: 0.15, loop: true, keyframes: [] },
      walk: { id: 'walk', totalFrames: 6, baseFrameDuration: 0.1, loop: true, keyframes: [] },
      attack: {
        id: 'attack',
        totalFrames: 4,
        baseFrameDuration: 0.1,
        loop: false,
        keyframes: [{ frame: 2, trigger: { type: 'damage' } }]
      }
    }
  },
  caster: {
    // ... similar structure with radius: 8 ...
  },
  // ...
};
```

**Jungle Creature Example** (`packages/shared/src/config/MOBAConfig.ts`):

```typescript
CREATURE_STATS: {
  gromp: {
    health: 500,
    damage: 30,
    // ... existing stats ...

    collision: { type: 'circle', radius: 18 },
    animations: {
      idle: { id: 'idle', totalFrames: 4, baseFrameDuration: 0.2, loop: true, keyframes: [] },
      walk: { id: 'walk', totalFrames: 6, baseFrameDuration: 0.12, loop: true, keyframes: [] },
      attack: {
        id: 'attack',
        totalFrames: 5,
        baseFrameDuration: 0.12,
        loop: false,
        keyframes: [{ frame: 3, trigger: { type: 'damage' } }]
      }
    }
  },
  spider: {
    // ... collision radius: 12 ...
  },
  // ...
}
```

**Structure Example** (`packages/shared/src/types/structures.ts`):

```typescript
export interface TowerStats {
  // Existing stats...
  health: number;
  attackDamage: number;
  attackRange: number;
  // ...

  // NEW: Collision (towers don't need animations)
  collision: CircleCollision;
}

export const DEFAULT_TOWER_STATS: Record<TowerTier, TowerStats> = {
  1: {
    // ... existing stats ...
    collision: { type: 'circle', radius: 48 }
  },
  // ...
};

export interface NexusStats {
  health: number;
  armor: number;
  magicResist: number;
  collision: CircleCollision;
}

export const DEFAULT_NEXUS_STATS: NexusStats = {
  health: 5500,
  armor: 20,
  magicResist: 20,
  collision: { type: 'circle', radius: 75 }
};
```

### 4.2 Server Collision System Updates

```typescript
// packages/server/src/systems/CollisionSystem.ts

interface CollisionResult {
  colliding: boolean;
  overlap: number;
  separationVector: Vector;
}

function checkCollision(
  entityA: { position: Vector; collision: EntityCollision },
  entityB: { position: Vector; collision: EntityCollision }
): CollisionResult {
  const typeA = entityA.collision.type;
  const typeB = entityB.collision.type;

  // Circle vs Circle
  if (typeA === 'circle' && typeB === 'circle') {
    return circleVsCircle(entityA, entityB);
  }

  // Circle vs Rectangle
  if ((typeA === 'circle' && typeB === 'rectangle') ||
      (typeA === 'rectangle' && typeB === 'circle')) {
    return circleVsRectangle(entityA, entityB);
  }

  // Rectangle vs Rectangle
  if (typeA === 'rectangle' && typeB === 'rectangle') {
    return rectangleVsRectangle(entityA, entityB);
  }

  // Capsule handling
  if (typeA === 'capsule' || typeB === 'capsule') {
    return capsuleCollision(entityA, entityB);
  }

  return { colliding: false, overlap: 0, separationVector: { x: 0, y: 0 } };
}

function circleVsCircle(a: CircleEntity, b: CircleEntity): CollisionResult {
  const offsetA = a.collision.offset || { x: 0, y: 0 };
  const offsetB = b.collision.offset || { x: 0, y: 0 };

  const centerA = {
    x: a.position.x + offsetA.x,
    y: a.position.y + offsetA.y
  };
  const centerB = {
    x: b.position.x + offsetB.x,
    y: b.position.y + offsetB.y
  };

  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = a.collision.radius + b.collision.radius;

  if (distSq >= radiusSum * radiusSum) {
    return { colliding: false, overlap: 0, separationVector: { x: 0, y: 0 } };
  }

  const dist = Math.sqrt(distSq);
  const overlap = radiusSum - dist;

  // Normalize separation direction
  const nx = dist > 0 ? dx / dist : 1;
  const ny = dist > 0 ? dy / dist : 0;

  return {
    colliding: true,
    overlap,
    separationVector: { x: nx * overlap, y: ny * overlap }
  };
}

// Similar implementations for other shape combinations...
```

### 4.3 Entity Interface Updates

```typescript
// packages/server/src/simulation/interfaces.ts

interface Collidable {
  getPosition(): Vector;
  getCollisionShape(): EntityCollision;
  getMass(): number;
  isCollidable(): boolean;
}

// packages/server/src/simulation/ServerChampion.ts
class ServerChampion implements Collidable {
  private collisionShape: EntityCollision;

  constructor(definition: ChampionDefinition, metadata: ChampionMetadata) {
    this.collisionShape = metadata.collision;
  }

  getCollisionShape(): EntityCollision {
    return this.collisionShape;
  }

  // Deprecated - keep for backwards compatibility during migration
  getRadius(): number {
    if (this.collisionShape.type === 'circle') {
      return this.collisionShape.radius;
    }
    // Approximate for non-circles
    if (this.collisionShape.type === 'rectangle') {
      return Math.max(this.collisionShape.width, this.collisionShape.height) / 2;
    }
    return 25; // Fallback
  }
}
```

---

## 5. Animation Timing System

### 5.1 Animation Data Registry

```typescript
// packages/shared/src/metadata/AnimationRegistry.ts

export const AnimationRegistry: Record<string, Record<string, AnimationData>> = {
  'champion:warrior': {
    idle: {
      id: 'idle',
      totalFrames: 4,
      baseFrameDuration: 0.2,  // 200ms per frame, 800ms total
      loop: true,
      keyframes: []
    },
    walk: {
      id: 'walk',
      totalFrames: 8,
      baseFrameDuration: 0.1,  // 100ms per frame
      loop: true,
      keyframes: []
    },
    attack: {
      id: 'attack',
      totalFrames: 6,
      baseFrameDuration: 0.083,  // ~500ms total at 1.0 attack speed
      loop: false,
      keyframes: [
        { frame: 3, trigger: { type: 'damage' } },  // Damage on frame 3 (halfway)
        { frame: 3, trigger: { type: 'sound', soundId: 'sword_hit' } }
      ]
    },
    death: {
      id: 'death',
      totalFrames: 8,
      baseFrameDuration: 0.125,  // 1 second total
      loop: false,
      keyframes: []
    },
    // Abilities
    'ability:warrior_slash': {
      id: 'warrior_slash',
      totalFrames: 8,
      baseFrameDuration: 0.05,  // 400ms total
      loop: false,
      keyframes: [
        { frame: 4, trigger: { type: 'damage' } },
        { frame: 4, trigger: { type: 'vfx', vfxId: 'slash_arc' } }
      ]
    },
    'ability:warrior_charge': {
      id: 'warrior_charge',
      totalFrames: 6,
      baseFrameDuration: 0.067,  // 400ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'effect', effectId: 'unstoppable' } },
        { frame: 5, trigger: { type: 'damage' } }  // Damage at end of dash
      ]
    }
  },

  'champion:mage': {
    // ...similar structure
    'ability:mage_fireball': {
      id: 'mage_fireball',
      totalFrames: 6,
      baseFrameDuration: 0.067,  // 400ms total
      loop: false,
      keyframes: [
        { frame: 3, trigger: { type: 'projectile' } },  // Spawn fireball mid-cast
        { frame: 3, trigger: { type: 'sound', soundId: 'fireball_cast' } }
      ]
    }
  },

  'minion:melee': {
    attack: {
      id: 'attack',
      totalFrames: 4,
      baseFrameDuration: 0.1,  // 400ms total
      loop: false,
      keyframes: [
        { frame: 2, trigger: { type: 'damage' } }
      ]
    }
  }
};
```

### 5.2 Animation Speed Calculation

```typescript
// packages/shared/src/utils/animationUtils.ts

interface AnimationPlayback {
  animation: AnimationData;
  speedMultiplier: number;
  totalDuration: number;        // Total animation time in seconds
  frameDuration: number;        // Duration per frame in seconds
  triggerTimes: Map<number, number>;  // frame -> time in seconds
}

/**
 * Calculate animation playback timings based on speed multiplier
 */
export function calculateAnimationPlayback(
  animation: AnimationData,
  speedMultiplier: number = 1.0
): AnimationPlayback {
  const frameDuration = animation.baseFrameDuration / speedMultiplier;
  const totalDuration = frameDuration * animation.totalFrames;

  // Calculate when each keyframe triggers
  const triggerTimes = new Map<number, number>();
  for (const keyframe of animation.keyframes) {
    const triggerTime = keyframe.frame * frameDuration;
    triggerTimes.set(keyframe.frame, triggerTime);
  }

  return {
    animation,
    speedMultiplier,
    totalDuration,
    frameDuration,
    triggerTimes
  };
}

/**
 * Get attack animation speed based on attack speed stat
 */
export function getAttackAnimationSpeed(attackSpeed: number): number {
  // Attack speed of 1.0 = normal speed
  // Attack speed of 2.0 = 2x animation speed (half duration)
  // Cap minimum animation at 0.15s (very high attack speed)
  const baseAttackDuration = 0.5;  // 500ms base
  const minAttackDuration = 0.15;  // 150ms minimum

  const targetDuration = baseAttackDuration / attackSpeed;
  const clampedDuration = Math.max(targetDuration, minAttackDuration);

  // Return speed multiplier to achieve target duration
  return baseAttackDuration / clampedDuration;
}
```

---

## 6. Server-Side Action Scheduling

### 6.1 Animation State Tracker

The server needs to track active animations to know when to trigger effects.

```typescript
// packages/server/src/systems/AnimationScheduler.ts

interface ScheduledAction {
  entityId: string;
  triggerTime: number;       // Game time when action should trigger
  trigger: KeyframeTrigger;
  context: ActionContext;    // Additional data needed for the action
}

interface ActionContext {
  targetId?: string;
  position?: Vector;
  direction?: Vector;
  damage?: number;
  abilityId?: string;
}

interface ActiveAnimation {
  entityId: string;
  animationId: string;
  startTime: number;
  playback: AnimationPlayback;
  scheduledActions: ScheduledAction[];
}

class AnimationScheduler {
  private activeAnimations: Map<string, ActiveAnimation> = new Map();
  private pendingActions: ScheduledAction[] = [];

  /**
   * Start an animation and schedule its keyframe triggers
   */
  startAnimation(
    entityId: string,
    animation: AnimationData,
    speedMultiplier: number,
    context: ActionContext,
    currentGameTime: number
  ): void {
    const playback = calculateAnimationPlayback(animation, speedMultiplier);

    // Schedule all keyframe triggers
    const scheduledActions: ScheduledAction[] = [];
    for (const keyframe of animation.keyframes) {
      const triggerTime = currentGameTime + (keyframe.frame * playback.frameDuration);

      const action: ScheduledAction = {
        entityId,
        triggerTime,
        trigger: keyframe.trigger,
        context
      };

      scheduledActions.push(action);
      this.pendingActions.push(action);
    }

    // Sort pending actions by trigger time
    this.pendingActions.sort((a, b) => a.triggerTime - b.triggerTime);

    // Store active animation
    this.activeAnimations.set(entityId, {
      entityId,
      animationId: animation.id,
      startTime: currentGameTime,
      playback,
      scheduledActions
    });
  }

  /**
   * Process scheduled actions that should trigger this tick
   */
  update(currentGameTime: number, gameRoom: GameRoom): void {
    while (this.pendingActions.length > 0) {
      const action = this.pendingActions[0];

      if (action.triggerTime > currentGameTime) {
        break;  // No more actions to trigger this tick
      }

      // Remove from queue
      this.pendingActions.shift();

      // Execute the action
      this.executeAction(action, gameRoom);
    }

    // Clean up finished animations
    for (const [entityId, anim] of this.activeAnimations) {
      const endTime = anim.startTime + anim.playback.totalDuration;
      if (currentGameTime >= endTime) {
        this.activeAnimations.delete(entityId);
      }
    }
  }

  /**
   * Execute a scheduled action
   */
  private executeAction(action: ScheduledAction, gameRoom: GameRoom): void {
    const entity = gameRoom.getEntity(action.entityId);
    if (!entity || !entity.isAlive?.()) {
      return;  // Entity died or was removed
    }

    switch (action.trigger.type) {
      case 'damage':
        this.executeDamage(action, gameRoom);
        break;
      case 'projectile':
        this.executeProjectile(action, gameRoom);
        break;
      case 'effect':
        this.executeEffect(action, gameRoom);
        break;
      case 'sound':
        // Server doesn't handle sounds, but could emit event for client
        break;
      case 'vfx':
        // Server doesn't handle VFX, but could emit event for client
        break;
    }
  }

  private executeDamage(action: ScheduledAction, gameRoom: GameRoom): void {
    const { entityId, context } = action;
    const { targetId, damage } = context;

    if (!targetId || damage === undefined) return;

    const attacker = gameRoom.getChampion(entityId);
    const target = gameRoom.getEntity(targetId);

    if (!attacker || !target || !target.isAlive?.()) return;

    // Apply the damage
    target.takeDamage(damage, 'physical', attacker);
  }

  private executeProjectile(action: ScheduledAction, gameRoom: GameRoom): void {
    const { entityId, context } = action;
    const { position, direction, abilityId } = context;

    if (!position || !direction || !abilityId) return;

    const caster = gameRoom.getChampion(entityId);
    if (!caster) return;

    const ability = AbilityRegistry.get(abilityId);
    if (!ability) return;

    // Create the projectile at the scheduled time
    gameRoom.spawnProjectile({
      position,
      direction,
      speed: ability.projectileSpeed!,
      radius: ability.projectileRadius!,
      sourceId: entityId,
      abilityId,
      damage: calculateAbilityDamage(ability, caster),
      damageType: ability.damage!.type,
      piercing: ability.piercing
    });
  }

  private executeEffect(action: ScheduledAction, gameRoom: GameRoom): void {
    const { entityId, context } = action;
    const effectId = (action.trigger as { type: 'effect'; effectId: string }).effectId;

    const entity = gameRoom.getEntity(entityId);
    if (!entity) return;

    entity.applyEffect(effectId, context);
  }

  /**
   * Cancel all scheduled actions for an entity (e.g., when stunned or killed)
   */
  cancelAnimation(entityId: string): void {
    this.activeAnimations.delete(entityId);
    this.pendingActions = this.pendingActions.filter(a => a.entityId !== entityId);
  }

  /**
   * Check if entity is currently in an animation
   */
  isAnimating(entityId: string): boolean {
    return this.activeAnimations.has(entityId);
  }
}
```

### 6.2 Updated Attack Flow

```typescript
// packages/server/src/simulation/ServerChampion.ts

performBasicAttack(target: AttackableEntity): void {
  // Calculate damage (but don't apply yet!)
  const damage = this.calculateAttackDamage(target);

  // Get attack animation data
  const attackAnim = this.metadata.animations.attack;
  if (!attackAnim) {
    // Fallback: apply damage immediately (legacy behavior)
    this.applyAttackDamage(target, damage);
    return;
  }

  // Calculate animation speed based on attack speed
  const animSpeed = getAttackAnimationSpeed(this.stats.attackSpeed);
  const playback = calculateAnimationPlayback(attackAnim, animSpeed);

  // Schedule the attack animation with damage trigger
  this.gameRoom.animationScheduler.startAnimation(
    this.id,
    attackAnim,
    animSpeed,
    {
      targetId: target.id,
      damage,
      damageType: 'physical'
    },
    this.gameRoom.gameTime
  );

  // Emit animation start event for client
  this.gameRoom.context.addEvent(GameEventType.BASIC_ATTACK, {
    entityId: this.id,
    targetId: target.id,
    animationDuration: playback.totalDuration,
    damageFrame: attackAnim.keyframes.find(k => k.trigger.type === 'damage')?.frame ?? 0,
    totalFrames: attackAnim.totalFrames
  });

  // Set attack cooldown
  this.attackCooldown = 1 / this.stats.attackSpeed;
}
```

### 6.3 Updated Ability Cast Flow

```typescript
// packages/server/src/simulation/ServerAbilityExecutor.ts

executeAbility(
  caster: ServerChampion,
  ability: AbilityDefinition,
  target: Vector | Entity
): void {
  // Deduct mana, start cooldown (existing logic)
  caster.useMana(ability.manaCost![ability.rank - 1]);
  caster.startCooldown(ability.id, ability.cooldown![ability.rank - 1]);

  // Get ability animation
  const abilityAnim = caster.metadata.animations.abilities?.[ability.id];

  if (!abilityAnim) {
    // Fallback: execute immediately (legacy behavior)
    this.executeAbilityEffect(caster, ability, target);
    return;
  }

  // Prepare context based on ability type
  const context: ActionContext = {
    abilityId: ability.id,
    position: caster.getPosition(),
    direction: ability.targetType === 'direction'
      ? normalizeVector(subtractVectors(target as Vector, caster.getPosition()))
      : undefined,
    targetId: ability.targetType === 'unit' ? (target as Entity).id : undefined
  };

  // Schedule the animation
  const playback = calculateAnimationPlayback(abilityAnim, 1.0);

  this.gameRoom.animationScheduler.startAnimation(
    caster.id,
    abilityAnim,
    1.0,  // Ability animations typically don't scale with stats
    context,
    this.gameRoom.gameTime
  );

  // Emit ability cast event
  this.gameRoom.context.addEvent(GameEventType.ABILITY_CAST, {
    entityId: caster.id,
    abilityId: ability.id,
    targetX: 'x' in target ? target.x : target.getPosition().x,
    targetY: 'y' in target ? target.y : target.getPosition().y,
    animationDuration: playback.totalDuration,
    castPointFrame: abilityAnim.keyframes.find(k =>
      k.trigger.type === 'projectile' || k.trigger.type === 'damage'
    )?.frame ?? 0,
    totalFrames: abilityAnim.totalFrames
  });
}
```

---

## 7. Alternative Approaches Considered

### 7.1 Client-Driven Animation Events

**Concept:** Client sends "animation trigger" events to server when keyframes are reached.

```
Client plays animation → reaches keyframe 3 → sends "apply_damage" to server
```

**Pros:**
- Simple server implementation
- Perfect visual sync by definition
- Handles variable client framerates

**Cons:**
- ❌ Not authoritative - clients could cheat by sending triggers early
- ❌ Network latency causes desync between clients
- ❌ Dropped packets could lose damage/effects
- ❌ Exploitable for competitive advantage

**Verdict:** Rejected - compromises server authority and competitive integrity.

### 7.2 Fixed Action Windows

**Concept:** Instead of precise frame timing, use time windows.

```
Attack takes 500ms
Damage window: 200ms - 400ms
Damage applies at 400ms (end of window)
```

**Pros:**
- Simpler than frame-precise timing
- Tolerant of minor timing differences
- Works well with variable animation speeds

**Cons:**
- ⚠️ Less precise visual sync
- ⚠️ Fixed windows don't adapt well to attack speed scaling
- ⚠️ Still need animation metadata for window definitions

**Verdict:** Partial adoption - could use as fallback for entities without detailed metadata.

### 7.3 Animation State Machine

**Concept:** Server runs a full animation state machine parallel to client.

```
Server: IDLE → ATTACK_WINDUP → ATTACK_STRIKE → ATTACK_RECOVERY → IDLE
Client: Same state machine, synced via state updates
```

**Pros:**
- Perfect synchronization
- Supports complex animation blending
- Handles interrupts naturally

**Cons:**
- ⚠️ Significant server overhead
- ⚠️ Requires state sync every tick
- ⚠️ Overkill for MOBA where states are simple

**Verdict:** Rejected - too complex for our use case.

### 7.4 Hybrid Approach (Recommended)

**Concept:** Server schedules actions based on animation timing, but uses simple triggers rather than full state tracking.

This is the approach detailed in Section 6. It balances:
- ✅ Server authority
- ✅ Precise timing
- ✅ Reasonable complexity
- ✅ Bandwidth efficiency

---

## 8. Migration Strategy

### Phase 1: Add Type Definitions (Non-Breaking)

1. Create `packages/shared/src/types/collision.ts` with shape types
2. Create `packages/shared/src/types/animation.ts` with keyframe types
3. Update `ChampionDefinition` interface to optionally include collision & animations
4. Export from `packages/shared/src/index.ts` (and `.js`!)
5. No changes to existing collision or attack logic yet

### Phase 2: Add Collision to Entity Definitions

1. Add collision shape to each champion definition file
2. Add collision to `DEFAULT_MINION_STATS` entries
3. Add collision to jungle creature stats in MOBAConfig
4. Add collision to structure stats (towers, nexus)
5. Add new collision checking functions for all shape types
6. Update `CollisionSystem` to read collision from entity definitions
7. Keep `getRadius()` as fallback during migration

### Phase 3: Animation Scheduler

1. Implement `AnimationScheduler` class in server
2. Add to `GameRoom` initialization
3. Call `scheduler.update()` in game loop
4. Initially, no entities use the scheduler (opt-in)

### Phase 4: Attack Synchronization

1. Add attack animations to champion definitions with keyframes
2. Update `performBasicAttack()` to use scheduler when animation exists
3. Update client to read new event properties
4. Test attack feel and timing
5. Adjust keyframes based on playtesting

### Phase 5: Ability Synchronization

1. Add ability animations to champion definitions
2. Update ability executor to use scheduler when animation exists
3. Update client ability rendering
4. Handle edge cases (interrupted casts, CC, death)

### Phase 6: Polish and Cleanup

1. Remove legacy fallback code (`getRadius()` hardcoded values)
2. Audit all entity definitions for proper collision/animation data
3. Performance optimization if needed
4. Documentation update

---

## 9. Impact Analysis

### 9.1 Files Requiring Changes

**New Files:**
```
packages/shared/src/types/
├── collision.ts                # Collision shape type definitions
├── animation.ts                # Animation timing type definitions

packages/shared/src/utils/
└── animationUtils.ts           # Timing calculation helpers

packages/server/src/systems/
└── AnimationScheduler.ts       # Server-side action scheduler
```

**Modified Files (Entity Definitions - Add collision & animations):**
```
packages/shared/src/
├── index.ts                    # Export new types
├── index.js                    # Export new types (CRITICAL!)

packages/shared/src/types/
├── champions.ts                # Add collision/animations to ChampionDefinition
├── minions.ts                  # Add collision/animations to MinionStats
├── structures.ts               # Add collision to TowerStats, NexusStats
├── network.ts                  # Updated event types

packages/shared/src/champions/definitions/
├── warrior.ts                  # Add collision & animations
├── magnus.ts                   # Add collision & animations
├── elara.ts                    # Add collision & animations
├── vex.ts                      # Add collision & animations
├── gorath.ts                   # Add collision & animations

packages/shared/src/config/
├── MOBAConfig.ts               # Add collision/animations to CREATURE_STATS

packages/server/src/
├── systems/CollisionSystem.ts  # Shape-aware collision
├── simulation/ServerChampion.ts    # Attack with scheduler
├── simulation/ServerAbilityExecutor.ts  # Abilities with scheduler
├── game/GameRoom.ts            # Add scheduler

src/ (client)
├── core/OnlineStateManager.ts  # Handle new event properties
├── render/EntityRenderer.ts    # Use collision shapes for debug
├── sprites/PixelArtSpriteAnimator.ts  # Keyframe callbacks
```

### 9.2 Network Protocol Changes

**Updated Events:**

```typescript
// BASIC_ATTACK event
{
  entityId: string;
  targetId: string;
  animationDuration: number;    // Total duration
  damageFrame: number;          // NEW: When damage happens
  totalFrames: number;          // NEW: Total animation frames
}

// ABILITY_CAST event
{
  entityId: string;
  abilityId: string;
  targetX: number;
  targetY: number;
  animationDuration: number;
  castPointFrame: number;       // NEW: When effect triggers
  totalFrames: number;          // NEW: Total animation frames
}
```

**Backwards Compatibility:** Old clients will ignore new properties. New clients should have fallbacks.

### 9.3 Performance Considerations

**Server Impact:**
- Animation scheduler: O(1) per action trigger
- Pending action queue: O(n log n) for sorting (rarely needed)
- Active animation tracking: O(n) where n = animating entities
- Estimated overhead: < 1ms per tick for 200 entities

**Client Impact:**
- No significant changes
- Potentially smoother animations due to keyframe callbacks

### 9.4 Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Animation data out of sync with sprites | Tooling to validate metadata against sprite sheets |
| Edge case: Entity dies during wind-up | Scheduler cancels on death, damage not applied |
| Edge case: Target dies during wind-up | Validate target alive at damage time |
| Edge case: CC interrupts animation | Scheduler supports cancellation |
| Edge case: Attack speed changes mid-attack | Use speed at attack start, don't recalculate |
| Regression in feel | A/B testing, configurable keyframes |

---

## 10. Implementation Phases

### Phase 1: Foundation (1-2 weeks)
- [ ] Create `packages/shared/src/types/collision.ts` with shape types
- [ ] Create `packages/shared/src/types/animation.ts` with keyframe types
- [ ] Create `packages/shared/src/utils/animationUtils.ts` for timing calculations
- [ ] Update `ChampionDefinition` interface to include collision & animations
- [ ] Update `MinionStats` interface to include collision & animations
- [ ] Export from shared package (both .ts and .js!)
- [ ] Unit tests for new types

### Phase 2: Add Collision to Entity Definitions (1 week)
- [ ] Add collision shapes to each champion in `champions/definitions/*.ts`
- [ ] Add collision to `DEFAULT_MINION_STATS` in `types/minions.ts`
- [ ] Add collision to `CREATURE_STATS` in `config/MOBAConfig.ts`
- [ ] Add collision to `TowerStats`, `NexusStats` in `types/structures.ts`
- [ ] Implement shape-aware collision functions in CollisionSystem
- [ ] Update server entities to read collision from definitions
- [ ] Integration tests

### Phase 3: Animation Scheduler (1-2 weeks)
- [ ] Implement `AnimationScheduler` class in server
- [ ] Integrate with GameRoom
- [ ] Add update call to game loop
- [ ] Implement action execution logic (damage, projectile, effect, sound, vfx)
- [ ] Handle cancellation and interrupts (CC, death)
- [ ] Unit tests for scheduler

### Phase 4: Attack Synchronization (1 week)
- [ ] Add attack animations to champion definitions with damage keyframes
- [ ] Update BASIC_ATTACK event type with damageFrame, totalFrames
- [ ] Modify `performBasicAttack()` to use scheduler
- [ ] Add attack animations to minion definitions
- [ ] Update client to sync with server keyframes
- [ ] Playtest and tune keyframes

### Phase 5: Ability Synchronization (1-2 weeks)
- [ ] Add ability animations to champion definitions with cast point keyframes
- [ ] Update ABILITY_CAST event type with castPointFrame, totalFrames
- [ ] Modify ability executor to use scheduler
- [ ] Handle projectile abilities (spawn at cast point)
- [ ] Handle instant damage abilities
- [ ] Handle channeled abilities
- [ ] Client updates
- [ ] Playtest

### Phase 6: Polish (1 week)
- [ ] Remove legacy hardcoded collision radius
- [ ] Remove legacy immediate damage application
- [ ] Performance profiling
- [ ] Edge case testing
- [ ] Update CLAUDE.md with new patterns
- [ ] Update architecture documentation

**Total Estimated Effort:** 6-9 weeks

---

## Appendix A: Example Complete Champion Definition with Collision & Animations

```typescript
// packages/shared/src/champions/definitions/warrior.ts

import { ChampionDefinition, ChampionClass, AttackType } from '../../types/champions';
import { CircleCollision } from '../../types/collision';
import { ChampionAnimations } from '../../types/animation';

// ============== COLLISION ==============
const collision: CircleCollision = {
  type: 'circle',
  radius: 14,
  offset: { x: 0, y: 4 }
};

// ============== ANIMATIONS ==============
const animations: ChampionAnimations = {
  idle: {
    id: 'idle',
    totalFrames: 4,
    baseFrameDuration: 0.2,
    loop: true,
    keyframes: []
  },
  walk: {
    id: 'walk',
    totalFrames: 8,
    baseFrameDuration: 0.1,
    loop: true,
    keyframes: []
  },
  attack: {
    id: 'attack',
    totalFrames: 6,
    baseFrameDuration: 0.083,  // 500ms total at 1.0 AS
    loop: false,
    keyframes: [
      { frame: 0, trigger: { type: 'sound', soundId: 'sword_swing' } },
      { frame: 3, trigger: { type: 'damage' } },  // Hit frame!
      { frame: 3, trigger: { type: 'sound', soundId: 'sword_hit' } }
    ]
  },
  death: {
    id: 'death',
    totalFrames: 8,
    baseFrameDuration: 0.125,
    loop: false,
    keyframes: [
      { frame: 7, trigger: { type: 'sound', soundId: 'death' } }
    ]
  },
  abilities: {
    'warrior_slash': {
      id: 'warrior_slash',
      totalFrames: 8,
      baseFrameDuration: 0.05,  // 400ms total
      loop: false,
      keyframes: [
        { frame: 2, trigger: { type: 'sound', soundId: 'slash_charge' } },
        { frame: 4, trigger: { type: 'damage' } },  // Damage point
        { frame: 4, trigger: { type: 'vfx', vfxId: 'slash_arc' } }
      ]
    },
    'warrior_charge': {
      id: 'warrior_charge',
      totalFrames: 6,
      baseFrameDuration: 0.067,  // 400ms total
      loop: false,
      keyframes: [
        { frame: 0, trigger: { type: 'effect', effectId: 'unstoppable' } },
        { frame: 0, trigger: { type: 'sound', soundId: 'charge_start' } },
        { frame: 5, trigger: { type: 'damage' } },  // End of dash
        { frame: 5, trigger: { type: 'vfx', vfxId: 'impact' } }
      ]
    }
  }
};

// ============== CHAMPION DEFINITION ==============
export const WarriorDefinition: ChampionDefinition = {
  id: 'warrior',
  name: 'Kael',
  title: 'The Bladestorm',
  championClass: 'warrior' as ChampionClass,
  attackType: 'melee' as AttackType,
  resourceType: 'mana',

  // NEW: Collision and animation data colocated with definition
  collision,
  animations,
  attackAnimationSpeedScale: true,

  baseStats: {
    health: 580,
    healthRegen: 8,
    mana: 300,
    manaRegen: 7,
    attackDamage: 60,
    attackSpeed: 0.7,
    armor: 35,
    magicResist: 32,
    movementSpeed: 345,
    attackRange: 125,
    critChance: 0,
    critDamage: 1.75
  },

  growthStats: {
    health: 95,
    healthRegen: 0.8,
    mana: 40,
    manaRegen: 0.5,
    attackDamage: 3.5,
    attackSpeed: 0.025,
    armor: 4,
    magicResist: 1.5
  },

  abilities: {
    Q: WarriorQ,  // Defined elsewhere
    W: WarriorW,
    E: WarriorE,
    R: WarriorR
  },

  passive: WarriorPassive
};
```

---

## Appendix B: Client Animation Keyframe Handling

```typescript
// src/sprites/PixelArtSpriteAnimator.ts (additions)

interface AnimatorOptions {
  onKeyframe?: (frame: number, animation: string) => void;
}

class PixelArtSpriteAnimator {
  private keyframeCallback?: (frame: number, animation: string) => void;
  private triggeredFrames: Set<number> = new Set();

  constructor(options?: AnimatorOptions) {
    this.keyframeCallback = options?.onKeyframe;
  }

  update(dt: number): void {
    if (!this.isPlaying) return;

    const prevFrame = this.currentFrame;
    this.elapsedTime += dt;

    const anim = this.animations.get(this.currentAnimation)!;
    const newFrameIndex = Math.floor(this.elapsedTime / anim.frameDuration);

    if (newFrameIndex >= anim.frames.length) {
      if (anim.loop) {
        this.elapsedTime %= (anim.frames.length * anim.frameDuration);
        this.triggeredFrames.clear();
      } else {
        this.isPlaying = false;
        return;
      }
    }

    this.currentFrame = anim.frames[newFrameIndex % anim.frames.length];

    // Trigger keyframe callback for new frames
    if (this.keyframeCallback && !this.triggeredFrames.has(newFrameIndex)) {
      this.triggeredFrames.add(newFrameIndex);
      this.keyframeCallback(newFrameIndex, this.currentAnimation);
    }
  }

  playAnimation(name: string, options?: PlayOptions): void {
    // ... existing logic
    this.triggeredFrames.clear();
  }
}
```

---

## Conclusion

This plan provides a comprehensive approach to solving collision masks and animation synchronization in Siege. The key insight is that these problems are interconnected through **shared metadata** that defines both visual and gameplay properties of entities.

By implementing the Entity Metadata System, we gain:

1. **Accurate Collision** - Collision shapes match visual appearance
2. **Synchronized Attacks** - Damage happens when the attack visually connects
3. **Synchronized Abilities** - Projectiles spawn when the cast animation reaches the "cast point"
4. **Scalability** - Easy to add new entities with proper metadata
5. **Maintainability** - Single source of truth for entity properties

The phased approach allows for incremental implementation with fallback behavior, minimizing risk of breaking changes while progressively improving the game feel.
