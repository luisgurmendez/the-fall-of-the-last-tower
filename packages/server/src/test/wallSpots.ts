/**
 * Finding walls on the map for tests, so they don't depend on the layout's
 * exact coordinates: a stretch of wall crossed left to right with open
 * ground on both sides.
 */
import { MOBAConfig } from '@siege/shared';

export interface WallCrossing {
  /** The row it's on */
  y: number;
  /** Where the wall starts and ends along the row */
  left: number;
  right: number;
  /** Its middle */
  x: number;
}

/**
 * The first wall (scanning rows from the top of blue's top-side jungle)
 * between `minThickness` and `maxThickness` thick along a row, with at
 * least `open` units of open ground (a champion's body fits) on each side.
 */
export function findWallCrossing(minThickness: number, maxThickness: number, open = 80): WallCrossing {
  const field = MOBAConfig.WALL_FIELD;
  const fits = (x: number, y: number) => field.distance(x, y) >= 25;
  for (let y = -1600; y <= 1600; y += 16) {
    for (let x = -2200; x < 0; x += 4) {
      if (!field.isWall(x, y) || field.isWall(x - 4, y)) continue;
      let right = x;
      while (right < x + maxThickness + 8 && field.isWall(right, y)) right += 4;
      const thickness = right - x;
      if (thickness < minThickness || thickness > maxThickness) continue;
      if (!fits(x - open, y) || !fits(right + open, y)) continue;
      return { y, left: x, right, x: (x + right) / 2 };
    }
  }
  throw new Error(`no wall ${minThickness}-${maxThickness} thick with open ground around it`);
}
