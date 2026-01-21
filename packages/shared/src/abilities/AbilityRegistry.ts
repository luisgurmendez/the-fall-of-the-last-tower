/**
 * Ability Registry - Definitions for all champion abilities.
 *
 * This registry contains the static data for all abilities,
 * shared between client and server.
 */

import type { AbilityDefinition, AbilityScaling } from '../types/abilities';

// =============================================================================
// Helper function for creating scaling
// =============================================================================

function scaling(base: number[], options?: {
  adRatio?: number;
  apRatio?: number;
  bonusHealthRatio?: number;
  maxHealthRatio?: number;
  missingHealthRatio?: number;
}): AbilityScaling {
  return {
    base,
    ...options,
  };
}

// =============================================================================
// WARRIOR ABILITIES
// =============================================================================

export const WarriorSlash: AbilityDefinition = {
  id: 'warrior_slash',
  name: 'Cleaving Strike',
  description: 'Slash enemies in a cone, dealing {damage} physical damage.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 5,
  manaCost: [40, 45, 50, 55, 60],
  cooldown: [6, 5.5, 5, 4.5, 4],
  range: 300,
  aoeRadius: 200,
  coneAngle: Math.PI / 2, // 90 degrees
  shape: 'cone',
  damage: {
    type: 'physical',
    scaling: scaling([60, 95, 130, 165, 200], { adRatio: 0.8 }),
  },
};

export const WarriorShield: AbilityDefinition = {
  id: 'warrior_shield',
  name: 'Iron Will',
  description: 'Gain a shield absorbing {shield} damage for 3 seconds.',
  type: 'active',
  targetType: 'self',
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [14, 13, 12, 11, 10],
  shield: {
    scaling: scaling([80, 120, 160, 200, 240], { bonusHealthRatio: 0.08 }),
    duration: 3,
  },
};

export const WarriorCharge: AbilityDefinition = {
  id: 'warrior_charge',
  name: 'Valiant Charge',
  description: 'Dash forward, dealing {damage} physical damage to enemies hit and slowing them by 30% for 1.5 seconds.',
  type: 'active',
  targetType: 'skillshot',
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [12, 11, 10, 9, 8],
  range: 500,
  dash: {
    speed: 1200,
    distance: 500,
  },
  aoeRadius: 60, // Hitbox width during dash
  damage: {
    type: 'physical',
    scaling: scaling([50, 85, 120, 155, 190], { adRatio: 0.6 }),
  },
  appliesEffects: ['slow_30'],
  effectDuration: 1.5,
};

export const WarriorUltimate: AbilityDefinition = {
  id: 'warrior_ultimate',
  name: 'Heroic Strike',
  description: 'Leap to target enemy and slam down, dealing {damage} physical damage and stunning them for 1 second.',
  type: 'active',
  targetType: 'target_enemy',
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [120, 100, 80],
  range: 600,
  damage: {
    type: 'physical',
    scaling: scaling([150, 250, 350], { adRatio: 1.0 }),
  },
  appliesEffects: ['stun'],
  effectDuration: 1,
};

// =============================================================================
// MAGNUS ABILITIES
// =============================================================================

export const MagnusFireball: AbilityDefinition = {
  id: 'magnus_fireball',
  name: 'Fireball',
  description: 'Launch a fireball that deals {damage} magic damage to the first enemy hit.',
  type: 'active',
  targetType: 'skillshot',
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [8, 7.5, 7, 6.5, 6],
  range: 900,
  projectileSpeed: 1200,
  projectileRadius: 30,
  shape: 'line',
  damage: {
    type: 'magic',
    scaling: scaling([80, 120, 160, 200, 240], { apRatio: 0.75 }),
  },
};

export const MagnusShield: AbilityDefinition = {
  id: 'magnus_shield',
  name: 'Arcane Barrier',
  description: 'Create a magical shield absorbing {shield} damage for 4 seconds.',
  type: 'active',
  targetType: 'self',
  maxRank: 5,
  manaCost: [80, 90, 100, 110, 120],
  cooldown: [18, 16, 14, 12, 10],
  shield: {
    scaling: scaling([60, 100, 140, 180, 220], { apRatio: 0.4 }),
    duration: 4,
  },
};

export const MagnusBlink: AbilityDefinition = {
  id: 'magnus_blink',
  name: 'Blink',
  description: 'Teleport to target location.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 5,
  manaCost: [90, 85, 80, 75, 70],
  cooldown: [22, 20, 18, 16, 14],
  range: 450,
  teleport: true,
};

