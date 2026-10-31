/**
 * Elara ability VFX: holy white and gold, sky blue for her barrier, and a
 * breeze with leaves for her speed. Petals and rays of light instead of
 * pillars. Registered when this module is imported (see ./index.ts).
 */

import { registerAbilityVFX } from '../VFXRegistryStore';
import { embers, light, petals, phase, rays, ring, shockwave, sigil, sparks, swirl, twinkles } from '../recipes';

const HOLY = '#ffe9a8';
const WHITE = '#fffaf0';
const SKY = '#8fd6ff';
const TEAL = '#7fffd4';
const LEAF = '#8fd47a';

// Q: rays of light bloom on the ally and petals rise around them
registerAbilityVFX({
  abilityId: 'elara_heal',
  phases: [
    phase('cast', 0, 'caster', [twinkles(HOLY, 4, [30, 90]), light(HOLY, 60, 0.5, 0.3)], 0.3),
    phase('bloom', 0.1, 'target', [
      rays(HOLY, 75, 0.7, 10),
      petals(HOLY, 14, [30, 90], 'petal', { gravity: -45 }),
      embers(WHITE, 10, 40),
      ring(WHITE, 0, 55, 0.45, 2),
      light(HOLY, 100, 0.9, 0.7),
    ], 0.8),
  ],
});

// W: a ring closes onto the ally and a ward of sky-blue petals forms around them
registerAbilityVFX({
  abilityId: 'elara_barrier',
  phases: [
    phase('cast', 0, 'caster', [ring(WHITE, 20, 46, 0.25, 3), twinkles(SKY, 4)], 0.25),
    phase('shield', 0.15, 'target', [
      { type: 'shield_bubble', color: SKY, radius: 32, duration: 2.5, pulseSpeed: 1.2, style: 'holy' },
      ring(SKY, 60, 24, 0.3, 3),
      petals(SKY, 8, [20, 60]),
      light(SKY, 70, 0.6, 0.5),
    ], 2.5),
  ],
});

// E: a gust of wind spiralling out, carrying leaves
registerAbilityVFX({
  abilityId: 'elara_speed',
  phases: [
    phase('gust', 0, 'caster', [
      swirl(TEAL, 120, 0.7, 1.6, 3),
      ring(TEAL, 10, 220, 0.5, 3),
      sparks(TEAL, 14, [220, 380]),
      petals(LEAF, 12, [140, 260], 'leaf', { friction: 1.5, gravity: 0 }),
      light(TEAL, 200, 0.4, 0.5),
    ], 0.7),
  ],
});

// R: a holy circle gathers light, then rays burst out and feathers of light drift down
registerAbilityVFX({
  abilityId: 'elara_resurrection',
  phases: [
    phase('gather', 0, 'caster', [
      sigil(HOLY, 300, 1.2, '#fff0b0'),
      rays(WHITE, 240, 0.3, 18, true),
      light(HOLY, 300, 0.6, 0.9),
    ], 1.2),
    phase('burst', 0.3, 'caster', [
      rays(HOLY, 380, 1.0, 22),
      shockwave(WHITE, 20, 360, 0.5, 10),
      petals(WHITE, 30, [80, 240]),
      twinkles(WHITE, 16, [80, 220]),
      light(HOLY, 340, 0.8, 1.0),
      { type: 'screen_flash', color: '#fffbe6', duration: 0.15, maxAlpha: 0.12 },
    ], 1.0),
    phase('linger', 0.5, 'caster', [
      petals(HOLY, 20, [20, 80], 'petal', { lifetime: { min: 1.2, max: 2.0 } }),
      embers(WHITE, 16, 260, { lifetime: { min: 1.0, max: 1.6 } }),
    ], 2.0),
  ],
});
