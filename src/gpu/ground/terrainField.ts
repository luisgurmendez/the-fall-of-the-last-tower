/**
 * The terrain as distance fields, for the ground shader. One texel per
 * FIELD_CELL world units over the whole map; each channel is the signed
 * distance (world units, negative inside) to one terrain:
 * - R: water (the border around the map and the river)
 * - G: the lanes' paths
 * - B: rock (the walls), read straight from the map's wall field, so the
 *   art's edges are exactly where units bump into them
 * - A: brush (the bushes' hitboxes, the same the server hides units in),
 *   smoothed a little so the rectangles' corners round off
 * Distances are stored as 128 + d / 2, so ±256 units fit in a byte, and
 * read with linear filtering, so edges stay smooth at any zoom.
 */

import { MOBAConfig, calculateIndividualBushPositions } from "@siege/shared";

/** World units per texel */
export const FIELD_CELL = 8;

export interface TerrainField {
  width: number;
  height: number;
  /** World position of the field's top-left corner */
  originX: number;
  originY: number;
  cell: number;
  /** RGBA bytes, row by row from the top */
  data: Uint8Array;
}

interface Point {
  x: number;
  y: number;
}

function distanceToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function distanceToPolyline(px: number, py: number, points: ReadonlyArray<Point>): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) best = Math.min(best, distanceToSegment(px, py, points[i], points[i + 1]));
  return best;
}

/** Signed distance to an axis-aligned square of half-size `half` around the origin */
function boxDistance(px: number, py: number, half: number): number {
  const qx = Math.abs(px) - half;
  const qy = Math.abs(py) - half;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
}

const FAR = 1e20;

/**
 * Squared Euclidean distance transform (Felzenszwalb and Huttenlocher), in
 * place: cells holding 0 are the features, cells holding FAR become their
 * squared distance (in cells) to the nearest feature.
 */
export function squaredDistanceTransform(grid: Float64Array, width: number, height: number): void {
  const n = Math.max(width, height);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);

  const pass = (length: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -FAR;
    z[1] = FAR;
    for (let q = 1; q < length; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = FAR;
    }
    k = 0;
    for (let q = 0; q < length; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  };

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = grid[y * width + x];
    pass(height);
    for (let y = 0; y < height; y++) grid[y * width + x] = d[y];
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) f[x] = grid[y * width + x];
    pass(width);
    for (let x = 0; x < width; x++) grid[y * width + x] = d[x];
  }
}

/**
 * Signed distance (world units) to the region marked in `inside`.
 */
function signedDistance(inside: Uint8Array, width: number, height: number, cell: number): Float64Array {
  const toInside = new Float64Array(width * height);
  const toOutside = new Float64Array(width * height);
  for (let i = 0; i < inside.length; i++) {
    toInside[i] = inside[i] ? 0 : FAR;
    toOutside[i] = inside[i] ? FAR : 0;
  }
  squaredDistanceTransform(toInside, width, height);
  squaredDistanceTransform(toOutside, width, height);
  const result = new Float64Array(width * height);
  for (let i = 0; i < inside.length; i++) {
    // The edge runs halfway between an inside and an outside cell
    result[i] = inside[i] ? -(Math.sqrt(toOutside[i]) - 0.5) * cell : (Math.sqrt(toInside[i]) - 0.5) * cell;
  }
  return result;
}

/** Box blur, `radius` cells each way, `passes` times */
function blur(values: Float64Array, width: number, height: number, radius: number, passes: number): void {
  const scratch = new Float64Array(values.length);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) sum += values[y * width + Math.min(width - 1, Math.max(0, x + k))];
        scratch[y * width + x] = sum / (radius * 2 + 1);
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) sum += scratch[Math.min(height - 1, Math.max(0, y + k)) * width + x];
        values[y * width + x] = sum / (radius * 2 + 1);
      }
    }
  }
}

const encode = (distance: number) => Math.max(0, Math.min(255, Math.round(128 + distance / 2)));

/**
 * The map's terrain field.
 */
export function buildTerrainField(): TerrainField {
  const cell = FIELD_CELL;
  const width = Math.ceil(MOBAConfig.MAP_SIZE.width / cell);
  const height = Math.ceil(MOBAConfig.MAP_SIZE.height / cell);
  const originX = -MOBAConfig.MAP_SIZE.width / 2;
  const originY = -MOBAConfig.MAP_SIZE.height / 2;
  const playableHalf = MOBAConfig.MAP_SIZE.width / 2 - MOBAConfig.WATER_BORDER_SIZE;
  const lanes = Object.values(MOBAConfig.LANES);

  // Brush: every bush of every group
  const brush = new Uint8Array(width * height);
  for (let group = 0; group < MOBAConfig.BUSH_GROUPS.length; group++) {
    for (const bush of calculateIndividualBushPositions(group)) {
      const x0 = Math.round((bush.x - bush.width / 2 - originX) / cell);
      const x1 = Math.round((bush.x + bush.width / 2 - originX) / cell);
      const y0 = Math.round((bush.y - bush.height / 2 - originY) / cell);
      const y1 = Math.round((bush.y + bush.height / 2 - originY) / cell);
      for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
        for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) brush[y * width + x] = 1;
      }
    }
  }
  const brushDistance = signedDistance(brush, width, height, cell);
  blur(brushDistance, width, height, 1, 2);

  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = originX + (x + 0.5) * cell;
      const py = originY + (y + 0.5) * cell;
      const river = distanceToPolyline(px, py, MOBAConfig.RIVER.points) - MOBAConfig.RIVER.width / 2;
      const water = Math.min(river, -boxDistance(px, py, playableHalf));
      let path = Infinity;
      for (const lane of lanes) path = Math.min(path, distanceToPolyline(px, py, lane.waypoints) - lane.width / 2);
      const i = (y * width + x) * 4;
      data[i] = encode(water);
      data[i + 1] = encode(path);
      data[i + 2] = encode(MOBAConfig.WALL_FIELD.distance(px, py));
      data[i + 3] = encode(brushDistance[y * width + x]);
    }
  }
  return { width, height, originX, originY, cell, data };
}

/**
 * A channel's distance at a world point (nearest texel), as the shader
 * reads it: 0 = water, 1 = path, 2 = rock, 3 = brush.
 */
export function fieldDistanceAt(field: TerrainField, channel: 0 | 1 | 2 | 3, worldX: number, worldY: number): number {
  const x = Math.max(0, Math.min(field.width - 1, Math.floor((worldX - field.originX) / field.cell)));
  const y = Math.max(0, Math.min(field.height - 1, Math.floor((worldY - field.originY) / field.cell)));
  return (field.data[(y * field.width + x) * 4 + channel] - 128) * 2;
}
