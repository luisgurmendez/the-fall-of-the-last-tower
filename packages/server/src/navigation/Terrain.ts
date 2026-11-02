/**
 * Terrain - Walls and water as the server sees them.
 *
 * The walls are the map's distance field (MOBAConfig.WALL_FIELD): smooth
 * curves, and exactly what the client draws.
 * - resolveCircle(): pushes a unit out of walls and the water border (run
 *   every tick after movement and unit collisions), straight away from the
 *   nearest wall, so units slide along curved walls
 * - findPath(): A* around walls and the nexus buildings on a navigation
 *   grid of the spots a champion fits, straightened along lines that keep
 *   a body's width off walls, so paths hug walls without scraping them
 * - hasLineOfSight(): straight line a champion walks without touching a wall
 * - landingSpot(): where a unit going past walls (Blink, Zhak'rul's burrow) comes out
 */

import { Vector, type MOBAConfig, type WallField } from '@siege/shared';
import { ServerNavGrid } from './ServerNavGrid';

/** How far landingSpot steps back looking for room past a wall */
const LANDING_STEP = 8;
/** A champion's radius: what paths make room for unless told otherwise */
const BODY_RADIUS = 25;
/** How much a straightened path may shave off a body's clearance at a corner (the unit slides past) */
const CORNER_SHAVE = 3;
/** A destination closer than this to where the unit stands is already reached */
const ARRIVED = 6;

interface Box {
  cx: number;
  cy: number;
  hx: number;
  hy: number;
}

/** Signed distance to a box (negative inside) */
function boxDistance(x: number, y: number, box: Box): number {
  const qx = Math.abs(x - box.cx) - box.hx;
  const qy = Math.abs(y - box.cy) - box.hy;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}

/** The point on segment a-b closest to p */
function closestOnSegment(p: Vector, a: Vector, b: Vector): Vector {
  const ab = b.subtracted(a);
  const lengthSq = ab.x * ab.x + ab.y * ab.y;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / lengthSq));
  return a.added(ab.scaled(t));
}

export class Terrain {
  readonly navGrid: ServerNavGrid;
  private readonly field: WallField;
  private readonly playableHalf: number;
  /** The nexus buildings: units collide with them, so paths go around */
  private readonly nexuses: Box[];

  /**
   * @param map Map config (walls, water border, nexus footprints)
   * @param clearance How far the navigation grid keeps paths' cells from walls (a champion's radius)
   */
  constructor(map: typeof MOBAConfig, private readonly clearance = BODY_RADIUS + 1) {
    this.field = map.WALL_FIELD;
    this.playableHalf = map.MAP_SIZE.width / 2 - map.WATER_BORDER_SIZE;

    const footprint = map.NEXUS.collision;
    this.nexuses = [map.NEXUS.BLUE, map.NEXUS.RED].map(center => ({
      cx: center.x + footprint.offset.x,
      cy: center.y + footprint.offset.y,
      hx: footprint.width / 2,
      hy: footprint.height / 2,
    }));

    this.navGrid = new ServerNavGrid(map.MAP_SIZE.width);
    this.navGrid.initializeWalkable((x, y) => this.clearanceAt(x, y) >= clearance);
  }

  /**
   * How far a point is from the nearest wall, water or nexus building
   * (negative inside one).
   */
  clearanceAt(x: number, y: number): number {
    let clearance = Math.min(this.field.distance(x, y), this.playableHalf - Math.abs(x), this.playableHalf - Math.abs(y));
    for (const nexus of this.nexuses) clearance = Math.min(clearance, boxDistance(x, y, nexus));
    return clearance;
  }

  /**
   * Whether a point is inside a wall or the water.
   */
  isBlocked(x: number, y: number): boolean {
    if (Math.abs(x) > this.playableHalf || Math.abs(y) > this.playableHalf) return true;
    return this.field.isWall(x, y);
  }

