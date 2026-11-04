/**
 * Gorath ability VFX: stone and molten amber; rock bursting out of the
 * ground, a red roar. His slam (Q) leaves a crater and rolls a shockwave of
 * earth out to its edge; his earthquake (R) raises a ring of pillars at its
 * edge and lava bursts out inside. Registered when this module is imported (see
 * ./index.ts). Each area has a cast time (he stands and winds up): its
 * windup shows the area's outline at once, then its warning fills up until
 * the area lands on the server.
 */

import { getAbilityDefinition, getCastTime } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import { debris, embers, gather, landsAt, light, phase, ring, rocks, scorch, shake, shockwave, sigil, smoke, spikes, warning } from '../recipes';

const EARTH = '#d9a35a';
const MOLTEN = '#ff8a2a';
const DUST = '#8c7a62';
const STONE = '#a08c74';
const ROAR = '#ff5a3a';

const SLAM = landsAt('gorath_slam');
const SLAM_RADIUS = getAbilityDefinition('gorath_slam')?.aoeRadius ?? 300;
const ROAR_LANDS = landsAt('gorath_taunt');
const ROAR_RADIUS = getAbilityDefinition('gorath_taunt')?.aoeRadius ?? 350;
const QUAKE = landsAt('gorath_earthquake');
const QUAKE_RADIUS = getAbilityDefinition('gorath_earthquake')?.aoeRadius ?? 450;

/** Each area's cast time: he winds up standing */
const castOf = (abilityId: string) => {
  const definition = getAbilityDefinition(abilityId);
  return definition ? getCastTime(definition) : 0.3;
};
const SLAM_CAST = castOf('gorath_slam');
const ROAR_CAST = castOf('gorath_taunt');
const QUAKE_CAST = castOf('gorath_earthquake');

// Q's windup: he hoists the hammer, dust rising off it, the slam's reach outlined
registerAbilityVFX({
  abilityId: 'gorath_slam_windup',
  phases: [
    phase('hoist', 0, 'caster', [
      sigil(EARTH, SLAM_RADIUS, SLAM_CAST),
      gather(EARTH, 8, 46, SLAM_CAST, 'ember'),
      smoke(DUST, 3, [8, 12], [10, 30]),
    ], SLAM_CAST),
  ],
});

// E's windup: he draws breath, red air pulled into his chest, the roar's reach outlined
registerAbilityVFX({
  abilityId: 'gorath_taunt_windup',
  phases: [
    phase('inhale', 0, 'caster', [
      sigil(ROAR, ROAR_RADIUS, ROAR_CAST),
      gather(ROAR, 12, ROAR_RADIUS * 0.6, ROAR_CAST, 'ember'),
      light(ROAR, 50, 0.4, ROAR_CAST),
    ], ROAR_CAST),
  ],
});

// R's windup: the hammer goes back, the ground starts shaking and glowing at the quake's edge
registerAbilityVFX({
  abilityId: 'gorath_earthquake_windup',
  phases: [
    phase('heave', 0, 'caster', [
      sigil(MOLTEN, QUAKE_RADIUS, QUAKE_CAST),
      light(MOLTEN, QUAKE_RADIUS * 0.5, 0.25, QUAKE_CAST),
      smoke(DUST, 6, [10, 16], [10, 30]),
      shake(1.5, QUAKE_CAST),
    ], QUAKE_CAST),
  ],
});

