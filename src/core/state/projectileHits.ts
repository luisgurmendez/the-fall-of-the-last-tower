/**
 * Whether a projectile that just disappeared hit someone, or ran its range
 * out: the server removes it either way, and only a hit should show its
 * impact (`<abilityId>_impact`: Elora's arrow pinning, Vex's cut). A hit
 * leaves an enemy unit (a champion, minion or monster) right where it
 * went, give or take the tick it moved since its last position and the
 * unit's body.
 */

import { EntityType } from '@siege/shared';
import type { InterpolatedEntity } from './entities';

/** A unit's body, roughly (champions 18-30, minions, monsters) */
const BODY = 30;
/** Server ticks a second: how far a projectile may have flown since its last position */
const TICK_RATE = 30;

const UNITS = new Set<number>([EntityType.CHAMPION, EntityType.MINION, EntityType.JUNGLE_CAMP]);

/** Whether the projectile hit an enemy unit where it disappeared */
export function projectileHit(projectile: InterpolatedEntity, entities: Iterable<InterpolatedEntity>): boolean {
  const shot = projectile.snapshot as { side?: number; radius?: number; speed?: number };
  const reach = (shot.radius ?? 20) + BODY + (shot.speed ?? 0) / TICK_RATE;
  const at = projectile.serverPosition;
  for (const entity of entities) {
    const unit = entity.snapshot as { entityType: number; side?: number; isDead?: boolean };
    if (!UNITS.has(unit.entityType) || unit.isDead || unit.side === shot.side) continue;
    if (Math.hypot(entity.serverPosition.x - at.x, entity.serverPosition.y - at.y) <= reach) return true;
  }
  return false;
}
