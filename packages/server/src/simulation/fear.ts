/**
 * Fear: a feared unit runs straight away from whoever scared it (the fear's
 * source), from wherever the source is now. A source that's dead or gone
 * leaves it running the way it was going. Champions, minions, summons and
 * jungle monsters flee the same way (each keeps the way it's running).
 */

import { Vector, type ActiveEffectState } from '@siege/shared';
import { getServerEffectById, isCCEffect } from '../data/effects';
import type { ServerEntity } from './ServerEntity';
import type { ServerGameContext } from '../game/ServerGameContext';

/** How far ahead of itself a fleeing unit aims each tick */
export const FLEE_AHEAD = 100;

/** The fear among a unit's effects, if one holds it (its sourceId is who scared it) */
export function findFear(activeEffects: readonly ActiveEffectState[]): ActiveEffectState | undefined {
  return activeEffects.find(effect => {
    const def = getServerEffectById(effect.definitionId);
    return def !== undefined && isCCEffect(def) && def.ccType === 'fear';
  });
}

/**
 * Which way a feared unit runs: away from its fear's source, or `previous`
 * (the way it was going) when the source is dead, gone or right on top of it.
 */
export function fleeDirection(
  unit: ServerEntity,
  fear: ActiveEffectState,
  context: ServerGameContext,
  previous: Vector | null,
): Vector {
  const source = fear.sourceId ? context.getEntity(fear.sourceId) : undefined;
  if (source && !source.isDead) {
    const away = unit.position.subtracted(source.position);
    if (away.length() > 1) return away.normalized();
  }
  return previous ?? new Vector(1, 0);
}

/** Where a feared unit heads this tick */
export function fleeTarget(unit: ServerEntity, direction: Vector): Vector {
  return unit.position.added(direction.scaled(FLEE_AHEAD));
}