export const MagnusMeteor: AbilityDefinition = {
  id: 'magnus_meteor',
  name: 'Meteor Strike',
  description: 'Call down a meteor at target location after 1 second, dealing {damage} magic damage to all enemies in the area.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [120, 100, 80],
  range: 800,
  aoeRadius: 250,
  aoeDelay: 1,
  shape: 'circle',
  damage: {
    type: 'magic',
    scaling: scaling([200, 350, 500], { apRatio: 0.9 }),
  },
};

// =============================================================================
// ELARA ABILITIES (Support)
// =============================================================================

export const ElaraHeal: AbilityDefinition = {
  id: 'elara_heal',
  name: 'Radiant Blessing',
  description: 'Heal target ally for {heal} health.',
  type: 'active',
  targetType: 'target_ally',
  maxRank: 5,
  manaCost: [70, 80, 90, 100, 110],
  cooldown: [10, 9, 8, 7, 6],
  range: 700,
  heal: {
    scaling: scaling([70, 110, 150, 190, 230], { apRatio: 0.5 }),
  },
};

export const ElaraBarrier: AbilityDefinition = {
  id: 'elara_barrier',
  name: 'Sacred Shield',
  description: 'Grant target ally a shield absorbing {shield} damage for 2.5 seconds.',
  type: 'active',
  targetType: 'target_ally',
  maxRank: 5,
  manaCost: [60, 65, 70, 75, 80],
  cooldown: [12, 11, 10, 9, 8],
  range: 700,
  shield: {
    scaling: scaling([60, 90, 120, 150, 180], { apRatio: 0.35 }),
    duration: 2.5,
  },
};

export const ElaraSpeed: AbilityDefinition = {
  id: 'elara_speed',
  name: 'Swift Grace',
  description: 'Grant yourself and nearby allies 30% bonus movement speed for 2 seconds.',
  type: 'active',
  targetType: 'no_target',
  maxRank: 5,
  manaCost: [50, 50, 50, 50, 50],
  cooldown: [15, 14, 13, 12, 11],
  aoeRadius: 400,
  shape: 'circle',
  appliesEffects: ['speed_30'],
  effectDuration: 2,
};

export const ElaraResurrection: AbilityDefinition = {
  id: 'elara_resurrection',
  name: 'Divine Intervention',
  description: 'Heal all allies in range for {heal} health and cleanse all debuffs.',
  type: 'active',
  targetType: 'no_target',
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [140, 120, 100],
  aoeRadius: 600,
  shape: 'circle',
  heal: {
    scaling: scaling([150, 250, 350], { apRatio: 0.6 }),
  },
};

// =============================================================================
// VEX ABILITIES (Assassin)
// =============================================================================

export const VexShuriken: AbilityDefinition = {
  id: 'vex_shuriken',
  name: 'Shadow Shuriken',
  description: 'Throw a shuriken that deals {damage} physical damage and marks the target for 4 seconds. Marked enemies take 10% increased damage from Vex.',
  type: 'active',
  targetType: 'skillshot',
  maxRank: 5,
  manaCost: [30, 30, 30, 30, 30], // Energy-based, low cost
  cooldown: [6, 5.5, 5, 4.5, 4],
  range: 700,
  projectileSpeed: 1500,
  projectileRadius: 20,
  shape: 'line',
  damage: {
    type: 'physical',
    scaling: scaling([40, 70, 100, 130, 160], { adRatio: 0.7 }),
  },
  appliesEffects: ['vex_mark'],
  effectDuration: 4,
};

export const VexShroud: AbilityDefinition = {
  id: 'vex_shroud',
  name: 'Shadow Shroud',
  description: 'Become invisible for 1.5 seconds and gain 20% bonus movement speed. Attacking or using abilities breaks stealth.',
  type: 'active',
  targetType: 'self',
  maxRank: 5,
  manaCost: [50, 45, 40, 35, 30],
  cooldown: [18, 16, 14, 12, 10],
  appliesEffects: ['vex_stealth', 'speed_20'],
  effectDuration: 1.5,
};

export const VexDash: AbilityDefinition = {
  id: 'vex_dash',
  name: 'Shadow Step',
  description: 'Dash to target location. If an enemy is marked, dash resets its cooldown.',
  type: 'active',
  targetType: 'ground_target',
  maxRank: 5,
  manaCost: [40, 40, 40, 40, 40],
  cooldown: [14, 12, 10, 8, 6],
  range: 400,
  dash: {
    speed: 1400,
    distance: 400,
  },
};

