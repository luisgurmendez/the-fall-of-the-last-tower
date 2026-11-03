/**
 * Gorath Ability Handlers
 *
 * Gorath - The Stone Guardian
 * Tank with crowd control and durability.
 *
 * NOTE: All Gorath abilities use generic execution.
 * - Q (Ground Slam): AoE damage + slow
 * - W (Stone Skin): Self armor/MR buff
 * - E (Defiant Roar): AoE taunt (what a taunt does is crowd control:
 *   ServerChampion.followTaunt, ServerJungleCreature, InputHandler)
 * - R (Earthquake): AoE damage + knockup with delay
 *
 * No custom handlers: the generic no_target path lands each area after its
 * aoeDelay (the windup the clients draw).
 */

/**
 * Register Gorath ability handlers.
 * Currently empty - all abilities use generic execution.
 */
export function registerGorathHandlers(): void {
  // All abilities use generic execution - no custom handlers needed
}
