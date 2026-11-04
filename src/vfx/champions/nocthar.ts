/**
 * Nocthar ability VFX: grave dirt, bone white and a cold spectral teal (no
 * violet, Vile's; no poison green, Zhak'rul's). Every ability reads before
 * it lands (docs/champions/nocthar-design.md, "Legibilidad"):
 * - Q: his claws glow in the cast, the ground cracks and fills where the
 *   hands will burst for the 0.85 s before they do (their fingertips poking
 *   out: risingSprites.ts), then they burst out and grab
 * - W: he draws breath in the cast, then rings of wailing; frenzied Hollows
 *   burn with pale flames on their claws
 * - E: a claw mark where he sends them (his team sees it) or a red ring
 *   closing on who they hunt; charging Hollows kick up dust, eyes red
 * - R: for its 1.5 s cast a ring of cracks fills where the colossus will
 *   rise; then the earth erupts
 * - The colossus: where its bones will fall fills while it winds up and
 *   they fly; a scar on the ground marks where it will charge
 * - A Hollow claws out of a crack in the ground
 * Registered when this module is imported (see ./index.ts).
 */

import { NOCTHAR_KIT, getAbilityDefinition, getCastTime } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import {
  cuts,
  debris,
  flames,
  gather,
  landsAt,
  light,
  meteor,
  pathCut,
  phase,
  ring,
  rocks,
  scorch,
  shake,
  shockwave,
  smoke,
  sparks,
  spikes,
  warning,
  wisps,
} from '../recipes';

const BONE = '#ece4cf';
const DIRT = '#6b5a44';
const DUST = '#9c8b72';
const SPECTRAL = '#bfe3d6';
const GRAVE = '#7f9a8c';
const EYES = '#ff5a4a';
/** Torn-up earth, darker as it cracks */
const CRACKED = '#2e2418';

const HANDS_RADIUS = getAbilityDefinition('nocthar_q')?.aoeRadius ?? 95;
const HANDS_DELAY = landsAt('nocthar_q');
const CLAWS_CAST = getCastTime(getAbilityDefinition('nocthar_q')!);
const WAIL_CAST = getCastTime(getAbilityDefinition('nocthar_w')!);
const RISE_CAST = getCastTime(getAbilityDefinition('nocthar_r')!);
const VOLLEY_RADIUS = getAbilityDefinition('nocthar_colossus_w')?.aoeRadius ?? 90;
const VOLLEY_WAIT = NOCTHAR_KIT.colossusWWindup + NOCTHAR_KIT.colossusWFlight;

// Q: his claws glow as he raises them...
registerAbilityVFX({
  abilityId: 'nocthar_q_windup',
  phases: [
    phase('claws', 0, 'caster', [gather(BONE, 8, 26, CLAWS_CAST), light(SPECTRAL, 24, 0.4, CLAWS_CAST)], CLAWS_CAST),
  ],
});

// ...they strike the ground and it cracks where the hands will burst, filling up until they do...
registerAbilityVFX({
  abilityId: 'nocthar_q',
  phases: [
    phase('strike', 0, 'caster', [debris(DIRT, 8, [60, 140]), smoke(DUST, 4, [10, 16], [20, 50])], 0.4),
    phase('cracking', 0, 'ground_target', [
      warning(GRAVE, HANDS_RADIUS, HANDS_DELAY),
      scorch(CRACKED, HANDS_RADIUS * 0.9, HANDS_DELAY + 0.6, 0, 0.75),
      debris(DUST, 6, [20, 60]),
    ], HANDS_DELAY),
  ],
});

// ...and the hands burst out of it and grab (the hands themselves are
// sprites drawn among the units: src/render/overlays/risingSprites.ts):
// clods of earth flying, dust, the ground pulled inward
registerAbilityVFX({
  abilityId: 'nocthar_q_burst',
  phases: [
    phase('hands', 0, 'ground_target', [
      shockwave(DIRT, HANDS_RADIUS, HANDS_RADIUS * 0.3, 0.35, 8),
      rocks(DIRT, 14, [80, 200], [3, 7]),
      debris(DIRT, 16, [80, 200]),
      smoke(DUST, 8, [14, 24], [30, 90]),
      light(SPECTRAL, HANDS_RADIUS, 0.6, 0.4),
      shake(2, 0.15),
    ], 0.8),
  ],
});

