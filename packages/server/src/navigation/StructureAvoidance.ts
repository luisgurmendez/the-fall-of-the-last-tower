/**
 * StructureAvoidance - Steer around towers, inhibitors and nexuses.
 *
 * Lanes run straight through their towers and inhibitors, so a unit walking down the lane
 * would press into the tower until the collision system pushed it aside.
 * In a crowded wave that jams. Instead, when a structure is in the way, the
 * unit aims for a point beside it and walks around.
 */

import { Vector, getCollisionCenter, getEffectiveRadius } from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';

/** How far ahead to look for structures in the way */
const LOOKAHEAD = 160;
/** Extra clearance between the unit and the structure */
const CLEARANCE = 6;

/**
 * Where a unit at `position` with `radius` should head to reach `target`
 * without walking into one of `side`'s structures. Returns `target` itself
 * when nothing is in the way, otherwise a point beside the nearest structure
 * in the way, on the side the unit is already on.
 *
 * Only the unit's own structures are avoided: enemy ones are what it walks
 * up to and attacks.
 */
export function steerAroundStructures(
  position: Vector,
  radius: number,
  target: Vector,
  structures: readonly ServerEntity[],
  side: number
): Vector {
  const toTargetX = target.x - position.x;
  const toTargetY = target.y - position.y;
  const targetDistance = Math.hypot(toTargetX, toTargetY);
  if (targetDistance === 0) return target;

  const dirX = toTargetX / targetDistance;
  const dirY = toTargetY / targetDistance;
  const reach = Math.min(targetDistance, LOOKAHEAD);

  let nearest: { ahead: number; across: number; centerX: number; centerY: number; clearRadius: number } | null = null;
  for (const structure of structures) {
    if (structure.isDead || structure.side !== side) continue;
    const shape = structure.getCollisionShape();
    const center = getCollisionCenter(shape, structure.position);
    const clearRadius = getEffectiveRadius(shape) + radius + CLEARANCE;

    const offsetX = center.x - position.x;
    const offsetY = center.y - position.y;
    const ahead = offsetX * dirX + offsetY * dirY;
    if (ahead <= 0 || ahead - clearRadius > reach) continue;

    // Signed distance of the structure's center from the line of travel
    const across = offsetX * -dirY + offsetY * dirX;
    if (Math.abs(across) >= clearRadius) continue;

    if (!nearest || ahead < nearest.ahead) {
      nearest = { ahead, across, centerX: center.x, centerY: center.y, clearRadius };
    }
  }
  if (!nearest) return target;

  // Pass on the side the unit is already on (the structure is to the other side)
  const sign = nearest.across > 0 ? -1 : 1;
  return new Vector(
    nearest.centerX + -dirY * sign * nearest.clearRadius,
    nearest.centerY + dirX * sign * nearest.clearRadius
  );
}