export const VexExecute: AbilityDefinition = {
  id: 'vex_execute',
  name: 'Death Mark',
  description: 'Mark target enemy champion. After 2 seconds, the mark detonates dealing {damage} physical damage plus 30% of damage dealt during the mark.',
  type: 'active',
  targetType: 'target_enemy',
  maxRank: 3,
  manaCost: [0, 0, 0], // Energy-based ultimate
  cooldown: [100, 80, 60],
  range: 400,
  damage: {
    type: 'physical',
    scaling: scaling([100, 200, 300], { adRatio: 1.0 }),
  },
  appliesEffects: ['vex_death_mark'],
  effectDuration: 2,
};

// =============================================================================
// GORATH ABILITIES (Tank)
// =============================================================================

export const GorathSlam: AbilityDefinition = {
  id: 'gorath_slam',
  name: 'Ground Slam',
  description: 'Slam the ground, dealing {damage} magic damage and slowing enemies by 40% for 1 second.',
  type: 'active',
  targetType: 'no_target',
  maxRank: 5,
  manaCost: [50, 55, 60, 65, 70],
  cooldown: [8, 7.5, 7, 6.5, 6],
  aoeRadius: 300,
  shape: 'circle',
  damage: {
    type: 'magic',
    scaling: scaling([60, 100, 140, 180, 220], { bonusHealthRatio: 0.04 }),
  },
  appliesEffects: ['slow_40'],
  effectDuration: 1,
};

export const GorathFortify: AbilityDefinition = {
  id: 'gorath_fortify',
  name: 'Stone Skin',
  description: 'Increase armor and magic resist by 30% for 4 seconds.',
  type: 'active',
  targetType: 'self',
  maxRank: 5,
  manaCost: [60, 60, 60, 60, 60],
  cooldown: [16, 15, 14, 13, 12],
  appliesEffects: ['gorath_fortify_buff'],
  effectDuration: 4,
};

export const GorathTaunt: AbilityDefinition = {
  id: 'gorath_taunt',
  name: 'Defiant Roar',
  description: 'Taunt all nearby enemies, forcing them to attack you for 1.5 seconds.',
  type: 'active',
  targetType: 'no_target',
  maxRank: 5,
  manaCost: [70, 70, 70, 70, 70],
  cooldown: [16, 15, 14, 13, 12],
  aoeRadius: 350,
  shape: 'circle',
  appliesEffects: ['taunt'],
  effectDuration: 1.5,
};

export const GorathEarthquake: AbilityDefinition = {
  id: 'gorath_earthquake',
  name: 'Earthquake',
  description: 'Create a massive earthquake dealing {damage} magic damage and knocking up all enemies for 1 second.',
  type: 'active',
  targetType: 'no_target',
  maxRank: 3,
  manaCost: [100, 100, 100],
  cooldown: [130, 110, 90],
  aoeRadius: 450,
  aoeDelay: 0.5, // Brief wind-up
  shape: 'circle',
  damage: {
    type: 'magic',
    scaling: scaling([150, 275, 400], { bonusHealthRatio: 0.06 }),
  },
  appliesEffects: ['knockup'],
  effectDuration: 1,
};

// =============================================================================
// Registry
// =============================================================================

/**
 * All ability definitions.
 */
export const ABILITY_DEFINITIONS: Record<string, AbilityDefinition> = {
  // Warrior
  warrior_slash: WarriorSlash,
  warrior_shield: WarriorShield,
  warrior_charge: WarriorCharge,
  warrior_ultimate: WarriorUltimate,

  // Magnus
  magnus_fireball: MagnusFireball,
  magnus_shield: MagnusShield,
  magnus_blink: MagnusBlink,
  magnus_meteor: MagnusMeteor,

  // Elara
  elara_heal: ElaraHeal,
  elara_barrier: ElaraBarrier,
  elara_speed: ElaraSpeed,
  elara_resurrection: ElaraResurrection,

  // Vex
  vex_shuriken: VexShuriken,
  vex_shroud: VexShroud,
  vex_dash: VexDash,
  vex_execute: VexExecute,

  // Gorath
  gorath_slam: GorathSlam,
  gorath_fortify: GorathFortify,
  gorath_taunt: GorathTaunt,
  gorath_earthquake: GorathEarthquake,
};

/**
 * Get an ability definition by ID.
 */
export function getAbilityDefinition(id: string): AbilityDefinition | undefined {
  return ABILITY_DEFINITIONS[id];
}

/**
 * Get all ability IDs.
 */
export function getAllAbilityIds(): string[] {
  return Object.keys(ABILITY_DEFINITIONS);
}

/**
 * Get ability definitions for a champion.
 */
export function getChampionAbilities(championId: string): AbilityDefinition[] {
  const prefix = `${championId}_`;
  return Object.values(ABILITY_DEFINITIONS).filter(
    (ability) => ability.id.startsWith(prefix)
  );
}
