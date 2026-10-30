/**
 * Magnus ability VFX definitions. Registered when this module is imported
 * (see ./index.ts).
 */

import { CHAMPION_COLORS } from '../VFXColors';
import { registerAbilityVFX } from '../VFXRegistryStore';

registerAbilityVFX({
  abilityId: 'magnus_fireball',
  phases: [
    {
      name: 'travel',
      delay: 0,
      duration: 1.0,
      anchor: 'caster', // Will follow projectile
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.magnus.primary,
          thickness: 8,
          duration: 1.0,
          fadeLength: 40,
        },
        {
          type: 'particle_burst',
          count: 3,
          color: CHAMPION_COLORS.magnus.secondary,
          size: { min: 2, max: 4 },
          speed: { min: 20, max: 40 },
          lifetime: { min: 0.2, max: 0.4 },
          spread: Math.PI,
          direction: Math.PI, // Behind projectile
          particleType: 'circle',
        },
      ],
    },
    {
      name: 'impact',
      delay: 0,
      duration: 0.3,
      anchor: 'target',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.magnus.primary,
          startRadius: 10,
          endRadius: 50,
          thickness: 6,
          duration: 0.25,
        },
        {
          type: 'particle_burst',
          count: 15,
          color: CHAMPION_COLORS.magnus.primary,
          colorSecondary: CHAMPION_COLORS.magnus.accent,
          size: { min: 3, max: 6 },
          speed: { min: 80, max: 140 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'spark',
          gravity: 100,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'magnus_shield',
  phases: [
    {
      name: 'activate',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'shield_bubble',
          color: '#9370DB', // Purple
          radius: 35,
          duration: 4.0,
          pulseSpeed: 2,
        },
        {
          type: 'particle_burst',
          count: 16,
          color: '#DDA0DD', // Plum
          size: { min: 2, max: 4 },
          speed: { min: 40, max: 70 },
          lifetime: { min: 0.4, max: 0.6 },
          spread: Math.PI * 2,
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'magnus_mud',
  phases: [
    {
      name: 'appear',
      delay: 0,
      duration: 0.2,
      anchor: 'ground_target',
      effects: [
        {
          type: 'particle_burst',
          count: 12,
          color: '#8B4513', // Brown
          size: { min: 4, max: 8 },
          speed: { min: 60, max: 100 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          direction: -Math.PI / 2, // Upward
          gravity: 300,
          particleType: 'circle',
        },
      ],
    },
    {
      name: 'active',
      delay: 0.15,
      duration: 2.0,
      anchor: 'ground_target',
      effects: [
        {
          type: 'ground_circle',
          color: '#5D4037', // Dark brown
          fillColor: 'rgba(139, 69, 19, 0.4)',
          radius: 150,
          duration: 2.0,
          pulseSpeed: 1,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'magnus_meteor',
  phases: [
    {
      name: 'summon',
      delay: 0,
      duration: 0.3,
      anchor: 'ground_target',
      effects: [
        {
          type: 'falling_particles',
          count: 20,
          color: CHAMPION_COLORS.magnus.primary,
          size: { min: 4, max: 8 },
          speed: { min: 100, max: 180 },
          spread: 200,
          lifetime: { min: 0.3, max: 0.5 },
          particleType: 'spark',
        },
      ],
    },
    {
      name: 'active',
      delay: 0.2,
      duration: 5.0,
      anchor: 'ground_target',
      effects: [
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.magnus.secondary,
          fillColor: 'rgba(255, 102, 0, 0.3)',
          radius: 200,
          duration: 5.0,
        },
        {
          type: 'rising_particles',
          count: 8,
          color: CHAMPION_COLORS.magnus.primary,
          size: { min: 3, max: 6 },
          speed: { min: 40, max: 80 },
          spread: 180,
          lifetime: { min: 0.5, max: 1.0 },
          particleType: 'spark',
        },
      ],
    },
  ],
});
