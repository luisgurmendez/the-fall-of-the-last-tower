# VFX System

This document describes the visual effects (VFX) system for champion abilities.

## Overview

The VFX system schedules each ability's effects in phases and keeps them between frames (particles, rings, slashes, trails, shields...). They are drawn on the GPU, with glow and bloom, by the WebGL2 layer in `src/gpu/` (see GPU rendering below); without WebGL2 the older Canvas 2D drawing in `src/vfx/active/` and `effects/VFXPrimitives.ts` is used instead.

## Architecture

```
src/vfx/
  index.ts              # Module exports
  VFXManager.ts         # Central manager - schedules effects, owns the active lists, update and draw order
  active/               # One module per effect family: spawn, update, draw (2D) and emit (GPU)
    types.ts            # Active effect instance types (ActiveEffect, ActiveTrail, ...)
    particles.ts        # Particle bursts, rising, falling and death particles (pooled)
    shapes.ts           # Ground circles, rings, cone slashes, shockwaves, beams, lights, decals, lightning, swirls
    trails.ts           # Entity trails and dash afterimages
    auras.ts            # Shield bubbles and orbiting particles
    screenFlash.ts      # Full-screen flash
  recipes.ts            # Shorthands the definitions layer: sparks(), flames(), smoke(), shockwave(), light(), spikes(), rays(), meteor(), cuts(), landsAt()...
  VFXParticlePool.ts    # Object pooling for particles
  VFXRegistry.ts        # Public registry API; importing it loads every champion's VFX
  VFXRegistryStore.ts   # Registry storage (register / get)
  VFXTypes.ts           # Phase and effect configuration types
  VFXColors.ts          # CHAMPION_COLORS palettes
  champions/
    index.ts            # Imports every champion file below
    <championId>.ts     # registerAbilityVFX() calls for one champion
  world.ts              # Hits, level ups, deaths, towers, monster attacks
  effects/
    VFXPrimitives.ts    # 2D drawing functions (fallback)

src/gpu/fx/
  fxShader.ts           # The effects shader: one primitive kind per quad
  FXBatch.ts            # A frame's quads for one layer, and the calls that add them (glow, spark, ring, slash...)
  FXPass.ts             # Draws a batch: half-float target, bloom, tone mapping
  projectiles.ts        # Each projectile type's look, with trails
  zones.ts              # Zones: burning ground (a trail's patches without a rim), mud, healing and buff circles
  championAuras.ts      # The recall circle and jungle buff rings at a champion's feet
```

## GPU rendering

`GPURenderer` (`src/gpu/GPURenderer.ts`) has two effect layers, each an `FXBatch` filled during the frame and drawn into the 2D canvas where it belongs:

- **Ground** (`groundFx`), drawn after the ground and before any unit: magic circles, warnings, light pools, scorch marks and zones.
- **Top** (`topFx`), drawn after the units: particles, rings, slashes, beams, trails, shields, projectiles and everything else.

