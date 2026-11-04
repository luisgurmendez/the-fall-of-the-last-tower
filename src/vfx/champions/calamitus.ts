/**
 * Calamitus ability VFX: molten orange, black rock and obsidian. Registered
 * when this module is imported (see ./index.ts). His pools of lava are
 * zones (src/gpu/fx/zones.ts).
 */

import { getAbilityDefinition } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import {
  embers,
  flames,
  landsAt,
  light,
  pathCut,
  phase,
  rocks,
  scorch,
  shake,
  shockwave,
  smoke,
  sparks,
  spikes,
  warning,
} from '../recipes';

const LAVA = '#ff5a14';
const HOT = '#ffb02e';
const ROCK = '#2a1a16';
const OBSIDIAN = '#3a3050';
const GLINT = '#c8b8ff';

const FLOW = getAbilityDefinition('calamitus_q')?.aoeRadius ?? 140;
/** His Q's cast: the ground churns where the lava will burst */
const CHURN = getAbilityDefinition('calamitus_q')?.castTime ?? 0.6;
const WAVE = landsAt('calamitus_w');
const ERUPTION = landsAt('calamitus_r');
const ERUPTION_RADIUS = getAbilityDefinition('calamitus_r')?.aoeRadius ?? 220;

// Q's cast: the ground around him glows and churns, as wide as the burst coming
registerAbilityVFX({
  abilityId: 'calamitus_q_windup',
  phases: [
    phase('churn', 0, 'caster', [
      warning(HOT, FLOW, CHURN),
      embers(LAVA, 18, FLOW * 0.85, { lifetime: { min: 0.4, max: CHURN } }),
      smoke(ROCK, 6, [12, 20], [10, 40]),
      light(LAVA, FLOW * 0.8, 0.6, CHURN, 0.5),
      shake(1, CHURN),
    ], CHURN),
  ],
});

// Q: lava bursts up around him as his cast ends (the pool it leaves is a zone)
registerAbilityVFX({
  abilityId: 'calamitus_q',
  phases: [
    phase('burst', 0, 'caster', [
      shockwave(LAVA, 20, FLOW, 0.35, 10),
      flames(LAVA, 14, [10, 18], [80, 200]),
      rocks(ROCK, 10, [100, 220]),
      sparks(HOT, 14, [160, 320]),
      light(LAVA, FLOW, 0.9, 0.4, 0.3),
      shake(2, 0.2),
    ], 0.5),
  ],
});

// W: a wave of magma rolls down the line (the stream it leaves is zones)
registerAbilityVFX({
  abilityId: 'calamitus_w',
  phases: [
    phase('wave', 0, 'caster', [
      { type: 'beam', color: LAVA, colorSecondary: HOT, thickness: 10, duration: WAVE + 0.15, glowRadius: 14 },
      pathCut(HOT, 8, WAVE + 0.15),
      rocks(ROCK, 8, [80, 180]),
    ], WAVE + 0.2),
    phase('crash', WAVE, 'ground_target', [
      flames(LAVA, 10, [10, 16], [60, 160]),
      smoke(ROCK, 6, [12, 20], [20, 60]),
      light(LAVA, 70, 0.7, 0.4),
    ], 0.5),
  ],
});

// E: his rock turns to glossy obsidian
registerAbilityVFX({
  abilityId: 'calamitus_e',
  phases: [
    phase('harden', 0, 'caster', [
      { type: 'shield_bubble', color: OBSIDIAN, radius: 46, duration: 3, pulseSpeed: 0.8, style: 'hex' },
      sparks(GLINT, 10, [80, 180]),
      light(GLINT, 60, 0.5, 0.4),
    ], 3),
  ],
});

// R: the ground rumbles around him, then erupts
registerAbilityVFX({
  abilityId: 'calamitus_r',
  phases: [
    phase('rumble', 0, 'caster', [
      warning(LAVA, ERUPTION_RADIUS, ERUPTION),
      smoke(ROCK, 8, [14, 22], [10, 40]),
      shake(2, ERUPTION),
    ], ERUPTION),
    phase('erupt', ERUPTION, 'caster', [
      spikes('geyser', LAVA, 12, ERUPTION_RADIUS * 0.8, 'ring', [40, 70], 0.9, HOT),
      shockwave(HOT, 30, ERUPTION_RADIUS, 0.5, 12),
      flames(LAVA, 20, [12, 22], [120, 280]),
      rocks(ROCK, 16, [140, 300]),
      scorch(ROCK, ERUPTION_RADIUS * 0.8, 2.5, 0.6),
      light(LAVA, ERUPTION_RADIUS * 1.2, 1.1, 0.7),
      { type: 'screen_flash', color: '#ff8a40', duration: 0.12, maxAlpha: 0.1 },
      shake(6, 0.35),
    ], 0.9),
  ],
});

// Each pool of his lava erupting with the R
registerAbilityVFX({
  abilityId: 'calamitus_lava_erupt',
  phases: [
    phase('geyser', 0, 'ground_target', [
      spikes('geyser', LAVA, 4, 30, 'ring', [30, 54], 0.8, HOT),
      flames(LAVA, 8, [10, 16], [80, 200]),
      rocks(ROCK, 6, [80, 180]),
      light(LAVA, 70, 0.9, 0.5),
    ], 0.8),
  ],
});
