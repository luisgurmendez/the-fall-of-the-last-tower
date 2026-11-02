/**
 * WallField - The terrain's walls as a signed distance field: for any point,
 * how far it is (world units) to the nearest wall edge, negative inside a
 * wall. It's sampled once on a grid of nodes WALL_FIELD_CELL apart and read
 * with bilinear interpolation, so walls are smooth curves rather than tiles.
 *
 * Everything that cares where the walls are reads this one field: the
 * server's collision and pathfinding (Terrain), line of sight for vision
 * (WallGrid), the ground shader's art and the minimap. So what a unit
 * bumps into is exactly what's drawn.
 */

/** World units between nodes */
export const WALL_FIELD_CELL = 16;

export class WallField {
  /** Nodes per side */
  readonly nodes: number;

  /**
   * @param values Signed distance at each node, row by row from (-half, -half)
   * @param half The field covers [-half, half] on both axes
   * @param cell World units between nodes
   */
  constructor(
    private readonly values: Float32Array,
    readonly half: number,
    readonly cell: number = WALL_FIELD_CELL,
  ) {
    this.nodes = Math.round((half * 2) / cell) + 1;
  }

  /**
   * Sample a distance function on the nodes. `distance` is evaluated only on
   * the half of the map where y >= x (blue's); the other half is its point
   * reflection through the center, so the map stays symmetric to the bit.
   */
  static buildSymmetric(distance: (x: number, y: number) => number, half: number, cell = WALL_FIELD_CELL): WallField {
    const nodes = Math.round((half * 2) / cell) + 1;
    const values = new Float32Array(nodes * nodes);
    for (let row = 0; row < nodes; row++) {
      for (let col = 0; col <= row; col++) {
        const value = distance(-half + col * cell, -half + row * cell);
        values[row * nodes + col] = value;
        values[(nodes - 1 - row) * nodes + (nodes - 1 - col)] = value;
      }
    }
    return new WallField(values, half, cell);
  }

  /** Signed distance to the nearest wall edge (negative inside a wall) */
  distance(x: number, y: number): number {
    const last = this.nodes - 1;
    const fx = Math.max(0, Math.min(last - 1e-6, (x + this.half) / this.cell));
    const fy = Math.max(0, Math.min(last - 1e-6, (y + this.half) / this.cell));
    const col = Math.floor(fx);
    const row = Math.floor(fy);
    const tx = fx - col;
    const ty = fy - row;
    const i = row * this.nodes + col;
    const top = this.values[i] + (this.values[i + 1] - this.values[i]) * tx;
    const bottom = this.values[i + this.nodes] + (this.values[i + this.nodes + 1] - this.values[i + this.nodes]) * tx;
    return top + (bottom - top) * ty;
  }

  isWall(x: number, y: number): boolean {
    return this.distance(x, y) < 0;
  }

  /** The direction away from the nearest wall (a unit vector; (0, 0) on flat ground) */
  normal(x: number, y: number): { x: number; y: number } {
    const h = this.cell / 2;
    const gx = this.distance(x + h, y) - this.distance(x - h, y);
    const gy = this.distance(x, y + h) - this.distance(x, y - h);
    const length = Math.hypot(gx, gy);
    return length > 1e-9 ? { x: gx / length, y: gy / length } : { x: 0, y: 0 };
  }

  /**
   * Whether the straight line from a to b keeps at least `clearance` from
   * every wall (sampled every `step` units, end points included).
   */
  segmentClear(ax: number, ay: number, bx: number, by: number, clearance: number, step = 8): boolean {
    const length = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(length / step));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this.distance(ax + (bx - ax) * t, ay + (by - ay) * t) < clearance) return false;
    }
    return true;
  }
}

// =============================================================================
// Building blocks for distance functions
// =============================================================================

/** Polynomial smooth minimum: like min, with the corner rounded over about k */
export function smoothMin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

/** Polynomial smooth maximum */
export function smoothMax(a: number, b: number, k: number): number {
  return -smoothMin(-a, -b, k);
}

function hash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [-1, 1], features about `scale` units across */
export function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return (top + (bottom - top) * sy) * 2 - 1;
}
