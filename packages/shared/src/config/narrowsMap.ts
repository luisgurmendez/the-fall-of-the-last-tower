/**
 * The Narrows: a one-lane map for duels (1v1), all fighting and no jungle.
 *
 * A single lane runs straight between the two bases, along the same
 * diagonal as the main map's mid, through a gorge in the forest about twice
 * its width: a wider arena in the middle, and pockets off its sides with
 * tall grass to hide in. Each side has two towers, an inhibitor and its
 * nexus along the lane. The bases are about 40 seconds' walk apart.
 *
 * Like the main map, the walls are a distance field (wallField.ts): the
 * forest everywhere, minus the gorge, the arena, the pockets and the bases,
 * with wandering edges. Blue's half is designed here; red's is its point
 * reflection.
 */

import { distanceToSegment, tileRects, type WallRect } from './mapLayout';
import { WallField, smoothMin, valueNoise } from './wallField';
import type { BushSpot } from './siegeMap';

type Point = { readonly x: number; readonly y: number };
const point = (x: number, y: number): Point => ({ x, y });

/**
 * A point by where it is along the lane: `s` from the middle toward red's
 * base (negative toward blue's), `o` off to the lane's right (toward the
 * bottom right of the map, negative toward the top left).
 */
function along(s: number, o = 0): Point {
  return point((s + o) * Math.SQRT1_2, (o - s) * Math.SQRT1_2);
}

/** Half the map's side, as the main map's (the field covers it all) */
const MAP_HALF = 2880;

export const NARROWS_BLUE_NEXUS = along(-1980);
export const NARROWS_BLUE_SPAWN = along(-2490);
export const NARROWS_LANE = [NARROWS_BLUE_NEXUS, point(0, 0), point(-NARROWS_BLUE_NEXUS.x, -NARROWS_BLUE_NEXUS.y)];

/** Blue's towers, outer first, and its inhibitor (red's are their mirror images) */
export const NARROWS_BLUE_TOWERS = [along(-790), along(-1340)];
export const NARROWS_BLUE_INHIBITOR = along(-1650);

/** Open ground: the gorge's half width, the arena in the middle, the pockets off the gorge and the base */
const GORGE_HALF_WIDTH = 280;
const ARENA = { center: point(0, 0), radius: 440 };
const POCKETS = [
  { center: along(-520, 330), radius: 150 },
  { center: along(-1120, -320), radius: 140 },
];
const BASE = { center: along(-2200), radius: 560 };
/** How round the open ground's corners are */
const ROUNDING = 70;

/** Healing blossoms on blue's half, at the lane's edges across from the pockets (red's mirror them) */
export const NARROWS_BLUE_BLOSSOMS = [along(-560, -210), along(-1150, 220)];

/** Tall grass on blue's half: in the pockets, and at the arena's edges */
export const NARROWS_BLUE_BUSHES: BushSpot[] = [
  { at: POCKETS[0].center, count: 3, line: 'cluster' },
  { at: POCKETS[1].center, count: 3, line: 'cluster' },
  { at: along(-220, 240), count: 2, line: 'cluster' },
  { at: along(-220, -240), count: 2, line: 'cluster' },
];

/** Signed distance to the walls at a point on blue's half: the forest minus the open ground */
function blueHalfWallDistance(x: number, y: number): number {
  const red = { x: -BASE.center.x, y: -BASE.center.y };
  let open = distanceToSegment(x, y, BASE.center.x, BASE.center.y, red.x, red.y) - GORGE_HALF_WIDTH;
  for (const circle of [ARENA, BASE, ...POCKETS]) {
    open = smoothMin(open, Math.hypot(x - circle.center.x, y - circle.center.y) - circle.radius, ROUNDING);
  }
  // Far from the open ground, the exact distance doesn't matter
  if (open < -200) return -open;
  return -open + valueNoise(x, y, 190, 3) * 22 + valueNoise(x, y, 70, 4) * 8;
}

export const NARROWS_WALL_FIELD: WallField = WallField.buildSymmetric(blueHalfWallDistance, MAP_HALF);

/** The walls as tile rectangles, for drawings that work in tiles */
export const NARROWS_WALLS: WallRect[] = tileRects((x, y) => NARROWS_WALL_FIELD.isWall(x, y));
