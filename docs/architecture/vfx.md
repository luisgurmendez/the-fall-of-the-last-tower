# VFX System

This document describes the visual effects (VFX) system for champion abilities.

## Overview

The VFX system provides particle-based visual effects for all champion abilities. It uses Canvas 2D rendering with a retro pixel art aesthetic, optimized for performance with object pooling.

## Architecture

```
src/vfx/
  index.ts              # Module exports
  VFXManager.ts         # Central manager - schedules effects, owns the active lists, update and draw order
  active/               # One module per effect family: spawn, update, draw
    types.ts            # Active effect instance types (ActiveEffect, ActiveTrail, ...)
    particles.ts        # Particle bursts, rising, falling and death particles (pooled)
    shapes.ts           # Ground circles, expanding rings, cone slashes, shockwaves, beams
    trails.ts           # Entity trails and dash afterimages
    auras.ts            # Shield bubbles and orbiting particles
    screenFlash.ts      # Full-screen flash
  VFXParticlePool.ts    # Object pooling for particles
  VFXRegistry.ts        # Public registry API; importing it loads every champion's VFX
  VFXRegistryStore.ts   # Registry storage (register / get)
  VFXTypes.ts           # Phase and effect configuration types
  VFXColors.ts          # CHAMPION_COLORS palettes
  champions/
    index.ts            # Imports every champion file below
    <championId>.ts     # registerAbilityVFX() calls for one champion
  effects/
    VFXPrimitives.ts    # Reusable drawing functions
```

### VFXManager

The central manager handles:
- Spawning effects based on ability casts
- Updating all active effects each frame
- Rendering effects to canvas
- Managing particle pools and performance

```typescript
// Get the singleton instance
const vfxManager = getVFXManager(stateManager);

// Spawn VFX for an ability
vfxManager.spawnAbilityVFX(
  abilityId,    // e.g., 'warrior_slash'
  casterX,      // Caster position
  casterY,
  targetX,      // Target position (optional)
  targetY,
  casterId      // Entity ID for attached effects
);

// In render loop
vfxManager.update(dt);
vfxManager.render(ctx, cameraX, cameraY);
```

`VFXManager` keeps the state between frames: the particle pool, the
scheduled effect list (every effect of every phase, with its progress), and
the lists of effects attached to an entity (trails, shields, orbiting
particles, dash afterimages) plus the screen flash. Particles, trails,
shields, orbits, afterimages and the flash are created when their effect is
scheduled. The modules in `src/vfx/active/` spawn, update and draw each
family; `VFXManager` calls them in a fixed order. `render()` draws ground
circles, trails, dash afterimages, particles, then rings, cone slashes,
shockwaves and beams, shields and orbiting particles, and last the screen
flash in screen space.

### VFXParticlePool

Object pooling system to avoid garbage collection:

```typescript
const pool = new VFXParticlePool({
  initialSize: 200,
  maxSize: 500,
  growthSize: 50,
});

// Acquire a particle
const particle = pool.acquire();
if (particle) {
  particle.x = 100;
  particle.y = 200;
  particle.color = '#FFD700';
  // ...
}

// Update all active particles
pool.updateAll(dt, (particle, dt) => {
  particle.x += particle.vx * dt;
  particle.life -= dt;
  return particle.life > 0; // Return false to release
});
```

### VFXRegistry

Stores VFX definitions for each ability. Each champion's definitions live in
`src/vfx/champions/<championId>.ts`, which calls `registerAbilityVFX()` when it
is imported. `VFXRegistry.ts` imports `./champions` (which imports every
champion file), so anything that reads the registry through `VFXRegistry.ts`
(as `VFXManager` and `src/vfx/index.ts` do) sees every definition before its
first lookup. Champion files register through `VFXRegistryStore.ts` directly,
because importing `VFXRegistry.ts` from them would be an import cycle.

`VFXRegistry.ts` re-exports `registerAbilityVFX`, `getAbilityVFX`,
`getAllRegisteredVFX`, `CHAMPION_COLORS` and all the types from `VFXTypes.ts`.

