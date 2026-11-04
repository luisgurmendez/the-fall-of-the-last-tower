/**
 * Magnus ability VFX: fire, and an amber ward for his barrier. Registered
 * when this module is imported (see ./index.ts). The fireball itself is
 * drawn by src/gpu/fx/projectiles.ts and his zones by src/gpu/fx/zones.ts.
 */

import { getAbilityDefinition, getCastTime } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import { abilityImpactTime } from '@/core/state/abilityTiming';
import {
  debris,
  embers,
  flames,
  gather,
  landsAt,
  light,
  meteor,
  phase,
  pillar,
  ring,
  rocks,
  scorch,
  shake,
  shockwave,
  sigil,
  smoke,
  sparks,
  warning,
} from '../recipes';

const FIRE = '#ff7a1a';
const HOT = '#ffc04a';
const SMOKE = '#3a3030';
const WARD = '#ffb347';
const MUD = '#6a4a30';

/** Seconds until the fireball leaves his staff (its animation's projectile keyframe) */
const THROW = abilityImpactTime('magnus_fireball');
/** His cast time: the fire gathers while he stands still */
const GATHER = getCastTime(getAbilityDefinition('magnus_fireball')!);
const MUD_LANDS = landsAt('magnus_mud');
const MUD_RADIUS = getAbilityDefinition('magnus_mud')?.aoeRadius ?? 110;
const METEOR_LANDS = landsAt('magnus_meteor');
const METEOR_RADIUS = getAbilityDefinition('magnus_meteor')?.aoeRadius ?? 250;
/** The meteor's own cast time (his staff raised), and when the rock starts its fast drop */
const METEOR_CAST = getCastTime(getAbilityDefinition('magnus_meteor')!);
const METEOR_DROP = Math.max(0, METEOR_LANDS - 0.7);

// Q: fire gathers at his staff in the cast time...
registerAbilityVFX({
  abilityId: 'magnus_fireball_windup',
  phases: [
    phase('gather', 0, 'caster', [
      gather(HOT, 10, 45, GATHER, 'ember'),
      flames(FIRE, 3, [5, 8], [5, 20], { lifetime: { min: GATHER, max: GATHER + 0.1 } }),
      light(FIRE, 60, 0.7, GATHER + 0.1),
    ], GATHER),
  ],
});

// ...then bursts out with the fireball...
registerAbilityVFX({
  abilityId: 'magnus_fireball',
  phases: [
    phase('throw', THROW, 'caster', [
      flames(HOT, 5, [7, 11], [60, 160], { spread: Math.PI / 3 }),
      sparks(HOT, 6, [120, 260], Math.PI / 3),
    ], 0.3),
  ],
});

// ...and an explosion where the fireball hits
registerAbilityVFX({
  abilityId: 'magnus_fireball_impact',
  phases: [
    phase('explode', 0, 'caster', [
      flames(FIRE, 10, [14, 24], [50, 150]),
      flames(HOT, 5, [10, 16], [20, 70]),
      ring(HOT, 8, 70, 0.3, 5),
      sparks(HOT, 16, [160, 360]),
      smoke(SMOKE, 5, [14, 22], [20, 60], { lifetime: { min: 0.8, max: 1.2 } }),
      scorch(FIRE, 42, 1.6, 0.9),
      light(FIRE, 130, 1.3, 0.6, 0.5),
    ], 0.6),
  ],
});

// W: an amber ward of hexagons over a circle of runes, embers rising
registerAbilityVFX({
  abilityId: 'magnus_shield',
  phases: [
    phase('raise', 0, 'caster', [
      { type: 'shield_bubble', color: WARD, radius: 45, duration: 4.0, pulseSpeed: 2, style: 'hex' },
      sigil(WARD, 48, 0.9),
      ring(WARD, 20, 64, 0.35, 4),
      embers(HOT, 14, 50),
      light(FIRE, 90, 0.6, 0.6),
    ], 4.0),
  ],
});

// E: the ground goes soft (a warning), then mud splashes up
registerAbilityVFX({
  abilityId: 'magnus_mud',
  phases: [
    phase('soften', 0, 'ground_target', [warning(MUD, MUD_RADIUS, MUD_LANDS)], MUD_LANDS),
    phase('splash', MUD_LANDS, 'ground_target', [
      smoke('#5a4030', 14, [12, 22], [50, 140]),
      debris('#3a2818', 12, [70, 170]),
      ring('#a07850', 20, MUD_RADIUS, 0.4, 3),
    ], 0.6),
  ],
});

// R's windup: he raises the staff and a thin beam of fire shoots from it into the sky
registerAbilityVFX({
  abilityId: 'magnus_meteor_windup',
  phases: [
    phase('call', 0, 'caster', [
      pillar(FIRE, 260, 5, METEOR_CAST + 0.15, HOT),
      light(FIRE, 50, 0.6, METEOR_CAST + 0.1),
    ], METEOR_CAST),
  ],
});

// R: the warning fills for the whole fall, a glow growing on it; the burning
// rock drops fast in the fall's last moments and blasts a crater; the
// burning zone follows
registerAbilityVFX({
  abilityId: 'magnus_meteor',
  phases: [
    phase('called', 0, 'ground_target', [
      warning(FIRE, METEOR_RADIUS, METEOR_LANDS),
      light(FIRE, METEOR_RADIUS * 0.8, 0.5, METEOR_LANDS, 0.3),
      embers(HOT, 10, METEOR_RADIUS * 0.6, { lifetime: { min: 0.6, max: 1.0 } }),
    ], METEOR_LANDS),
    phase('fall', METEOR_DROP, 'ground_target', [
      meteor('fire', FIRE, 22, 420, METEOR_LANDS - METEOR_DROP, HOT),
    ], METEOR_LANDS - METEOR_DROP),
    phase('impact', METEOR_LANDS, 'ground_target', [
      flames(FIRE, 18, [18, 30], [80, 220]),
      flames(HOT, 8, [12, 20], [30, 90]),
      shockwave(FIRE, 30, METEOR_RADIUS * 0.95, 0.5, 14),
      sparks(HOT, 30, [220, 480]),
      rocks('#4a3020', 14, [140, 280]),
      smoke(SMOKE, 10, [20, 32], [40, 120], { lifetime: { min: 1.0, max: 1.6 } }),
      scorch(FIRE, METEOR_RADIUS * 0.65, 5.0, 1.0),
      light(FIRE, METEOR_RADIUS * 1.1, 1.5, 0.9, 0.4),
      { type: 'screen_flash', color: '#ffb060', duration: 0.12, maxAlpha: 0.15 },
      shake(5, 0.3),
    ], 0.9),
  ],
});
