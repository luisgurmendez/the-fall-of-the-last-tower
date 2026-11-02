/**
 * WallGrid - Where the walls are, on a fine grid, for line of sight.
 *
 * Server fog of war and the client fog renderer use the same grid and the
 * same sampling, so they agree on what a wall hides. A cell is wall when the
 * wall field (wallField.ts) says its center is.
 */

import { MOBAConfig } from './MOBAConfig';
import type { WallField } from './wallField';

/** Grid resolution in world units */
const CELL_SIZE = 16;
/** Distance between samples along a sight line */
const SAMPLE_STEP = 16;

export class WallGrid {
  private readonly cells: Uint8Array;
  private readonly size: number;
  private readonly half: number;

  /**
   * @param field The walls (null for none)
   */
  constructor(field: WallField | null = MOBAConfig.WALL_FIELD, mapSize: number = MOBAConfig.MAP_SIZE.width) {
    this.half = mapSize / 2;
    this.size = Math.ceil(mapSize / CELL_SIZE);
    this.cells = new Uint8Array(this.size * this.size);
    if (!field) return;
    for (let cy = 0; cy < this.size; cy++) {
      for (let cx = 0; cx < this.size; cx++) {
        const x = -this.half + (cx + 0.5) * CELL_SIZE;
        const y = -this.half + (cy + 0.5) * CELL_SIZE;
        if (field.isWall(x, y)) this.cells[cy * this.size + cx] = 1;
      }
    }
  }

  isWall(x: number, y: number): boolean {
    const cx = this.toCell(x);
    const cy = this.toCell(y);
    if (cx < 0 || cy < 0 || cx >= this.size || cy >= this.size) return false;
    return this.cells[cy * this.size + cx] === 1;
  }

  /**
   * Whether nothing walls off the straight line from a to b. The end points
   * themselves don't count, so units standing against a wall can still see
   * and be seen.
   */
  hasLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const distance = Math.hypot(dx, dy);
    const steps = Math.floor(distance / SAMPLE_STEP);
    for (let i = 1; i < steps; i++) {
      const t = (i * SAMPLE_STEP) / distance;
      if (this.isWall(ax + dx * t, ay + dy * t)) return false;
    }
    return true;
  }

  /**
   * How far a ray from (x, y) in a direction travels before hitting a wall,
   * up to maxDistance. Used to draw what a unit can see.
   */
  rayDistance(x: number, y: number, dirX: number, dirY: number, maxDistance: number): number {
    for (let d = SAMPLE_STEP; d < maxDistance; d += SAMPLE_STEP) {
      if (this.isWall(x + dirX * d, y + dirY * d)) return d;
    }
    return maxDistance;
  }

  private toCell(value: number): number {
    return Math.floor((value + this.half) / CELL_SIZE);
  }
}
