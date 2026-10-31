/**
 * Elara ability VFX: holy gold and white, and a teal breeze for her speed.
 * Registered when this module is imported (see ./index.ts).
 */

import { registerAbilityVFX } from '../VFXRegistryStore';
import { embers, light, phase, pillar, ring, shockwave, sigil, sparks, swirl, twinkles } from '../recipes';

const HOLY = '#ffe08a';
const WHITE = '#fffaf0';
const SOFT = '#fff4c4';
const TEAL = '#7fffd4';

// Q: a pillar of light on the ally, motes rising around them
registerAbilityVFX({
  abilityId: 'elara_heal',
  phases: [
    phase('cast', 0, 'caster', [twinkles(HOLY, 6, [30, 90]), light(HOLY, 60, 0.6, 0.3)], 0.3),
    phase('bless', 0.1, 'target', [
      pillar(HOLY, 180, 10, 0.45, WHITE),
      ring(HOLY, 0, 60, 0.4, 3),
      embers(SOFT, 18, 40),
      twinkles(WHITE, 8, [20, 70]),
      light(HOLY, 100, 1.0, 0.6),
    ]),
  ],
});

// W: a ring closes onto the ally and a golden bubble forms around them
registerAbilityVFX({
  abilityId: 'elara_barrier',
  phases: [
    phase('cast', 0, 'caster', [ring(WHITE, 20, 46, 0.22, 3), twinkles(HOLY, 6)], 0.25),
    phase('shield', 0.15, 'target', [
      { type: 'shield_bubble', color: HOLY, radius: 30, duration: 2.5, pulseSpeed: 1.2 },
      ring(HOLY, 60, 24, 0.25, 3),
      light(HOLY, 70, 0.6, 0.4),
    ], 2.5),
  ],
});

// E: a gust of wind spiralling out
registerAbilityVFX({
  abilityId: 'elara_speed',
  phases: [
    phase('gust', 0, 'caster', [
      ring(TEAL, 10, 200, 0.45, 4),
      swirl(TEAL, 110, 0.6, 1.6, 3),
      sparks(TEAL, 18, [220, 380]),
      light(TEAL, 200, 0.5, 0.5),
    ]),
  ],
});

// R: a holy circle gathers light, then a pillar and a wave of it burst out
registerAbilityVFX({
  abilityId: 'elara_resurrection',
  phases: [
    phase('gather', 0, 'caster', [
      sigil(HOLY, 300, 0.75, '#fff0b0'),
      embers(HOLY, 24, 260, { lifetime: { min: 0.6, max: 1.0 } }),
      light(HOLY, 300, 0.6, 0.7),
    ], 0.75),
    phase('burst', 0.45, 'caster', [
      pillar(WHITE, 320, 26, 0.5, HOLY),
      shockwave(HOLY, 20, 320, 0.45, 12),
      ring(WHITE, 10, 280, 0.3, 3),
      twinkles(WHITE, 20, [80, 220]),
      light(HOLY, 340, 1.4, 1.0),
      { type: 'screen_flash', color: '#fffbe6', duration: 0.15, maxAlpha: 0.18 },
    ]),
    phase('linger', 0.5, 'caster', [embers(SOFT, 26, 280, { lifetime: { min: 1.0, max: 1.6 } })], 1.6),
  ],
});
