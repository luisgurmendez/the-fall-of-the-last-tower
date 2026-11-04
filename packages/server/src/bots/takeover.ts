/**
 * A bot for a player who lost their connection (GameRoom): after
 * TAKEOVER_DELAY seconds away a LaneBot plays their champion in the lane
 * it's nearest, until they come back.
 */

import { mapLanes, type LaneId, type MOBAConfig } from '@siege/shared';

/** Seconds a player is away before a bot plays for them (a page reload takes less) */
export const TAKEOVER_DELAY = 5;

/** How much nearer another lane must be than mid to be taken over it (all lanes meet at the bases) */
const MID_MARGIN = 50;

interface Point {
  x: number;
  y: number;
}

/** Distance from a point to the segment a-b */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * The lane a bot taking over a champion at `position` plays: the one whose
 * path is nearest, mid when they're about as near (in a base, where they
 * all start).
 */
export function takeoverLane(position: Point, map: typeof MOBAConfig): LaneId {
  let best: { id: LaneId; distance: number } | null = null;
  let mid: number | null = null;
  for (const lane of mapLanes(map)) {
    let distance = Infinity;
    for (let i = 0; i + 1 < lane.waypoints.length; i++) {
      distance = Math.min(distance, distanceToSegment(position, lane.waypoints[i], lane.waypoints[i + 1]));
    }
    if (lane.id === 'mid') mid = distance;
    if (!best || distance < best.distance) best = { id: lane.id, distance };
  }
  if (!best) return 'mid';
  return mid !== null && mid - best.distance < MID_MARGIN ? 'mid' : best.id;
}
