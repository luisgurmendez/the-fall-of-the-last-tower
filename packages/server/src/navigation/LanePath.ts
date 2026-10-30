/**
 * LanePath - A lane as a polyline with arc-length helpers.
 *
 * Used to answer "how far along the lane is this point?" (for bots picking
 * where the wave front is, and for minions rejoining their lane after a
 * fight without walking backwards).
 */

import { Vector } from '@siege/shared';

export interface LaneProjection {
  /** Arc length from the start of the path to the closest point */
  distance: number;
  /** Closest point on the path */
  point: Vector;
  /** Distance from the queried point to the path */
  offset: number;
}

export class LanePath {
  readonly points: readonly Vector[];
  readonly length: number;
  /** Arc length at each waypoint */
  private readonly cumulative: number[];

  constructor(points: Vector[]) {
    if (points.length < 2) {
      throw new Error('LanePath needs at least two points');
    }
    this.points = points.map(p => p.clone());
    this.cumulative = [0];
    for (let i = 1; i < this.points.length; i++) {
      this.cumulative.push(this.cumulative[i - 1] + this.points[i - 1].distanceTo(this.points[i]));
    }
    this.length = this.cumulative[this.cumulative.length - 1];
  }

  /**
   * Find the closest point on the path.
   */
  project(position: Vector): LaneProjection {
    let best: LaneProjection | null = null;

    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const segmentLengthSq = abx * abx + aby * aby;
      const t = segmentLengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((position.x - a.x) * abx + (position.y - a.y) * aby) / segmentLengthSq));
      const point = new Vector(a.x + abx * t, a.y + aby * t);
      const offset = point.distanceTo(position);

      if (!best || offset < best.offset) {
        best = {
          distance: this.cumulative[i] + Math.sqrt(segmentLengthSq) * t,
          point,
          offset,
        };
      }
    }

    return best!;
  }

  /**
   * Point at a given arc length (clamped to the path).
   */
  pointAt(distance: number): Vector {
    const d = Math.max(0, Math.min(this.length, distance));
    for (let i = 0; i < this.points.length - 1; i++) {
      if (d <= this.cumulative[i + 1]) {
        const segmentLength = this.cumulative[i + 1] - this.cumulative[i];
        const t = segmentLength === 0 ? 0 : (d - this.cumulative[i]) / segmentLength;
        const a = this.points[i];
        const b = this.points[i + 1];
        return new Vector(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      }
    }
    return this.points[this.points.length - 1].clone();
  }

  /**
   * Index of the first waypoint strictly further along than `distance`.
   * Returns points.length - 1 when past the end.
   */
  nextWaypointIndex(distance: number): number {
    for (let i = 0; i < this.cumulative.length; i++) {
      if (this.cumulative[i] > distance) return i;
    }
    return this.points.length - 1;
  }
}