**The lookup key is the ability ID.** The server's `ABILITY_CAST` event carries
the ability's definition ID (`champion.definition.abilities[slot]`, for example
`lume_q`), and `OnlineStateManager` passes it unchanged to `spawnAbilityVFX`
(the event handlers are in `src/core/state/gameEvents.ts`).
There is no alias table, so a definition's `abilityId` must be the ability ID
from `CHAMPION_DEFINITIONS`; VFX registered under any other key never plays.
`packages/client/src/test/ChampionClientContract.test.ts` checks every
champion's abilities against the registry and lists the known gaps (abilities
whose VFX is registered under a different key).

```typescript
registerAbilityVFX({
  abilityId: 'warrior_slash',
  phases: [
    {
      name: 'swing',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'cone_slash',
          color: 'rgba(255, 165, 0, 0.6)',
          radius: 100,
          arcAngle: Math.PI / 2,
          duration: 0.2,
        },
      ],
    },
  ],
});
```

## Champion Color Palettes

| Champion | Primary | Secondary | Accent |
|----------|---------|-----------|--------|
| Elara | Gold #FFD700 | White #FFFFFF | Soft Yellow #FFF9C4 |
| Gorath | Brown #8B7355 | Stone Gray #708090 | Orange #FF8C00 |
| Lume | Warm Gold #FFE566 | Soft Yellow #FFF9E0 | White #FFFFFF |
| Magnus | Fire Orange #FF6600 | Deep Red #CC3300 | Yellow Core #FFDD44 |
| Vex | Purple #8844CC | Dark #442266 | Shadow #2C3E50 |
| Vile | Dark Purple #4A0080 | Green-Black #1A3A1A | Soul Cyan #00FFFF |
| Warrior | Steel Blue #4682B4 | Gold #DAA520 | Iron Gray #708090 |

## Effect Types

### particle_burst
Burst of particles in a direction or spread pattern.

```typescript
{
  type: 'particle_burst',
  count: 15,
  color: '#FF6600',
  size: { min: 3, max: 6 },
  speed: { min: 80, max: 140 },
  lifetime: { min: 0.3, max: 0.5 },
  spread: Math.PI * 2,  // Full circle
  particleType: 'spark',
  gravity: 100,
}
```

### expanding_ring
Ring that expands outward and fades.

```typescript
{
  type: 'expanding_ring',
  color: '#FFD700',
  startRadius: 10,
  endRadius: 60,
  thickness: 4,
  duration: 0.4,
  fadeOut: true,
}
```

### cone_slash
Arc/cone shape for melee attacks.

```typescript
{
  type: 'cone_slash',
  color: 'rgba(255, 165, 0, 0.6)',
  radius: 100,
  arcAngle: Math.PI / 2,  // 90 degrees
  duration: 0.2,
  sparkCount: 8,
}
```

### ground_circle
Zone indicator on the ground.

```typescript
{
  type: 'ground_circle',
  color: '#CC3300',
  fillColor: 'rgba(255, 102, 0, 0.3)',
  radius: 200,
  duration: 5.0,
  pulseSpeed: 1,
}
```

### shockwave
Thick ring that expands rapidly.

```typescript
{
  type: 'shockwave',
  color: '#8B7355',
  startRadius: 20,
  endRadius: 150,
  thickness: 10,
  duration: 0.2,
}
```

### trail
Following trail attached to an entity.

```typescript
{
  type: 'trail',
  color: '#4682B4',
  thickness: 4,
  duration: 0.3,
  fadeLength: 60,
}
```

### shield_bubble
Protective bubble around an entity.

```typescript
{
  type: 'shield_bubble',
  color: '#FFD700',
  radius: 30,
  duration: 3.0,
  pulseSpeed: 2,
  hexagonal: true,
}
```

### dash_afterimage
Ghostly images left during dashes.

```typescript
{
  type: 'dash_afterimage',
  color: '#8844CC',
  imageCount: 5,
  fadeSpeed: 0.8,
  duration: 0.3,
}
```

### screen_flash
Full-screen flash for ultimates.

