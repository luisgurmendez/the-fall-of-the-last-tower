/**
 * World VFX: feedback for things that happen in the match rather than for a
 * champion's ability (hits, level ups, deaths, recalls, towers falling).
 * Registered when this module is imported (see VFXRegistry.ts) and spawned
 * by OnlineStateManager when it sees the matching event or state change.
 */

import { registerAbilityVFX } from './VFXRegistryStore';

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
} as const;

function registerHitSpark(abilityId: string, color: string, colorSecondary: string): void {
  registerAbilityVFX({
    abilityId,
    phases: [
      {
        name: 'spark',
        delay: 0,
        duration: 0.2,
        anchor: 'caster',
        effects: [
          {
            type: 'particle_burst',
            count: 5,
            color,
            colorSecondary,
            size: { min: 1.5, max: 3 },
            speed: { min: 60, max: 140 },
            lifetime: { min: 0.1, max: 0.22 },
            spread: Math.PI * 2,
            friction: 0.85,
            particleType: 'spark',
          },
        ],
      },
    ],
  });
}

registerHitSpark(WORLD_VFX.HIT_PHYSICAL, '#ffffff', '#ffb347');
registerHitSpark(WORLD_VFX.HIT_MAGIC, '#b39ddb', '#5c6bc0');
registerHitSpark(WORLD_VFX.HIT_TRUE, '#ffffff', '#fff59d');

registerAbilityVFX({
  abilityId: WORLD_VFX.LEVEL_UP,
  phases: [
    {
      name: 'burst',
      delay: 0,
      duration: 0.8,
      anchor: 'caster',
      effects: [
        {
          type: 'expanding_ring',
          color: '#ffd54f',
          startRadius: 10,
          endRadius: 70,
          thickness: 4,
          duration: 0.5,
          fadeOut: true,
        },
        {
          type: 'rising_particles',
          count: 16,
          color: '#ffe082',
          size: { min: 2, max: 4 },
          speed: { min: 40, max: 90 },
          spread: 50,
          lifetime: { min: 0.5, max: 0.9 },
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: WORLD_VFX.CHAMPION_DEATH,
  phases: [
    {
      name: 'fall',
      delay: 0,
      duration: 1,
      anchor: 'caster',
      effects: [
        {
          type: 'shockwave',
          color: '#9e9e9e',
          startRadius: 10,
          endRadius: 90,
          thickness: 6,
          duration: 0.4,
        },
        {
          type: 'particle_burst',
          count: 20,
          color: '#b0bec5',
          colorSecondary: '#546e7a',
          size: { min: 2, max: 5 },
          speed: { min: 40, max: 120 },
          lifetime: { min: 0.5, max: 0.9 },
          spread: Math.PI * 2,
          gravity: 120,
          particleType: 'square',
        },
        {
          type: 'rising_particles',
          count: 12,
          color: '#eceff1',
          size: { min: 2, max: 3 },
          speed: { min: 20, max: 50 },
          spread: 30,
          lifetime: { min: 0.8, max: 1.2 },
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: WORLD_VFX.RESPAWN,
  phases: [
    {
      name: 'pillar',
      delay: 0,
      duration: 0.9,
      anchor: 'caster',
      effects: [
        {
          type: 'ground_circle',
          color: '#80deea',
          fillColor: 'rgba(128, 222, 234, 0.15)',
          radius: 45,
          duration: 0.9,
          fadeOut: true,
        },
        {
          type: 'rising_particles',
          count: 24,
          color: '#b2ebf2',
          size: { min: 2, max: 4 },
          speed: { min: 60, max: 120 },
          spread: 35,
          lifetime: { min: 0.5, max: 0.9 },
          particleType: 'spark',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: WORLD_VFX.RECALL_ARRIVE,
  phases: [
    {
      name: 'arrive',
      delay: 0,
      duration: 0.6,
      anchor: 'caster',
      effects: [
        {
          type: 'expanding_ring',
          color: '#4fc3f7',
          startRadius: 50,
          endRadius: 5,
          thickness: 5,
          duration: 0.35,
          fadeOut: true,
        },
        {
          type: 'particle_burst',
          count: 18,
          color: '#e1f5fe',
          colorSecondary: '#4fc3f7',
          size: { min: 2, max: 4 },
          speed: { min: 60, max: 150 },
          lifetime: { min: 0.3, max: 0.6 },
          spread: Math.PI * 2,
          friction: 0.9,
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: WORLD_VFX.TOWER_DESTROYED,
  phases: [
    {
      name: 'blast',
      delay: 0,
      duration: 0.6,
      anchor: 'caster',
      effects: [
        {
          type: 'screen_flash',
          color: '#ffcc80',
          duration: 0.25,
          maxAlpha: 0.25,
        },
        {
          type: 'shockwave',
          color: '#ff9800',
          startRadius: 20,
          endRadius: 220,
          thickness: 14,
          duration: 0.5,
        },
        {
          type: 'particle_burst',
          count: 40,
          color: '#ffb74d',
          colorSecondary: '#e65100',
          size: { min: 3, max: 7 },
          speed: { min: 120, max: 280 },
          lifetime: { min: 0.4, max: 0.9 },
          spread: Math.PI * 2,
          gravity: 300,
          particleType: 'square',
        },
      ],
    },
    {
      name: 'rubble',
      delay: 0.2,
      duration: 1.5,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 30,
          color: '#8d6e63',
          colorSecondary: '#4e342e',
          size: { min: 3, max: 6 },
          speed: { min: 40, max: 120 },
          lifetime: { min: 0.8, max: 1.4 },
          spread: Math.PI * 2,
          gravity: 200,
          friction: 0.92,
          particleType: 'square',
        },
        {
          type: 'rising_particles',
          count: 20,
          color: '#9e9e9e',
          size: { min: 4, max: 8 },
          speed: { min: 20, max: 50 },
          spread: 80,
          lifetime: { min: 1, max: 1.5 },
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: WORLD_VFX.CREATURE_DEATH,
  phases: [
    {
      name: 'puff',
      delay: 0,
      duration: 0.6,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 14,
          color: '#a1887f',
          colorSecondary: '#5d4037',
          size: { min: 2, max: 5 },
          speed: { min: 40, max: 110 },
          lifetime: { min: 0.3, max: 0.6 },
          spread: Math.PI * 2,
          gravity: 150,
          particleType: 'square',
        },
      ],
    },
  ],
});
