/**
 * Vex ability VFX definitions. Registered when this module is imported
 * (see ./index.ts).
 */

import { CHAMPION_COLORS } from '../VFXColors';
import { registerAbilityVFX } from '../VFXRegistryStore';

registerAbilityVFX({
  abilityId: 'vex_shuriken',
  phases: [
    {
      name: 'travel',
      delay: 0,
      duration: 0.5,
      anchor: 'caster',
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.vex.primary,
          thickness: 4,
          duration: 0.5,
          fadeLength: 30,
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
          count: 8,
          color: CHAMPION_COLORS.vex.primary,
          size: { min: 2, max: 4 },
          speed: { min: 40, max: 80 },
          lifetime: { min: 0.2, max: 0.3 },
          spread: Math.PI * 2,
          particleType: 'spark',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vex_shroud',
  phases: [
    {
      name: 'activate',
      delay: 0,
      duration: 0.15,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 12,
          color: CHAMPION_COLORS.vex.secondary,
          size: { min: 4, max: 8 },
          speed: { min: 60, max: 100 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'circle',
        },
      ],
    },
    {
      name: 'active',
      delay: 0.1,
      duration: 1.5,
      anchor: 'caster',
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.vex.accent,
          thickness: 3,
          duration: 1.5,
          fadeLength: 20,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vex_dash',
  phases: [
    {
      name: 'dash',
      delay: 0,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        // Sprite-based afterimages are drawn by src/render/champions/vex.ts
        // Just use a subtle trail effect here
        {
          type: 'trail',
          color: CHAMPION_COLORS.vex.primary,
          thickness: 4,
          duration: 0.3,
          fadeLength: 40,
        },
      ],
    },
    {
      name: 'arrive',
      delay: 0.25,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 10,
          color: CHAMPION_COLORS.vex.primary,
          size: { min: 3, max: 5 },
          speed: { min: 50, max: 90 },
          lifetime: { min: 0.2, max: 0.35 },
          spread: Math.PI * 2,
          particleType: 'spark',
          glowIntensity: 1.2,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'vex_ninja_mode',
  phases: [
    // Activation burst
    {
      name: 'activate',
      delay: 0,
      duration: 0.4,
      anchor: 'caster',
      effects: [
        {
          type: 'shockwave',
          color: '#9933FF', // Violet
          startRadius: 10,
          endRadius: 60,
          thickness: 8,
          duration: 0.35,
        },
        {
          type: 'particle_burst',
          count: 20,
          color: '#BB66FF', // Bright violet
          colorSecondary: CHAMPION_COLORS.vex.primary,
          size: { min: 4, max: 7 },
          speed: { min: 80, max: 140 },
          lifetime: { min: 0.4, max: 0.6 },
          spread: Math.PI * 2,
          particleType: 'spark',
          glowIntensity: 1.5,
        },
        {
          type: 'rising_particles',
          count: 12,
          color: '#9933FF', // Violet
          size: { min: 3, max: 5 },
          speed: { min: 60, max: 100 },
          spread: 40,
          lifetime: { min: 0.5, max: 0.8 },
          particleType: 'star',
        },
      ],
    },
    // Ongoing aura effect (violet particles emanating from Vex)
    {
      name: 'aura',
      delay: 0.3,
      duration: 15.0, // Full Ninja Mode duration
      anchor: 'caster',
      effects: [
        {
          type: 'orbiting_particles',
          count: 6,
          color: '#9933FF', // Violet
          size: 4,
          orbitRadius: 35,
          orbitSpeed: 3,
          duration: 15.0,
        },
        {
          type: 'rising_particles',
          count: 4,
          color: '#BB66FF', // Bright violet
          size: { min: 2, max: 4 },
          speed: { min: 30, max: 50 },
          spread: 25,
          lifetime: { min: 0.6, max: 1.0 },
          particleType: 'spark',
        },
      ],
    },
  ],
});
