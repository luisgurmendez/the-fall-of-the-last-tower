/**
 * Magnus ability VFX: fire, and arcane violet for his barrier. Registered
 * when this module is imported (see ./index.ts). The fireball itself is
 * drawn by src/gpu/fx/projectiles.ts and his zones by src/gpu/fx/zones.ts.
 */

import { registerAbilityVFX } from '../VFXRegistryStore';
import { debris, flames, light, phase, pillar, ring, scorch, shockwave, smoke, sparks, swirl, twinkles, warning } from '../recipes';

const FIRE = '#ff7a1a';
const HOT = '#ffc04a';
const SMOKE = '#3a3030';
const ARCANE = '#b07cff';

// Q: a flash of flame at his hands...
registerAbilityVFX({
  abilityId: 'magnus_fireball',
  phases: [
    phase('cast', 0, 'caster', [
      flames(HOT, 5, [7, 11], [60, 160], { spread: Math.PI / 3 }),
      sparks(HOT, 6, [120, 260], Math.PI / 3),
      light(FIRE, 70, 0.8, 0.25),
    ], 0.3),
  ],
});

// ...and an explosion where the fireball hits
registerAbilityVFX({
  abilityId: 'magnus_fireball_impact',
  phases: [
    phase('explode', 0, 'caster', [
      flames(FIRE, 10, [14, 24], [50, 150]),
      flames(HOT, 5, [10, 16], [20, 70]),
      ring(HOT, 8, 70, 0.28, 5),
      sparks(HOT, 16, [160, 360]),
      smoke(SMOKE, 5, [14, 22], [20, 60], { lifetime: { min: 0.7, max: 1.1 } }),
      scorch('#2a1a10', 42, 1.6, 0.9),
      light(FIRE, 130, 1.3, 0.5, 0.5),
    ]),
  ],
});

// W: a violet barrier with a swirl of runes as it forms
registerAbilityVFX({
  abilityId: 'magnus_shield',
  phases: [
    phase('raise', 0, 'caster', [
      { type: 'shield_bubble', color: ARCANE, radius: 36, duration: 4.0, pulseSpeed: 2 },
      ring(ARCANE, 20, 64, 0.3, 4),
      swirl(ARCANE, 55, 0.6, 1.2, 4),
      twinkles('#e0c8ff', 10),
      light(ARCANE, 90, 0.7, 0.5),
    ], 4.0),
  ],
});

// E: mud splashing out where the quagmire forms
registerAbilityVFX({
  abilityId: 'magnus_mud',
  phases: [
    phase('splash', 0, 'ground_target', [
      smoke('#5a4030', 14, [14, 24], [60, 160]),
      debris('#3a2818', 12, [80, 180]),
    ]),
  ],
});

// R: a meteor streaks down and blasts a crater; the burning zone follows
registerAbilityVFX({
  abilityId: 'magnus_meteor',
  phases: [
    phase('fall', 0, 'ground_target', [
      pillar(FIRE, 420, 14, 0.3, HOT),
      warning(FIRE, 200, 0.3),
    ], 0.3),
    phase('impact', 0.3, 'ground_target', [
      flames(FIRE, 18, [18, 30], [80, 220]),
      flames(HOT, 8, [12, 20], [30, 90]),
      shockwave(FIRE, 30, 230, 0.45, 14),
      sparks(HOT, 30, [220, 480]),
      debris('#3a2010', 14, [120, 260]),
      smoke(SMOKE, 10, [20, 32], [40, 120], { lifetime: { min: 0.9, max: 1.5 } }),
      scorch('#1e120a', 160, 5.0, 1.0),
      light(FIRE, 280, 1.5, 0.8, 0.4),
      { type: 'screen_flash', color: '#ffb060', duration: 0.12, maxAlpha: 0.15 },
    ]),
  ],
});
