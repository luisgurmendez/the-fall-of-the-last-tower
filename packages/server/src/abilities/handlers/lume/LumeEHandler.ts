/**
 * LumeEHandler - Prismatic Beam
 *
 * Joins Lume and the Light Orb with a beam of light for the ability's
 * effectDuration: Lume gets the lume_prism effect, and LumeHooks applies the
 * beam every tick from wherever she is to wherever the orb is (damage once
 * per cast, a slow while in it, speed for allies crossing it). Clients draw
 * the beam while she has the effect.
 */

import { BaseAbilityHandler } from '../../BaseAbilityHandler';
import type {
  AbilityHandlerParams,
  AbilityValidationResult,
  AbilityExecutionResult,
} from '../../IAbilityHandler';
import { ServerLightOrb } from '../../../simulation/ServerLightOrb';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerGameContext } from '../../../game/ServerGameContext';

export class LumeEHandler extends BaseAbilityHandler {
  readonly abilityId = 'lume_e';

  validate(params: AbilityHandlerParams): AbilityValidationResult {
    const orb = findOrb(params.champion, params.context);
    if (!orb || orb.isDestroyed) {
      return { valid: false, reason: 'orb_destroyed', customMessage: 'Light Orb is destroyed' };
    }
    return { valid: true };
  }

  execute(params: AbilityHandlerParams): AbilityExecutionResult {
    const { champion, definition } = params;
    // A new beam: everything it touches can be hit again
    (champion.passiveState.customData ??= {}).prismHit = [];
    champion.applyEffect('lume_prism', definition.effectDuration ?? 2.5, champion.id);
    return { success: true };
  }
}

/** Lume's Light Orb */
export function findOrb(champion: ServerChampion, context: ServerGameContext): ServerLightOrb | null {
  for (const entity of context.getAllEntities()) {
    if (entity instanceof ServerLightOrb && entity.ownerId === champion.id) return entity;
  }
  return null;
}
