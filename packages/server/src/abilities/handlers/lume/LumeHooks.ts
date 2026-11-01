/**
 * LumeHooks - Guiding Glow follows the Light Orb, and the Prismatic Beam
 *
 * Lume's passive and orb abilities depend on the Light Orb being alive (it
 * goes when she dies and comes back with her):
 * - Orb alive: passive active, Q/W/E enabled
 * - Orb destroyed: passive shows the orb respawn timer, Q/W/E disabled
 *
 * While she has lume_prism (Prismatic Beam, E) a beam runs from her to the
 * orb: enemies it touches take the E's damage once per cast and are slowed
 * while in it; allied champions crossing it are sped up.
 */

import { calculateAbilityValue, canAbilityAffectEntityType, EntityType, getAbilityDefinition, LUME_ORB_CONFIG, type Vector } from '@siege/shared';
import type { IChampionHooks } from '../../IChampionHooks';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerGameContext } from '../../../game/ServerGameContext';
import { entitiesInBand } from '../../generic/Line';
import { getScalingStats, applyEffectsToEntity } from '../../generic/AbilityHelpers';
import { findOrb } from './LumeEHandler';

/** The beam's slow and the allies' speed last this long, refreshed while they're in it */
const BEAM_EFFECT_REFRESH = 0.5;
const ALLY_SPEED_DURATION = 1;

export const lumeHooks: IChampionHooks = {
  championId: 'lume',

  updatePassiveState(champion: ServerChampion, context: ServerGameContext): void {
    const orb = findOrb(champion, context);
    if (!orb) return;

    if (orb.isDestroyed) {
      // Orb is destroyed - show respawn cooldown, disable abilities
      champion.passiveState.isActive = false;
      champion.passiveState.cooldownRemaining = (orb.toSnapshot() as { respawnTimeRemaining?: number }).respawnTimeRemaining ?? 0;
      champion.abilityStates.Q.isDisabled = true;
      champion.abilityStates.W.isDisabled = true;
      champion.abilityStates.E.isDisabled = true;
      return;
    }

    // Orb is alive - passive is active, enable abilities
    champion.passiveState.isActive = true;
    champion.passiveState.cooldownRemaining = 0;
    champion.abilityStates.Q.isDisabled = false;
    champion.abilityStates.W.isDisabled = false;
    champion.abilityStates.E.isDisabled = false;

    if (champion.hasEffect('lume_prism')) prismaticBeam(champion, orb.position, context);
  },
};

/** The beam from Lume to her orb, this tick */
function prismaticBeam(champion: ServerChampion, orbPosition: Vector, context: ServerGameContext): void {
  const beam = getAbilityDefinition('lume_e');
  const rank = champion.abilityStates.E.rank;
  if (!beam || rank <= 0) return;

  const offset = orbPosition.subtracted(champion.position);
  const length = offset.length();
  if (length < 1) return;
  const band = { from: champion.position, direction: offset.normalized(), length, halfWidth: beam.aoeRadius ?? LUME_ORB_CONFIG.eBeamHalfWidth };

  const data = (champion.passiveState.customData ??= {});
  const hit = (data.prismHit ??= []) as string[];
  const damage = beam.damage ? calculateAbilityValue(beam.damage.scaling, rank, getScalingStats(champion, champion.getStats())) : 0;

  for (const entity of entitiesInBand(context, band)) {
    if (entity.isDead || entity.id === champion.id) continue;
    if (entity.side === champion.side) {
      // Allied champions crossing it are sped up
      if (entity.entityType === EntityType.CHAMPION) {
        applyEffectsToEntity(entity, [LUME_ORB_CONFIG.eAllySpeedEffect], ALLY_SPEED_DURATION, champion.id);
      }
      continue;
    }
    if (!canAbilityAffectEntityType(beam, entity.entityType)) continue;
    if (!hit.includes(entity.id)) {
      hit.push(entity.id);
      if (damage > 0 && beam.damage) entity.takeDamage(damage, beam.damage.type, champion.id, context);
    }
    applyEffectsToEntity(entity, beam.appliesEffects ?? [], BEAM_EFFECT_REFRESH, champion.id);
  }
}
