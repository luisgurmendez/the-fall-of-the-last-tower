/**
 * Warrior ability VFX definitions. Registered when this module is imported
 * (see ./index.ts).
 */

import { CHAMPION_COLORS } from '../VFXColors';
import { registerAbilityVFX } from '../VFXRegistryStore';

registerAbilityVFX({
  abilityId: 'warrior_slash',
  phases: [
    {
      name: 'swing',
      delay: 0,
      duration: 0.2,
      anchor: 'caster',
      effects: [
        {
          type: 'cone_slash',
          color: 'rgba(255, 165, 0, 0.6)',
          radius: 100,
          arcAngle: Math.PI / 2, // 90 degrees
          duration: 0.2,
          sparkCount: 8,
          sparkColor: CHAMPION_COLORS.warrior.secondary,
        },
      ],
    },
    {
      name: 'impact',
      delay: 0.15,
      duration: 0.2,
      anchor: 'target',
      effects: [
        {
          type: 'particle_burst',
          count: 6,
          color: '#FFFFFF',
          size: { min: 2, max: 4 },
          speed: { min: 50, max: 100 },
          lifetime: { min: 0.15, max: 0.25 },
          spread: Math.PI * 2,
          particleType: 'spark',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'warrior_shield',
  phases: [
    {
      name: 'activate',
      delay: 0,
      duration: 0.15,
      anchor: 'caster',
      effects: [
        {
          type: 'shield_bubble',
          color: CHAMPION_COLORS.warrior.primary,
          radius: 30,
          duration: 3.0,
        },
        {
          type: 'particle_burst',
          count: 12,
          color: CHAMPION_COLORS.warrior.accent,
          size: { min: 3, max: 5 },
          speed: { min: 30, max: 60 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'square',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'warrior_charge',
  phases: [
    {
      name: 'dash',
      delay: 0,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'dash_afterimage',
          color: CHAMPION_COLORS.warrior.primary,
          imageCount: 5,
          fadeSpeed: 0.8,
          duration: 0.3,
        },
        {
          type: 'trail',
          color: CHAMPION_COLORS.warrior.accent,
          thickness: 4,
          duration: 0.3,
          fadeLength: 60,
        },
      ],
    },
    {
      name: 'hit',
      delay: 0.25,
      duration: 0.2,
      anchor: 'target',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.warrior.secondary,
          startRadius: 10,
          endRadius: 40,
          thickness: 8,
          duration: 0.2,
        },
        {
          type: 'particle_burst',
          count: 8,
          color: '#87CEEB', // Ice blue for slow
          size: { min: 3, max: 5 },
          speed: { min: 40, max: 80 },
          lifetime: { min: 0.3, max: 0.5 },
          spread: Math.PI * 2,
          particleType: 'star',
        },
      ],
    },
  ],
});

registerAbilityVFX({
  abilityId: 'warrior_ultimate',
  phases: [
    {
      name: 'leap',
      delay: 0,
      duration: 0.3,
      anchor: 'caster',
      effects: [
        {
          type: 'trail',
          color: CHAMPION_COLORS.warrior.secondary,
          thickness: 6,
          duration: 0.3,
          fadeLength: 80,
        },
      ],
    },
    {
      name: 'impact',
      delay: 0.25,
      duration: 0.3,
      anchor: 'ground_target',
      effects: [
        {
          type: 'shockwave',
          color: CHAMPION_COLORS.warrior.primary,
          startRadius: 20,
          endRadius: 80,
          thickness: 12,
          duration: 0.3,
        },
        {
          type: 'particle_burst',
          count: 20,
          color: CHAMPION_COLORS.warrior.accent,
          size: { min: 3, max: 6 },
          speed: { min: 80, max: 150 },
          lifetime: { min: 0.4, max: 0.6 },
          spread: Math.PI * 2,
          particleType: 'square',
          gravity: 200,
        },
        {
          type: 'rising_particles',
          count: 6,
          color: '#FFD700', // Stun stars
          size: { min: 4, max: 6 },
          speed: { min: 20, max: 40 },
          spread: 30,
          lifetime: { min: 0.5, max: 0.8 },
          particleType: 'star',
        },
      ],
    },
  ],
});
