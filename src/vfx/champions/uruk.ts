/**
 * Urûk ability VFX: silver and ice blue, the spear's straight lines and
 * frost. Registered when this module is imported (see ./index.ts).
 */

import { getAbilityDefinition } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import { abilityImpactTime } from '@/core/state/abilityTiming';
import {
  embers,
  light,
  pathCut,
  phase,
  ring,
  scorch,
  shake,
  shockwave,
  smoke,
  sparks,
  spikes,
  twinkles,
} from '../recipes';

const SILVER = '#d8e4ec';
const ICE = '#9fd8ff';
const FROST = '#f0f8ff';

const THRUST = abilityImpactTime('uruk_q');
const STRIKE = abilityImpactTime('uruk_r');
const BURST = getAbilityDefinition('uruk_e')?.aoeRadius ?? 170;

// Q: the spear's line flashes, then a silver streak runs the length of the thrust
registerAbilityVFX({
  abilityId: 'uruk_q',
  phases: [
    phase('draw', 0, 'caster', [light(ICE, 40, 0.5, THRUST)], THRUST),
    phase('thrust', THRUST, 'caster', [
      pathCut(SILVER, 10, 0.3),
      pathCut(FROST, 4, 0.22),
      sparks(ICE, 10, [220, 420], Math.PI / 10),
      light(ICE, 70, 0.6, 0.25),
    ], 0.3),
    phase('tip', THRUST, 'ground_target', [
      sparks(FROST, 8, [120, 260]),
      ring(ICE, 6, 30, 0.2, 2),
    ], 0.3),
  ],
});

// W: frost gathers on the spear tip and circles him while it's charged
registerAbilityVFX({
  abilityId: 'uruk_w',
  phases: [
    phase('charge', 0, 'caster', [
      ring(SILVER, 40, 10, 0.25, 3),
      twinkles(FROST, 5, [30, 90]),
      { type: 'orbiting_particles', color: ICE, count: 3, size: 4, orbitRadius: 28, orbitSpeed: 4, duration: 4, style: 'blade' },
      light(ICE, 50, 0.6, 0.4),
    ], 4),
  ],
});

// E: a shell of silver scales around him
registerAbilityVFX({
  abilityId: 'uruk_e',
  phases: [
    phase('scales', 0, 'caster', [
      { type: 'shield_bubble', color: SILVER, radius: 42, duration: 2.5, pulseSpeed: 1.2, style: 'hex' },
      ring(ICE, 50, 18, 0.3, 3),
      twinkles(FROST, 6, [20, 70]),
      light(SILVER, 70, 0.5, 0.4),
    ], 2.5),
  ],
});

// The scales burst: a ring of frost spikes and a cold shockwave
registerAbilityVFX({
  abilityId: 'uruk_e_burst',
  phases: [
    phase('burst', 0, 'caster', [
      shockwave(ICE, 20, BURST, 0.4, 10),
      spikes('crystal', ICE, 12, BURST * 0.8, 'ring', [18, 34], 0.9, FROST),
      sparks(FROST, 18, [160, 360]),
      smoke('#cfe6f5', 8, [14, 22], [30, 90]),
      light(ICE, BURST, 0.9, 0.5),
    ], 0.9),
  ],
});

// R: he leaps trailing silver, then drives the spear down: the ground cracks in ice
registerAbilityVFX({
  abilityId: 'uruk_r',
  phases: [
    phase('leap', 0, 'caster', [
      { type: 'trail', color: SILVER, thickness: 12, duration: STRIKE + 0.1, fadeLength: 16 },
      embers(ICE, 10, 30),
    ], STRIKE + 0.1),
  ],
});

// ...and runs it through where he lands (the server's uruk_r_land)
registerAbilityVFX({
  abilityId: 'uruk_r_land',
  phases: [
    phase('strike', 0, 'target', [
      spikes('crystal', ICE, 10, 90, 'lines', [28, 48], 1.0, FROST),
      shockwave(SILVER, 20, 120, 0.4, 10),
      sparks(FROST, 22, [200, 440]),
      scorch('#1c3448', 70, 2.0, 0.4),
      light(ICE, 160, 1.1, 0.6),
      { type: 'screen_flash', color: '#e6f4ff', duration: 0.12, maxAlpha: 0.12 },
      shake(5, 0.25),
    ], 0.6),
  ],
});
