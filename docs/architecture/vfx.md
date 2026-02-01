# VFX System

This document describes the visual effects (VFX) system for champion abilities.

## Overview

The VFX system provides particle-based visual effects for all champion abilities. It uses Canvas 2D rendering with a retro pixel art aesthetic, optimized for performance with object pooling.

## Architecture

```
src/vfx/
  index.ts              # Module exports
  VFXManager.ts         # Central manager - spawn, update, render
  VFXParticlePool.ts    # Object pooling for particles
  VFXRegistry.ts        # Maps ability IDs to VFX configs
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

Stores VFX definitions for each ability:

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

### OnlineStateManager

```typescript
// src/core/OnlineStateManager.ts
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

1. Define colors in `CHAMPION_COLORS` if needed
2. Call `registerAbilityVFX()` with phases and effects
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
| `src/vfx/VFXParticlePool.ts` | Particle pooling |
| `src/vfx/VFXRegistry.ts` | Ability VFX definitions |
| `src/vfx/effects/VFXPrimitives.ts` | Drawing functions |
| `src/vfx/index.ts` | Module exports |
