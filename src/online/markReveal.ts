/**
 * Marks that reveal their holder (Kip's): the server sends a marked enemy
 * champion to the marker's team even in the fog or a bush
 * (FogOfWarServer, the effect's `revealsHolder`). An enemy champion can only
 * hold such a mark from someone on our team, so the client opens a small
 * window in its fog around it (OnlineFogProvider) instead of drawing the
 * fog over it.
 */

import { EntityType, KIP_KIT } from '@siege/shared';

/** Effects that reveal their holder to their source's team */
const REVEALING_EFFECTS: ReadonlySet<string> = new Set([KIP_KIT.markEffect]);

/** How far around a marked enemy the fog clears: about its body */
export const MARK_REVEAL_RANGE = 60;

interface RevealedUnit {
  entityType: EntityType;
  side: number;
  isDead?: boolean;
  activeEffects?: ReadonlyArray<{ definitionId: string }>;
}

/** The fog window around a unit (0 for none): a living enemy champion holding a revealing mark */
export function markRevealRange(unit: RevealedUnit, localSide: number): number {
  if (unit.entityType !== EntityType.CHAMPION || unit.side === localSide || unit.isDead) return 0;
  return unit.activeEffects?.some(effect => REVEALING_EFFECTS.has(effect.definitionId)) ? MARK_REVEAL_RANGE : 0;
}
