/**
 * Oitboil ability VFX: orange fire, sparks and soot, and cool blue for Blue
 * Fire. Registered when this module is imported (see ./index.ts). The fire
 * on him while he's overheated is drawn by src/gpu/fx/championAuras.ts, the
 * trail of his E by its zones (src/gpu/fx/zones.ts).
 */

import { getAbilityDefinition } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import {
  embers,
  flames,
  light,
  phase,
  ring,
  scorch,
  shake,
  shockwave,
  smoke,
  sparks,
  swirl,
} from '../recipes';

const FIRE = '#ff7a1a';
const HOT = '#ffc04a';
const DEEP = '#e0301a';
const SOOT = '#3a2a22';
const BLUE = '#5cb8ff';
const BLUE_HOT = '#c8ecff';

const SPRAY = getAbilityDefinition('oitboil_q')?.aoeRadius ?? 130;
const STREAM = getAbilityDefinition('oitboil_r')?.range ?? 260;
const STREAM_ANGLE = getAbilityDefinition('oitboil_r')?.coneAngle ?? Math.PI / 3;

/** How long the flamethrower pours, and how often a new gout of fire leaves the nozzles */
const POUR = 1;
const GOUT = 0.06;
/** A gout's flames live this long and fly fast enough to reach the cone's end (little friction: they'd stall in a ball) */
const GOUT_LIFE = 0.4;

// Q: sparks sprayed all around him, a ring of fire running out to the edge
registerAbilityVFX({
  abilityId: 'oitboil_q',
  phases: [
    phase('spray', 0, 'caster', [
      sparks(HOT, 26, [260, 480]),
      sparks(FIRE, 14, [180, 360]),
      ring(FIRE, 20, SPRAY, 0.25, 5),
      flames(FIRE, 10, [8, 14], [120, 260]),
      light(FIRE, SPRAY, 0.9, 0.3, 0.3),
    ], 0.4),
  ],
});

// W: cool blue fire wraps around him
registerAbilityVFX({
  abilityId: 'oitboil_w',
  phases: [
    phase('wrap', 0, 'caster', [
      swirl(BLUE, 46, 0.7, 1.4, 3),
      flames(BLUE, 12, [10, 16], [30, 90]),
      embers(BLUE_HOT, 14, 30),
      light(BLUE, 70, 1.0, 0.6),
    ], 0.8),
  ],
});

// E: the nozzles blast behind him as he launches, soot hanging where he left
registerAbilityVFX({
  abilityId: 'oitboil_e',
  phases: [
    phase('launch', 0, 'caster', [
      flames(FIRE, 14, [10, 18], [60, 160]),
      smoke(SOOT, 8, [14, 22], [30, 80]),
      { type: 'trail', color: FIRE, thickness: 12, duration: 0.35, fadeLength: 14 },
      light(FIRE, 80, 1.0, 0.3),
    ], 0.4),
  ],
});

// R: the stream: gout after gout of fire roaring out over the cone, light
// and soot at his feet, the ground scorched where it poured
registerAbilityVFX({
  abilityId: 'oitboil_r',
  phases: [
    ...Array.from({ length: Math.round(POUR / GOUT) }, (_, i) =>
      phase(`gout${i}`, i * GOUT, 'caster', [
        flames(i % 3 ? FIRE : DEEP, 6, [7, 13], [STREAM / GOUT_LIFE, STREAM * 1.3 / GOUT_LIFE], {
          spread: STREAM_ANGLE * 0.7, lifetime: { min: GOUT_LIFE * 0.8, max: GOUT_LIFE }, friction: 0.5, gravity: -20,
        }),
        sparks(HOT, 3, [STREAM * 2, STREAM * 3], STREAM_ANGLE * 0.6),
      ], GOUT_LIFE + 0.05)),
    phase('roar', 0, 'caster', [
      light(FIRE, STREAM * 0.6, 1.2, POUR, 0.4),
      smoke(SOOT, 10, [16, 26], [20, 60]),
      shake(2, POUR),
    ], POUR),
    phase('scorch', POUR * 0.5, 'target', [scorch(SOOT, STREAM * 0.35, 2.5, 0.5, 0.8)], 2.5),
  ],
});

// The overheat: he flares up in a burst of fire
registerAbilityVFX({
  abilityId: 'oitboil_overheat',
  phases: [
    phase('flare', 0, 'caster', [
      shockwave(FIRE, 16, 110, 0.35, 8),
      flames(DEEP, 14, [12, 20], [80, 180]),
      flames(HOT, 10, [8, 14], [60, 140]),
      sparks(HOT, 16, [200, 380]),
      light(FIRE, 120, 1.3, 0.5),
    ], 0.6),
  ],
});