// Q: he raises the hammer over a warning, then slams it down: a crater at
// his feet, a thick shockwave of earth rolling out to the slam's edge, a ring
// of dust and stones thrown up. No pillars or spikes: those are his
// earthquake's (R), so the two read apart
registerAbilityVFX({
  abilityId: 'gorath_slam',
  phases: [
    phase('raise', 0, 'caster', [warning(EARTH, SLAM_RADIUS, SLAM), smoke(DUST, 4, [8, 12], [10, 30])], SLAM),
    phase('slam', SLAM, 'caster', [
      { type: 'screen_flash', color: '#ffe2b0', duration: 0.06, maxAlpha: 0.06 },
      scorch(STONE, 46, 1.6, 0, 0.9),
      shockwave(EARTH, 18, SLAM_RADIUS, 0.4, 14),
      ring(DUST, 30, SLAM_RADIUS * 1.05, 0.55, 3),
      smoke(DUST, 14, [14, 24], [80, 170]),
      rocks(STONE, 12, [100, 220], [3, 6]),
      debris(DUST, 10, [60, 140]),
      light(EARTH, SLAM_RADIUS * 0.7, 0.5, 0.3),
      shake(3, 0.2),
    ], 0.9),
  ],
});

// W: skin of stone: a ring of stones grinding around him, rocks circling
registerAbilityVFX({
  abilityId: 'gorath_fortify',
  phases: [
    phase('harden', 0, 'caster', [
      { type: 'shield_bubble', color: STONE, radius: 50, duration: 4.0, pulseSpeed: 0.8, style: 'stone', glowColor: MOLTEN },
      { type: 'orbiting_particles', color: STONE, count: 3, size: 15, orbitRadius: 64, orbitSpeed: 2.2, duration: 4.0, style: 'rock' },
      smoke(DUST, 8, [10, 16], [30, 80]),
      rocks(STONE, 6, [60, 130]),
    ], 4.0),
  ],
});

// E: he draws breath, then roars: rings of red sound rolling out, dust blown away
registerAbilityVFX({
  abilityId: 'gorath_taunt',
  phases: [
    phase('breath', 0, 'caster', [gather(ROAR, 8, 60, ROAR_LANDS, 'ember'), light(ROAR, 60, 0.5, ROAR_LANDS)], ROAR_LANDS),
    phase('roar', ROAR_LANDS, 'caster', [
      ring(ROAR, 30, ROAR_RADIUS, 0.45, 3),
      smoke(DUST, 12, [16, 26], [160, 280]),
      light(ROAR, ROAR_RADIUS * 0.6, 0.6, 0.45),
    ], 0.45),
    phase('echo', ROAR_LANDS + 0.09, 'caster', [ring('#ff8a6a', 25, ROAR_RADIUS * 0.85, 0.4, 2)], 0.4),
    phase('echo2', ROAR_LANDS + 0.18, 'caster', [ring('#ffb08a', 20, ROAR_RADIUS * 0.7, 0.35, 2)], 0.35),
  ],
});

// R: the ground rumbles under a wide warning, then a ring of stone pillars
// bursts up at its edge, lava shoots out of the cracks inside it and the
// camera shakes
registerAbilityVFX({
  abilityId: 'gorath_earthquake',
  phases: [
    phase('rumble', 0, 'caster', [
      warning(MOLTEN, QUAKE_RADIUS, QUAKE),
      smoke(DUST, 12, [12, 20], [10, 40]),
      light(MOLTEN, QUAKE_RADIUS * 0.6, 0.3, QUAKE),
      shake(2, QUAKE),
    ], QUAKE),
    phase('quake', QUAKE, 'caster', [
      spikes('rock', STONE, 18, QUAKE_RADIUS * 0.95, 'ring', [70, 110], 1.6, MOLTEN),
      spikes('geyser', MOLTEN, 10, QUAKE_RADIUS * 0.75, 'area', [50, 80], 1.2),
      scorch(MOLTEN, QUAKE_RADIUS * 0.8, 3.0, 1.0),
      smoke(DUST, 18, [20, 34], [60, 220]),
      rocks(STONE, 16, [160, 320]),
      embers(MOLTEN, 24, QUAKE_RADIUS, { lifetime: { min: 0.9, max: 1.5 } }),
      light(MOLTEN, QUAKE_RADIUS, 1.1, 1.0, 0.4),
      shake(8, 0.6),
      { type: 'screen_flash', color: '#ffcf9a', duration: 0.1, maxAlpha: 0.1 },
    ], 1.6),
  ],
});
