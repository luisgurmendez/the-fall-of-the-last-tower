/**
 * Elara ability VFX definitions. Registered when this module is imported
 * (see ./index.ts).
 */

import { CHAMPION_COLORS } from '../VFXColors';
import { registerAbilityVFX } from '../VFXRegistryStore';

registerAbilityVFX({
  abilityId: 'elara_heal',
  phases: [
    {
      name: 'cast',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 8,
          color: CHAMPION_COLORS.elara.primary,
          size: { min: 3, max: 5 },
          speed: { min: 20, max: 40 },
          lifetime: { min: 0.2, max: 0.3 },
          spread: Math.PI / 2,
          direction: 0,
          particleType: 'star',
          glowIntensity: 1.5,
        },
      ],
    },
    {
      name: 'impact',
      delay: 0.1,
      duration: 0.5,
      anchor: 'target',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.elara.primary,
          startRadius: 0,
          endRadius: 60,
          thickness: 4,
          duration: 0.4,
        },
        {
          type: 'rising_particles',
          count: 10,
          color: CHAMPION_COLORS.elara.accent,
          size: { min: 2, max: 4 },
          speed: { min: 30, max: 60 },
          spread: 30,
          lifetime: { min: 0.4, max: 0.7 },
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'elara_barrier',
  phases: [
    {
      name: 'cast',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.elara.primary,
          startRadius: 20,
          endRadius: 40,
          thickness: 3,
          duration: 0.2,
        },
      ],
    },
    {
      name: 'active',
      delay: 0.15,
      duration: 2.5,
      anchor: 'target',
      effects: [
        {
          type: 'shield_bubble',
          color: CHAMPION_COLORS.elara.primary,
          radius: 28,
          duration: 2.5,
          pulseSpeed: 3,
          hexagonal: true,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'elara_speed',
  phases: [
    {
      name: 'cast',
      delay: 0,
      duration: 0.15,
      anchor: 'caster',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.elara.primary,
          startRadius: 10,
          endRadius: 200,
          thickness: 4,
          duration: 0.4,
        },
      ],
    },
    {
      name: 'active',
      delay: 0.1,
      duration: 0.5,
      anchor: 'caster',
      effects: [
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.elara.primary,
          fillColor: 'rgba(255, 215, 0, 0.15)',
          radius: 200,
          duration: 0.5,
          dashed: true,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'elara_resurrection',
  phases: [
    {
      name: 'windup',
      delay: 0,
      duration: 0.5,
      anchor: 'caster',
      effects: [
        {
          type: 'rising_particles',
          count: 20,
          color: CHAMPION_COLORS.elara.secondary,
          size: { min: 2, max: 4 },
          speed: { min: 80, max: 120 },
          spread: 40,
          lifetime: { min: 0.4, max: 0.6 },
          particleType: 'star',
        },
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.elara.primary,
          radius: 300,
          duration: 0.5,
          fadeIn: true,
        },
      ],
    },
    {
      name: 'burst',
      delay: 0.45,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.elara.secondary,
          startRadius: 20,
          endRadius: 320,
          thickness: 20,
          duration: 0.3,
        },
        {
          type: 'screen_flash',
          color: CHAMPION_COLORS.elara.secondary,
          duration: 0.15,
          maxAlpha: 0.3,
        },
      ],
    },
    {
      name: 'heal',
      delay: 0.5,
      duration: 0.5,
      anchor: 'caster',
      effects: [
        {
          type: 'rising_particles',
          count: 30,
          color: CHAMPION_COLORS.elara.primary,
          size: { min: 3, max: 6 },
          speed: { min: 40, max: 80 },
          spread: 280,
          lifetime: { min: 0.5, max: 0.8 },
          particleType: 'star',
        },
      ],
    },
  ],
});
