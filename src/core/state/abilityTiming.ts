/**
 * When an ability takes effect after it's cast, as players see it: an area
 * lands after its aoeDelay (as on the server), a projectile is thrown when
 * the server throws it (its animation's projectile keyframe, less the cast
 * time already waited: at once, for those with one), a leap lands on its
 * target; anything else takes effect at once. Its VFX (src/vfx/champions/),
 * its sounds (src/audio/abilitySounds.ts) and the champion's cast strip
 * (stripBody.ts) all play their blow then, and the cast animation lasts past
 * it (gameEvents.ts).
 *
 * A leap's blow and Lume's orb arriving take as long as their trip: their
 * VFX and sounds wait for the server's `<id>_land` and `lume_q_arrive`
 * events; the times here only pace the cast animation.
 */

import { CHAMPION_DEFINITIONS, getAbilityDefinition, getCastTime } from '@siege/shared';

/** Typical trips, for the cast animation (the blow itself comes with its event) */
const TRIP_TIMES: Record<string, number> = {
  warrior_ultimate: 0.37,
  uruk_r: 0.35,
  fenris_e: 0.4,
  lume_q: 0.5,
};

/** "At once": the first frames of the cast */
const AT_ONCE = 0.12;

/** Seconds from an ability's cast until it takes effect */
export function abilityImpactTime(abilityId: string): number {
  const trip = TRIP_TIMES[abilityId];
  if (trip !== undefined) return trip;
  const definition = getAbilityDefinition(abilityId);
  if (definition?.targetType === 'skillshot' && definition.projectileSpeed) return projectileThrow(abilityId);
  return definition?.aoeDelay || AT_ONCE;
}

/** When the server throws a skillshot's projectile after its cast (packages/server generic/Skillshot.ts) */
function projectileThrow(abilityId: string): number {
  for (const champion of Object.values(CHAMPION_DEFINITIONS)) {
    const animation = champion.animations?.abilities?.[abilityId];
    const keyframe = animation?.keyframes.find(k => k.trigger.type === 'projectile');
    if (keyframe) return Math.max(0, keyframe.frame * animation!.baseFrameDuration - getCastTime(getAbilityDefinition(abilityId)!));
  }
  return 0;
}
