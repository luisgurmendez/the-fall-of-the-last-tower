/**
 * Fenris ability VFX: blood red, dark fur grey, claw marks. Registered when
 * this module is imported (see ./index.ts). His red rage while feral or in
 * his bloodthirst is drawn by src/gpu/fx/championAuras.ts.
 */

import { getAbilityDefinition } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import {
  cuts,
  debris,
  embers,
  landsAt,
  light,
  phase,
  rays,
  ring,
  shake,
  shockwave,
  slash,
  smoke,
  sparks,
} from '../recipes';

const RED = '#e02a2a';
const BLOOD = '#8a0a14';
const FUR = '#8a8a90';
const WHITE = '#f4ecec';

const RAKE = getAbilityDefinition('fenris_w')?.range ?? 170;
const RAKE_ANGLE = getAbilityDefinition('fenris_w')?.coneAngle ?? Math.PI / 2;

// Q: jaws snap shut on the target: two crescent cuts and a spray of red
registerAbilityVFX({
  abilityId: 'fenris_q',
  phases: [
    phase('bite', 0.1, 'target', [
      cuts(WHITE, 34, 5, 0.2, [Math.PI / 2 - 0.5, Math.PI / 2 + 0.5]),
      sparks(RED, 12, [100, 220]),
      sparks(BLOOD, 6, [60, 140]),
      light(RED, 40, 0.6, 0.25),
    ], 0.35),
  ],
});

// W: a wide rake of claws: three red slashes sweeping the cone
registerAbilityVFX({
  abilityId: 'fenris_w',
  phases: [
    phase('rake', landsAt('fenris_w'), 'caster', [
      slash(RED, RAKE, RAKE_ANGLE / 2, 0.25, 14),
      slash(WHITE, RAKE * 0.85, RAKE_ANGLE / 2, 0.2, 5),
      sparks(RED, 14, [200, 360], RAKE_ANGLE / 2),
      light(RED, 70, 0.5, 0.25),
    ], 0.35),
  ],
});

// E: a grey streak as he pounces, dust where he lands
registerAbilityVFX({
  abilityId: 'fenris_e',
  phases: [
    phase('leap', 0, 'caster', [
      { type: 'trail', color: FUR, thickness: 12, duration: 0.45, fadeLength: 16 },
      smoke(FUR, 5, [10, 16], [20, 60]),
    ], 0.45),
    phase('land', 0.4, 'target', [
      ring(FUR, 10, 60, 0.3, 4),
      debris('#6a5a48', 10, [60, 160]),
      cuts(RED, 30, 4, 0.2, [0.6]),
    ], 0.4),
  ],
});

// R: the howl: a red shockwave and red light rising off him
registerAbilityVFX({
  abilityId: 'fenris_r',
  phases: [
    phase('howl', 0.2, 'caster', [
      shockwave(RED, 20, 160, 0.5, 8),
      rays(RED, 90, 0.6, 16),
      embers(RED, 14, 40),
      light(RED, 110, 0.9, 0.6),
      shake(3, 0.3),
    ], 0.7),
  ],
});

// A kill in his bloodthirst: he's restored in a burst of red
registerAbilityVFX({
  abilityId: 'fenris_r_feast',
  phases: [
    phase('feast', 0, 'caster', [
      ring(RED, 60, 10, 0.4, 5),
      embers(RED, 20, 40),
      sparks(BLOOD, 16, [80, 200]),
      light(RED, 90, 1.0, 0.5),
    ], 0.7),
  ],
});
