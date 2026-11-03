/**
 * Caelum ability VFX: the forest's green and the gold of his light.
 * Registered when this module is imported (see ./index.ts). The blessing's
 * glow on an emboldened ally is drawn by src/gpu/fx/championAuras.ts.
 */

import { CAELUM_LIGHT, getAbilityDefinition, getCastTime } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import {
  debris,
  gather,
  landsAt,
  light,
  petals,
  phase,
  pillar,
  rays,
  ring,
  sparks,
  spikes,
  twinkles,
  warning,
} from '../recipes';

const GREEN = '#9be070';
const LEAF = '#5aa83a';
const GOLD = '#ffe08a';
const WHITE = '#fff8e0';
const BARK = '#6a4a2a';

const ROOTS = landsAt('caelum_e');
const ROOTS_RADIUS = getAbilityDefinition('caelum_e')?.aoeRadius ?? 100;

// Q: light gathers at his staff (in the cast time)...
const GATHER = getCastTime(getAbilityDefinition('caelum_q')!);
registerAbilityVFX({
  abilityId: 'caelum_q_windup',
  phases: [
    phase('gather', 0, 'caster', [gather(GOLD, 8, 40, GATHER), light(GOLD, 40, 0.4, GATHER)], GATHER),
  ],
});

// ...the staff flares as the ray leaves (the ray is the projectile)...
registerAbilityVFX({
  abilityId: 'caelum_q',
  phases: [
    phase('flare', landsAt('caelum_q'), 'caster', [
      rays(GOLD, 40, 0.25, 10),
      sparks(WHITE, 6, [160, 300], Math.PI / 8),
      light(GOLD, 50, 0.6, 0.25),
    ], 0.3),
  ],
});

// ...and bursts on the first enemy it meets
registerAbilityVFX({
  abilityId: 'caelum_q_impact',
  phases: [
    phase('burst', 0, 'caster', [
      sparks(GOLD, 12, [120, 260]),
      ring(WHITE, 6, 34, 0.25, 3),
      light(GOLD, 50, 0.8, 0.3),
    ], 0.4),
  ],
});

// W: leaves of light rise around the ally he blesses
registerAbilityVFX({
  abilityId: 'caelum_w',
  phases: [
    phase('bless', 0, 'target', [
      petals(GREEN, 10, [30, 80], 'leaf'),
      twinkles(GOLD, 8, [20, 70]),
      ring(GREEN, 50, 14, 0.35, 3),
      light(GREEN, 60, 0.6, 0.4),
    ], 0.6),
  ],
});

// E: a warning of green where the roots will rise, then they burst up
registerAbilityVFX({
  abilityId: 'caelum_e',
  phases: [
    phase('stir', 0, 'ground_target', [warning(LEAF, ROOTS_RADIUS, ROOTS)], ROOTS),
    phase('roots', ROOTS, 'ground_target', [
      spikes('thorn', BARK, 10, ROOTS_RADIUS * 0.85, 'ring', [20, 36], 1.3, GREEN),
      debris(BARK, 10, [60, 150]),
      petals(LEAF, 8, [40, 100], 'leaf'),
      ring(GREEN, 20, ROOTS_RADIUS, 0.3, 4),
    ], 1.3),
  ],
});

// R: his life light gathers at his chest...
registerAbilityVFX({
  abilityId: 'caelum_r',
  phases: [
    phase('give', 0, 'caster', [
      gather(GOLD, 14, 70, 0.4),
      rays(WHITE, 60, 0.4, 14, true),
      light(GOLD, 60, 0.7, 0.5),
    ], 0.5),
  ],
});

// ...and comes down on the ally as a pillar of light
registerAbilityVFX({
  abilityId: 'caelum_r_given',
  phases: [
    phase('pillar', 0, 'ground_target', [
      pillar(GOLD, 180, 26, 0.6, WHITE),
      petals(GREEN, 12, [40, 110], 'leaf'),
      twinkles(WHITE, 10, [30, 90]),
      ring(GOLD, 20, 70, 0.4, 4),
      light(GOLD, 90, 1.0, 0.6),
    ], 0.8),
  ],
});

// Lightweaving: a soft ring of light rolls out over the allies around him
registerAbilityVFX({
  abilityId: 'caelum_lightweave',
  phases: [
    phase('weave', 0, 'caster', [
      ring(GREEN, 20, CAELUM_LIGHT.weaveRadius, 0.6, 3),
      petals(GREEN, 8, [60, 140], 'leaf'),
      twinkles(GOLD, 6, [40, 100]),
      light(GREEN, 80, 0.4, 0.5),
    ], 0.7),
  ],
});
