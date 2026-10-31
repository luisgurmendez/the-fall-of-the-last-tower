/**
 * Kael (warrior) ability VFX: steel and gold. Registered when this module
 * is imported (see ./index.ts).
 */

import { registerAbilityVFX } from '../VFXRegistryStore';
import { debris, embers, light, phase, pillar, ring, scorch, shockwave, slash, smoke, sparks, twinkles } from '../recipes';

const STEEL = '#7cc8ff';
const GOLD = '#ffb52e';
const WHITE = '#fff6dc';
const BLUE = '#5aa8ff';
const DUST = '#8a7a66';

// Q: a two-tone crescent swept across the cone, sparks flying off the edge
registerAbilityVFX({
  abilityId: 'warrior_slash',
  phases: [
    phase('swing', 0, 'caster', [
      slash(STEEL, 118, Math.PI * 0.62, 0.3, 58),
      slash(GOLD, 100, Math.PI * 0.55, 0.26, 26),
      sparks(WHITE, 12, [180, 380], Math.PI / 2),
      light(STEEL, 110, 0.5, 0.25),
    ], 0.3),
    phase('impact', 0.1, 'target', [twinkles(GOLD, 4, [20, 60]), light(GOLD, 60, 0.5, 0.25)], 0.25),
  ],
});

// W: a golden bubble that flares as it comes up
registerAbilityVFX({
  abilityId: 'warrior_shield',
  phases: [
    phase('raise', 0, 'caster', [
      { type: 'shield_bubble', color: GOLD, radius: 34, duration: 3.0, pulseSpeed: 1.5 },
      ring(GOLD, 18, 62, 0.3, 4),
      twinkles(WHITE, 10, [40, 120]),
      embers(GOLD, 10, 30),
      light(GOLD, 80, 0.7, 0.5),
    ], 3.0),
  ],
});

// E: afterimages and a steel streak, a dusty impact where he lands
registerAbilityVFX({
  abilityId: 'warrior_charge',
  phases: [
    phase('charge', 0, 'caster', [
      { type: 'dash_afterimage', color: BLUE, imageCount: 6, fadeSpeed: 3, duration: 0.3 },
      { type: 'trail', color: STEEL, thickness: 12, duration: 0.45, fadeLength: 14 },
      smoke(DUST, 5, [10, 16], [20, 60]),
    ], 0.45),
    phase('impact', 0.25, 'target', [
      shockwave(STEEL, 10, 85, 0.3, 8),
      scorch('#3a2c22', 45, 1.2),
      smoke(DUST, 8, [12, 20], [40, 110]),
      sparks(WHITE, 14, [160, 340]),
      light(STEEL, 90, 0.8, 0.3),
    ]),
  ],
});

// R: a golden leap that ends in a pillar of light and a crater
registerAbilityVFX({
  abilityId: 'warrior_ultimate',
  phases: [
    phase('leap', 0, 'caster', [
      { type: 'trail', color: GOLD, thickness: 14, duration: 0.5, fadeLength: 16 },
      embers(GOLD, 10, 30),
    ], 0.5),
    phase('strike', 0.25, 'ground_target', [
      pillar(GOLD, 260, 16, 0.35, WHITE),
      shockwave(GOLD, 20, 150, 0.4, 12),
      ring(WHITE, 10, 120, 0.22, 3),
      scorch('#3a2a18', 95, 2.0, 0.7),
      sparks(GOLD, 26, [200, 420]),
      debris('#5a4a3a', 10),
      smoke('#9a8a70', 10, [16, 26], [50, 140]),
      light(GOLD, 180, 1.3, 0.6),
      { type: 'screen_flash', color: '#fff3c0', duration: 0.12, maxAlpha: 0.12 },
    ]),
  ],
});
