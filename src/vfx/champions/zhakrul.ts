/**
 * Zhak'rul ability VFX: venom green, crimson chitin, desert sand.
 * Registered when this module is imported (see ./index.ts). Toxic Cloud's
 * gas is a zone (src/gpu/fx/zones.ts); the venom on whoever he poisoned is
 * drawn by src/gpu/fx/championAuras.ts.
 */

import { getAbilityDefinition, getCastTime, ZHAKRUL_KIT } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import {
  coneWarning,
  cuts,
  debris,
  gather,
  landsAt,
  light,
  phase,
  ring,
  rocks,
  shake,
  shockwave,
  slash,
  smoke,
  sparks,
  warning,
  wisps,
} from '../recipes';

const VENOM = '#8be04a';
const VENOM_LIGHT = '#d4ff8a';
const VENOM_DARK = '#2f6a1e';
const CHITIN = '#b8323a';
const SAND = '#d2b07a';
const SAND_DARK = '#8a6a3a';

const PINCERS = getAbilityDefinition('zhakrul_q')?.range ?? 150;
const PINCERS_ANGLE = getAbilityDefinition('zhakrul_q')?.coneAngle ?? Math.PI / 2;
const CLOUD = getAbilityDefinition('zhakrul_w')?.aoeRadius ?? 190;
/** How long the cloud billows out before it bites (its warning) */
const CLOUD_BILLOW = getAbilityDefinition('zhakrul_w')?.aoeDelay ?? 0.75;
const BURST = getAbilityDefinition('zhakrul_e')?.aoeRadius ?? 130;
/** How long Death Stinger's venom burns */
const STING_VENOM = ZHAKRUL_KIT.stingDuration;

// Q: as he raises his pincers (its cast), the cone they'll close on darkens until they snap...
const PINCERS_CAST = getCastTime(getAbilityDefinition('zhakrul_q')!);
registerAbilityVFX({
  abilityId: 'zhakrul_q_windup',
  phases: [
    phase('raise', 0, 'caster', [coneWarning(CHITIN, PINCERS, PINCERS_ANGLE, PINCERS_CAST + landsAt('zhakrul_q'))], PINCERS_CAST),
  ],
});

// ...then both pincers snap shut like scissors: two crossing blades and a spray of venom
registerAbilityVFX({
  abilityId: 'zhakrul_q',
  phases: [
    phase('snap', landsAt('zhakrul_q'), 'caster', [
      slash(CHITIN, PINCERS, PINCERS_ANGLE / 2, 0.22, 12),
      slash(VENOM, PINCERS * 0.85, PINCERS_ANGLE / 2, 0.18, 5),
      sparks(VENOM, 12, [180, 320], PINCERS_ANGLE / 2),
      light(VENOM, 60, 0.5, 0.25),
    ], 0.35),
  ],
});

// W: he breathes out the gas: it billows out to the cloud's edge while it
// can still be stepped out of (its warning, aoeDelay), then it settles and
// bites (the cloud that stays is a zone)
registerAbilityVFX({
  abilityId: 'zhakrul_w',
  phases: [
    phase('breath', 0, 'caster', [
      smoke(VENOM, 10, [14, 24], [60, 140]),
      smoke(VENOM_DARK, 6, [12, 20], [30, 90]),
      warning(VENOM, CLOUD, CLOUD_BILLOW),
      ring(VENOM_LIGHT, 18, CLOUD, CLOUD_BILLOW, 3),
      light(VENOM, CLOUD * 0.6, 0.4, CLOUD_BILLOW),
    ], CLOUD_BILLOW),
    phase('settle', CLOUD_BILLOW, 'caster', [
      smoke(VENOM, 14, [18, 30], [20, 70]),
      ring(VENOM, CLOUD * 0.9, CLOUD, 0.3, 6),
      light(VENOM, CLOUD, 0.6, 0.4),
    ], 0.5),
  ],
});

// E: he digs in, sand flying (then he's a mound moving underground,
// src/render/champions/zhakrul.ts); the sand where he'll burst out stirs
// in a circle as wide as the burst until he does
const BURROW_TRIP = (getAbilityDefinition('zhakrul_e')?.range ?? 320) / ZHAKRUL_KIT.burrowSpeed;
registerAbilityVFX({
  abilityId: 'zhakrul_e',
  phases: [
    phase('dig', 0, 'caster', [
      debris(SAND, 12, [80, 200]),
      smoke(SAND, 6, [10, 18], [30, 80]),
      ring(SAND_DARK, 10, 50, 0.3, 4),
    ], 0.4),
    phase('stir', 0, 'ground_target', [
      warning(SAND_DARK, BURST, BURROW_TRIP),
      debris(SAND, 6, [20, 60]),
    ], BURROW_TRIP),
  ],
});

// ...and bursts out of the ground, throwing up sand and whoever is on it
registerAbilityVFX({
  abilityId: 'zhakrul_e_burst',
  phases: [
    phase('burst', 0, 'caster', [
      shockwave(SAND, 20, BURST, 0.35, 10),
      debris(SAND, 18, [120, 260]),
      rocks(SAND_DARK, 10),
      smoke(SAND, 8, [14, 24], [40, 110]),
      cuts(CHITIN, 40, 5, 0.2, [-0.6, 0.6]),
      light(SAND, BURST, 0.6, 0.3),
      shake(3, 0.25),
    ], 0.5),
  ],
});

// R: as he arches his tail (its cast), venom gathers at the stinger...
const STING_CAST = getCastTime(getAbilityDefinition('zhakrul_r')!);
registerAbilityVFX({
  abilityId: 'zhakrul_r_windup',
  phases: [
    phase('arch', 0, 'caster', [gather(VENOM, 10, 50, STING_CAST), light(VENOM, 40, 0.6, STING_CAST)], STING_CAST),
  ],
});

// ...then the stinger stabs down and pumps venom in: a green burst, then fumes for as long as it burns
registerAbilityVFX({
  abilityId: 'zhakrul_r',
  phases: [
    phase('sting', 0.1, 'target', [
      cuts(VENOM_LIGHT, 46, 7, 0.22, [Math.PI / 2]),
      sparks(VENOM, 18, [120, 260]),
      ring(VENOM, 6, 50, 0.3, 4),
      light(VENOM, 70, 1.0, 0.4),
      shake(3, 0.2),
    ], 0.4),
    phase('venom', 0.3, 'target', [
      wisps(VENOM, 12, [30, 70]),
      smoke(VENOM_DARK, 6, [10, 16], [10, 40]),
      light(VENOM_DARK, 45, 0.6, STING_VENOM, 0.4),
    ], STING_VENOM),
  ],
});
