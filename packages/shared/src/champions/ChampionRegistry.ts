/**
 * Champion Registry - Definitions for all playable champions.
 *
 * This registry contains the static data for all champions,
 * shared between client and server.
 *
 * Champion definitions are now organized in individual files
 * under the definitions/ folder.
 */

import type { ChampionDefinition } from '../types/champions';

// Import champion definitions from individual files
import {
  WarriorDefinition,
  MagnusDefinition,
  ElaraDefinition,
  VexDefinition,
  GorathDefinition,
  VileDefinition,
} from './definitions';

// Re-export individual definitions for backward compatibility
export {
  WarriorDefinition,
  MagnusDefinition,
  ElaraDefinition,
  VexDefinition,
  GorathDefinition,
  VileDefinition,
};

// =============================================================================
// Registry
// =============================================================================

/**
 * All champion definitions.
 */
export const CHAMPION_DEFINITIONS: Record<string, ChampionDefinition> = {
  warrior: WarriorDefinition,
  magnus: MagnusDefinition,
  elara: ElaraDefinition,
  vex: VexDefinition,
  gorath: GorathDefinition,
  vile: VileDefinition,
};

/**
 * Get a champion definition by ID.
 */
export function getChampionDefinition(
  id: string,
): ChampionDefinition | undefined {
  return CHAMPION_DEFINITIONS[id];
}

/**
 * Get all champion IDs.
 */
export function getAllChampionIds(): string[] {
  return Object.keys(CHAMPION_DEFINITIONS);
}

/**
 * Get all champion definitions.
 */
export function getAllChampionDefinitions(): ChampionDefinition[] {
  return Object.values(CHAMPION_DEFINITIONS);
}
