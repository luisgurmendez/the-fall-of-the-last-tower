/**
 * Lume ability VFX: warm light. Registered when this module is imported
 * (see ./index.ts). The Light Orb is drawn by src/render/entities/lightOrb.ts.
 */

import { registerAbilityVFX } from '../VFXRegistryStore';
import { embers, light, phase, pillar, ring, scorch, shockwave, sigil, sparks, twinkles } from '../recipes';

const LIGHT = '#ffe566';
const WARM = '#ffd27a';
const WHITE = '#ffffff';
const SOFT = '#fff9e0';

// Q: she sends the orb off in a spray of light
registerAbilityVFX({
  abilityId: 'lume_q',
  phases: [
    phase('send', 0, 'caster', [twinkles(LIGHT, 6), sparks(WARM, 8, [180, 340], Math.PI / 4), light(LIGHT, 60, 0.6, 0.25)], 0.3),
    phase('arrive', 0.2, 'ground_target', [ring(LIGHT, 5, 45, 0.25, 3), twinkles(WHITE, 6, [20, 60])], 0.3),
  ],
});

// W: a warm pulse rolling out
registerAbilityVFX({
  abilityId: 'lume_w',
  phases: [
    phase('pulse', 0, 'caster', [ring(WARM, 10, 180, 0.4, 4), light(WARM, 180, 0.7, 0.5), embers(SOFT, 16, 120)]),
  ],
});

// E: she steps in a streak of light and flashes, dazzling everyone near
registerAbilityVFX({
  abilityId: 'lume_e',
  phases: [
    phase('step', 0, 'caster', [
      { type: 'dash_afterimage', color: LIGHT, imageCount: 5, fadeSpeed: 3.5, duration: 0.25 },
      { type: 'trail', color: LIGHT, thickness: 9, duration: 0.35, fadeLength: 12 },
    ], 0.35),
    phase('dazzle', 0.2, 'caster', [
      twinkles(WHITE, 12, [80, 200]),
      ring(WHITE, 20, 110, 0.25, 4),
      sparks(LIGHT, 16, [200, 380]),
      light(WHITE, 130, 1.2, 0.3),
      { type: 'screen_flash', color: '#ffffff', duration: 0.08, maxAlpha: 0.1 },
    ], 0.3),
  ],
});

// R: a circle marks the spot, the light gathers, then a beam crashes down
registerAbilityVFX({
  abilityId: 'lume_r',
  phases: [
    phase('mark', 0, 'target', [sigil(LIGHT, 220, 0.55, '#fff3b0'), light(LIGHT, 220, 0.5, 0.55)], 0.55),
    phase('converge', 0.3, 'target', [ring(WHITE, 90, 10, 0.18, 3)], 0.18),
    phase('fall', 0.38, 'target', [pillar(WHITE, 520, 30, 0.45, LIGHT)], 0.45),
    phase('impact', 0.48, 'target', [
      shockwave(LIGHT, 20, 240, 0.45, 14),
      ring(WHITE, 15, 300, 0.4, 3),
      twinkles(WHITE, 24, [100, 300]),
      sparks(LIGHT, 30, [250, 520]),
      scorch('#3a3020', 140, 2.0, 0.6),
      light(LIGHT, 320, 1.6, 1.0),
      { type: 'screen_flash', color: '#fffbe0', duration: 0.25, maxAlpha: 0.2 },
    ]),
    phase('afterglow', 0.55, 'target', [embers(SOFT, 30, 220, { lifetime: { min: 0.8, max: 1.6 } })], 1.6),
  ],
});