```typescript
{
  type: 'screen_flash',
  color: '#FFFFFF',
  duration: 0.15,
  maxAlpha: 0.3,
}
```

### rising_particles
Particles that float upward.

```typescript
{
  type: 'rising_particles',
  count: 10,
  color: '#FFF9C4',
  size: { min: 2, max: 4 },
  speed: { min: 30, max: 60 },
  spread: 30,
  lifetime: { min: 0.4, max: 0.7 },
  particleType: 'star',
}
```

### orbiting_particles
Particles that orbit around an entity.

```typescript
{
  type: 'orbiting_particles',
  count: 4,
  color: '#708090',
  size: 6,
  orbitRadius: 40,
  orbitSpeed: 2,
  duration: 4.0,
}
```

## Phase Configuration

Each ability VFX is divided into phases:

| Property | Description |
|----------|-------------|
| `name` | Phase identifier (e.g., 'cast', 'travel', 'impact') |
| `delay` | Seconds before this phase starts |
| `duration` | How long this phase lasts |
| `anchor` | Where to spawn: `'caster'`, `'target'`, `'ground_target'` |
| `effects` | Array of effect configurations |

Every effect of a delayed phase starts when the phase does. That includes one-shot parts: particle bursts, trails, shields, orbits, afterimages and screen flashes are created when their phase starts (`VFXManager.startEffect`), not at cast time. `packages/client/src/test/VFXManager.test.ts` checks this.

## Integration Points

### EntityRenderer

```typescript
// src/render/EntityRenderer.ts
import { VFXManager, getVFXManager } from "@/vfx";

class EntityRenderer {
  private vfxManager: VFXManager;

  constructor(stateManager, localSide) {
    this.vfxManager = getVFXManager(stateManager);
  }

  render() {
    // In render loop
    this.vfxManager.update(clientDt);
    this.vfxManager.render(ctx, 0, 0);
  }
}
```

Entities are drawn back to front by Y, buildings included (zones first, under
everything), so a unit behind a tower is hidden by it. A tower or nexus standing
in front of the local champion is drawn at half opacity.

### OnlineStateManager

`OnlineStateManager` hands each game event to `processGameEvent`
(`src/core/state/gameEvents.ts`), which spawns ability VFX and hit sparks.
Death, respawn, level up and recall VFX come from entity deltas, in
`src/core/state/entityVFX.ts`.

```typescript
// src/core/state/gameEvents.ts
import { getVFXManager } from '@/vfx';

// On ability cast event
case GameEventType.ABILITY_CAST: {
  const vfxManager = getVFXManager();
  vfxManager.spawnAbilityVFX(
    abilityId,
    entity.position.x,
    entity.position.y,
    targetX,
    targetY,
    entityId
  );
}
```

## Performance Constraints

| Constraint | Limit |
|------------|-------|
| Max particles per effect | 100 |
| Max total active particles | 500 |
| Initial pool size | 300 |
| Pool growth increment | 50 |

## Adding New VFX

1. Define colors in `CHAMPION_COLORS` (`src/vfx/VFXColors.ts`) if needed
2. Call `registerAbilityVFX()` with phases and effects in
   `src/vfx/champions/<championId>.ts`, using the ability's ID from
   `CHAMPION_DEFINITIONS` as `abilityId`. For a new champion, create that file
   and import it from `src/vfx/champions/index.ts`.
3. Test in-game to verify timing and visuals

```typescript
// Example: Adding VFX for a new ability
registerAbilityVFX({
  abilityId: 'new_champion_ability',
  phases: [
    {
      name: 'cast',
      delay: 0,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 12,
          color: '#NEW_COLOR',
          size: { min: 3, max: 5 },
          speed: { min: 40, max: 80 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
        },
      ],
    },
  ],
});
```

## Debugging

Get VFX statistics:

```typescript
const stats = vfxManager.getStats();
console.log(stats);
// {
//   activeEffects: 5,
//   activeParticles: 127,
//   activeTrails: 2,
//   activeShields: 1,
//   poolStats: { active: 127, total: 300, maxSize: 500 }
// }
```

Clear all effects:

