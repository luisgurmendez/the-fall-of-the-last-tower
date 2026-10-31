/**
 * The Siege map layout: terrain walls.
 *
 * Proportions follow the classic MOBA map at 0.4 of its size (1 Siege unit
 * = 2.5 of those): outer lanes along the edges 280 wide, a diagonal mid, a
 * river 360 wide crossing it, and a jungle quadrant on each side of mid per
 * team. The wall shapes are our own.
 *
 * Designed for blue's top-side jungle (between top lane and mid), reflected
 * across mid for blue's bot-side jungle, then mirrored through the map center
 * for red. The river banks differ: blue's bot-side bank has the dragon pit,
 * which mirrors into an empty pit on red's top-side bank. Pits sit beside the
 * river, open toward it, so walking along the river is never blocked.
 * Tiles are 64 units, so the client draws them as cliffs.
 *
 * Preview the result with `bun run sim map-overview` (packages/server).
 */

import { arc, blob, buildWalls, reflectAcrossMid, stroke, type Polygon, type WallRect } from './mapLayout';

/** Thickness of the walls between lanes, river and jungle */
const WALL = 120;

/**
 * The dragon's pit, on blue's bank of the bot river (the river runs along
 * y = x; blue's side is y > x). Its center is 330 off the river's centerline
 * and its walls only go round the side away from the river.
 */
export const DRAGON_PIT = { x: 867, y: 1333, radius: 250 } as const;

/** A point on blue's bank of the river: `t` along the river, `offset` from its centerline */
function bank(t: number, offset = 320): [number, number] {
  const d = offset / Math.SQRT2;
  return [t - d, t + d];
}

/** A point beside mid lane on blue's top side: `u` along mid (negative toward blue), `offset` from its centerline */
function besideMid(u: number, offset = 320): [number, number] {
  const d = offset / Math.SQRT2;
  return [u - d, -u - d];
}

const segment = (a: [number, number], b: [number, number]) => stroke(a[0], a[1], b[0], b[1], WALL);

/** Blue's top-side jungle, without its river bank */
const TOP_SIDE_JUNGLE: Polygon[] = [
  // Along top lane, with entrances near the river and near the base
  stroke(-2130, -1600, -2130, -1180, WALL),
  stroke(-2130, -760, -2130, 40, WALL),
  stroke(-2130, 460, -2130, 1180, WALL),
  // Along mid, with an entrance to the wolves
  segment(besideMid(-1400), besideMid(-1100)),
  segment(besideMid(-800), besideMid(-250)),
  // Blocks that split the quadrant into camps and paths
  blob(-1700, -1000, 120, 100, 6),
  blob(-1000, -150, 120, 120, 5, Math.PI / 5),
  blob(-1850, 760, 140, 110, 6),
];

/** Blue's bank of the top river: entrances at the lane corner, to the blue buff and near mid */
const TOP_RIVER_BANK: Polygon[] = [
  segment(bank(-1650), bank(-1350)),
  segment(bank(-1050), bank(-600)),
];

/** Blue's bank of the bot river: the dragon pit, with entrances on both sides of it */
const BOT_RIVER_BANK: Polygon[] = [
  segment(bank(350), bank(700)),
  ...arc(DRAGON_PIT.x, DRAGON_PIT.y, DRAGON_PIT.radius, 24, 246, 100),
  segment(bank(1450), bank(1650)),
];

/** Walls between blue's base exits (top/mid; reflected for mid/bot) */
const BASE_GATE: Polygon[] = arc(-2200, 2200, 950, -88, -58, 140);

export const SIEGE_MAP_WALLS: WallRect[] = buildWalls([
  ...TOP_SIDE_JUNGLE,
  ...TOP_SIDE_JUNGLE.map(reflectAcrossMid),
  ...TOP_RIVER_BANK,
  ...BOT_RIVER_BANK,
  ...BASE_GATE,
  ...BASE_GATE.map(reflectAcrossMid),
]);
