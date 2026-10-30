/**
 * Gorath ability VFX definitions. Registered when this module is imported
 * (see ./index.ts).
 */

import { CHAMPION_COLORS } from '../VFXColors';
import { registerAbilityVFX } from '../VFXRegistryStore';

registerAbilityVFX({
  abilityId: 'gorath_slam',
  phases: [
    {
      name: 'windup',
      delay: 0,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 6,
          color: CHAMPION_COLORS.gorath.primary,
          size: { min: 2, max: 4 },
          speed: { min: 10, max: 30 },
          lifetime: { min: 0.2, max: 0.3 },
          spread: Math.PI * 2,
          particleType: 'square',
        },
      ],
    },
    {
      name: 'impact',
      delay: 0.25,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.gorath.primary,
          startRadius: 20,
          endRadius: 150,
          thickness: 10,
          duration: 0.2,
        },
        {
          type: 'particle_burst',
          count: 16,
          color: CHAMPION_COLORS.gorath.secondary,
          size: { min: 4, max: 8 },
          speed: { min: 100, max: 180 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'square',
          gravity: 400,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'gorath_fortify',
  phases: [
    {
      name: 'activate',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'shield_bubble',
          color: CHAMPION_COLORS.gorath.primary,
          radius: 32,
          duration: 4.0,
        },
        {
          type: 'orbiting_particles',
          count: 4,
          color: CHAMPION_COLORS.gorath.secondary,
          size: 6,
          orbitRadius: 40,
          orbitSpeed: 2,
          duration: 4.0,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'gorath_taunt',
  phases: [
    {
      name: 'roar',
      delay: 0,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.gorath.accent,
          startRadius: 30,
          endRadius: 200,
          thickness: 8,
          duration: 0.3,
        },
        {
          type: 'expanding_ring',
          color: 'rgba(255, 140, 0, 0.5)',
          startRadius: 40,
          endRadius: 180,
          thickness: 3,
          duration: 0.25,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'gorath_earthquake',
  phases: [
    {
      name: 'windup',
      delay: 0,
      duration: 0.5,
      anchor: 'ground_target',
      effects: [
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.gorath.accent,
          radius: 250,
          duration: 0.5,
          pulseSpeed: 4,
        },
      ],
    },
    {
      name: 'eruption',
      delay: 0.45,
      duration: 0.3,
      anchor: 'ground_target',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.gorath.primary,
          startRadius: 30,
          endRadius: 260,
          thickness: 15,
          duration: 0.3,
        },
        {
          type: 'particle_burst',
          count: 30,
          color: CHAMPION_COLORS.gorath.secondary,
          size: { min: 5, max: 10 },
          speed: { min: 120, max: 220 },
          lifetime: { min: 0.5, max: 0.8 },
          spread: Math.PI * 2,
          particleType: 'square',
          gravity: 500,
        },
      ],
    },
  ],
});