  /**
   * Push a circle out of walls and the water border.
   * @returns true if the position changed
   */
  resolveCircle(position: Vector, radius: number): boolean {
    let moved = false;

    // Edges wander, so the field isn't an exact distance: a few small steps settle it
    for (let pass = 0; pass < 4; pass++) {
      const distance = this.field.distance(position.x, position.y);
      if (distance >= radius - 0.01) break;
      const normal = this.field.normal(position.x, position.y);
      if (normal.x === 0 && normal.y === 0) break;
      position.x += normal.x * (radius - distance);
      position.y += normal.y * (radius - distance);
      moved = true;
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
   * Where a unit of `radius` going from `from` toward `to`, at most
   * `maxDistance` away, comes out: the spot itself, or inside a wall the
   * farthest open spot short of it along the way (so it crosses a thin wall
   * when there's room past it).
   */
  landingSpot(from: Vector, to: Vector, maxDistance: number, radius: number): Vector {
    const offset = to.subtracted(from);
    const distance = offset.length();
    if (distance === 0) return from.clone();
    const direction = offset.scaled(1 / distance);
    for (let along = Math.min(distance, maxDistance); along > 0; along -= LANDING_STEP) {
      const spot = from.added(direction.scaled(along));
      if (this.clearanceAt(spot.x, spot.y) >= radius) return spot;
    }
    return from.clone();
  }

  /**
   * Waypoints from `from` to `to` around walls (not including `from`) for a
   * unit of `radius`. A destination too close to a wall for the body (or in
   * one) becomes the nearest spot it fits, so a click on the forest's edge
   * walks right up to it. Returns null when unreachable, and [] when the
   * unit already stands as close as it gets.
   */
  findPath(from: Vector, to: Vector, radius = BODY_RADIUS): Vector[] | null {
    const goal = to.clone();
    if (this.clearanceAt(goal.x, goal.y) < radius) this.resolveCircle(goal, radius);
    if (goal.distanceTo(from) < ARRIVED && goal.distanceTo(to) > 0.01) return [];
    if (this.lineClear(from, goal, radius, true)) return [goal];

    const path = this.navGrid.findPath(from, goal, (a, b) => this.lineClear(a, b, radius));
    if (!path || path.length === 0) return null;

    // The grid path starts at the cell we're in; drop it, and end exactly at the goal
    // (or as close as the grid gets when the body doesn't fit there)
    const waypoints = path.slice(1);
    const goalFits = this.clearanceAt(goal.x, goal.y) >= radius - 1;
    if (goalFits) {
      if (waypoints.length === 0) return [goal];
      waypoints[waypoints.length - 1] = goal;
    }
    if (waypoints.length === 0) return goalFits ? [goal] : [];
    return this.tighten([from, ...waypoints], radius).slice(1);
  }

  /**
   * Pull a path taut, like an elastic band: each corner slides toward the
   * straight line between its neighbors as far as the walls allow, so the
   * path rounds a wall's edge at a body's width from it instead of wherever
   * the grid's cells put it (and a corner no longer needed goes).
   * `points` starts where the unit stands.
   */
  private tighten(points: Vector[], radius: number): Vector[] {
    const clear = (a: Vector, b: Vector) => this.lineClear(a, b, radius, a === points[0]);
    for (let round = 0; round < 3; round++) {
      for (let i = 1; i < points.length - 1; i++) {
        const before = points[i - 1];
        const after = points[i + 1];
        if (clear(before, after)) {
          points.splice(i, 1);
          i--;
          continue;
        }
        const corner = points[i];
        const target = closestOnSegment(corner, before, after);
        let reach = 0;
        let limit = 1;
        for (let step = 0; step < 7; step++) {
          const t = (reach + limit) / 2;
          const moved = corner.added(target.subtracted(corner).scaled(t));
          if (clear(before, moved) && clear(moved, after)) reach = t;
          else limit = t;
        }
        points[i] = corner.added(target.subtracted(corner).scaled(reach));
      }
    }
    return points;
  }

  /**
   * Whether a champion walks the straight line between two points without
   * touching a wall.
   */
  hasLineOfSight(from: Vector, to: Vector): boolean {
    return this.lineClear(from, to, BODY_RADIUS, true);
  }

  /**
   * Whether a body of `radius` follows the straight line from a to b
   * without walls in the way. From where a unit stands (`fromUnit`), the
   * first stretch may be tight, as long as it isn't through a wall (a unit
   * pressed against one walks away from it).
   */
  private lineClear(from: Vector, to: Vector, radius: number, fromUnit = false): boolean {
    const length = from.distanceTo(to);
    const steps = Math.max(1, Math.ceil(length / 8));
    const needed = radius - CORNER_SHAVE;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const clearance = this.clearanceAt(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      if (clearance < needed && (!fromUnit || clearance < 0 || t * length > radius)) return false;
    }
    return true;
  }
}
