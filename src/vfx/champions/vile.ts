/**
 * Vile ability VFX definitions. Registered when this module is imported
 * (see ./index.ts).
 */

import { CHAMPION_COLORS } from '../VFXColors';
import { registerAbilityVFX } from '../VFXRegistryStore';

registerAbilityVFX({
  abilityId: 'vile_arrow',
  phases: [
    {
      name: 'travel',
      delay: 0,
      duration: 0.6,
      anchor: 'caster',
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.vile.primary,
          thickness: 4,
          duration: 0.6,
          fadeLength: 35,
        },
      ],
    },
    {
      name: 'hit',
      delay: 0,
      duration: 0.2,
      anchor: 'target',
      effects: [
        {
          type: 'particle_burst',
          count: 10,
          color: CHAMPION_COLORS.vile.primary,
          colorSecondary: CHAMPION_COLORS.vile.accent,
          size: { min: 3, max: 5 },
          speed: { min: 50, max: 90 },
          lifetime: { min: 0.2, max: 0.35 },
          spread: Math.PI * 2,
          particleType: 'spark',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vile_veil',
  phases: [
    {
      name: 'activate',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 16,
          color: CHAMPION_COLORS.vile.secondary,
          size: { min: 4, max: 7 },
          speed: { min: 50, max: 80 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'circle',
        },
      ],
    },
    {
      name: 'active',
      delay: 0.15,
      duration: 2.0,
      anchor: 'caster',
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.vile.primary,
          thickness: 4,
          duration: 2.0,
          fadeLength: 25,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vile_trap',
  phases: [
    {
      name: 'place',
      delay: 0,
      duration: 0.2,
      anchor: 'ground_target',
      effects: [
        {
          type: 'particle_burst',
          count: 8,
          color: CHAMPION_COLORS.vile.secondary,
          size: { min: 2, max: 4 },
          speed: { min: 20, max: 40 },
          lifetime: { min: 0.2, max: 0.35 },
          spread: Math.PI * 2,
          direction: Math.PI / 2, // Downward
          particleType: 'circle',
        },
      ],
    },
    {
      name: 'trigger',
      delay: 0,
      duration: 0.4,
      anchor: 'ground_target',
      effects: [
        {
          type: 'particle_burst',
          count: 15,
          color: CHAMPION_COLORS.vile.primary,
          size: { min: 3, max: 6 },
          speed: { min: 60, max: 100 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          direction: -Math.PI / 2, // Upward
          particleType: 'spark',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vile_restoration',
  phases: [
    {
      name: 'transform',
      delay: 0,
      duration: 0.5,
      anchor: 'caster',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.vile.primary,
          startRadius: 20,
          endRadius: 100,
          thickness: 10,
          duration: 0.4,
        },
        {
          type: 'particle_burst',
          count: 25,
          color: CHAMPION_COLORS.vile.accent,
          size: { min: 3, max: 6 },
          speed: { min: 80, max: 140 },
          lifetime: { min: 0.4, max: 0.6 },
          spread: Math.PI * 2,
          particleType: 'spark',
        },
      ],
    },
    {
      name: 'active',
      delay: 0.4,
      duration: 10.0,
      anchor: 'caster',
      effects: [
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.vile.primary,
          radius: 80,
          duration: 10.0,
          pulseSpeed: 1.5,
        },
        {
          type: 'orbiting_particles',
          count: 6,
          color: CHAMPION_COLORS.vile.accent,
          size: 5,
          orbitRadius: 50,
          orbitSpeed: 1.5,
          duration: 10.0,
        },
      ],
    },
  ],
});
