/**
 * Vex ability VFX: shadow violet and smoke. Registered when this module is
 * imported (see ./index.ts). The shuriken itself is drawn by
 * src/gpu/fx/projectiles.ts.
 */

import { registerAbilityVFX } from '../VFXRegistryStore';
import { embers, light, phase, ring, shockwave, smoke, sparks, swirl, twinkles } from '../recipes';

const SHADOW = '#a35cff';
const EDGE = '#e8dcff';
const SMOKE = '#2a2238';

// Q: a flick of violet as the shuriken leaves...
registerAbilityVFX({
  abilityId: 'vex_shuriken',
  phases: [phase('throw', 0, 'caster', [sparks(SHADOW, 6, [200, 360], Math.PI / 4), light(SHADOW, 50, 0.5, 0.2)], 0.25)],
});

// ...and a cut of light where it lands
registerAbilityVFX({
  abilityId: 'vex_shuriken_impact',
  phases: [
    phase('hit', 0, 'caster', [
      twinkles(EDGE, 4, [30, 80]),
      sparks(SHADOW, 12, [160, 320]),
      ring(SHADOW, 4, 40, 0.2, 3),
      light(SHADOW, 60, 0.6, 0.25),
    ], 0.3),
  ],
});

// W: she vanishes in a puff of smoke
registerAbilityVFX({
  abilityId: 'vex_shroud',
  phases: [
    phase('vanish', 0, 'caster', [
      smoke(SMOKE, 18, [18, 30], [20, 90], { lifetime: { min: 0.8, max: 1.4 } }),
      swirl(SHADOW, 60, 0.6, 1.5, 3),
      ring(SHADOW, 10, 70, 0.3, 3),
      sparks(SHADOW, 10, [100, 220]),
    ]),
  ],
});

// E: a streak of shadow, smoke where she leaves and where she lands
registerAbilityVFX({
  abilityId: 'vex_dash',
  phases: [
    phase('step', 0, 'caster', [
      { type: 'dash_afterimage', color: SHADOW, imageCount: 5, fadeSpeed: 3.5, duration: 0.3 },
      { type: 'trail', color: SHADOW, thickness: 9, duration: 0.4, fadeLength: 12 },
      smoke(SMOKE, 6, [12, 18], [20, 60]),
    ], 0.4),
    phase('arrive', 0.25, 'caster', [
      smoke(SMOKE, 8, [14, 22], [30, 90]),
      sparks(EDGE, 10, [150, 300]),
      ring(SHADOW, 8, 50, 0.2, 3),
    ], 0.3),
  ],
});

// R: a burst of shadow, then blades of light circling her while it lasts
registerAbilityVFX({
  abilityId: 'vex_ninja_mode',
  phases: [
    phase('awaken', 0, 'caster', [
      shockwave(SHADOW, 10, 90, 0.35, 8),
      swirl(SHADOW, 75, 0.9, 2, 4),
      twinkles(EDGE, 10),
      embers(SHADOW, 16, 40),
      light(SHADOW, 110, 1.0, 0.6),
    ], 0.9),
    phase('aura', 0.3, 'caster', [
      { type: 'orbiting_particles', color: SHADOW, count: 3, size: 6, orbitRadius: 34, orbitSpeed: 4, duration: 15.0 },
    ], 15.0),
  ],
});
