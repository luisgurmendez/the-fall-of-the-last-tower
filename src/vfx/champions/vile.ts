/**
 * Vile ability VFX: void violet, rot and soul-green light. Registered when
 * this module is imported (see ./index.ts). His arrows are drawn by
 * src/gpu/fx/projectiles.ts.
 */

import { registerAbilityVFX } from '../VFXRegistryStore';
import { embers, light, phase, ring, scorch, shockwave, sigil, smoke, sparks, swirl } from '../recipes';

const VOID = '#2a0d3d';
const VIOLET = '#a35cff';
const SOUL = '#5cffd0';
const ROT = '#1e2a14';

// Q: darkness gathering at his bow...
registerAbilityVFX({
  abilityId: 'vile_black_arrows',
  phases: [
    phase('loose', 0, 'caster', [
      smoke(VOID, 6, [10, 16], [40, 100]),
      sparks(VIOLET, 8, [200, 380], Math.PI / 5),
      light(VIOLET, 60, 0.6, 0.25),
    ], 0.3),
  ],
});

// ...and bursting where an arrow lands
registerAbilityVFX({
  abilityId: 'vile_black_arrows_impact',
  phases: [
    phase('hit', 0, 'caster', [
      smoke(VOID, 8, [12, 20], [40, 120]),
      sparks(VIOLET, 14, [160, 340]),
      ring(VIOLET, 6, 55, 0.25, 4),
      light(VIOLET, 80, 0.7, 0.3),
    ], 0.3),
  ],
});

// W: he melts into a cloud of darkness that trails him
registerAbilityVFX({
  abilityId: 'vile_veil_of_darkness',
  phases: [
    phase('veil', 0, 'caster', [
      smoke(VOID, 20, [20, 34], [30, 110], { lifetime: { min: 0.9, max: 1.5 } }),
      swirl(VIOLET, 70, 0.8, -1.4, 5),
      sparks(VIOLET, 10),
    ]),
    phase('trail', 0.15, 'caster', [{ type: 'trail', color: VIOLET, thickness: 10, duration: 2.0, fadeLength: 18 }], 2.0),
  ],
});

// E: a trap planted in a puff of rot, its circle glowing as it arms
registerAbilityVFX({
  abilityId: 'vile_roots_of_vilix',
  phases: [
    phase('plant', 0, 'ground_target', [
      smoke(ROT, 10, [12, 20], [30, 90]),
      sparks(SOUL, 10, [120, 260]),
      sigil(VIOLET, 70, 0.8),
      light(SOUL, 70, 0.6, 0.6),
    ], 0.8),
  ],
});

// A trap snapping shut on someone
registerAbilityVFX({
  abilityId: 'vile_trap_trigger',
  phases: [
    phase('snap', 0, 'caster', [
      smoke(ROT, 10, [12, 20], [40, 110]),
      sparks(SOUL, 14, [150, 300]),
      ring(VIOLET, 10, 70, 0.25, 4),
      light(SOUL, 90, 0.9, 0.4),
    ], 0.4),
  ],
});

// A trap blowing up when he casts his ultimate
registerAbilityVFX({
  abilityId: 'vile_trap_explosion',
  phases: [
    phase('burst', 0, 'caster', [
      shockwave(VIOLET, 15, 150, 0.4, 12),
      smoke(VOID, 16, [18, 30], [60, 170]),
      sparks(SOUL, 20, [200, 400]),
      scorch('#140a1c', 100, 1.8, 0.5),
      light(VIOLET, 170, 1.2, 0.5),
    ]),
  ],
});

// R: he transforms in a vortex; a dark circle and souls stay with him
registerAbilityVFX({
  abilityId: 'vile_restoration_of_vilix',
  phases: [
    phase('transform', 0, 'caster', [
      shockwave(VIOLET, 20, 130, 0.45, 10),
      swirl(VIOLET, 90, 1.0, -1.2, 5),
      smoke(VOID, 16, [18, 30], [60, 160]),
      embers(SOUL, 18, 60),
      light(VIOLET, 140, 1.2, 0.8),
    ], 1.0),
    phase('aura', 0.4, 'caster', [
      sigil(VIOLET, 85, 10.0),
      { type: 'orbiting_particles', color: SOUL, count: 4, size: 6, orbitRadius: 50, orbitSpeed: 2.2, duration: 10.0 },
    ], 10.0),
  ],
});
