/**
 * Hop-To-Eat ability VFX: white fluff, pink, carrot orange, and cartoon
 * stars for the kick. Registered when this module is imported (see
 * ./index.ts).
 */

import { registerAbilityVFX } from '../VFXRegistryStore';
import {
  cuts,
  debris,
  light,
  petals,
  phase,
  rays,
  ring,
  shake,
  shockwave,
  smoke,
  sparks,
  twinkles,
} from '../recipes';

const FLUFF = '#f4f0f0';
const PINK = '#ff8ab8';
const BLOOD = '#d0203a';
const CARROT = '#ff8a1a';
const LEAF = '#5ab83a';
const STAR = '#ffe25a';
const DUST = '#b8a890';

// Hop to It!: a white streak as it hops, a puff of fluff where it lands
registerAbilityVFX({
  abilityId: 'hop_hop',
  phases: [
    phase('hop', 0, 'caster', [
      { type: 'trail', color: FLUFF, thickness: 9, duration: 0.3, fadeLength: 12 },
    ], 0.3),
    phase('land', 0.2, 'caster', [
      smoke(FLUFF, 5, [8, 14], [30, 70]),
      ring(DUST, 8, 36, 0.25, 3),
    ], 0.4),
  ],
});

// Q: sharp little teeth snap shut, and bits of armor fly
registerAbilityVFX({
  abilityId: 'hop_q',
  phases: [
    phase('bite', 0.1, 'target', [
      cuts(FLUFF, 26, 4, 0.18, [Math.PI / 2 - 0.4, Math.PI / 2 + 0.4]),
      sparks(BLOOD, 8, [80, 180]),
      debris('#8a8a90', 6, [60, 160]),
      light(PINK, 36, 0.5, 0.2),
    ], 0.3),
  ],
});

// W: crunch: bits of carrot and its leaves, a soft heal, then a sugary sparkle
registerAbilityVFX({
  abilityId: 'hop_w',
  phases: [
    phase('crunch', 0.1, 'caster', [
      petals(CARROT, 10, [30, 90]),
      petals(LEAF, 5, [30, 80], 'leaf'),
      light('#9be070', 50, 0.5, 0.5),
    ], 0.7),
    phase('rush', 0.75, 'caster', [
      twinkles(PINK, 10, [30, 90]),
      ring(PINK, 20, 50, 0.3, 3),
    ], 0.5),
  ],
});

// E: a long hop: a white streak, dust where it lands
registerAbilityVFX({
  abilityId: 'hop_e',
  phases: [
    phase('hop', 0, 'caster', [
      { type: 'trail', color: FLUFF, thickness: 11, duration: 0.35, fadeLength: 14 },
      smoke(DUST, 3, [8, 12], [20, 50]),
    ], 0.35),
    phase('land', 0.3, 'caster', [
      smoke(FLUFF, 6, [8, 14], [30, 80]),
      ring(DUST, 8, 44, 0.25, 3),
    ], 0.4),
  ],
});

// R: the kick lands with a burst of stars
registerAbilityVFX({
  abilityId: 'hop_r',
  phases: [
    phase('kick', 0.1, 'target', [
      shockwave(FLUFF, 12, 90, 0.3, 8),
      rays(STAR, 60, 0.3, 10),
      twinkles(STAR, 12, [100, 220]),
      cuts(FLUFF, 50, 6, 0.2, [0.3]),
      light(STAR, 70, 0.9, 0.3),
      shake(4, 0.2),
    ], 0.5),
  ],
});

// A kicked champion crashes into another: dust and dizzy stars
registerAbilityVFX({
  abilityId: 'hop_r_crash',
  phases: [
    phase('crash', 0, 'ground_target', [
      ring(FLUFF, 10, 70, 0.3, 5),
      debris(DUST, 10, [80, 200]),
      twinkles(STAR, 10, [40, 120]),
      light(STAR, 60, 0.8, 0.3),
      shake(3, 0.2),
    ], 0.5),
  ],
});
