/**
 * Passive Registry - Definitions for all champion passive abilities.
 *
 * This registry contains the static data for passive abilities,
 * shared between client and server.
 *
 * Passive definitions are organized with their champions
 * in the champions/definitions/ folder.
 */

import type { PassiveAbilityDefinition } from '../types/abilities';

// Import passive definitions from champion files
import {
  WarriorPassive,
  MagnusPassive,
  ElaraPassive,
  VexPassive,
  GorathPassive,
  VilePassive,
} from '../champions/definitions';

// Re-export individual passives for convenience
export {
  WarriorPassive,
  MagnusPassive,
  ElaraPassive,
  VexPassive,
  GorathPassive,
  VilePassive,
};

// =============================================================================
// Registry
// =============================================================================

/**
 * All passive ability definitions.
 */
export const PASSIVE_DEFINITIONS: Record<string, PassiveAbilityDefinition> = {
  warrior_passive: WarriorPassive,
  magnus_passive: MagnusPassive,
  elara_passive: ElaraPassive,
  vex_passive: VexPassive,
  gorath_passive: GorathPassive,
  vile_passive: VilePassive,
};

/**
 * Get a passive ability definition by ID.
 */
export function getPassiveDefinition(id: string): PassiveAbilityDefinition | undefined {
  return PASSIVE_DEFINITIONS[id];
}

/**
 * Get all passive IDs.
 */
export function getAllPassiveIds(): string[] {
  return Object.keys(PASSIVE_DEFINITIONS);
}

/**
 * Get passive definition for a champion by champion ID.
 */
export function getChampionPassive(championId: string): PassiveAbilityDefinition | undefined {
  return PASSIVE_DEFINITIONS[`${championId}_passive`];
}

/**
 * Create default passive state.
 */
export function createDefaultPassiveState(): import('../types/abilities').PassiveState {
  return {
    isActive: false,
    cooldownRemaining: 0,
    stacks: 0,
    stackTimeRemaining: 0,
    nextIntervalIn: 0,
  };
}
