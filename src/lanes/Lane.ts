/**
 * Lane - Represents a MOBA lane path between nexuses.
 *
 * Lanes have pre-defined waypoints that minions follow.
 * The waypoints go from Blue base to Red base.
 */

import Vector from '@/physics/vector';
import { LaneId, MapSide } from '@/map/MOBAConfig';

/**
 * A MOBA lane with pre-computed waypoints.
 */
export class Lane {
  /** Lane identifier */
  readonly id: LaneId;

  /** Waypoints from Blue base (index 0) to Red base (last index) */
  readonly waypoints: Vector[];

  /** Lane width for minion spread */
  readonly width: number;

  /**
   * Create a new lane.
   * @param id - Lane identifier (top, mid, bot)
   * @param waypoints - Array of positions from Blue to Red base
   * @param width - Lane width for minion spread
   */
  constructor(id: LaneId, waypoints: Vector[], width: number) {
    this.id = id;
    this.waypoints = waypoints.map(wp => wp.clone());
    this.width = width;
  }

  /**
   * Get waypoints for a specific side.
   * Blue side: waypoints as-is (Blue→Red)
   * Red side: waypoints reversed (Red→Blue)
   *
   * @param side - The team side (0 = Blue, 1 = Red)
   */
  getWaypointsForSide(side: MapSide): Vector[] {
    if (side === 0) {
      // Blue side: go from Blue base to Red base
      return this.waypoints.map(wp => wp.clone());
    } else {
      // Red side: go from Red base to Blue base (reversed)
      return [...this.waypoints].reverse().map(wp => wp.clone());
    }
  }

  /**
   * Get the spawn position for a side (first waypoint).
   */
  getSpawnPosition(side: MapSide): Vector {
    const waypoints = this.getWaypointsForSide(side);
    return waypoints[0].clone();
  }

  /**
   * Get the target position for a side (last waypoint = enemy nexus).
   */
  getTargetPosition(side: MapSide): Vector {
    const waypoints = this.getWaypointsForSide(side);
    return waypoints[waypoints.length - 1].clone();
  }

  /**
   * Get a point along the lane path using linear interpolation.
   * @param t - Parameter from 0 (start) to 1 (end)
   */
  getPointAlongPath(t: number): Vector {
    const clampedT = Math.max(0, Math.min(1, t));

    if (this.waypoints.length === 0) {
      return new Vector(0, 0);
    }

    if (this.waypoints.length === 1) {
      return this.waypoints[0].clone();
    }

    // Calculate total path length
    let totalLength = 0;
    const segmentLengths: number[] = [];

    for (let i = 1; i < this.waypoints.length; i++) {
      const segmentLength = this.waypoints[i].distanceTo(this.waypoints[i - 1]);
      segmentLengths.push(segmentLength);
      totalLength += segmentLength;
    }

    // Find the segment at parameter t
    const targetLength = clampedT * totalLength;
    let currentLength = 0;

    for (let i = 0; i < segmentLengths.length; i++) {
      const segmentLength = segmentLengths[i];

      if (currentLength + segmentLength >= targetLength) {
        // Found the segment
        const segmentT = (targetLength - currentLength) / segmentLength;
        const start = this.waypoints[i];
        const end = this.waypoints[i + 1];

        return new Vector(
          start.x + (end.x - start.x) * segmentT,
          start.y + (end.y - start.y) * segmentT
        );
      }

      currentLength += segmentLength;
    }

    // Return the last waypoint
    return this.waypoints[this.waypoints.length - 1].clone();
  }

  /**
   * Get the closest point on the lane to a given position.
   */
  getClosestPoint(position: Vector): { point: Vector; distance: number; segmentIndex: number } {
    let closestPoint = this.waypoints[0].clone();
    let closestDistance = position.distanceTo(this.waypoints[0]);
    let closestSegment = 0;

    for (let i = 1; i < this.waypoints.length; i++) {
      const start = this.waypoints[i - 1];
      const end = this.waypoints[i];

      // Project position onto line segment
      const segmentDir = end.clone().sub(start);
      const segmentLength = segmentDir.length();

      if (segmentLength === 0) continue;

      segmentDir.normalize();

      const toPosition = position.clone().sub(start);
      const projection = toPosition.dot(segmentDir);

      let closestOnSegment: Vector;

      if (projection <= 0) {
        closestOnSegment = start.clone();
      } else if (projection >= segmentLength) {
        closestOnSegment = end.clone();
      } else {
        closestOnSegment = start.clone().add(segmentDir.scalar(projection));
      }

      const distance = position.distanceTo(closestOnSegment);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPoint = closestOnSegment;
        closestSegment = i - 1;
      }
    }

    return {
      point: closestPoint,
      distance: closestDistance,
      segmentIndex: closestSegment,
    };
  }
}

export default Lane;