// Each hand bursts out of its own patch of earth (src/render/overlays/risingSprites.ts)...
registerAbilityVFX({
  abilityId: 'nocthar_q_hand',
  phases: [
    phase('earth', 0, 'caster', [
      scorch(CRACKED, 16, 1.4, 0, 0.85),
      rocks(DIRT, 7, [50, 140], [2, 5]),
      debris(DIRT, 10, [40, 120]),
      smoke(DUST, 3, [8, 13], [10, 40]),
    ], 0.6),
  ],
});

// ...and kicks up a little dust as it sinks back
registerAbilityVFX({
  abilityId: 'nocthar_q_hand_sink',
  phases: [
    phase('dust', 0, 'caster', [smoke(DUST, 3, [8, 12], [10, 30]), debris(DIRT, 5, [20, 60])], 0.5),
  ],
});

// W: he draws a rattling breath...
registerAbilityVFX({
  abilityId: 'nocthar_w_windup',
  phases: [
    phase('breath', 0, 'caster', [gather(SPECTRAL, 14, 70, WAIL_CAST), light(SPECTRAL, 30, 0.4, WAIL_CAST)], WAIL_CAST),
  ],
});

// ...and wails: pale rings rolling off him, ghostly wisps fleeing
registerAbilityVFX({
  abilityId: 'nocthar_w',
  phases: [
    phase('wail', 0, 'caster', [
      shockwave(SPECTRAL, 12, NOCTHAR_KIT.wFearRadius, 0.4, 10),
      ring(SPECTRAL, 20, NOCTHAR_KIT.wFearRadius * 1.1, 0.55, 4),
      wisps(SPECTRAL, 14, [90, 200]),
      light(SPECTRAL, NOCTHAR_KIT.wFearRadius, 0.7, 0.45),
      shake(1.5, 0.2),
    ], 0.6),
    phase('echo', 0.18, 'caster', [ring(GRAVE, 16, NOCTHAR_KIT.wFearRadius * 0.9, 0.45, 3)], 0.5),
  ],
});

// A frenzied Hollow: pale flames on its claws while it lasts
registerAbilityVFX({
  abilityId: 'nocthar_w_frenzy',
  phases: [
    phase('frenzy', 0, 'caster', [
      flames(SPECTRAL, 10, [5, 9], [20, 60], { lifetime: { min: 0.3, max: 0.6 } }),
      light(SPECTRAL, 18, 0.5, NOCTHAR_KIT.wFrenzyDuration),
    ], NOCTHAR_KIT.wFrenzyDuration),
  ],
});

// E: three claw marks where he sends them (his team sees it), a red ring closing on whoever they hunt
registerAbilityVFX({
  abilityId: 'nocthar_e',
  phases: [
    phase('point', 0, 'caster', [sparks(SPECTRAL, 4, [60, 120], Math.PI / 6)], 0.2),
    phase('order', 0, 'target', [
      cuts(GRAVE, 22, 3, 0.6, [-0.35, 0, 0.35]),
      ring(EYES, 34, 12, 0.45, 3),
      light(GRAVE, 22, 0.4, 0.5),
    ], 0.6),
  ],
});

// A charging Hollow: dust under it, its eyes burning red
registerAbilityVFX({
  abilityId: 'nocthar_e_charge',
  phases: [
    phase('charge', 0, 'caster', [
      smoke(DUST, 4, [8, 14], [20, 60]),
      sparks(EYES, 6, [40, 100], Math.PI * 2, { lifetime: { min: 0.3, max: 0.6 } }),
      light(EYES, 16, 0.5, NOCTHAR_KIT.eChargeDuration),
    ], NOCTHAR_KIT.eChargeDuration),
  ],
});

// R: for its whole cast, a ring of cracks fills where the colossus will rise...
registerAbilityVFX({
  abilityId: 'nocthar_r_windup',
  phases: [
    phase('arms', 0, 'caster', [debris(DIRT, 10, [40, 100]), smoke(DUST, 6, [12, 20], [10, 40])], RISE_CAST),
    phase('cracks', 0, 'ground_target', [
      warning(GRAVE, NOCTHAR_KIT.rKnockupRadius, RISE_CAST),
      scorch(CRACKED, NOCTHAR_KIT.rKnockupRadius, RISE_CAST + 0.8, 0, 0.8),
      light(SPECTRAL, NOCTHAR_KIT.rKnockupRadius * 0.7, 0.35, RISE_CAST, 0.3),
    ], RISE_CAST),
  ],
});

// ...he pulls his arms out of the ground...
registerAbilityVFX({
  abilityId: 'nocthar_r',
  phases: [
    phase('pull', 0, 'caster', [debris(DIRT, 8, [60, 140]), smoke(DUST, 4, [10, 18], [20, 60])], 0.4),
  ],
});

