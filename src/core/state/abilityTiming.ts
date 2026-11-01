/**
 * When an ability takes effect after it's cast, as players see it: an area
 * lands after its aoeDelay (as on the server), a projectile leaves the hand
 * a moment after the cast, Kael's leap lands on its target; anything else
 * takes effect at once. Its VFX (src/vfx/champions/), its sounds
 * (src/audio/abilitySounds.ts) and the champion's cast strip (stripBody.ts)
 * all play their blow then, and the cast animation lasts past it
 * (gameEvents.ts).
 */

import { getAbilityDefinition } from '@siege/shared';

/** Abilities whose moment isn't an area landing */
const IMPACT_TIMES: Record<string, number> = {
  // Projectiles: thrown a moment into the cast
  magnus_fireball: 0.25,
  vex_shuriken: 0.2,
  vile_black_arrows: 0.2,
  // Kael's leap: the blade of light lands on his target
  warrior_ultimate: 0.37,
  // Lume's orb lands where it was sent
  lume_q: 0.2,
};

/** "At once": the first frames of the cast */
const AT_ONCE = 0.12;

/** Seconds from an ability's cast until it takes effect */
export function abilityImpactTime(abilityId: string): number {
  return IMPACT_TIMES[abilityId] ?? (getAbilityDefinition(abilityId)?.aoeDelay || AT_ONCE);
}
