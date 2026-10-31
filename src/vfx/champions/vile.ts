/**
 * Vile ability VFX: void violet, rot, thorny roots and soul-green flames.
 * Registered when this module is imported (see ./index.ts). His arrows are
 * drawn by src/gpu/fx/projectiles.ts.
 */

import { getAbilityDefinition } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import { gather, light, phase, ring, scorch, sigil, smoke, sparks, spikes, wisps } from '../recipes';

const VOID = '#2a0d3d';
const VIOLET = '#a35cff';
const SOUL = '#5cffd0';
const ROT = '#1e2a14';
const ROOT = '#4a2e48';

/** Seconds from releasing the bow until the arrows fly (its animation's projectile keyframe) */
const LOOSE = 0.2;

const TRAP = getAbilityDefinition('vile_roots_of_vilix')?.trap;
const TRAP_RADIUS = TRAP?.triggerRadius ?? 60;
const TRAP_BLAST = TRAP?.explosionRadius ?? 140;
const AURA_RADIUS = getAbilityDefinition('vile_restoration_of_vilix')?.aura?.radius ?? 140;

// Q: souls gather at his bow...
registerAbilityVFX({
  abilityId: 'vile_black_arrows',
  phases: [
    phase('draw', 0, 'caster', [
      gather(SOUL, 6, 50, LOOSE, 'wisp'),
      smoke(VOID, 4, [10, 14], [10, 30]),
      light(VIOLET, 60, 0.6, LOOSE + 0.1),
    ], LOOSE),
    phase('loose', LOOSE, 'caster', [sparks(VIOLET, 8, [200, 380], Math.PI / 5)], 0.25),
  ],
});

// ...and burst out of whoever an arrow hits
registerAbilityVFX({
  abilityId: 'vile_black_arrows_impact',
  phases: [
    phase('hit', 0, 'caster', [
      smoke(VOID, 8, [12, 20], [40, 120]),
      wisps(SOUL, 5),
      sparks(VIOLET, 10, [160, 320]),
      light(VIOLET, 80, 0.7, 0.35),
    ], 0.5),
  ],
});

// W: he melts into a cloud of darkness that trails him, souls slipping out
registerAbilityVFX({
  abilityId: 'vile_veil_of_darkness',
  phases: [
    phase('veil', 0, 'caster', [
      smoke(VOID, 22, [20, 34], [30, 110], { lifetime: { min: 1.0, max: 1.6 } }),
      wisps(SOUL, 6, [40, 100]),
    ], 1.6),
    phase('trail', 0.15, 'caster', [{ type: 'trail', color: VIOLET, thickness: 10, duration: 2.0, fadeLength: 18 }], 2.0),
  ],
});

// E: a trap planted: little thorns sprout in a circle that glows as it arms
registerAbilityVFX({
  abilityId: 'vile_roots_of_vilix',
  phases: [
    phase('plant', 0, 'ground_target', [
      spikes('thorn', ROOT, 7, 30, 'ring', [14, 22], 1.0, SOUL),
      smoke(ROT, 8, [12, 20], [30, 80]),
      sigil(VIOLET, TRAP_RADIUS, 1.0),
      light(SOUL, 70, 0.5, 0.8),
    ], 1.0),
  ],
});

// A trap snapping shut: roots burst up around whoever stepped on it
registerAbilityVFX({
  abilityId: 'vile_trap_trigger',
  phases: [
    phase('snap', 0, 'caster', [
      spikes('thorn', ROOT, 10, 34, 'ring', [38, 56], 1.4, SOUL),
      smoke(ROT, 10, [12, 20], [40, 110]),
      sparks(SOUL, 10, [150, 300]),
      light(SOUL, 90, 0.8, 0.6),
    ], 1.4),
  ],
});

// A trap blowing up when he casts his ultimate: a thicket of roots and a burst of souls
registerAbilityVFX({
  abilityId: 'vile_trap_explosion',
  phases: [
    phase('burst', 0, 'caster', [
      spikes('thorn', ROOT, 14, TRAP_BLAST * 0.8, 'area', [40, 70], 1.1, SOUL),
      smoke(VOID, 16, [18, 30], [60, 170]),
      wisps(SOUL, 10, [100, 220]),
      scorch(VIOLET, TRAP_BLAST * 0.7, 1.8, 0.5),
      light(VIOLET, TRAP_BLAST, 1.1, 0.5),
    ], 1.1),
  ],
});

// R: he transforms in a burst of darkness; a dark circle and soul flames stay with him
registerAbilityVFX({
  abilityId: 'vile_restoration_of_vilix',
  phases: [
    phase('transform', 0, 'caster', [
      smoke(VOID, 18, [18, 30], [60, 170]),
      wisps(SOUL, 14, [100, 220]),
      ring(VIOLET, 20, AURA_RADIUS, 0.45, 4),
      light(VIOLET, 140, 1.1, 0.8),
    ], 1.0),
    phase('aura', 0.4, 'caster', [
      sigil(VIOLET, AURA_RADIUS * 0.6, 10.0),
      { type: 'orbiting_particles', color: SOUL, count: 4, size: 7, orbitRadius: 62, orbitSpeed: 2.2, duration: 10.0, style: 'wisp' },
    ], 10.0),
  ],
});
