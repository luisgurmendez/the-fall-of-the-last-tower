/**
 * Ability Registry - Definitions for all champion abilities.
 *
 * This registry contains the static data for all abilities,
 * shared between client and server.
 *
 * Ability definitions are now organized with their champions
 * in the champions/definitions/ folder.
 */

import type { AbilityDefinition } from '../types/abilities';

// Import ability definitions from champion files
import {
  WarriorAbilities,
  WarriorSlash,
  WarriorShield,
  WarriorCharge,
  WarriorUltimate,
  MagnusAbilities,
  MagnusFireball,
  MagnusShield,
  MagnusMudGround,
  MagnusMeteor,
  ElaraAbilities,
  ElaraHeal,
  ElaraBarrier,
  ElaraSpeed,
  ElaraResurrection,
  VexAbilities,
  VexShuriken,
  VexShroud,
  VexDash,
  VexExecute,
  GorathAbilities,
  GorathSlam,
  GorathFortify,
  GorathTaunt,
  GorathEarthquake,
  VileAbilities,
  VileBlackArrows,
  VileVeilOfDarkness,
  VileRootsOfVilix,
  VileRestorationOfVilix,
} from '../champions/definitions';

// Re-export individual abilities for backward compatibility
export {
  // Warrior
  WarriorSlash,
  WarriorShield,
  WarriorCharge,
  WarriorUltimate,
  // Magnus
  MagnusFireball,
  MagnusShield,
  MagnusMudGround,
  MagnusMeteor,
  // Elara
  ElaraHeal,
  ElaraBarrier,
  ElaraSpeed,
  ElaraResurrection,
  // Vex
  VexShuriken,
  VexShroud,
  VexDash,
  VexExecute,
  // Gorath
  GorathSlam,
  GorathFortify,
  GorathTaunt,
  GorathEarthquake,
  // Vile
  VileBlackArrows,
  VileVeilOfDarkness,
  VileRootsOfVilix,
  VileRestorationOfVilix,
};

// =============================================================================
// Registry
// =============================================================================

/**
 * All ability definitions.
 */
export const ABILITY_DEFINITIONS: Record<string, AbilityDefinition> = {
  ...WarriorAbilities,
  ...MagnusAbilities,
  ...ElaraAbilities,
  ...VexAbilities,
  ...GorathAbilities,
  ...VileAbilities,
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
