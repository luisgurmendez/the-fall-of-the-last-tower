/**
 * Map layout helpers: distances to polylines for designing the terrain, and
 * the walls as tile rectangles for the drawings that work in tiles (the 2D
 * ground without the GPU).
 *
 * The walls themselves are a distance field (wallField.ts); the rectangles
 * are only a picture of it.
 */

import { Vector } from '../math/Vector';

export const WALL_TILE_SIZE = 64;
/** Tile grid spans [-WALL_GRID_HALF, WALL_GRID_HALF] on both axes (symmetric, so mirroring stays on the grid) */
export const WALL_GRID_HALF = 2752;

export interface WallRect {
  position: Vector;
  width: number;
  height: number;
}

/**
 * The walls as tiles merged into rectangles: a tile is wall when its center
 * is. Every column of wall is at least two tiles tall, so a tile drawing
 * can show a grass plateau over a cliff face (a lone row would be all cliff).
 * Rows of tiles are merged into runs, and identical runs on consecutive rows
 * into taller rectangles.
 */
export function tileRects(isSolid: (x: number, y: number) => boolean): WallRect[] {
  const count = (WALL_GRID_HALF * 2) / WALL_TILE_SIZE;
  const solid: boolean[][] = [];
  for (let row = 0; row < count; row++) {
    solid.push([]);
    for (let col = 0; col < count; col++) {
      const cx = -WALL_GRID_HALF + (col + 0.5) * WALL_TILE_SIZE;
      const cy = -WALL_GRID_HALF + (row + 0.5) * WALL_TILE_SIZE;
      solid[row].push(isSolid(cx, cy));
    }
  }
  for (let row = 0; row < count - 1; row++) {
    for (let col = 0; col < count; col++) {
      const runStart = solid[row][col] && (row === 0 || !solid[row - 1][col]);
      if (runStart && !solid[row + 1][col]) solid[row + 1][col] = true;
    }
  }

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
    const keys = new Set<string>();
    if (row < count) {
      let col = 0;
      while (col < count) {
        if (!solid[row][col]) {
          col++;
          continue;
        }
        const start = col;
        while (col < count && solid[row][col]) col++;
        const key = `${start}-${col}`;
        keys.add(key);
        const existing = open.get(key);
        if (existing && existing.rowEnd === row) existing.rowEnd = row + 1;
        else {
          if (existing) flush(key);
          open.set(key, { rowStart: row, rowEnd: row + 1, start, end: col });
        }
      }
    }
    for (const key of [...open.keys()]) {
      if (!keys.has(key)) flush(key);
    }
  }
  return rects;
}

/**
 * Reflect a point across the mid lane (the line y = -x), mapping a team's
 * top-side jungle onto its bot-side jungle.
 */
export function reflectAcrossMid(x: number, y: number): [number, number] {
  return [-y, -x];
}

/** Distance from a point to a segment */
export function distanceToSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** Distance from a point to a polyline */
export function distanceToPolyline(x: number, y: number, points: readonly { x: number; y: number }[]): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    best = Math.min(best, distanceToSegment(x, y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y));
  }
  return best;
}
