# Offline Mode Removal Plan

> **Status:** ✅ COMPLETED
> **Date:** January 2025
> **Scope:** Remove offline/single-player mode, keep online multiplayer only

## Completion Summary

The offline mode removal has been completed. The game is now online-only.

**What was removed:**
- ~75+ client files deleted (champions, abilities, effects, units, structures, lanes, etc.)
- All offline game modes and entry points
- Map builder and custom map systems
- Client-side simulation code (all simulation now runs on server)
- Legacy tower defense code

**What remains:**
- Online multiplayer game (server-authoritative)
- Server-side champion implementations (`packages/server/src/simulation/`)
- Server-side tests (`packages/server/src/test/`)
- Shared types and config (`packages/shared/`)
- Client rendering and input handling (`src/`)

---

## Original Plan (for reference)

This document outlined the complete plan to remove offline mode from the Siege codebase, transitioning to an online-only multiplayer game. The goal was to simplify the codebase by eliminating duplicate systems and dead code.

**Estimated Impact:**
- ~75 files to delete (client)
- ~8 files to create (server test migrations)
- ~5 files to modify
- ~40% reduction in client codebase size
- Improved server test coverage (champion-specific tests migrated)

---

## Table of Contents

1. [Pre-Removal Checklist](#1-pre-removal-checklist)
2. [Phase 1: Entry Point Simplification](#2-phase-1-entry-point-simplification)
3. [Phase 2: Delete Offline Game Loop](#3-phase-2-delete-offline-game-loop)
4. [Phase 3: Delete Offline Levels](#4-phase-3-delete-offline-levels)
5. [Phase 4: Delete Champion Implementations](#5-phase-4-delete-champion-implementations)
6. [Phase 5: Delete Legacy Systems](#6-phase-5-delete-legacy-systems)
7. [Phase 6: Delete Map Builder](#7-phase-6-delete-map-builder)
8. [Phase 7: Clean Up Tests](#8-phase-7-clean-up-tests)
9. [Phase 8: Clean Up Shared Components](#9-phase-8-clean-up-shared-components)
10. [Files to Keep](#10-files-to-keep)
11. [Post-Removal Verification](#11-post-removal-verification)
12. [Rollback Plan](#12-rollback-plan)

---

## 1. Pre-Removal Checklist

Before starting, ensure:

- [ ] All changes are committed to a feature branch
- [ ] Online mode is fully functional and tested
- [ ] Server is running and stable
- [ ] Backup of current state exists
- [ ] All team members are aware of the changes
- [ ] **Test migration plan reviewed** (see Phase 7)
- [ ] Server test utilities created (`ServerTestUtils.ts`)
- [ ] Champion tests migrated to server before deleting client versions

**Create the branch:**
```bash
git checkout -b feature/remove-offline-mode
```

---

## 2. Phase 1: Entry Point Simplification

### File: `src/index.ts`

**Current State:**
- Detects mode via URL hash (`#offline`, `#play-custom`, `#builder`, default=`online`)
- Has separate functions: `startOfflineGame()`, `startOnlineGame()`, `startBuilder()`
- Switch statement routes to different modes

**Changes Required:**

#### 2.1 Remove Imports
```typescript
// DELETE these imports:
import Game from "./core/game";
import { createMapBuilderUI } from "./mapBuilder";
```

#### 2.2 Delete Functions
- Delete `startOfflineGame()` function entirely
- Delete `startBuilder()` function entirely

#### 2.3 Simplify main()

**Before:**
```typescript
async function main() {
  // ... setup code ...

  switch (mode) {
    case 'builder':
      startBuilder();
      break;
    case 'play-custom':
    case 'offline':
      startOfflineGame();
      break;
    case 'online':
    default:
      await startOnlineGame();
  }
}
```

**After:**
```typescript
async function main() {
  // ... setup code ...

  // Always start in online mode
  await startOnlineGame();
}
```

#### 2.4 Remove Hash Listener
```typescript
// DELETE this:
window.addEventListener('hashchange', () => {
  window.location.reload();
});
```

---

## 3. Phase 2: Delete Offline Game Loop

### Files to Delete:

| File | Reason |
|------|--------|
| `src/core/game.ts` | Offline-only game loop |

**Dependency Check:**
- Only imported by `src/index.ts` (will be removed in Phase 1)
- Not used by online mode at all

---

## 4. Phase 3: Delete Offline Levels

### Files to Delete:

| File | Reason |
|------|--------|
| `src/levels/mobaLevel.ts` | Offline MOBA with local simulation |
| `src/levels/customMapLevel.ts` | Custom map single-player |
| `src/levels/battlefield.ts` | Legacy tower defense level |

**Dependency Check:**
- `mobaLevel.ts` - Only imported by `game.ts` (being deleted)
- `customMapLevel.ts` - Only imported by `game.ts` (being deleted)
- `battlefield.ts` - Only imported by `game.ts` (being deleted)

**Keep:**
- `src/levels/onlineLevel.ts` - Used by online mode

---

## 5. Phase 4: Delete Champion Implementations

### Understanding the Champion System

**Important:** There are TWO champion systems:
1. **Client champions** (`src/champions/`) - Full simulation, used by offline mode only
2. **Server champions** (`packages/server/src/simulation/`) - Used by online mode
3. **Shared definitions** (`packages/shared/src/champions/`) - Type definitions used by both

**Online mode does NOT use `src/champions/`** - it uses:
- `@siege/shared` for champion definitions (names, stats, abilities)
- `OnlineChampionAdapter` to wrap server snapshots
- `EntityRenderer` to render champion visuals

### Files to Delete:

#### Champion Base Classes:
| File | Lines | Reason |
|------|-------|--------|
| `src/champions/Champion.ts` | ~2,000 | Base champion class (offline simulation) |
| `src/champions/index.ts` | ~50 | Champion exports |
| `src/champions/types.ts` | ~100 | Champion type definitions |

#### Champion Implementations:
| File | Reason |
|------|--------|
| `src/champions/implementations/Bran.ts` | Offline champion |
| `src/champions/implementations/Elara.ts` | Offline champion |
| `src/champions/implementations/Greta.ts` | Offline champion |
| `src/champions/implementations/Lyra.ts` | Offline champion |
| `src/champions/implementations/Magnus.ts` | Offline champion |
| `src/champions/implementations/TestChampion.ts` | Test champion |
| `src/champions/implementations/Thorne.ts` | Offline champion |
| `src/champions/implementations/Uruk.ts` | Offline champion |
| `src/champions/implementations/index.ts` | Exports |

#### Champion Targeting:
| File | Reason |
|------|--------|
| `src/champions/targeting/TargetingPolicy.ts` | Offline AI targeting |
| `src/champions/targeting/index.ts` | Exports |

**Total: ~15 files, ~3,000+ lines**

---

## 6. Phase 5: Delete Legacy Systems

### 6.1 Tower Defense Units (Legacy)

These are remnants from the original tower defense game:

| File | Reason |
|------|--------|
| `src/objects/army/armyUnit.ts` | Base unit class |
| `src/objects/army/swordsman/swordsman.ts` | Swordsman unit |
| `src/objects/army/archer/archer.ts` | Archer unit |
| `src/objects/army/archer/arrow.ts` | Arrow projectile |
| `src/objects/army/spriteUtils.ts` | Unit sprite utilities |
| `src/objects/army/types.ts` | Unit types |
| `src/objects/army/utils.ts` | Unit utilities |
| `src/objects/army/ParticleUtils.ts` | Particle effects |

**Also delete sprite directories:**
- `src/objects/army/swordsman/sprites/`
- `src/objects/army/swordsman/swordsman-attack-sprites/`
- `src/objects/army/swordsman/swordsman-walk-sprites/`
- `src/objects/army/archer/sprites/`
- `src/objects/army/archer/archer-attack-sprites/`
- `src/objects/army/archer/archer-walk-sprites/`

### 6.2 Castle & Wave System

| File | Reason |
|------|--------|
| `src/objects/castle/castle.ts` | Destructible castle (tower defense) |
| `src/objects/waveController.ts` | Enemy wave spawning |
| `src/objects/particle/particle.ts` | Damage particles (for units) |

### 6.3 Player Controller

| File | Reason |
|------|--------|
| `src/objects/player/player.ts` | Offline input handling |

Online mode uses `OnlineInputHandler` instead.

### 6.4 Offline Configuration

| File | Reason |
|------|--------|
| `src/config/waveConfig.ts` | Wave spawning configuration |
| `src/config/unitConfig.ts` | Unit stats configuration |

**Keep:**
- `src/config/gameConfig.ts` - Used by both modes

---

## 7. Phase 6: Delete Map Builder

The map builder is an offline-only tool for creating custom maps.

### Files to Delete (entire directory):

```
src/mapBuilder/
├── index.ts
├── MapBuilder.ts
├── MapBuilderUI.ts
├── MapData.ts
├── MapLoader.ts
└── tools/
    ├── index.ts
    ├── Tool.ts
    ├── SelectTool.ts
    ├── TerrainTool.ts
    ├── LaneTool.ts
    └── PlacementTools.ts
```

**Total: 11 files**

### Related Files to Delete:

| File | Reason |
|------|--------|
| `src/objects/CustomMapBackground.ts` | Renders custom maps |
| `src/map/CustomMOBAMap.ts` | Custom map logic |

---

## 8. Phase 7: Migrate and Clean Up Tests

> **IMPORTANT**: Do NOT simply delete test files. Many contain valuable testing patterns
> and champion-specific behavior tests that should be migrated to the server first.

### 7.1 Overview: Migrate Before Delete

The client tests contain valuable patterns that the server lacks:

| What Client Has | What Server Has | Action |
|-----------------|-----------------|--------|
| `TestDummy` class with state inspection | Inline `createTestChampion()` only | **MIGRATE** |
| `createTestArena()` for 2-champion setup | Missing | **MIGRATE** |
| Damage calculation helpers | Inline in tests | **MIGRATE** |
| Per-champion ability tests (elara, magnus, etc.) | Only generic ability tests | **MIGRATE** |
| `TestSwordsman`, `TestArcher` wrappers | `ServerMinion.test.ts` covers basics | **PARTIAL MIGRATE** |

### 7.2 Step 1: Create Server Test Utilities

**Create:** `packages/server/src/test/ServerTestUtils.ts`

Migrate from `src/test/ChampionTestUtils.ts`:

```typescript
/**
 * Server test utilities - migrated from client ChampionTestUtils.ts
 */

import { ServerChampion } from '../simulation/ServerChampion';
import { ServerGameContext } from '../game/ServerGameContext';
import { Vector, CHAMPION_DEFINITIONS, type ChampionDefinition, type Side } from '@siege/shared';

/**
 * Test champion with exposed state for assertions.
 * Wraps ServerChampion with convenience methods for testing.
 */
export class TestServerChampion extends ServerChampion {
  /** Force set health for testing */
  setHealth(health: number): void {
    this.health = health;
  }

  /** Force set resource for testing */
  setResource(resource: number): void {
    this.resource = resource;
  }

  /** Force set level for testing */
  setLevel(level: number): void {
    this.level = level;
  }

  /** Get shields for testing */
  getShields() {
    return [...this.shields];
  }

  /** Get active effects for testing */
  getActiveEffects() {
    return [...this.activeEffects];
  }

  /** Check if champion can move (not stunned/rooted) */
  canMove(): boolean {
    return this.ccStatus.canMove;
  }

  /** Check if champion can cast abilities */
  canCast(): boolean {
    return this.ccStatus.canCast;
  }

  /** Check if champion can attack */
  canAttack(): boolean {
    return this.ccStatus.canAttack;
  }
}

/**
 * Test arena with two opposing champions.
 */
export interface ServerTestArena {
  context: ServerGameContext;
  ally: TestServerChampion;
  enemy: TestServerChampion;
  tick: (dt?: number) => void;
  tickFrames: (frames: number, dt?: number) => void;
}

/**
 * Create a test arena with two opposing champions.
 */
export function createServerTestArena(options: {
  allyChampion?: string;
  enemyChampion?: string;
  allyPosition?: Vector;
  enemyPosition?: Vector;
} = {}): ServerTestArena {
  const {
    allyChampion = 'warrior',
    enemyChampion = 'warrior',
    allyPosition = new Vector(0, 0),
    enemyPosition = new Vector(200, 0),
  } = options;

  const context = new ServerGameContext({ gameId: 'test-game' });

  const ally = new TestServerChampion({
    id: 'test-ally',
    position: allyPosition,
    side: 0 as Side,
    definition: CHAMPION_DEFINITIONS[allyChampion],
    playerId: 'player-1',
  });

  const enemy = new TestServerChampion({
    id: 'test-enemy',
    position: enemyPosition,
    side: 1 as Side,
    definition: CHAMPION_DEFINITIONS[enemyChampion],
    playerId: 'player-2',
  });

  context.addChampion(ally, 'player-1');
  context.addChampion(enemy, 'player-2');

  return {
    context,
    ally,
    enemy,
    tick: (dt = 1/60) => {
      ally.update(dt, context);
      enemy.update(dt, context);
    },
    tickFrames: (frames, dt = 1/60) => {
      for (let i = 0; i < frames; i++) {
        ally.update(dt, context);
        enemy.update(dt, context);
      }
    },
  };
}

/**
 * Calculate expected damage after armor reduction.
 */
export function calculateExpectedPhysicalDamage(baseDamage: number, targetArmor: number): number {
  return baseDamage * (100 / (100 + targetArmor));
}

/**
 * Calculate expected damage after magic resist reduction.
 */
export function calculateExpectedMagicDamage(baseDamage: number, targetMR: number): number {
  return baseDamage * (100 / (100 + targetMR));
}
```

### 7.3 Step 2: Migrate Champion-Specific Tests

**Create:** `packages/server/src/test/champions/` directory

For each client champion test, create a server equivalent:

| Client Test | Server Test | What to Migrate |
|-------------|-------------|-----------------|
| `src/test/elara.test.ts` | `packages/server/src/test/champions/Elara.test.ts` | Passive behavior, ability damage values, cooldowns, effects |
| `src/test/magnus.test.ts` | `packages/server/src/test/champions/Magnus.test.ts` | Fireball projectile, blink teleport, etc. |
| `src/test/lyra.test.ts` | `packages/server/src/test/champions/Lyra.test.ts` | Healing, shields, support abilities |
| `src/test/uruk.test.ts` | `packages/server/src/test/champions/Uruk.test.ts` | Tank abilities, CC |
| `src/test/bran.test.ts` | `packages/server/src/test/champions/Bran.test.ts` | Abilities |
| `src/test/greta.test.ts` | `packages/server/src/test/champions/Greta.test.ts` | Abilities |
| `src/test/thorne.test.ts` | `packages/server/src/test/champions/Thorne.test.ts` | Abilities |

**Example migration** - `Elara.test.ts`:

```typescript
// packages/server/src/test/champions/Elara.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { createServerTestArena, calculateExpectedPhysicalDamage } from '../ServerTestUtils';
import { Vector, CHAMPION_DEFINITIONS } from '@siege/shared';
import { abilityExecutor } from '../../simulation/ServerAbilityExecutor';

describe('Elara Champion (Server)', () => {
  describe('Base Stats', () => {
    test('should have correct base health (550)', () => {
      const { ally } = createServerTestArena({ allyChampion: 'elara' });
      expect(ally.maxHealth).toBe(550);
    });

    test('should have ranged attack range (550)', () => {
      const { ally } = createServerTestArena({ allyChampion: 'elara' });
      expect(ally.getStats().attackRange).toBe(550);
    });
  });

  describe('Q - Piercing Arrow', () => {
    test('should pierce through multiple enemies', () => {
      // ... migrate test logic from client
    });

    test('should deal correct damage at rank 1', () => {
      // ... migrate test logic from client
    });
  });

  // ... migrate other ability tests
});
```

### 7.4 Step 3: Migrate Unit/Minion Test Patterns

The client `ArmyTestUtils.ts` patterns are partially covered by `ServerMinion.test.ts`.

**Review and potentially add:**

| Client Pattern | Server Status | Action |
|----------------|---------------|--------|
| `TestSwordsman` wrapper | Not needed - ServerMinion is simpler | SKIP |
| `TestArcher` wrapper | Not needed | SKIP |
| `TestArrow` wrapper | ServerProjectile exists but untested | **ADD `ServerProjectile.test.ts`** |
| `createArmyTestArena()` | Already have minion tests | SKIP |
| Damage calculation helpers | Migrate to `ServerTestUtils.ts` | **MIGRATE** |

**Create:** `packages/server/src/test/ServerProjectile.test.ts` (if missing)

### 7.5 Step 4: Delete Client Tests (After Migration Complete)

**Only delete after server equivalents exist and pass:**

#### Tests to Delete (After Migration):

| Client File | Server Equivalent | Safe to Delete? |
|-------------|-------------------|-----------------|
| `src/test/elara.test.ts` | `packages/server/src/test/champions/Elara.test.ts` | ✅ After migration |
| `src/test/magnus.test.ts` | `packages/server/src/test/champions/Magnus.test.ts` | ✅ After migration |
| `src/test/lyra.test.ts` | `packages/server/src/test/champions/Lyra.test.ts` | ✅ After migration |
| `src/test/uruk.test.ts` | `packages/server/src/test/champions/Uruk.test.ts` | ✅ After migration |
| `src/test/bran.test.ts` | `packages/server/src/test/champions/Bran.test.ts` | ✅ After migration |
| `src/test/greta.test.ts` | `packages/server/src/test/champions/Greta.test.ts` | ✅ After migration |
| `src/test/thorne.test.ts` | `packages/server/src/test/champions/Thorne.test.ts` | ✅ After migration |
| `src/test/champion.test.ts` | `packages/server/src/test/ServerChampionEffects.test.ts` | ✅ Already covered |
| `src/test/ChampionTestUtils.ts` | `packages/server/src/test/ServerTestUtils.ts` | ✅ After migration |

#### Tests to Delete (No Migration Needed):

These test legacy systems that don't exist on the server:

| File | Reason |
|------|--------|
| `src/test/swordsman.test.ts` | Legacy tower defense unit - server uses `ServerMinion` |
| `src/test/archer.test.ts` | Legacy tower defense unit - server uses `ServerMinion` |
| `src/test/armyUnit.test.ts` | Legacy base class - server uses `ServerEntity` |
| `src/test/ArmyTestUtils.ts` | Legacy test helpers - not needed |

### 7.6 Tests to Keep (Client):

| File | Reason |
|------|--------|
| `src/test/abilities.test.ts` | Tests shared ability system (if still used by client) |
| `src/test/buffs.test.ts` | Tests shared effect system |
| `src/test/items.test.ts` | Tests shared item system |
| `src/test/shop.test.ts` | Tests shop UI (client-specific) |
| `src/test/TestGameContext.ts` | May still be useful for client-side tests |

### 7.7 Migration Checklist

```
Phase 7 Checklist:

□ Step 1: Create ServerTestUtils.ts
  □ TestServerChampion class
  □ createServerTestArena()
  □ Damage calculation helpers

□ Step 2: Migrate Champion Tests
  □ Elara.test.ts
  □ Magnus.test.ts
  □ Lyra.test.ts
  □ Uruk.test.ts
  □ Bran.test.ts
  □ Greta.test.ts
  □ Thorne.test.ts

□ Step 3: Add Missing Server Tests
  □ ServerProjectile.test.ts (if needed)

□ Step 4: Verify Server Tests Pass
  □ Run: cd packages/server && bun test
  □ All champion tests pass

□ Step 5: Delete Client Tests
  □ Delete migrated champion tests
  □ Delete legacy army unit tests
  □ Delete ChampionTestUtils.ts
  □ Delete ArmyTestUtils.ts

□ Step 6: Verify Client Tests Still Pass
  □ Run: npm test
  □ Remaining tests pass
```

---

## 9. Phase 8: Clean Up Shared Components

### Files to Review and Potentially Modify:

#### 9.1 `src/core/ChampionController.ts`

**Check:** Is this used by online mode?
- If only used by `mobaLevel.ts` → DELETE
- If used by `onlineLevel.ts` → KEEP

#### 9.2 `src/ui/Minimap.ts`

**Status:** Offline-only (reads local objects)
**Action:** DELETE - Online uses `OnlineMinimap.ts`

#### 9.3 Ability System (`src/abilities/`)

**Check:** Used by offline champions only?
- If only used by `src/champions/` → DELETE entire directory
- Online mode uses `@siege/shared` ability definitions

#### 9.4 Effect System (`src/effects/`)

**Check:** Used by offline champions only?
- If only used by `src/champions/` → DELETE entire directory
- Online mode uses server-sent effect states

#### 9.5 Item System (`src/items/`)

**Partial Keep:**
- Shop UI is used by online mode
- Item definitions may be needed
- Review what's actually used

---

## 10. Files to Keep

### Core Systems (Used by Online):

| Directory/File | Reason |
|----------------|--------|
| `src/core/OnlineGame.ts` | Online game loop |
| `src/core/OnlineStateManager.ts` | Server state tracking |
| `src/core/level.ts` | Level base class |
| `src/core/camera.ts` | Camera system |
| `src/core/canvas.ts` | Canvas setup |
| `src/core/clock.ts` | Timing |
| `src/core/gameContext.ts` | Game context |
| `src/core/FogOfWar.ts` | Fog rendering |
| `src/core/Team.ts` | Team data |
| `src/core/GameObject.ts` | Base class |
| `src/core/CursorManager.ts` | Cursor |
| `src/core/events/` | Event system |
| `src/core/input/InputManager.ts` | Input handling |
| `src/core/input/OnlineInputHandler.ts` | Online input |

### Online-Specific:

| Directory/File | Reason |
|----------------|--------|
| `src/levels/onlineLevel.ts` | Online level |
| `src/online/OnlineChampionAdapter.ts` | HUD adapter |
| `src/online/OnlineFogProvider.ts` | Server fog |
| `src/render/EntityRenderer.ts` | Entity rendering |
| `src/ui/OnlineMinimap.ts` | Online minimap |
| `src/ui/matchmaking/` | Matchmaking UI |

### Shared Systems:

| Directory | Reason |
|-----------|--------|
| `src/map/` | MOBA map (keep MOBAMap.ts) |
| `src/structures/` | Towers, nexus |
| `src/units/` | Base unit classes |
| `src/render/` | Rendering utilities |
| `src/sprites/` | Sprite system |
| `src/physics/` | Physics |
| `src/navigation/` | Pathfinding |
| `src/vision/` | Vision system |
| `src/ui/ChampionHUD.ts` | HUD (works with adapter) |
| `src/ui/GameStatsHUD.ts` | Stats display |
| `src/ui/shop/` | Shop UI |
| `src/debug/` | Debug tools |
| `src/styles/` | CSS |

### Packages (Keep All):

| Package | Reason |
|---------|--------|
| `packages/shared/` | Shared types and definitions |
| `packages/server/` | Game server |
| `packages/client/` | Network client |

---

## 11. Post-Removal Verification

### Step 1: TypeScript Compilation
```bash
npm run tsc
# Should complete with no errors
```

### Step 2: Lint Check
```bash
npm run lint
# Fix any unused import warnings
```

### Step 3: Build Check
```bash
npm run build
# Should complete successfully
```

### Step 4: Test Suite
```bash
npm run test
# Remaining tests should pass
```

### Step 5: Manual Testing
- [ ] Dev server starts: `npm run dev`
- [ ] Matchmaking UI appears
- [ ] Can connect to server
- [ ] Can select champion
- [ ] Can find match
- [ ] Game loads correctly
- [ ] HUD displays correctly
- [ ] Abilities work
- [ ] Shop works
- [ ] Game ends properly

### Step 6: Dead Code Check
```bash
# Search for any remaining imports of deleted files
grep -r "from.*champions/implementations" src/
grep -r "from.*objects/player" src/
grep -r "from.*objects/army" src/
grep -r "from.*mapBuilder" src/
grep -r "from.*core/game" src/
grep -r "from.*levels/mobaLevel" src/
```

---

## 12. Rollback Plan

If issues are discovered:

```bash
# Revert all changes
git checkout main

# Or revert specific commits
git revert <commit-hash>
```

**Keep the branch for reference:**
```bash
# Don't delete the branch immediately
git branch -m feature/remove-offline-mode feature/remove-offline-mode-backup
```

---

## Summary: Deletion Checklist

### Phase 1: Entry Point
- [ ] `src/index.ts` - Modify (remove offline routing)

### Phase 2: Game Loop
- [ ] `src/core/game.ts` - DELETE

### Phase 3: Levels
- [ ] `src/levels/mobaLevel.ts` - DELETE
- [ ] `src/levels/customMapLevel.ts` - DELETE
- [ ] `src/levels/battlefield.ts` - DELETE

### Phase 4: Champions
- [ ] `src/champions/` - DELETE entire directory (~15 files)

### Phase 5: Legacy Systems
- [ ] `src/objects/army/` - DELETE entire directory (~20 files)
- [ ] `src/objects/castle/` - DELETE
- [ ] `src/objects/player/` - DELETE
- [ ] `src/objects/waveController.ts` - DELETE
- [ ] `src/objects/particle/` - DELETE
- [ ] `src/config/waveConfig.ts` - DELETE
- [ ] `src/config/unitConfig.ts` - DELETE

### Phase 6: Map Builder
- [ ] `src/mapBuilder/` - DELETE entire directory (11 files)
- [ ] `src/objects/CustomMapBackground.ts` - DELETE
- [ ] `src/map/CustomMOBAMap.ts` - DELETE

### Phase 7: Tests (MIGRATE FIRST, then delete)
- [ ] Create `packages/server/src/test/ServerTestUtils.ts`
- [ ] Create `packages/server/src/test/champions/` directory
- [ ] Migrate Elara.test.ts → server
- [ ] Migrate Magnus.test.ts → server
- [ ] Migrate Lyra.test.ts → server
- [ ] Migrate Uruk.test.ts → server
- [ ] Migrate Bran.test.ts → server
- [ ] Migrate Greta.test.ts → server
- [ ] Migrate Thorne.test.ts → server
- [ ] Verify server tests pass: `cd packages/server && bun test`
- [ ] DELETE migrated client champion tests (~7 files)
- [ ] DELETE legacy unit tests (swordsman, archer, armyUnit) (~3 files)
- [ ] DELETE ChampionTestUtils.ts (after ServerTestUtils.ts created)
- [ ] DELETE ArmyTestUtils.ts

### Phase 8: Cleanup
- [ ] `src/ui/Minimap.ts` - DELETE (keep OnlineMinimap)
- [ ] Review and clean `src/abilities/` - Possibly DELETE
- [ ] Review and clean `src/effects/` - Possibly DELETE
- [ ] Remove unused imports everywhere

---

## Estimated File Count

| Category | Files to Delete | Files to Create (Server) |
|----------|-----------------|--------------------------|
| Entry/Game Loop | 2 | - |
| Levels | 3 | - |
| Champions | 15 | - |
| Legacy Units | 20+ | - |
| Player/Castle/Wave | 5 | - |
| Map Builder | 13 | - |
| Tests (Delete) | 12 | - |
| Tests (Migrate) | - | 8 (ServerTestUtils + 7 champion tests) |
| Misc | 5 | - |
| **Total Delete** | **~75 files** | |
| **Total Create** | | **~8 files** |

**Net effect:** ~75 files deleted, ~8 files created on server = ~67 fewer files overall

---

## Notes

1. **Do NOT delete `packages/shared/`** - This contains server champion definitions used by online mode.

2. **The `src/champions/` directory is completely separate** from `packages/shared/src/champions/`. The former is client-side simulation (delete), the latter is shared definitions (keep).

3. **Some systems may have hidden dependencies** - Run TypeScript compilation after each phase to catch issues early.

4. **Consider keeping offline mode in a separate branch** for potential future use or reference.

5. **CRITICAL: Migrate tests before deleting** - The client test files contain valuable champion-specific behavior tests and testing utilities. These must be migrated to the server (`packages/server/src/test/`) BEFORE deleting the client versions. See Phase 7 for detailed migration steps.

6. **Server test coverage improvement** - After migration, the server will have:
   - `ServerTestUtils.ts` - Reusable test utilities (TestServerChampion, createServerTestArena, damage helpers)
   - `champions/*.test.ts` - Per-champion ability and behavior tests
   - Better test coverage overall for the authoritative game logic
