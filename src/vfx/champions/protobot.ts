/**
 * Protobot 45 ability VFX: steel, cyan electricity and rocket fire.
 * Registered when this module is imported (see ./index.ts). The magnetic
 * claw in flight is a projectile (src/gpu/fx/projectiles.ts).
 */

import { getAbilityDefinition } from '@siege/shared';
import { registerAbilityVFX } from '../VFXRegistryStore';
import {
  bolts,
  debris,
  flames,
  gather,
  landsAt,
  light,
  phase,
  rays,
  ring,
  shake,
  shockwave,
  smoke,
  sparks,
  warning,
} from '../recipes';

const CYAN = '#4ae0ff';
const SPARK = '#d8f8ff';
const STEEL = '#6a7a8a';
const ROCKET = '#ff8a2a';
const ROCKET_HOT = '#ffd06a';

const PULSE_RADIUS = getAbilityDefinition('protobot_r')?.aoeRadius ?? 280;
const CHARGE = landsAt('protobot_r');

// Q: the claw leaves his arm in a crackle (the claw itself is the projectile)...
registerAbilityVFX({
  abilityId: 'protobot_q',
  phases: [
    phase('launch', 0, 'caster', [
      sparks(CYAN, 8, [120, 240], Math.PI / 6),
      light(CYAN, 40, 0.6, 0.2),
    ], 0.3),
  ],
});

// ...sparks where it stops...
registerAbilityVFX({
  abilityId: 'protobot_q_impact',
  phases: [
    phase('clamp', 0, 'caster', [
      sparks(SPARK, 12, [100, 220]),
      ring(CYAN, 6, 36, 0.25, 3),
      light(CYAN, 50, 0.8, 0.25),
    ], 0.35),
  ],
});

// ...and a champion it caught is dragged in along crackling bolts
registerAbilityVFX({
  abilityId: 'protobot_q_pull',
  phases: [
    phase('chain', 0, 'caster', [bolts(CYAN, 2, 0.35, 10, 2.5)], 0.35),
    phase('dragged', 0, 'target', [
      { type: 'trail', color: CYAN, thickness: 10, duration: 0.4, fadeLength: 14 },
      sparks(SPARK, 10, [60, 160]),
    ], 0.4),
  ],
});

// W: he overcharges: electricity crawls over a hex shield
registerAbilityVFX({
  abilityId: 'protobot_w',
  phases: [
    phase('charge', 0, 'caster', [
      { type: 'shield_bubble', color: CYAN, radius: 48, duration: 3, pulseSpeed: 2.5, style: 'hex' },
      rays(CYAN, 60, 0.35, 10),
      sparks(SPARK, 14, [120, 260]),
      light(CYAN, 70, 0.8, 0.5, 0.4),
    ], 3),
  ],
});

// E: the fist rockets across on a streak of fire and bursts on the target
registerAbilityVFX({
  abilityId: 'protobot_e',
  phases: [
    phase('rocket', 0, 'caster', [
      { type: 'beam', color: ROCKET, colorSecondary: ROCKET_HOT, thickness: 8, duration: 0.15, glowRadius: 12 },
      smoke(STEEL, 4, [8, 14], [20, 60]),
    ], 0.2),
    phase('punch', 0.05, 'target', [
      shockwave(ROCKET_HOT, 10, 60, 0.25, 6),
      flames(ROCKET, 8, [8, 14], [80, 180]),
      debris(STEEL, 6, [80, 180]),
      light(ROCKET, 60, 0.9, 0.3),
      shake(2, 0.15),
    ], 0.4),
  ],
});

// R: power gathers into him over the charge...
registerAbilityVFX({
  abilityId: 'protobot_r',
  phases: [
    phase('charge', 0, 'caster', [
      warning(CYAN, PULSE_RADIUS, CHARGE),
      gather(CYAN, 18, 90, CHARGE),
      light(CYAN, 80, 0.7, CHARGE, 0.6),
    ], CHARGE),
  ],
});

// ...and goes off as an electromagnetic pulse
registerAbilityVFX({
  abilityId: 'protobot_r_pulse',
  phases: [
    phase('pulse', 0, 'caster', [
      shockwave(CYAN, 30, PULSE_RADIUS, 0.45, 12),
      ring(SPARK, 20, PULSE_RADIUS * 0.9, 0.35, 3),
      bolts(CYAN, 6, 0.3, 30, 2),
      rays(SPARK, PULSE_RADIUS * 0.7, 0.4, 18),
      sparks(SPARK, 24, [200, 420]),
      light(CYAN, PULSE_RADIUS * 1.1, 1.1, 0.5, 0.5),
      { type: 'screen_flash', color: '#7ae8ff', duration: 0.1, maxAlpha: 0.08 },
      shake(5, 0.3),
    ], 0.6),
  ],
});
