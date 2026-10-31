/**
 * Gorath ability VFX: stone and molten amber; rock bursting out of the
 * ground, a red roar. Registered when this module is imported (see
 * ./index.ts). Each warning fills up until the area lands on the server.
 */

import { getAbilityDefinition } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import { gather, landsAt, light, phase, ring, rocks, scorch, smoke, spikes, warning } from '../recipes';

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

// Q: he raises his fists over a warning, then rocks burst out of the ground
registerAbilityVFX({
  abilityId: 'gorath_slam',
  phases: [
    phase('raise', 0, 'caster', [warning(MOLTEN, SLAM_RADIUS, SLAM), smoke(DUST, 4, [8, 12], [10, 30])], SLAM),
    phase('slam', SLAM, 'caster', [
      spikes('rock', STONE, 22, SLAM_RADIUS * 0.85, 'area', [36, 64], 1.1, MOLTEN),
      scorch(MOLTEN, SLAM_RADIUS * 0.55, 1.8, 0.6),
      ring(EARTH, 30, SLAM_RADIUS, 0.4, 5),
      smoke(DUST, 16, [16, 26], [80, 190]),
      rocks(STONE, 12),
      light(MOLTEN, SLAM_RADIUS * 0.8, 0.7, 0.45),
    ], 1.1),
  ],
});

// W: skin of stone: a ring of stones grinding around him, rocks circling
registerAbilityVFX({
  abilityId: 'gorath_fortify',
  phases: [
    phase('harden', 0, 'caster', [
      { type: 'shield_bubble', color: STONE, radius: 40, duration: 4.0, pulseSpeed: 0.8, style: 'stone', glowColor: MOLTEN },
      { type: 'orbiting_particles', color: STONE, count: 3, size: 13, orbitRadius: 52, orbitSpeed: 2.2, duration: 4.0, style: 'rock' },
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

// R: the ground rumbles under a wide warning, then splits open: rocks burst
// out all over it and the cracks glow molten
registerAbilityVFX({
  abilityId: 'gorath_earthquake',
  phases: [
    phase('rumble', 0, 'caster', [
      warning(MOLTEN, QUAKE_RADIUS, QUAKE),
      smoke(DUST, 10, [14, 22], [10, 40]),
      light(MOLTEN, QUAKE_RADIUS * 0.6, 0.3, QUAKE),
    ], QUAKE),
    phase('quake', QUAKE, 'caster', [
      spikes('rock', STONE, 34, QUAKE_RADIUS * 0.9, 'area', [44, 80], 1.5, MOLTEN),
      scorch(MOLTEN, QUAKE_RADIUS * 0.7, 2.8, 1.0),
      smoke(DUST, 20, [20, 34], [60, 220]),
      rocks(STONE, 18, [140, 300]),
      light(MOLTEN, QUAKE_RADIUS * 0.9, 1.0, 0.8, 0.3),
      { type: 'screen_flash', color: '#ffcf9a', duration: 0.1, maxAlpha: 0.1 },
    ], 1.5),
  ],
});