```typescript
vfxManager.clear();
```

## Files Reference

| File | Purpose |
|------|---------|
| `src/vfx/VFXManager.ts` | Central manager |
| `src/vfx/active/<family>.ts` | Spawn, update and draw one effect family (particles, shapes, trails, auras, screen flash) |
| `src/vfx/active/types.ts` | Active effect instance types |
| `src/vfx/VFXParticlePool.ts` | Particle pooling |
| `src/vfx/VFXRegistry.ts` | Registry API; loads all champion VFX |
| `src/vfx/VFXRegistryStore.ts` | Registry storage |
| `src/vfx/VFXTypes.ts` | VFX phase and effect types |
| `src/vfx/VFXColors.ts` | Champion color palettes |
| `src/vfx/champions/<championId>.ts` | One champion's ability VFX definitions |
| `src/vfx/effects/VFXPrimitives.ts` | Drawing functions |
| `src/vfx/index.ts` | Module exports |
| `src/core/state/gameEvents.ts` | Spawns ability VFX and hit sparks from game events |
| `src/core/state/entityVFX.ts` | Spawns death, respawn, level up and recall VFX from entity deltas |

## World VFX

Defined in `src/vfx/world.ts` (keys in `WORLD_VFX`). They use the same phase-based definitions as ability VFX. `OnlineStateManager` spawns them from events (`src/core/state/gameEvents.ts`) and state changes (`src/core/state/entityVFX.ts`):

| Key | When |
|-----|------|
| `fx_hit_physical` / `fx_hit_magic` / `fx_hit_true` | A `DAMAGE` event: a small spark on the target, colored by damage type |
| `fx_level_up` | A champion's level goes up |
| `fx_champion_death` / `fx_respawn` | A champion dies (removed from client state) / reappears |
| `fx_recall_arrive` | A recall ends with the champion jumping to base |
| `fx_tower_destroyed` | A tower or nexus dies: flash, shockwave, rubble |
| `fx_creature_death` | A jungle creature dies. Its special attack warning, if it was winding up, is cancelled (`VFXManager.cancelCasterEffects`) |
| `fx_dragon_death` | The dragon dies: a large fiery shockwave, sparks and embers, and a light screen shake |
| `jungle_slam_blue` / `jungle_slam_red` / `dragon_breath` | An `ABILITY_CAST` from a monster's special attack: the warning area for the wind-up, then the hit (sizes from `MOBAConfig.JUNGLE.SPECIAL_ATTACKS`, see [jungle.md](jungle.md)) |

Drawn directly by renderers rather than as VFX definitions:
- **Recall channel** (`ChampionRenderer.renderRecallChannel`): a ground ring that fills over the recall, with rising motes.
- **Jungle buff auras** (`ChampionRenderer.renderJungleBuffAuras`): a ring at the feet of any champion holding a buff, so everyone can see who has it. Crest of Insight is a blue ring with orbiting sparks; Crest of Cinders is a red-orange ring with sparks and rising embers. A champion with both shows the red ring outside the blue one.
- **Tower lock-on** (`renderTower`): a pulsing dashed line and reticle while an enemy tower shoots the local champion.
- **Announcements** (`AnnouncementBanner`, fed by `OnlineStateManager`; the texts are in `src/core/state/gameEvents.ts`): champion kills ("You have slain an enemy!" / "You have been slain!" / "First Blood!"), towers destroyed, dragon slain, and the match result.
- **Screen shake** (`src/core/screenShake.ts`): a decaying jitter on top of the camera transform. It's triggered when a tower falls, when the nexus falls (stronger), and when the local champion takes a hit over 15% of its health.
- **Low-health vignette** (`LowHealthVignette`): red screen edges below 30% health, pulsing faster as health drops.
- **Status icons** (`statusIndicators.ts`): knockup, root, silence, slows, burn and the jungle buffs.

Ability VFX are registered under the ability ID the server sends in `ABILITY_CAST`. The client contract test (`packages/client/src/test/ChampionClientContract.test.ts`) fails if an ability has no VFX or a registered key is never spawned.
