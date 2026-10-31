/**
 * Gorath ability VFX: earth, dust and amber, a red roar. Registered when
 * this module is imported (see ./index.ts).
 */

import { registerAbilityVFX } from '../VFXRegistryStore';
import { debris, flames, light, phase, ring, scorch, shockwave, smoke, sparks, warning } from '../recipes';

const EARTH = '#d9a35a';
const AMBER = '#ff9a3a';
const DUST = '#8c7a62';
const ROCK = '#4a3c30';
const ROAR = '#ff5a3a';

// Q: he raises his fists and the ground cracks around him
registerAbilityVFX({
  abilityId: 'gorath_slam',
  phases: [
    phase('raise', 0, 'caster', [smoke(DUST, 4, [8, 12], [10, 30])], 0.3),
    phase('slam', 0.25, 'caster', [
      shockwave(EARTH, 20, 160, 0.35, 12),
      scorch('#2e241c', 115, 1.6, 0.35),
      smoke(DUST, 14, [16, 26], [70, 170]),
      debris(ROCK, 14, [100, 230]),
      sparks(AMBER, 10, [150, 300]),
      light(AMBER, 170, 0.8, 0.35),
    ]),
  ],
});

// W: skin of stone: a sandy bubble and rocks circling him
registerAbilityVFX({
  abilityId: 'gorath_fortify',
  phases: [
    phase('harden', 0, 'caster', [
      { type: 'shield_bubble', color: '#d9b07a', radius: 36, duration: 4.0, pulseSpeed: 0.8 },
      { type: 'orbiting_particles', color: AMBER, count: 4, size: 7, orbitRadius: 42, orbitSpeed: 2.5, duration: 4.0 },
      ring(EARTH, 20, 56, 0.3, 5),
      smoke(DUST, 8, [10, 16], [30, 80]),
      debris(ROCK, 6, [60, 120]),
    ], 4.0),
  ],
});

// E: a roar: rings of red sound rolling out
registerAbilityVFX({
  abilityId: 'gorath_taunt',
  phases: [
    phase('roar', 0, 'caster', [
      shockwave(ROAR, 30, 210, 0.4, 9),
      ring(ROAR, 30, 170, 0.3, 3),
      ring('#ffb08a', 25, 120, 0.22, 2),
      sparks(ROAR, 16, [200, 360]),
      light(ROAR, 200, 0.7, 0.4),
    ]),
  ],
});

// R: the ground rumbles, then splits open in glowing cracks
registerAbilityVFX({
  abilityId: 'gorath_earthquake',
  phases: [
    phase('rumble', 0, 'ground_target', [
      warning(AMBER, 250, 0.45),
      smoke(DUST, 8, [14, 22], [10, 40]),
      light(AMBER, 200, 0.4, 0.45),
    ], 0.45),
    phase('quake', 0.45, 'ground_target', [
      shockwave(EARTH, 30, 270, 0.45, 16),
      scorch('#20160f', 210, 2.5, 0.9),
      debris(ROCK, 20, [140, 300]),
      smoke(DUST, 18, [20, 34], [60, 200]),
      sparks(AMBER, 20, [200, 400]),
      flames(AMBER, 6, [10, 16], [20, 60]),
      light(AMBER, 300, 1.2, 0.7, 0.3),
    ]),
  ],
});
