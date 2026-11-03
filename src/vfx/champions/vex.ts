/**
 * Vex ability VFX: ink-black smoke, moonlit steel, a crimson edge and
 * cherry petals; straight cuts, never crescents. Registered when this
 * module is imported (see ./index.ts). The shuriken itself is drawn by
 * src/gpu/fx/projectiles.ts.
 */

import { getAbilityDefinition, getCastTime } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import { abilityImpactTime } from '@/core/state/abilityTiming';
import { cuts, embers, light, pathCut, petals, phase, rays, smoke, sparks, twinkles } from '../recipes';

const INK = '#16131f';
const MOON = '#d6ecff';
const CRIMSON = '#ff3b6b';
const PETAL = '#ffb3c8';

/** Seconds until the shuriken leaves her hand (its animation's projectile keyframe) */
const THROW = abilityImpactTime('vex_shuriken');
/** Her cast time: she draws the shuriken */
const DRAW = getCastTime(getAbilityDefinition('vex_shuriken')!);

// Q: a glint as she draws the shuriken (in the cast time)...
registerAbilityVFX({
  abilityId: 'vex_shuriken_windup',
  phases: [
    phase('draw', 0, 'caster', [twinkles(MOON, 1, [0, 0], { size: { min: 6, max: 7 }, lifetime: { min: DRAW, max: DRAW } })], DRAW),
  ],
});

// ...a flick as it leaves...
registerAbilityVFX({
  abilityId: 'vex_shuriken',
  phases: [
    phase('throw', THROW, 'caster', [sparks(MOON, 5, [200, 360], Math.PI / 5)], 0.25),
  ],
});

// ...and an X cut where it lands
registerAbilityVFX({
  abilityId: 'vex_shuriken_impact',
  phases: [
    phase('hit', 0, 'caster', [
      cuts(MOON, 52, 4, 0.35, [Math.PI / 4, -Math.PI / 4]),
      sparks(CRIMSON, 10, [140, 300]),
      light(CRIMSON, 50, 0.5, 0.3),
    ], 0.35),
  ],
});

// W: she vanishes in a burst of ink smoke and cherry petals
registerAbilityVFX({
  abilityId: 'vex_shroud',
  phases: [
    phase('vanish', 0, 'caster', [
      smoke(INK, 20, [18, 30], [20, 100], { lifetime: { min: 0.9, max: 1.5 } }),
      petals(PETAL, 16, [60, 170], 'leaf', { gravity: 10 }),
      embers(CRIMSON, 6, 30),
    ], 1.5),
  ],
});

// E: a flash step: a cut of light along the dash, smoke where she leaves and lands
registerAbilityVFX({
  abilityId: 'vex_dash',
  phases: [
    phase('step', 0, 'caster', [
      { type: 'dash_afterimage', color: '#3d3a7a', imageCount: 5, fadeSpeed: 3.5, duration: 0.3 },
      pathCut(MOON, 7, 0.4),
      smoke(INK, 8, [12, 18], [20, 60]),
    ], 0.4),
    phase('arrive', 0.25, 'caster', [
      smoke(INK, 8, [14, 22], [30, 90]),
      sparks(MOON, 10, [150, 300]),
      sparks(CRIMSON, 6, [100, 200]),
    ], 0.3),
  ],
});

// R: a burst of ink and crimson light, then blades circling her while it lasts
registerAbilityVFX({
  abilityId: 'vex_ninja_mode',
  phases: [
    phase('awaken', 0, 'caster', [
      smoke(INK, 18, [16, 28], [60, 160]),
      rays(CRIMSON, 110, 0.5, 8, false, 1.5),
      petals(PETAL, 12, [80, 180], 'leaf'),
      embers(CRIMSON, 12, 40),
      light(CRIMSON, 110, 0.8, 0.6),
    ], 0.9),
    // Blades circle her while it lasts (kills extend it)
    phase('aura', 0.3, 'caster', [
      { type: 'orbiting_particles', color: CRIMSON, count: 3, size: 7, orbitRadius: 46, orbitSpeed: 4, duration: 120, style: 'blade', whileEffect: 'vex_ninja_mode' },
    ], 120),
  ],
});