`EntityRenderer` updates the VFX manager, has it add the ground parts (`VFXManager.emitGround`) plus the zones (`emitZone`, Calamitus's lava and Zhak'rul's toxic cloud drawn by their ability ids) and each champion's recall circle, buff rings, Oitboil's overheat fire, Fenris's rage, Caelum's blessing, Protobot's circuit while he's learned something, Hop-To-Eat's sugar rush and Zhak'rul's venom on whoever he poisoned (`emitChampionAuras`), draws the ground layer, draws the units (projectiles add themselves to the top layer as they're drawn, `emitProjectile`), then has the manager add the rest (`emitTop`) and draws the top layer. The screen flash stays 2D. The legacy ability shapes (`overlays/abilityEffects.ts`) are only drawn without the GPU.

Each quad is one primitive (`FXKind`), drawn by the effects shader from the quad's local coordinates: a glow, a spark (a streak along its velocity), a ring broken by noise with a wake of light inside, a slash (a crescent swept across an arc), a beam, a sigil (rings, runes and a star that draw themselves in), a shield (in one of four styles, `ShieldStyle`: hexagons, circling steel plates, petals of light, a ring of stones glowing in the cracks), a flame (fire that burns away into smoke, as a round puff or a tongue licking up), a flare (four-pointed twinkle), a decal (scorch or cracks with embers), a swirl, lightning, an orb, a ribbon segment, dust, a telegraph (a warning filling up, its lines the same width whatever its size), a shard (a faceted rock lit by the sun with a glow at its base, or a crystal of light), a petal (of light, or solid like a leaf, turning over as it drifts), rays (light bursting out or gathering in), a wisp (a soul flame with a wavering tail), a thorn (a curved root that covers, its veins glowing) and a cut (a straight blade of light drawn across). Some kinds take a second color (the glow in a stone shield's cracks, at a rock's base, in a thorn's veins). Fragments are snapped to the ground's 1.5-unit art pixels, so effects read as pixel art.

Light adds up in a half-float target; the bloom keeps the parts over a threshold, halves them four times and blurs them back up (dual Kawase), and the composite tone-maps the light (bright cores go white instead of clipping). The output is premultiplied: light has no alpha, so it adds to what's under it, while smoke, dust and scorch marks have alpha and cover it.

How config types look on the GPU:

| Config | GPU |
|--------|-----|
| `particle_burst`, `rising_particles`, `falling_particles` | By `particleType`: `circle` glow, `spark` streak, `star` flare, `flame` fire puff, `smoke` dust that covers, `ember` flickering mote, `rock` tumbling stone, `crystal` tumbling shard of light, `petal` petal of light, `leaf` solid petal, `wisp` soul flame. Dark colors (blood, mud) are dust for the light types. A burst with `fromRadius` starts on a ring and flies in (power gathering). |
| `expanding_ring` | A broken ring with a wake, and a light pool under it |
| `shockwave` | A thicker ring with a wake, a light pool and a crack decal under it |
| `cone_slash` | A crescent swept across the arc toward the target; `style: 'telegraph'` is a cone warning on the ground |
| `ground_circle` | A magic circle; `style: 'telegraph'` is a warning filling up over the effect's life |
| `beam` | Light flowing to the target; with `fromSky`, a pillar falling onto the anchor |
| `trail` | A ribbon through the followed entity's recent positions |
| `shield_bubble` | By `style`: `hex` (default), `plates`, `holy`, `stone` (with `glowColor` in the cracks) |
| `orbiting_particles` | By `style`: motes with short tails (default), tumbling `rock`s, spinning `blade`s, `wisp`s |
| `dash_afterimage` | Glows joined by a streak |
| `spikes` | Rocks, crystals, thorny roots or lava geysers bursting out of the ground in a ring, over a circle, or along fissures running out from the anchor (`pattern: 'lines'`, glowing cracks with the spikes rising one after another along them), then sinking |
| `rays` | Rays of light bursting out, or with `converge`, gathering in |
| `meteor` | A flaming rock (with its shadow growing on the ground) or a blade of light falling onto the anchor over the effect's life |
| `cut` | Straight cuts across the anchor at `angles` from the aim, or with `path`, along a dash |
| `screen_shake` | The camera shakes (`src/core/screenShake.ts`), in the 2D fallback too |
| `ground_light`, `decal`, `lightning`, `swirl`, `spikes`, `rays`, `meteor`, `cut` | GPU only (the 2D fallback skips them) |

**Lume's Light Orb** (`src/gpu/fx/lightOrb.ts`): a ball of warm light hovering over its glow on the ground, with a ribbon and sparkles behind it while it travels and slow rays while it hangs at a spot; a dim ember while it respawns (she died). Its ball has a solid gold core under a small halo: light alone takes the color of what's under it, so a big halo made the orb look green over grass and white over water.

**Tower shots** leave from the top of the tower and drop onto their target's body as they close in (`towerShotLift` in `src/render/entities/projectile.ts`); the server's shots fly at 500, so they're on screen for up to about 0.6 seconds. Drawn at the ground they stayed hidden under the tower, and a tower's shots on minions or enemies looked like nothing.

**Cast times and later blows:** an ability with a cast time (`ABILITY_WINDUP`) plays the VFX registered as `<abilityId>_windup`, if any, while the caster stands still (Magnus's fire gathering at his staff, Vex drawing her shuriken); its throw plays with `ABILITY_CAST`, when the server throws the projectile. A targeted leap's blow is `<abilityId>_land` (Kael's slam, Urûk's strike, Fenris landing) and Lume's orb landing `lume_q_arrive`: the server sends those when they happen (`gameEvents.ts` plays only their look, no new cast animation).

**Projectile impacts:** when a projectile is destroyed, `entityVFX.ts` spawns the VFX registered as `<projectile type>_impact` (e.g. `magnus_fireball_impact`) where it was, so explosions happen where the projectile actually hits. Only if it hit: one that ran its range out just goes (`projectileHit` in `src/core/state/projectileHits.ts`: an enemy unit right where it went), so Elora's arrow doesn't pin empty ground.

**Effects on an ally:** effects that follow an entity (shields, trails, orbits) follow the caster, or in a phase anchored on the target, the cast's `targetEntityId` (Elara's shield on an ally).

### VFX lab

With the client dev server running, `/vfx-lab.html` plays every registered VFX on a loop in a grid over the real ground (`src/debug/vfxLab.ts`), plus every projectile type in flight, the zones (Calamitus's lava among them) and the champion auras (recall, jungle buffs, an overheated Oitboil, a feral or bloodthirsty Fenris, Caelum's blessing, Protobot's learning, Hop-To-Eat's sugar rush). Options: `?only=magnus`, `?kind=projectile` (or `ability`, `zone`, `aura`), `?zoom=1.4`, `?period=2.5`, `?speed=0.25` (slow motion), `?pause=0.6` (freeze 0.6 seconds after the first cast, to screenshot a moment), `?kind=orb` (Lume's Light Orb in each of its states). Use it to tune effects without a match.

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
(the event handlers are in `src/core/state/gameEvents.ts`). The effect plays
from the caster to the event's target, or from `originX`/`originY` when the
handler returned a `vfxOrigin` (Lume's Eclipse fires from her orb, and her
Warmth pulses there).
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

Each champion has its own colors and its own shapes, so two champions' effects never look alike:

| Champion | Colors | Signature shapes |
|----------|--------|------------------|
| Kael (warrior) | Steel #A8D8FF, azure #4F8DFF, white | Crescent slashes, steel-plate shield, a blade of light falling on his ultimate |
| Magnus | Fire #FF7A1A, hot #FFC04A, amber ward #FFB347 | Flames, fire gathering before the fireball, hex ward, a meteor |
| Elara | Holy #FFE9A8, white, sky #8FD6FF, teal wind | Rays and petals of light (no pillars), a ward of petals, leaves in the wind |
| Gorath | Stone #A08C74, molten #FF8A2A, dust, roar red #FF5A3A | Slam: fissures running out with rocks along them. Earthquake: a ring of pillars at the edge, lava geysers, the camera shaking. A ring-of-stones shield, orbiting rocks, echoing roar rings |
| Vex | Ink #16131F, moonlit steel #D6ECFF, crimson #FF3B6B, cherry petals | Straight cuts (an X on the shuriken's hit, a flash step), ink smoke, circling blades |
| Vile | Void #2A0D3D, violet #A35CFF, soul green #5CFFD0 | Thorny roots, soul flames (wisps), darkness |
| Oitboil | Fire #FF7A1A, hot #FFC04A, soot, cool blue #5CB8FF for Blue Fire | Sparks, gouts of flame (the flamethrower's stream), a trail of burning ground, fire on him while overheated |
| Elora | Pale wood #F2EAD8, poison green #7CD64A, hunter's gold #FFD45A, dust | Arrows (a shaft with a thin streak; green-tipped when poisoned, a gold glint for a weak point), stakes pinning the ground, a lane marked then swept by arrows |
| Caelum | Leaf green #9BE070, gold light #FFE08A, bark | Leaves of light, a golden ray, roots bursting up, a pillar of light on the ally he saves, a soft ring for Lightweaving |
| Fenris | Blood red #E02A2A, dark red, fur grey | Jaws and claw cuts, a pounce's grey streak, a red howl; red rage under him while feral or in his bloodthirst |
| Calamitus | Lava #FF5A14, hot #FFB02E, black rock, obsidian violet | Molten pools (crust, seams and popping bubbles, not flames: Oitboil's fire is flames), a wave of magma, lava geysers erupting from every pool |
| Protobot 45 | Electric cyan #4AE0FF, steel #6A7A8A, rocket orange #FF8A2A | A magnetic claw trailing a steel chain, bolts and a cyan streak as a champion is dragged in, a hex shield, a rocket fist's streak of fire, an electromagnetic pulse |
| Hop-To-Eat | Fluff white #F4F0F0, pink #FF8AB8, carrot orange, star yellow #FFE25A | White streaks and puffs of fluff as it hops, bits of carrot, cartoon stars for the kick and the crash |
| Lume | White, warm #FFD27A, prism cyan #9FF3FF and pink #FFB0F0 | Crystals of light, rays, beams: the Prismatic Beam (E, drawn by her renderer while it lasts, from her to the orb) and the Eclipse (R, from the orb) |

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
  // Optional: once this effect shows up on the entity, the orbit lasts while
  // it does (duration at most): Vex's Ninja Mode (extended by kills), Urûk's
  // charged spear (spent by the attack), Vile transformed
  whileEffect: 'vex_ninja_mode',
}
```

A shield bubble likewise ends when the shield it's for breaks (`ShieldSnapshot.sourceId`, the ability's id). Looks that last exactly as long as an effect and follow the champion can also be drawn from its effects in `src/gpu/fx/championAuras.ts` (Vile transformed: a sigil as wide as his aura reaches).

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

`EntityRenderer.render` updates the VFX manager, then with the GPU layer draws the ground effects, the units and the top effects as described in GPU rendering; without it, `vfxManager.render(ctx, 0, 0)` draws everything in 2D after the units.

Heals show as a green "+N" rising beside the entity. `ServerEntity.heal(amount, context,
sourceId)` sends a `HEAL` event `{ entityId, amount, sourceId }` when given a context: ability
heals, healing auras, heals over time and lifesteal do; max health going up doesn't.

Champions, minions and jungle creatures flash white for 0.12 s when they take damage: the
`DAMAGE` event stamps `animation.hitTime` (`src/core/state/gameEvents.ts`) and the renderers
add a fading filter (`hitFlashFilter` in `src/render/hitFlash.ts`: low contrast and high
brightness, a white silhouette fading back to the sprite; `stateManager.getHitFlash`).
The hit also knocks the body back up to 3 units, away from what hit it, springing back as
the flash fades (`stateManager.getHitRecoil`, applied by `EntityRenderer`).

Damage numbers pop in 60% bigger and settle within the first 12% of their life; hits
over 40 damage stay bigger (up to 50% at 190).


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
| Max total active particles | 1500 |
| Initial pool size | 300 |
| Pool growth increment | 100 |
| Max quads per GPU layer per frame | 16384 |

## Adding New VFX

1. Call `registerAbilityVFX()` with phases and effects in
   `src/vfx/champions/<championId>.ts`, using the ability's ID from
   `CHAMPION_DEFINITIONS` as `abilityId`. For a new champion, create that file
   and import it from `src/vfx/champions/index.ts`.
2. Build the effects from `src/vfx/recipes.ts` and layer them: a core (slash,
   ring, spikes, rays), secondary motion (sparks, flames, smoke, rocks), and
   what it leaves on the ground (light pool, scorch). Keep to the champion's
   colors and shapes (see [Champion Color Palettes](#champion-color-palettes)).
   An area with an `aoeDelay` gets a `warning()` lasting `landsAt(abilityId)`
   and its impact at that delay; a skillshot gets power gathering (`gather()`)
   until its projectile keyframe.
3. A skillshot's explosion goes in `<abilityId>_impact`; its projectile's look
   in `PROJECTILE_STYLES` (`src/gpu/fx/projectiles.ts`).
4. Tune it in the VFX lab (`/vfx-lab.html?only=<abilityId>&speed=0.3`), then in a match.

```typescript
registerAbilityVFX({
  abilityId: 'new_champion_ability',
  phases: [
    phase('cast', 0, 'caster', [sparks('#7cc8ff', 10), light('#7cc8ff', 80, 0.8, 0.3)], 0.3),
    phase('impact', 0.2, 'ground_target', [
      shockwave('#7cc8ff', 10, 120, 0.35),
      smoke('#8a7a66', 8),
      scorch('#2a2018', 70, 1.5),
    ]),
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
| `src/core/state/entityVFX.ts` | Spawns death, respawn, level up, recall and projectile impact VFX from entity deltas |
| `src/vfx/recipes.ts` | Shorthands for effect configs |
| `src/gpu/fx/` | GPU effects: shader, batch, bloom pass, projectiles, zones |
| `src/debug/vfxLab.ts` | The VFX lab (`/vfx-lab.html`) |

## World VFX

Defined in `src/vfx/world.ts` (keys in `WORLD_VFX`). They use the same phase-based definitions as ability VFX. `OnlineStateManager` spawns them from events (`src/core/state/gameEvents.ts`) and state changes (`src/core/state/entityVFX.ts`):

| Key | When |
|-----|------|
| `fx_hit_physical` / `fx_hit_magic` / `fx_hit_true` | A `DAMAGE` event: a small spark on the target, colored by damage type |
| `fx_level_up` | A champion's level goes up |
| `fx_champion_death` / `fx_respawn` | A champion dies (removed from client state) / reappears |
| `fx_recall_depart` | A recall ends: where the champion was, the light snaps in and a beam carries it up |
| `fx_recall_arrive` | A recall ends with the champion jumping to base |
| `fx_tower_destroyed` | A tower or nexus dies: flash, shockwave, rubble |
| `fx_last_hit` | The local champion last-hits a minion or monster (`GOLD_EARNED` carries where it fell): a fountain of coins |
| `fx_creature_death` | A jungle creature dies. Its special attack warning, if it was winding up, is cancelled (`VFXManager.cancelCasterEffects`) |
| `fx_dragon_death` | The dragon dies: a large fiery shockwave, sparks and embers, and a light screen shake |
| `fx_rootwyrm_death` | The Rootwyrm dies: a green shockwave, its thorny roots bursting up, leaves and spores drifting |
| `jungle_slam_blue` / `jungle_slam_red` / `dragon_breath` / `rootwyrm_eruption` | An `ABILITY_CAST` from a monster's special attack: a warning filling up over the wind-up (a circle, or the dragon's cone), then the hit: cracks and dust for the slams, a jet of flame for the breath, thorny roots bursting out all over the Rootwyrm's circle (sizes from `MOBAConfig.JUNGLE.SPECIAL_ATTACKS`, see [jungle.md](jungle.md)) |
| `vile_trap_trigger` / `vile_trap_explosion` | An `ABILITY_CAST` from one of Vile's traps snapping on someone, or blown up by his ultimate. Both carry the trap's `x`/`y`: the enemy team never has the (stealthed) trap, so it sees neither until the client draws them at that point |
| `nocthar_q_burst` / `nocthar_hollow_rise` / `nocthar_w_frenzy` / `nocthar_e_charge` / `nocthar_r_emerge` / `nocthar_colossus_w_throw` / `nocthar_colossus_w_impact` / `nocthar_colossus_e_trample` / `nocthar_colossus_e_end` | Nocthar's army: the hands bursting where the ground cracked (the Q's cast fills a warning over its 0.6 s delay), a Hollow clawing out of a crack, a frenzied Hollow's pale flames, a charging Hollow's dust and red eyes, the colossus erupting (its R's windup fills a ring of cracks over the 1.5 s cast). The colossus's events come from it (its strip plays): the bones' landing fills while it winds up and they fly, then they shatter; a scar shows where it will charge, then a crash. His ground orders (`nocthar_e`, `nocthar_colossus_r` without a unit) show only to his team (`gameEvents.ts`). His basic attack is a GPU projectile, `nocthar_auto` (a tumbling bone shard). Summons' deaths: `fx_hollow_crumble`, `fx_colossus_crumble` |
| `kip_w_hit` / `kip_e_land` / `kip_r_volley` | Kip: Run Them Down on each marked enemy it slows (a purple ring closing on it), Grand Entrance landing (a ring of dust, gold sparks: its burst), each volley of Show Them All after the first (a twang of gold). His arrows are GPU projectiles: `kip_auto`, `kip_pop_auto` (the arrow that will pop a mark, a red glint; `kip_pop_auto_impact` is the pop's burst), `kip_q` (`kip_q_impact`, a bullseye) and `kip_r` (`kip_r_impact`) |

Drawn directly by renderers rather than as VFX definitions:
- **Recall channel** (`src/gpu/fx/championAuras.ts`; 2D fallback `ChampionRenderer.renderRecallChannel`): a magic circle at the feet that draws itself in over the recall, a column of light growing with it and motes rising.
- **Jungle buff auras** (same files, `renderJungleBuffAuras` in 2D): a ring at the feet of any champion holding a buff, so everyone can see who has it. Crest of Insight is a blue ring with orbiting motes; Crest of Cinders is a red-orange ring with motes and rising embers. A champion with both shows the red ring outside the blue one.
- **Corpses** (`EntityRenderer.renderCorpses`, kept by `src/core/state/corpses.ts`): a champion, minion or small monster that dies doesn't vanish: its body (no bars or plates) falls over backward within a quarter second (monsters slump), greys out, sinks a little and fades, over 1.6 s (champions), 0.9 s (minions) or 1.1 s (monsters). The buff monsters and the epic ones go out with their own death VFX instead.
- **Tower lock-on** (`renderTower`): a pulsing dashed line and reticle while an enemy tower shoots the local champion.
- **Health bars** (`overlays/healthBars.ts`): a hit leaves the health it took as a light trail that holds for 0.35 s, then drains (`overlays/damageTrail.ts`). Champion bars have a tick every 100 health and a full-height one every 1000. The small ticks are left out when they would be under 3 px apart.
- **Tower range** (`overlays/towerRange.ts`): a dashed ring on the ground around an enemy tower, fading in as the local champion comes within 250 of its reach (attack range plus both radii). It turns red while the tower aims at the champion. Around an allied tower, a blue ring fades in as an enemy champion comes near: where an enemy champion can be shot (attack range plus the tower's and a typical champion's radius); it turns red while the tower shoots a champion.
- **Attack range** (`OnlineInputHandler.renderAttackRange`): a red circle of the local champion's reach while A (attack-move) is held.
- **Announcements** (`AnnouncementBanner`, fed by `OnlineStateManager`; the texts are in `src/core/state/gameEvents.ts`): champion kills ("You have slain an enemy!" / "You have been slain!" / "Vex has slain Kael" / "First Blood!"), multi-kills (a killer's kills each within 10 s of the last: "Double Kill!" up to "Penta Kill!", with who got it), towers destroyed, the dragon or the Rootwyrm slain, and the match result.
- **Kill feed** (`src/ui/KillFeed.ts`, kept by `src/core/state/killFeed.ts`): the last five champion kills in the top right, under the stats panel, for 8 s each: the killer's portrait (or T, M, J for a tower, minions or a monster), a blade, the victim's portrait greyed and crossed out, on the killer's team color. `CHAMPION_KILL` carries `victimChampionId`, `killerChampionId` and `killerType` for it, since the victim is gone from state by then.
- **Screen shake** (`src/core/screenShake.ts`): a decaying jitter on top of the camera transform. It's triggered when a tower falls, when the nexus falls (stronger), when the dragon dies, by ultimates' impacts (`shake()` in their VFX: Kael, Magnus, Lume, Vile, Gorath), when the local champion takes a hit over 15% of its health, and lightly when it deals one over 12% of a champion's. A shake in the world fades with its distance from the middle of the view (full within half the view's width, none past its width), and so do VFX screen flashes (`nearView`), so a fight across the map doesn't shake or flash the screen.
- **Camera punch** (`punchCamera`, same file): a quick 5% zoom in, easing back over 0.4 s, with a shake, when the local champion takes down a champion or goes down.
- **Low-health vignette** (`LowHealthVignette`): red screen edges below 30% health, pulsing faster as health drops.
- **Status icons** (`statusIndicators.ts`): knockup, root, silence, slows, burn and the jungle buffs.

Ability VFX are registered under the ability ID the server sends in `ABILITY_CAST`. The client contract test (`packages/client/src/test/ChampionClientContract.test.ts`) fails if an ability has no VFX or a registered key is never spawned.