// ...and the colossus bursts out: rocks, bones and dust flying, the ground shaking
registerAbilityVFX({
  abilityId: 'nocthar_r_emerge',
  phases: [
    phase('erupt', 0, 'caster', [
      spikes('rock', DIRT, 12, NOCTHAR_KIT.rKnockupRadius, 'ring', [20, 40], 0.8),
      shockwave(DUST, 20, NOCTHAR_KIT.rKnockupRadius * 1.2, 0.45, 14),
      rocks(DIRT, 18, [120, 260]),
      debris(BONE, 14, [100, 240]),
      smoke(DUST, 10, [18, 30], [40, 120]),
      light(SPECTRAL, NOCTHAR_KIT.rKnockupRadius, 0.8, 0.5),
      shake(5, 0.35),
    ], 0.9),
  ],
});

// His orders to the colossus (Bone Volley, Trample, R): he points, a flick of pale light
for (const abilityId of ['nocthar_colossus_w', 'nocthar_colossus_e', 'nocthar_colossus_r']) {
  registerAbilityVFX({
    abilityId,
    phases: [phase('command', 0, 'caster', [sparks(SPECTRAL, 5, [60, 140], Math.PI / 5), light(SPECTRAL, 20, 0.4, 0.25)], 0.3)],
  });
}

// The colossus rips bones off its back: where they'll fall fills up until they do...
registerAbilityVFX({
  abilityId: 'nocthar_colossus_w_throw',
  phases: [
    phase('rip', 0, 'caster', [debris(BONE, 6, [40, 100])], 0.3),
    phase('aim', 0, 'ground_target', [warning(BONE, VOLLEY_RADIUS, VOLLEY_WAIT)], VOLLEY_WAIT),
    phase('fall', NOCTHAR_KIT.colossusWWindup, 'ground_target', [
      meteor('blade', BONE, 10, 160, NOCTHAR_KIT.colossusWFlight, SPECTRAL),
    ], NOCTHAR_KIT.colossusWFlight),
    phase('fall2', NOCTHAR_KIT.colossusWWindup + 0.06, 'ground_target', [
      meteor('blade', BONE, 8, 140, NOCTHAR_KIT.colossusWFlight - 0.06),
    ], NOCTHAR_KIT.colossusWFlight - 0.06),
  ],
});

// ...and they shatter there
registerAbilityVFX({
  abilityId: 'nocthar_colossus_w_impact',
  phases: [
    phase('shatter', 0, 'ground_target', [
      debris(BONE, 20, [100, 240]),
      rocks(DIRT, 8, [80, 180]),
      ring(BONE, 12, VOLLEY_RADIUS, 0.3, 5),
      smoke(DUST, 6, [12, 20], [30, 80]),
      shake(2.5, 0.18),
    ], 0.6),
  ],
});

// Trample: it scrapes the ground, a scar showing where it will charge; then it charges, dust trailing
registerAbilityVFX({
  abilityId: 'nocthar_colossus_e_trample',
  phases: [
    phase('scrape', 0, 'caster', [smoke(DUST, 6, [12, 20], [10, 40]), pathCut(EYES, 26, NOCTHAR_KIT.colossusEWindup + 0.1)], NOCTHAR_KIT.colossusEWindup),
    phase('charge', NOCTHAR_KIT.colossusEWindup, 'caster', [
      { type: 'trail', color: DUST, thickness: 22, duration: NOCTHAR_KIT.colossusEDuration + 0.2, fadeLength: 14 },
      debris(DIRT, 10, [60, 140]),
    ], NOCTHAR_KIT.colossusEDuration + 0.2),
  ],
});

// Where it stops, a crash
registerAbilityVFX({
  abilityId: 'nocthar_colossus_e_end',
  phases: [
    phase('crash', 0, 'caster', [
      shockwave(DUST, 14, 80, 0.35, 12),
      rocks(DIRT, 12, [100, 220]),
      debris(BONE, 8, [80, 180]),
      shake(4, 0.25),
    ], 0.6),
  ],
});

// A Hollow claws out of a crack in the ground
registerAbilityVFX({
  abilityId: 'nocthar_hollow_rise',
  phases: [
    phase('crack', 0, 'ground_target', [
      scorch(CRACKED, 20, NOCTHAR_KIT.riseTime + 0.6, 0, 0.8),
      debris(DIRT, 10, [40, 110]),
      smoke(DUST, 4, [10, 16], [10, 40]),
      light(SPECTRAL, 22, 0.4, NOCTHAR_KIT.riseTime),
    ], NOCTHAR_KIT.riseTime),
  ],
});
