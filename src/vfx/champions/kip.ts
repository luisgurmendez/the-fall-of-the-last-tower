/**
 * Kip ability VFX: a show-off's colors, his cape's burnt orange, his sash's
 * purple, a bullseye's red and white, and gold for the big moments. His
 * arrows are GPU projectiles (src/gpu/fx/projectiles.ts); these are the
 * moments around them. Registered when this module is imported (see
 * ./index.ts).
 */

import { KIP_KIT, getAbilityDefinition, getCastTime } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import {
  cuts,
  debris,
  light,
  phase,
  rays,
  ring,
  shake,
  shockwave,
  smoke,
  sparks,
  twinkles,
  warning,
} from '../recipes';

const CAPE = '#e0662a';
const SASH = '#9a5cd6';
const TARGET = '#ff4a3a';
const WHITE = '#fff4e6';
const GOLD = '#ffd45a';
const SHAFT = '#f2ead8';
const DUST = '#b8a888';

const LANDING = getAbilityDefinition('kip_e')?.aoeRadius ?? 130;

// Q: he draws in the cast time...
const DRAW = getCastTime(getAbilityDefinition('kip_q')!);
registerAbilityVFX({
  abilityId: 'kip_q_windup',
  phases: [
    phase('draw', 0, 'caster', [twinkles(TARGET, 2, [0, 10], { lifetime: { min: DRAW, max: DRAW } }), light(WHITE, 26, 0.3, DRAW)], DRAW),
  ],
});

// ...the string snaps as the practice arrow flies...
registerAbilityVFX({
  abilityId: 'kip_q',
  phases: [
    phase('loose', 0, 'caster', [
      sparks(SHAFT, 6, [160, 300], Math.PI / 8),
      light(WHITE, 34, 0.4, 0.2),
    ], 0.3),
  ],
});

// ...and where it hits, a bullseye: red and white rings closing in
registerAbilityVFX({
  abilityId: 'kip_q_impact',
  phases: [
    phase('bullseye', 0, 'caster', [
      ring(TARGET, 46, 14, 0.3, 4),
      ring(WHITE, 30, 8, 0.25, 3),
      sparks(TARGET, 10, [100, 220]),
      light(TARGET, 40, 0.7, 0.3),
    ], 0.4),
  ],
});

// The Bigger They Are: an arrow pops his mark, a burst of red and gold
registerAbilityVFX({
  abilityId: 'kip_pop_auto_impact',
  phases: [
    phase('pop', 0, 'caster', [
      shockwave(TARGET, 10, 58, 0.3, 8),
      cuts(GOLD, 44, 6, 0.2, [Math.PI / 4, -Math.PI / 4]),
      sparks(GOLD, 16, [160, 320]),
      light(GOLD, 60, 1.0, 0.3),
      shake(2, 0.15),
    ], 0.45),
  ],
});

// W: he calls out his targets: a purple ring bursting off him...
registerAbilityVFX({
  abilityId: 'kip_w',
  phases: [
    phase('shout', 0, 'caster', [
      ring(SASH, 10, 70, 0.35, 4),
      twinkles(SASH, 8, [60, 140]),
      light(SASH, 50, 0.5, 0.35),
    ], 0.45),
  ],
});

// ...and on each marked enemy, a weight pressing down: a ring closing on it
registerAbilityVFX({
  abilityId: 'kip_w_hit',
  phases: [
    phase('pinned', 0, 'target', [
      ring(SASH, 50, 16, 0.4, 5),
      debris(DUST, 6, [40, 100]),
      light(SASH, 40, 0.6, 0.4),
    ], 0.5),
  ],
});

// E: he springs off in a puff of dust, his cape streaming, the spot he'll
// land on marked as wide as his landing's burst...
const LEAP = (getAbilityDefinition('kip_e')?.range ?? 200) / KIP_KIT.eDashSpeed;
registerAbilityVFX({
  abilityId: 'kip_e',
  phases: [
    phase('spring', 0, 'caster', [
      smoke(DUST, 6, [10, 16], [20, 60]),
      debris(DUST, 5, [40, 100]),
      { type: 'trail', color: CAPE, thickness: 7, duration: 0.3, fadeLength: 10 },
    ], 0.4),
    phase('spot', 0, 'ground_target', [warning(CAPE, LANDING, LEAP)], LEAP),
  ],
});

// ...and lands with a flourish: a ring of dust, sparks of gold
registerAbilityVFX({
  abilityId: 'kip_e_land',
  phases: [
    phase('land', 0, 'caster', [
      shockwave(CAPE, 16, LANDING, 0.35, 9),
      debris(DUST, 14, [100, 220]),
      smoke(DUST, 6, [12, 20], [30, 90]),
      sparks(GOLD, 10, [120, 260]),
      light(GOLD, LANDING * 0.6, 0.6, 0.3),
      shake(2, 0.15),
    ], 0.5),
  ],
});

// R: "watch this!": golden rays off him as the volleys start...
registerAbilityVFX({
  abilityId: 'kip_r',
  phases: [
    phase('flourish', 0, 'caster', [
      rays(GOLD, 70, 0.45, 14),
      sparks(GOLD, 12, [160, 320]),
      light(GOLD, 70, 0.8, 0.5),
    ], 0.5),
  ],
});

// ...a twang of sparks with each volley...
registerAbilityVFX({
  abilityId: 'kip_r_volley',
  phases: [
    phase('twang', 0, 'caster', [
      sparks(GOLD, 6, [140, 260]),
      light(GOLD, 36, 0.5, 0.15),
    ], 0.2),
  ],
});

// ...and every arrow lands in a golden flash
registerAbilityVFX({
  abilityId: 'kip_r_impact',
  phases: [
    phase('hit', 0, 'caster', [
      sparks(GOLD, 8, [120, 240]),
      ring(GOLD, 6, 28, 0.2, 3),
      light(GOLD, 34, 0.7, 0.2),
    ], 0.3),
  ],
});
