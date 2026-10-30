/**
 * Lume ability VFX definitions. Registered when this module is imported
 * (see ./index.ts).
 */

import { CHAMPION_COLORS } from '../VFXColors';
import { registerAbilityVFX } from '../VFXRegistryStore';

registerAbilityVFX({
  abilityId: 'lume_send_light',
  phases: [
    {
      name: 'cast',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'particle_burst',
          count: 6,
          color: CHAMPION_COLORS.lume.primary,
          size: { min: 3, max: 5 },
          speed: { min: 40, max: 70 },
          lifetime: { min: 0.2, max: 0.3 },
          spread: Math.PI / 3,
          particleType: 'star',
          glowIntensity: 1.5,
        },
      ],
    },
    {
      name: 'arrive',
      delay: 0.2,
      duration: 0.3,
      anchor: 'ground_target',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.lume.primary,
          startRadius: 5,
          endRadius: 35,
          thickness: 3,
          duration: 0.25,
        },
        {
          type: 'particle_burst',
          count: 8,
          color: CHAMPION_COLORS.lume.accent,
          size: { min: 2, max: 4 },
          speed: { min: 50, max: 90 },
          lifetime: { min: 0.25, max: 0.4 },
          spread: Math.PI * 2,
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'lume_warmth',
  phases: [
    {
      name: 'pulse',
      delay: 0,
      duration: 0.3,
      anchor: 'caster', // From orb position
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.lume.primary,
          startRadius: 10,
          endRadius: 180,
          thickness: 4,
          duration: 0.3,
        },
      ],
    },
    {
      name: 'effect',
      delay: 0.15,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'rising_particles',
          count: 12,
          color: '#90EE90', // Green for heal
          size: { min: 2, max: 4 },
          speed: { min: 30, max: 50 },
          spread: 160,
          lifetime: { min: 0.3, max: 0.5 },
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'lume_dazzle_step',
  phases: [
    {
      name: 'dash',
      delay: 0,
      duration: 0.25,
      anchor: 'caster',
      effects: [
        {
          type: 'dash_afterimage',
          color: CHAMPION_COLORS.lume.primary,
          imageCount: 5,
          fadeSpeed: 0.85,
          duration: 0.25,
        },
        {
          type: 'trail',
          color: CHAMPION_COLORS.lume.accent,
          thickness: 5,
          duration: 0.25,
          fadeLength: 60,
        },
      ],
    },
    {
      name: 'arrive',
      delay: 0.2,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.lume.secondary,
          startRadius: 20,
          endRadius: 100,
          thickness: 5,
          duration: 0.25,
        },
        {
          type: 'screen_flash',
          color: CHAMPION_COLORS.lume.accent,
          duration: 0.1,
          maxAlpha: 0.2,
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'lume_r',
  phases: [
    // Phase 1: Charge - energy gathering inward
    {
      name: 'charge',
      delay: 0,
      duration: 0.5,
      anchor: 'target',
      effects: [
        // Pulsing ground indicator
        {
          type: 'ground_circle',
          color: CHAMPION_COLORS.lume.primary,
          radius: 220,
          duration: 0.5,
          fadeIn: true,
          pulseSpeed: 6,
        },
        // First wave of inward particles (gold)
        {
          type: 'particle_burst',
          count: 25,
          color: CHAMPION_COLORS.lume.primary,
          size: { min: 3, max: 5 },
          speed: { min: -120, max: -60 },
          lifetime: { min: 0.4, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'star',
          glowIntensity: 1.5,
        },
        // Second wave of inward particles (white/bright)
        {
          type: 'particle_burst',
          count: 15,
          color: CHAMPION_COLORS.lume.accent,
          size: { min: 2, max: 4 },
          speed: { min: -100, max: -50 },
          lifetime: { min: 0.35, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'circle',
          glowIntensity: 2,
        },
      ],
    },
    // Phase 2: Core brightening just before explosion
    {
      name: 'core_brighten',
      delay: 0.35,
      duration: 0.15,
      anchor: 'target',
      effects: [
        // Bright core shrinking circle
        {
          type: 'expanding_ring',
          color: CHAMPION_COLORS.lume.accent,
          startRadius: 60,
          endRadius: 20,
          thickness: 25,
          duration: 0.15,
          fadeOut: false,
        },
        // Final inward rush
        {
          type: 'particle_burst',
          count: 20,
          color: CHAMPION_COLORS.lume.accent,
          size: { min: 4, max: 6 },
          speed: { min: -200, max: -150 },
          lifetime: { min: 0.12, max: 0.15 },
          spread: Math.PI * 2,
          particleType: 'star',
          glowIntensity: 3,
        },
      ],
    },
    // Phase 3: Main explosion - multiple shockwaves
    {
      name: 'explosion_shockwaves',
      delay: 0.48,
      duration: 0.5,
      anchor: 'target',
      effects: [
        // Inner shockwave (fastest, brightest)
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.lume.accent,
          startRadius: 20,
          endRadius: 200,
          thickness: 25,
          duration: 0.3,
        },
        // Middle shockwave (gold)
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.lume.primary,
          startRadius: 15,
          endRadius: 260,
          thickness: 18,
          duration: 0.4,
        },
        // Outer shockwave (softer)
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.lume.secondary,
          startRadius: 10,
          endRadius: 320,
          thickness: 12,
          duration: 0.5,
        },
      ],
    },
    // Phase 4: Particle explosion bursts
    {
      name: 'explosion_particles',
      delay: 0.48,
      duration: 0.8,
      anchor: 'target',
      effects: [
        // Core flash particles (white, fast)
        {
          type: 'particle_burst',
          count: 30,
          color: CHAMPION_COLORS.lume.accent,
          size: { min: 5, max: 10 },
          speed: { min: 300, max: 450 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'star',
          glowIntensity: 3,
        },
        // Main explosion particles (gold stars)
        {
          type: 'particle_burst',
          count: 50,
          color: CHAMPION_COLORS.lume.primary,
          size: { min: 4, max: 8 },
          speed: { min: 150, max: 300 },
          lifetime: { min: 0.5, max: 0.9 },
          spread: Math.PI * 2,
          particleType: 'star',
          glowIntensity: 2,
        },
        // Slower trailing sparks
        {
          type: 'particle_burst',
          count: 35,
          color: CHAMPION_COLORS.lume.secondary,
          size: { min: 3, max: 6 },
          speed: { min: 80, max: 180 },
          lifetime: { min: 0.7, max: 1.2 },
          spread: Math.PI * 2,
          particleType: 'spark',
          gravity: 50,
          friction: 0.5,
        },
      ],
    },
    // Phase 5: Rising embers (float upward after explosion)
    {
      name: 'rising_embers',
      delay: 0.55,
      duration: 1.5,
      anchor: 'target',
      effects: [
        {
          type: 'rising_particles',
          count: 25,
          color: CHAMPION_COLORS.lume.primary,
          size: { min: 2, max: 5 },
          speed: { min: 40, max: 80 },
          lifetime: { min: 1.0, max: 1.5 },
          spread: 180,
          particleType: 'star',
        },
        {
          type: 'rising_particles',
          count: 15,
          color: CHAMPION_COLORS.lume.accent,
          size: { min: 2, max: 4 },
          speed: { min: 50, max: 100 },
          lifetime: { min: 0.8, max: 1.2 },
          spread: 120,
          particleType: 'circle',
        },
      ],
    },
    // Phase 6: Screen flash for impact
    {
      name: 'screen_impact',
      delay: 0.48,
      duration: 0.35,
      anchor: 'target',
      effects: [
        {
          type: 'screen_flash',
          color: CHAMPION_COLORS.lume.accent,
          duration: 0.35,
          maxAlpha: 0.55,
        },
      ],
    },
  ],
});
