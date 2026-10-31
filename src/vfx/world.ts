/**
 * World VFX: feedback for things that happen in the match rather than for a
 * champion's ability (hits, level ups, deaths, recalls, towers falling,
 * monster attacks).
 * Registered when this module is imported (see VFXRegistry.ts) and spawned
 * by OnlineStateManager when it sees the matching event or state change.
 */

import { GameConfig, MOBAConfig } from '@siege/shared';
import { registerAbilityVFX } from './VFXRegistryStore';
import {
  coneWarning,
  debris,
  embers,
  flames,
  light,
  phase,
  pillar,
  rays,
  ring,
  rocks,
  scorch,
  shockwave,
  sigil,
  smoke,
  sparks,
  twinkles,
  warning,
} from './recipes';

/** Keys of the world VFX, spawned with VFXManager.spawnAbilityVFX */
export const WORLD_VFX = {
  HIT_PHYSICAL: 'fx_hit_physical',
  HIT_MAGIC: 'fx_hit_magic',
  HIT_TRUE: 'fx_hit_true',
  LEVEL_UP: 'fx_level_up',
  CHAMPION_DEATH: 'fx_champion_death',
  RESPAWN: 'fx_respawn',
  RECALL_ARRIVE: 'fx_recall_arrive',
  TOWER_DESTROYED: 'fx_tower_destroyed',
  CREATURE_DEATH: 'fx_creature_death',
  DRAGON_DEATH: 'fx_dragon_death',
  WARD_PLACED: 'fx_ward_placed',
  CONTROL_WARD_PLACED: 'fx_control_ward_placed',
} as const;

// A ward is placed: a glint where its eye opens, and a ring of its light
// spreading over what it will see
function registerWardPlaced(abilityId: string, color: string, colorSecondary: string): void {
  registerAbilityVFX({
    abilityId,
    phases: [
      phase('place', 0, 'caster', [
        ring(color, 6, 46, 0.35, 2),
        ring(colorSecondary, 20, GameConfig.VISION.WARD_SIGHT_RANGE, 0.7, 1.5),
        twinkles(colorSecondary, 4, [6, 22]),
        light(color, 40, 0.7, 0.5),
      ], 0.8),
    ],
  });
}

// A hit: a few short streaks and a pinprick of light, colored by damage type
function registerHitSpark(abilityId: string, color: string, colorSecondary: string): void {
  registerAbilityVFX({
    abilityId,
    phases: [
      phase('spark', 0, 'caster', [
        sparks(color, 7, [110, 240], Math.PI * 2, { colorSecondary, size: { min: 2.5, max: 4 }, lifetime: { min: 0.1, max: 0.22 } }),
        twinkles(colorSecondary, 1, [0, 0], { size: { min: 5, max: 6 }, lifetime: { min: 0.1, max: 0.15 } }),
      ], 0.2),
    ],
  });
}

registerHitSpark(WORLD_VFX.HIT_PHYSICAL, '#ffffff', '#ffb347');
registerHitSpark(WORLD_VFX.HIT_MAGIC, '#c8b4ff', '#7c6cff');
registerHitSpark(WORLD_VFX.HIT_TRUE, '#ffffff', '#fff59d');

registerWardPlaced(WORLD_VFX.WARD_PLACED, '#d4ff7a', '#f1e9a0');
registerWardPlaced(WORLD_VFX.CONTROL_WARD_PLACED, '#ff5fa2', '#ffc1dc');

// Level up: a golden pillar, a ring and sparkles rising
registerAbilityVFX({
  abilityId: WORLD_VFX.LEVEL_UP,
  phases: [
    phase('burst', 0, 'caster', [
      pillar('#ffd54f', 140, 9, 0.5, '#fff8e1'),
      ring('#ffd54f', 10, 70, 0.5, 4),
      embers('#ffe082', 16, 30),
      twinkles('#fff8e1', 6, [20, 60]),
      light('#ffd54f', 90, 0.9, 0.7),
    ], 0.8),
  ],
});

// A champion falls: a dark burst and a wisp of light rising from it
registerAbilityVFX({
  abilityId: WORLD_VFX.CHAMPION_DEATH,
  phases: [
    phase('fall', 0, 'caster', [
      shockwave('#e8e8f0', 10, 90, 0.4, 6),
      smoke('#2a2630', 10, [14, 22], [30, 90]),
      sparks('#ffffff', 10, [120, 260]),
      embers('#dfe8ff', 12, 20, { lifetime: { min: 0.9, max: 1.4 } }),
      light('#c8d8ff', 90, 0.6, 0.6),
    ], 1),
  ],
});

// Back in the fountain: a circle and a pillar of light
registerAbilityVFX({
  abilityId: WORLD_VFX.RESPAWN,
  phases: [
    phase('return', 0, 'caster', [
      sigil('#9fe8ff', 45, 0.9),
      pillar('#9fe8ff', 160, 10, 0.5, '#ffffff'),
      embers('#e0f7ff', 12, 30),
    ], 0.9),
  ],
});

// Arriving from a recall: light collapsing onto the spot, then rays of it
registerAbilityVFX({
  abilityId: WORLD_VFX.RECALL_ARRIVE,
  phases: [
    phase('arrive', 0, 'caster', [
      ring('#9fd8ff', 50, 5, 0.35, 3),
      rays('#9fd8ff', 80, 0.5, 12),
      twinkles('#e0f7ff', 6, [20, 60]),
      light('#9fd8ff', 70, 0.8, 0.5),
    ], 0.6),
  ],
});

