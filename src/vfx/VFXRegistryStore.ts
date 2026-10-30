/**
 * VFXRegistryStore - Storage for ability VFX definitions.
 *
 * Import from VFXRegistry.ts instead: it re-exports these functions and also
 * loads every champion's definitions. The champion modules register through
 * this module directly, because importing VFXRegistry from them would be an
 * import cycle.
 */

import type { AbilityVFXDefinition } from './VFXTypes';

/**
 * VFX Registry - stores all ability VFX definitions.
 */
const vfxRegistry: Map<string, AbilityVFXDefinition> = new Map();

/**
 * Register VFX for an ability.
 */
export function registerAbilityVFX(definition: AbilityVFXDefinition): void {
  vfxRegistry.set(definition.abilityId, definition);
}

/**
 * Get VFX definition for an ability.
 */
export function getAbilityVFX(
  abilityId: string
): AbilityVFXDefinition | undefined {
  return vfxRegistry.get(abilityId);
}

/**
 * Export all registered VFX for debugging.
 */
export function getAllRegisteredVFX(): string[] {
  return Array.from(vfxRegistry.keys());
}
