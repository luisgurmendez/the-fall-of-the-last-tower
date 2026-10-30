/**
 * Gorath Ability Handlers
 *
 * Gorath - The Stone Guardian
 * Tank with crowd control and durability.
 *
 * NOTE: All Gorath abilities use generic execution.
 * - Q (Ground Slam): AoE damage + slow
 * - W (Stone Skin): Self armor/MR buff
 * - E (Defiant Roar): AoE taunt
 * - R (Earthquake): AoE damage + knockup with delay
 *
 * No custom handlers yet. The generic no_target path ignores aoeDelay and
 * applies Q/E/R effects to Gorath and his allies as well; see KNOWN_GAPS in
 * test/AbilityCoverageContract.test.ts.
 */

/**
 * Register Gorath ability handlers.
 * Currently empty - all abilities use generic execution.
 */
export function registerGorathHandlers(): void {
  // All abilities use generic execution - no custom handlers needed
}