// A tower or the nexus goes down: an explosion, flames, smoke and rubble
registerAbilityVFX({
  abilityId: WORLD_VFX.TOWER_DESTROYED,
  phases: [
    phase('blast', 0, 'caster', [
      { type: 'screen_flash', color: '#ffffff', duration: 0.25, maxAlpha: 0.35 },
      shockwave('#ffcc80', 20, 230, 0.5, 14),
      flames('#ff8a3a', 16, [18, 30], [60, 200]),
      sparks('#ffd180', 30, [220, 480]),
      debris('#5d4a3a', 20, [140, 320]),
      scorch('#1e140c', 140, 4.0, 0.8),
      light('#ff9a3a', 260, 1.4, 1.0, 0.4),
    ], 0.6),
    phase('smoke', 0.2, 'caster', [
      smoke('#4a4448', 16, [22, 36], [30, 110], { lifetime: { min: 1.2, max: 2.0 } }),
      embers('#ffab40', 18, 80),
    ], 1.5),
  ],
});

// A monster dies: a puff and a few sparks
registerAbilityVFX({
  abilityId: WORLD_VFX.CREATURE_DEATH,
  phases: [
    phase('burst', 0, 'caster', [
      smoke('#4a4440', 8, [12, 20], [30, 90]),
      sparks('#ffe0b2', 8, [100, 220]),
      twinkles('#fff3e0', 3, [20, 50]),
    ], 0.6),
  ],
});

// The dragon dies: a fiery blast and embers drifting up
registerAbilityVFX({
  abilityId: WORLD_VFX.DRAGON_DEATH,
  phases: [
    phase('blast', 0, 'caster', [
      shockwave('#ff7043', 20, 230, 0.6, 16),
      ring('#ffd180', 10, 150, 0.5, 4),
      flames('#ff7a1a', 18, [18, 30], [60, 200]),
      sparks('#ffab40', 30, [200, 460]),
      scorch('#1e120a', 120, 3.0, 1.0),
      light('#ff7a1a', 260, 1.5, 1.0, 0.4),
    ], 0.6),
    phase('embers', 0.2, 'caster', [
      embers('#ffab40', 26, 120, { lifetime: { min: 1.0, max: 1.6 } }),
      smoke('#3a3030', 10, [20, 32], [30, 90], { lifetime: { min: 1.0, max: 1.6 } }),
    ], 1.4),
  ],
});

const SPECIAL_ATTACKS = MOBAConfig.JUNGLE.SPECIAL_ATTACKS;

// A big monster's slam: a warning filling up over the windup, then the ground cracks
function registerMonsterSlam(
  attack: { abilityId: string; radius: number; windup: number },
  color: string,
  dustColor: string
): void {
  registerAbilityVFX({
    abilityId: attack.abilityId,
    phases: [
      phase('warning', 0, 'caster', [warning(color, attack.radius, attack.windup)], attack.windup),
      phase('slam', attack.windup, 'caster', [
        shockwave(color, attack.radius * 0.3, attack.radius * 1.05, 0.35, 10),
        scorch('#2a2018', attack.radius * 0.8, 1.6, 0.4),
        smoke(dustColor, 12, [14, 24], [60, 170]),
        rocks('#6a5a4a', 12, [100, 220]),
        sparks(color, 10, [150, 300]),
        light(color, attack.radius * 1.2, 0.8, 0.4),
      ], 0.8),
    ],
  });
}

registerMonsterSlam(SPECIAL_ATTACKS.blue_buff, '#64b5f6', '#8a96a8');
registerMonsterSlam(SPECIAL_ATTACKS.red_buff, '#ff8a65', '#9a8478');

const DRAGON_BREATH = SPECIAL_ATTACKS.dragon;

// The dragon's breath: a cone warning, then a jet of flame across it
registerAbilityVFX({
  abilityId: DRAGON_BREATH.abilityId,
  phases: [
    phase('warning', 0, 'caster', [
      coneWarning('#ff7043', DRAGON_BREATH.radius, DRAGON_BREATH.coneAngle, DRAGON_BREATH.windup),
      light('#ff7043', 70, 0.6, DRAGON_BREATH.windup, 0.4),
    ], DRAGON_BREATH.windup),
    phase('breath', DRAGON_BREATH.windup, 'caster', [
      flames('#ff7a1a', 26, [14, 26], [DRAGON_BREATH.radius * 1.1, DRAGON_BREATH.radius * 1.9], {
        spread: DRAGON_BREATH.coneAngle * 0.8,
        lifetime: { min: 0.4, max: 0.6 },
        friction: 1.5,
        gravity: 0,
      }),
      flames('#ffc04a', 12, [10, 16], [DRAGON_BREATH.radius * 0.8, DRAGON_BREATH.radius * 1.4], {
        spread: DRAGON_BREATH.coneAngle * 0.5,
        lifetime: { min: 0.3, max: 0.45 },
        friction: 1.5,
        gravity: 0,
      }),
      sparks('#ffd180', 18, [300, 600], DRAGON_BREATH.coneAngle * 0.8),
      light('#ff7a1a', 160, 1.0, 0.6, 0.5),
    ], 0.7),
    phase('embers', DRAGON_BREATH.windup + 0.2, 'ground_target', [
      embers('#ffab40', 20, 120),
      scorch('#1e120a', 90, 2.0, 0.8),
    ], 1),
  ],
});
