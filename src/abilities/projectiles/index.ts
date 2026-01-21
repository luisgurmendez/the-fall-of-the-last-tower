/**
 * Ability projectiles and area effects.
 *
 * This module provides game objects for abilities that:
 * - Travel through the map (skillshots)
 * - Create zones on the ground (AoE)
 * - Apply effects to units they hit
 */

export * from './types';
export { AbilityProjectile } from './AbilityProjectile';
export { AreaOfEffect } from './AreaOfEffect';
