/**
 * Kip's marks: who holds one of his, and putting one on a champion. Only
 * enemy champions are marked (a minion or a monster hit by Target Practice or
 * Grand Entrance is only hurt).
 */

import { EntityType, KIP_KIT, type ActiveEffectState } from '@siege/shared';
import type { ServerChampion } from '../../../simulation/ServerChampion';
import type { ServerEntity } from '../../../simulation/ServerEntity';
import type { ServerGameContext } from '../../../game/ServerGameContext';

/** Whether a unit holds a mark Kip put on it (another Kip's doesn't count) */
export function isMarkedBy(unit: ServerEntity, kip: ServerChampion): boolean {
  const effects = (unit as Partial<{ activeEffects: ActiveEffectState[] }>).activeEffects;
  return effects?.some(effect => effect.definitionId === KIP_KIT.markEffect && effect.sourceId === kip.id) ?? false;
}

/** Mark an enemy champion (refreshing a mark it has); anything else isn't marked */
export function markIfChampion(unit: ServerEntity, kip: ServerChampion): void {
  if (unit.entityType !== EntityType.CHAMPION || unit.isDead || unit.side === kip.side) return;
  (unit as ServerChampion).applyEffect(KIP_KIT.markEffect, KIP_KIT.markDuration, kip.id);
}

/** The living enemy champions holding his mark, within `reach` of him (to the edge of their body) if given */
export function markedEnemies(kip: ServerChampion, context: ServerGameContext, reach?: number): ServerChampion[] {
  return context.getAllChampions().filter(enemy =>
    enemy.side !== kip.side && !enemy.isDead && isMarkedBy(enemy, kip) &&
    (reach === undefined || enemy.position.distanceTo(kip.position) <= reach + enemy.getRadius()));
}
