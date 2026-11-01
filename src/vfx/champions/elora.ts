/**
 * Elora ability VFX: pale wood and steel, poison green, a hunter's gold.
 * Her arrows are GPU projectiles (src/gpu/fx/projectiles.ts); these are
 * the moments around them. Registered when this module is imported (see
 * ./index.ts).
 */

import { getAbilityDefinition } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import { landsAt } from '../recipes';
import {
  debris,
  light,
  pathCut,
  phase,
  ring,
  scorch,
  shake,
  smoke,
  sparks,
  spikes,
  twinkles,
  wisps,
} from '../recipes';

const SHAFT = '#f2ead8';
const STEEL = '#c8d4dc';
const VENOM = '#7cd64a';
const VENOM_DARK = '#2f6a1e';
const GOLD = '#ffd45a';
const DUST = '#b8a888';

const BARRAGE = landsAt('elora_r');
const LANE_WIDTH = (getAbilityDefinition('elora_r')?.aoeRadius ?? 55) * 2;

// Q: the arrowhead dipped in poison: a green glow and rising fumes on her
registerAbilityVFX({
  abilityId: 'elora_q',
  phases: [
    phase('dip', 0, 'caster', [
      wisps(VENOM, 6, [30, 70]),
      twinkles(VENOM, 4, [20, 60]),
      light(VENOM, 45, 0.5, 0.5),
    ], 0.6),
  ],
});

// The poisoned arrow lands: a green splash and a puff of fumes
registerAbilityVFX({
  abilityId: 'elora_poison_auto_impact',
  phases: [
    phase('splash', 0, 'caster', [
      sparks(VENOM, 10, [80, 180]),
      smoke(VENOM_DARK, 5, [8, 14], [20, 50]),
      ring(VENOM, 4, 26, 0.25, 2),
      light(VENOM, 40, 0.6, 0.3),
    ], 0.5),
  ],
});

// A weak point struck: a gold glint and a crack of sparks
registerAbilityVFX({
  abilityId: 'elora_weak_auto_impact',
  phases: [
    phase('glint', 0, 'caster', [
      sparks(GOLD, 12, [140, 280]),
      ring(GOLD, 6, 30, 0.2, 3),
      light(GOLD, 45, 0.8, 0.25),
    ], 0.4),
  ],
});

// W: the bowstring snaps (the heavy arrow is the projectile)...
registerAbilityVFX({
  abilityId: 'elora_w',
  phases: [
    phase('loose', landsAt('elora_w'), 'caster', [
      sparks(STEEL, 6, [160, 300], Math.PI / 8),
      light(SHAFT, 40, 0.4, 0.2),
    ], 0.3),
  ],
});

// ...and where it hits it pins: stakes in the ground around the target
registerAbilityVFX({
  abilityId: 'elora_w_impact',
  phases: [
    phase('pin', 0, 'caster', [
      spikes('thorn', DUST, 6, 26, 'ring', [10, 18], 1.2, SHAFT),
      debris(DUST, 8, [60, 140]),
      ring(SHAFT, 8, 34, 0.25, 3),
    ], 1.2),
  ],
});

// E: a roll through the dust
registerAbilityVFX({
  abilityId: 'elora_e',
  phases: [
    phase('roll', 0, 'caster', [
      smoke(DUST, 6, [10, 16], [20, 60]),
      debris(DUST, 5, [40, 100]),
      { type: 'trail', color: SHAFT, thickness: 6, duration: 0.3, fadeLength: 10 },
    ], 0.4),
  ],
});

// R: arrows loosed into the sky while the lane is marked; then they come
// down all along it
registerAbilityVFX({
  abilityId: 'elora_r',
  phases: [
    phase('loose', 0, 'caster', [
      { type: 'beam', color: GOLD, thickness: 3, duration: BARRAGE, glowRadius: 4 },
      sparks(SHAFT, 10, [220, 380], Math.PI / 6),
      light(GOLD, 50, 0.5, BARRAGE),
    ], BARRAGE),
    phase('rain', BARRAGE, 'caster', [
      { type: 'beam', color: SHAFT, colorSecondary: GOLD, thickness: LANE_WIDTH / 5, duration: 0.3, glowRadius: 12 },
      pathCut(SHAFT, 6, 0.35),
      pathCut(GOLD, 3, 0.25),
      shake(3, 0.2),
    ], 0.4),
    phase('dust', BARRAGE, 'ground_target', [
      debris(DUST, 14, [60, 160]),
      smoke(DUST, 8, [12, 20], [20, 70]),
      scorch('#3a3020', LANE_WIDTH * 0.6, 1.5, 0, 0.5),
    ], 0.6),
  ],
});
