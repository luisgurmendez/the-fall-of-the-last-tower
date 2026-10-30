/**
 * Map layout helpers: terrain walls are designed as polygons for one side,
 * mirrored onto the other side (point reflection through the map center),
 * and rasterized to 64-unit tiles so the client can draw them as cliffs.
 *
 * Output is the `MOBAConfig.WALLS` format: axis-aligned rectangles centered
 * on `position`.
 */

import { Vector } from '../math/Vector';

export const WALL_TILE_SIZE = 64;
/** Tile grid spans [-WALL_GRID_HALF, WALL_GRID_HALF] on both axes (symmetric, so mirroring stays on the grid) */
export const WALL_GRID_HALF = 1600;

export interface WallRect {
  position: Vector;
  width: number;
  height: number;
}

export type Polygon = readonly (readonly [number, number])[];

function pointInPolygon(x: number, y: number, polygon: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Rasterize polygons (plus their mirror images) to tiles and merge the tiles
 * into as few rectangles as possible (runs per row, then identical runs on
 * consecutive rows).
 */
export function buildWalls(sidePolygons: Polygon[]): WallRect[] {
  const polygons: Polygon[] = [
    ...sidePolygons,
    ...sidePolygons.map(polygon => polygon.map(([x, y]) => [-x, -y] as const)),
  ];

  const count = (WALL_GRID_HALF * 2) / WALL_TILE_SIZE;
  const solid: boolean[][] = [];
  for (let row = 0; row < count; row++) {
    solid.push([]);
    for (let col = 0; col < count; col++) {
      const cx = -WALL_GRID_HALF + (col + 0.5) * WALL_TILE_SIZE;
      const cy = -WALL_GRID_HALF + (row + 0.5) * WALL_TILE_SIZE;
      solid[row].push(polygons.some(polygon => pointInPolygon(cx, cy, polygon)));
    }
  }

  // Horizontal runs per row: key "start-end" -> rows
  const runs: { row: number; start: number; end: number }[] = [];
  for (let row = 0; row < count; row++) {
    let col = 0;
    while (col < count) {
      if (!solid[row][col]) {
        col++;
        continue;
      }
      const start = col;
      while (col < count && solid[row][col]) col++;
      runs.push({ row, start, end: col });
    }
  }

  // Merge identical runs on consecutive rows into taller rectangles
  const rects: WallRect[] = [];
  const open = new Map<string, { rowStart: number; rowEnd: number; start: number; end: number }>();
  const flush = (key: string) => {
    const r = open.get(key)!;
    const width = (r.end - r.start) * WALL_TILE_SIZE;
    const height = (r.rowEnd - r.rowStart) * WALL_TILE_SIZE;
    rects.push({
      position: new Vector(
        -WALL_GRID_HALF + r.start * WALL_TILE_SIZE + width / 2,
        -WALL_GRID_HALF + r.rowStart * WALL_TILE_SIZE + height / 2
      ),
      width,
      height,
    });
    open.delete(key);
  };

  for (let row = 0; row <= count; row++) {
    const rowRuns = runs.filter(run => run.row === row);
    const keys = new Set(rowRuns.map(run => `${run.start}-${run.end}`));
    for (const key of [...open.keys()]) {
      if (!keys.has(key)) flush(key);
    }
    for (const run of rowRuns) {
      const key = `${run.start}-${run.end}`;
      const existing = open.get(key);
      if (existing) existing.rowEnd = row + 1;
      else open.set(key, { rowStart: row, rowEnd: row + 1, start: run.start, end: run.end });
    }
  }
  for (const key of [...open.keys()]) flush(key);

  return rects;
}

/**
 * Mirror a point to the other side of the map (point reflection).
 */
export function mirror(point: { x: number; y: number }): Vector {
  return new Vector(-point.x, -point.y);
}

// =============================================================================
// Shape helpers for designing walls
// =============================================================================

/**
 * A straight wall segment of a given thickness.
 */
export function stroke(ax: number, ay: number, bx: number, by: number, thickness: number): Polygon {
  const length = Math.hypot(bx - ax, by - ay);
  const nx = (-(by - ay) / length) * (thickness / 2);
  const ny = ((bx - ax) / length) * (thickness / 2);
  return [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]];
}

/**
 * A rounded block (regular polygon stretched to rx/ry).
 */
export function blob(cx: number, cy: number, rx: number, ry: number, sides = 8, rotation = 0): Polygon {
  return Array.from({ length: sides }, (_, i) => {
    const angle = rotation + (i / sides) * Math.PI * 2;
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as const;
  });
}

/**
 * A curved wall: an arc around (cx, cy) from angle a0 to a1 (degrees, screen
 * coordinates with +y down), made of short strokes.
 */
export function arc(cx: number, cy: number, radius: number, a0: number, a1: number, thickness: number): Polygon[] {
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 15));
  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return [cx + Math.cos(radians) * radius, cy + Math.sin(radians) * radius] as const;
  };
  const segments: Polygon[] = [];
  for (let i = 0; i < steps; i++) {
    const [sx, sy] = point(a0 + ((a1 - a0) * i) / steps);
    const [ex, ey] = point(a0 + ((a1 - a0) * (i + 1)) / steps);
    segments.push(stroke(sx, sy, ex, ey, thickness));
  }
  return segments;
}

/**
 * Reflect across the mid lane (the line y = -x), mapping a team's top-side
 * jungle onto its bot-side jungle.
 */
export function reflectAcrossMid(polygon: Polygon): Polygon {
  return polygon.map(([x, y]) => [-y, -x] as const);
}
