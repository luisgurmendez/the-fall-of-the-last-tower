/**
 * Terrain - Walls and water as the server sees them.
 *
 * - resolveCircle(): pushes a unit out of walls and the water border (run
 *   every tick after movement and unit collisions)
 * - findPath(): A* around walls and the nexus buildings on a navigation
 *   grid whose walls are inflated by a unit's clearance, so paths don't hug
 *   cliff edges
 * - hasLineOfSight(): straight line not crossing a wall
 */

import { Vector, type MOBAConfig } from '@siege/shared';
import { ServerNavGrid } from './ServerNavGrid';

interface Rect {
  cx: number;
  cy: number;
  hx: number;
  hy: number;
}

/** Spatial bucket size for wall lookups */
const BUCKET = 256;

export class Terrain {
  readonly navGrid: ServerNavGrid;
  private readonly rects: Rect[];
  private readonly buckets: Map<string, number[]> = new Map();
  private readonly playableHalf: number;

  /**
   * @param map Map config (walls, water border, nexus footprints)
   * @param clearance How far paths keep from walls (about a champion's radius)
   */
  constructor(map: typeof MOBAConfig, clearance = 30) {
    this.playableHalf = map.MAP_SIZE.width / 2 - map.WATER_BORDER_SIZE;
    this.rects = map.WALLS.map(wall => ({
      cx: wall.position.x,
      cy: wall.position.y,
      hx: wall.width / 2,
      hy: wall.height / 2,
    }));

    this.rects.forEach((rect, index) => {
      for (const key of this.bucketKeys(rect.cx - rect.hx, rect.cy - rect.hy, rect.cx + rect.hx, rect.cy + rect.hy)) {
        const list = this.buckets.get(key) ?? [];
        list.push(index);
        this.buckets.set(key, list);
      }
    });

    // Paths also go around the nexus buildings (units collide with them)
    const footprint = map.NEXUS.collision;
    const nexuses = [map.NEXUS.BLUE, map.NEXUS.RED].map(center => ({
      position: { x: center.x + footprint.offset.x, y: center.y + footprint.offset.y },
      width: footprint.width,
      height: footprint.height,
    }));

    this.navGrid = new ServerNavGrid(map.MAP_SIZE.width);
    this.navGrid.initializeFromConfig({
      MAP_SIZE: map.MAP_SIZE,
      WATER_BORDER_SIZE: map.WATER_BORDER_SIZE + clearance,
      WALLS: [...map.WALLS, ...nexuses].map(wall => ({
        position: wall.position,
        width: wall.width + clearance * 2,
        height: wall.height + clearance * 2,
      })),
    });
  }

  /**
   * Whether a point is inside a wall or the water.
   */
  isBlocked(x: number, y: number): boolean {
    if (Math.abs(x) > this.playableHalf || Math.abs(y) > this.playableHalf) return true;
    for (const index of this.bucketAt(x, y)) {
      const rect = this.rects[index];
      if (Math.abs(x - rect.cx) <= rect.hx && Math.abs(y - rect.cy) <= rect.hy) return true;
    }
    return false;
  }

  /**
   * Push a circle out of walls and the water border.
   * @returns true if the position changed
   */
  resolveCircle(position: Vector, radius: number): boolean {
    let moved = false;

    // Two passes handle corners where rectangles meet
    for (let pass = 0; pass < 2; pass++) {
      for (const index of this.bucketsAround(position.x, position.y, radius)) {
        const rect = this.rects[index];
        const dx = position.x - rect.cx;
        const dy = position.y - rect.cy;
        if (Math.abs(dx) >= rect.hx + radius || Math.abs(dy) >= rect.hy + radius) continue;

        const closestX = Math.max(-rect.hx, Math.min(rect.hx, dx));
        const closestY = Math.max(-rect.hy, Math.min(rect.hy, dy));
        const ox = dx - closestX;
        const oy = dy - closestY;
        const distanceSq = ox * ox + oy * oy;

        if (distanceSq >= radius * radius) continue;

        if (distanceSq > 1e-6) {
          // Center outside the rectangle: push along the normal from the closest point
          const distance = Math.sqrt(distanceSq);
          const push = radius - distance;
          position.x += (ox / distance) * push;
          position.y += (oy / distance) * push;
        } else {
          // Center inside: leave through the nearest side
          const pushX = rect.hx - Math.abs(dx) + radius;
          const pushY = rect.hy - Math.abs(dy) + radius;
          if (pushX < pushY) position.x += dx >= 0 ? pushX : -pushX;
          else position.y += dy >= 0 ? pushY : -pushY;
        }
        moved = true;
      }
    }

    const limit = this.playableHalf - radius;
    const clampedX = Math.max(-limit, Math.min(limit, position.x));
    const clampedY = Math.max(-limit, Math.min(limit, position.y));
    if (clampedX !== position.x || clampedY !== position.y) {
      position.x = clampedX;
      position.y = clampedY;
      moved = true;
    }

    return moved;
  }

  /**
   * Waypoints from `from` to `to` around walls (not including `from`).
   * Returns [to] when the straight line is clear, null when unreachable, and
   * [] when `to` is in a wall and `from` is already as close as it gets.
   */
  findPath(from: Vector, to: Vector): Vector[] | null {
    if (this.navGrid.hasLineOfSight(from, to)) return [to.clone()];

    const path = this.navGrid.findPath(from, to);
    if (!path || path.length === 0) return null;

    // The grid path starts at the cell we're in; drop it, and end exactly at the target
    // (or as close as the grid allows when the target itself is in a wall)
    const waypoints = path.slice(1);
    const destinationWalkable = this.navGrid.isWalkableWorld(to.x, to.y);
    if (destinationWalkable) {
      if (waypoints.length === 0) return [to.clone()];
      waypoints[waypoints.length - 1] = to.clone();
    }
    if (waypoints.length > 0) return waypoints;
    return destinationWalkable ? [to.clone()] : [];
  }

  /**
   * Whether the straight line between two points stays clear of walls
   * (on the inflated navigation grid).
   */
  hasLineOfSight(from: Vector, to: Vector): boolean {
    return this.navGrid.hasLineOfSight(from, to);
  }

  private bucketKeys(minX: number, minY: number, maxX: number, maxY: number): string[] {
    const keys: string[] = [];
    for (let bx = Math.floor(minX / BUCKET); bx <= Math.floor(maxX / BUCKET); bx++) {
      for (let by = Math.floor(minY / BUCKET); by <= Math.floor(maxY / BUCKET); by++) {
        keys.push(`${bx},${by}`);
      }
    }
    return keys;
  }

  private bucketAt(x: number, y: number): number[] {
    return this.buckets.get(`${Math.floor(x / BUCKET)},${Math.floor(y / BUCKET)}`) ?? [];
  }

  private bucketsAround(x: number, y: number, radius: number): Set<number> {
    const result = new Set<number>();
    for (const key of this.bucketKeys(x - radius, y - radius, x + radius, y + radius)) {
      for (const index of this.buckets.get(key) ?? []) result.add(index);
    }
    return result;
  }
}
