/**
 * Summoner spell VFX, keyed `summoner_<id>` and spawned from SUMMONER_CAST
 * events (state/gameEvents.ts): at the caster, and for Blink at where it
 * landed, for spells cast on a unit at that unit (`ground_target`).
 * Registered when this module is imported (see VFXRegistry.ts).
 */

import { SUMMONER_SPELLS } from '@siege/shared';
import { registerAbilityVFX } from './VFXRegistryStore';
import { embers, flames, light, phase, pillar, rays, ring, shockwave, sparks, swirl, twinkles, wisps } from './recipes';

const color = (id: keyof typeof SUMMONER_SPELLS) => SUMMONER_SPELLS[id].color;

// Blink: light folding in where the champion was, bursting out where it lands
registerAbilityVFX({
  abilityId: 'summoner_blink',
  phases: [
    phase('vanish', 0, 'caster', [
      rays(color('blink'), 50, 0.25, 12, true),
      twinkles('#ffffff', 6, [10, 40]),
      light(color('blink'), 50, 0.8, 0.3),
    ], 0.35),
    phase('appear', 0, 'ground_target', [
      ring(color('blink'), 6, 46, 0.3, 3),
      rays(color('blink'), 60, 0.3, 12),
      twinkles('#ffffff', 8, [10, 50]),
      light(color('blink'), 60, 0.9, 0.4),
    ], 0.45),
  ],
});

// Haste: streaks of wind peeling off the champion
registerAbilityVFX({
  abilityId: 'summoner_haste',
  phases: [
    phase('rush', 0, 'caster', [
      wisps(color('haste'), 10, [80, 180]),
      ring(color('haste'), 10, 55, 0.35, 2),
      light(color('haste'), 50, 0.6, 0.4),
    ], 0.5),
  ],
});

// Mend: green motes rising around a soft ring
registerAbilityVFX({
  abilityId: 'summoner_mend',
  phases: [
    phase('heal', 0, 'caster', [
      ring(color('mend'), 8, 60, 0.45, 3),
      embers(color('mend'), 16, 34),
      twinkles('#e8ffe8', 6, [10, 40]),
      light(color('mend'), 70, 0.8, 0.6),
    ], 0.8),
  ],
});

// Aegis: a golden flare as the shield closes in
registerAbilityVFX({
  abilityId: 'summoner_aegis',
  phases: [
    phase('shield', 0, 'caster', [
      ring(color('aegis'), 60, 30, 0.3, 4),
      rays(color('aegis'), 55, 0.35, 10),
      light(color('aegis'), 60, 0.8, 0.5),
    ], 0.5),
  ],
});

// Purge: a white burst throwing off what held the champion
registerAbilityVFX({
  abilityId: 'summoner_purge',
  phases: [
    phase('purge', 0, 'caster', [
      shockwave('#ffffff', 10, 70, 0.35, 6),
      sparks('#ffffff', 12, [160, 300]),
      twinkles('#e8f4ff', 6, [10, 50]),
      light('#ffffff', 60, 0.7, 0.4),
    ], 0.5),
  ],
});

// Scorch: the target bursts into flame
registerAbilityVFX({
  abilityId: 'summoner_scorch',
  phases: [
    phase('ignite', 0, 'ground_target', [
      flames(color('scorch'), 12, [10, 18], [30, 110]),
      embers('#ffcf6b', 10, 26),
      light(color('scorch'), 60, 0.9, 0.7, 0.3),
    ], 0.8),
  ],
});

// Hinder: dark weight coiling around the target
registerAbilityVFX({
  abilityId: 'summoner_hinder',
  phases: [
    phase('bind', 0, 'ground_target', [
      swirl(color('hinder'), 40, 0.6, -1.2, 3),
      ring(color('hinder'), 50, 14, 0.4, 3),
      light(color('hinder'), 50, 0.6, 0.6),
    ], 0.7),
  ],
});

// Reap: a bolt of golden light striking the monster
registerAbilityVFX({
  abilityId: 'summoner_reap',
  phases: [
    phase('strike', 0, 'ground_target', [
      pillar(color('reap'), 220, 10, 0.3, '#fff6c8'),
      shockwave(color('reap'), 8, 60, 0.3, 6),
      sparks('#fff6c8', 12, [180, 320]),
      light(color('reap'), 80, 1, 0.4),
    ], 0.45),
  ],
});
