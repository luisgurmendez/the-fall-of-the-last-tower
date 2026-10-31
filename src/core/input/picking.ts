/**
 * What's under the cursor: each kind of unit can be pointed at anywhere on
 * its drawn body (a circle around the body's middle, which for buildings is
 * well above their position), not only near its feet. When several are
 * under the cursor, the one whose middle is closest (relative to its size)
 * wins, champions first by a little, like the classic MOBA.
 */

import { EntityType } from "@siege/shared";

interface PickArea {
  /** How far the area reaches from the body's middle */
  radius: number;
  /** How far above the unit's position the body's middle is */
  lift: number;
}

const CREATURE_AREAS: Record<string, PickArea> = {
  spider: { radius: 24, lift: 0 },
  wolf: { radius: 30, lift: 0 },
  thornspitter: { radius: 40, lift: 4 },
  blue_buff: { radius: 54, lift: 4 },
  red_buff: { radius: 54, lift: 6 },
  dragon: { radius: 78, lift: 6 },
};

/** Champions win ties with units around them by this much (of their area's radius) */
const CHAMPION_PRIORITY = 0.2;

function pickArea(snapshot: { entityType: number; minionType?: string; creatureType?: string }): PickArea {
  switch (snapshot.entityType) {
    case EntityType.CHAMPION:
      return { radius: 40, lift: 4 };
    case EntityType.MINION:
      return snapshot.minionType === "siege" ? { radius: 30, lift: 2 } : { radius: 26, lift: 2 };
    case EntityType.JUNGLE_CAMP:
      return CREATURE_AREAS[snapshot.creatureType ?? ""] ?? { radius: 34, lift: 0 };
    case EntityType.TOWER:
      return { radius: 70, lift: 70 };
    case EntityType.NEXUS:
      return { radius: 95, lift: 90 };
    default:
      return { radius: 30, lift: 0 };
  }
}

/**
 * How well a point picks a unit: under 1 when it's on the unit (lower is
 * closer to its middle), null when it misses.
 */
export function pickScore(
  point: { x: number; y: number },
  position: { x: number; y: number },
  snapshot: { entityType: number; minionType?: string; creatureType?: string },
): number | null {
  const area = pickArea(snapshot);
  const distance = Math.hypot(point.x - position.x, point.y - (position.y - area.lift));
  if (distance > area.radius) return null;
  const score = distance / area.radius;
  return snapshot.entityType === EntityType.CHAMPION ? score - CHAMPION_PRIORITY : score;
}
