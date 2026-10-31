/**
 * The Siege map layout: lanes, river and terrain walls.
 *
 * Proportions follow the classic MOBA map at 0.4 of its size (1 Siege unit
 * = 2.5 of those): outer lanes along the edges 280 wide, a diagonal mid, a
 * river 360 wide crossing it, and a jungle quadrant on each side of mid per
 * team. The jungle's shapes are our own.
 *
 * The jungle is islands of forest about 300-600 across, with paths about
 * 180-250 wide between them and the camps in the pockets they leave, about
 * half of it walkable, like the classic map. Blue's top-side jungle
 * (between top lane and mid) is designed here, reflected across mid for
 * blue's bot-side jungle, and mirrored through the map center for red. The
 * bot-side jungle differs at the river: the dragon's pit is cut into blue's
 * bank of the bot river (open toward it, so walking along the river is
 * never blocked), which mirrors into an empty pit on red's bank of the top
 * river. Islands are clipped to stay clear of the lanes, the river and the
 * base. Tiles are 64 units, so the client draws them as cliffs.
 *
 * Preview the result with `bun run sim map-overview` (packages/server).
 */

import { arc, buildWalls, distanceToPolyline, pointInPolygon, reflectAcrossMid, type Polygon, type WallRect } from './mapLayout';

type Point = { readonly x: number; readonly y: number };
const point = (x: number, y: number): Point => ({ x, y });

/** Blue's nexus (red's is its mirror image) */
export const BLUE_NEXUS = point(-2200, 2200);

/** Lane paths from blue's nexus to red's */
export const LANE_PATHS = {
  top: [BLUE_NEXUS, point(-2420, 1500), point(-2420, -1950), point(-1950, -2420), point(1500, -2420), point(2200, -2200)],
  mid: [BLUE_NEXUS, point(0, 0), point(2200, -2200)],
  bot: [BLUE_NEXUS, point(-1500, 2420), point(1950, 2420), point(2420, 1950), point(2420, -1500), point(2200, -2200)],
} as const;
export const LANE_WIDTH = 280;

/** The river, from the top lane's corner to the bot lane's (along y = x) */
export const RIVER_PATH = [point(-2250, -2250), point(2250, 2250)] as const;
export const RIVER_WIDTH = 360;

/**
 * The dragon's pit, on blue's bank of the bot river (blue's side is
 * y > x). Its center is 330 off the river's centerline, and its walls only
 * go round the side away from the river.
 */
export const DRAGON_PIT = { x: 867, y: 1333, radius: 250 } as const;

/** Islands stay this far from a lane's centerline, the river's, and blue's nexus */
const LANE_CLEARANCE = 200;
const RIVER_CLEARANCE = 240;
const BASE_CLEARANCE = 950;

/**
 * Blue's top-side jungle (camps: blue buff (-1440, -200), thornspitter
 * (-1960, -420), wolves (-1440, 360)). Paths left between the islands:
 * from top lane by the river corner, to the thornspitter, and near the
 * base; thornspitter to blue buff; blue buff to the river and to the
 * wolves; wolves to mid and to the base; and a crossroads where the river
 * meets mid.
 */
const TOP_SIDE_ISLANDS: Polygon[] = [
  // Along top lane, between the river corner and the thornspitter's entrance
  [[-2220, -1420], [-2090, -1470], [-2000, -1400], [-2020, -1260], [-2110, -1170], [-2220, -1160]],
  // Along top lane, behind the thornspitter
  [[-2220, -760], [-2130, -760], [-2150, -420], [-2100, -160], [-2080, 60], [-2220, 160]],
  // Between the thornspitter and the river corner
  [[-1850, -960], [-1700, -870], [-1640, -660], [-1720, -540], [-1860, -600], [-1920, -790]],
  // Between the blue buff and the thornspitter's way to the base
  [[-1910, -170], [-1680, -120], [-1620, 60], [-1780, 180], [-1980, 120], [-2010, -40]],
  // Between the blue buff, the wolves and the river crossroads
  [[-1260, -60], [-1030, -130], [-870, -30], [-880, 170], [-1050, 300], [-1230, 200]],
  // Between the wolves and mid, south of their mid entrance
  [[-1320, 760], [-1130, 690], [-990, 760], [-1060, 910], [-1250, 970], [-1390, 880]],
  // Along top lane, near the base
  [[-2220, 640], [-2000, 600], [-1850, 720], [-1880, 920], [-2050, 1050], [-2220, 1060]],
  // Between the wolves' way to the base and mid
  [[-1620, 1000], [-1460, 930], [-1370, 1040], [-1450, 1180], [-1620, 1190], [-1700, 1100]],
];

/** Blue's bank of the top river: between the corner and the blue buff's river entrance, and toward mid */
const TOP_RIVER_ISLANDS: Polygon[] = [
  [[-1780, -1300], [-1600, -1210], [-1450, -1050], [-1520, -920], [-1700, -950], [-1830, -1120]],
  [[-1090, -650], [-900, -560], [-760, -420], [-800, -360], [-1000, -390], [-1160, -450]],
];

/**
 * Blue's bank of the bot river: toward mid (the top bank's reflection), then
 * the dragon's pit, its wall thickened where it would leave cracks with the
 * islands behind it and toward mid
 */
const BOT_RIVER_ISLANDS: Polygon[] = [
  reflectAcrossMid(TOP_RIVER_ISLANDS[1]),
  ...arc(DRAGON_PIT.x, DRAGON_PIT.y, DRAGON_PIT.radius, 24, 246, 110),
  ...arc(DRAGON_PIT.x, DRAGON_PIT.y, DRAGON_PIT.radius + 90, 70, 145, 120),
  ...arc(DRAGON_PIT.x, DRAGON_PIT.y, DRAGON_PIT.radius + 90, 185, 240, 120),
];

/** An island grown by `factor` around its center (designs are drawn small, then grown to close the paths down) */
function grow(island: Polygon, factor: number): Polygon {
  const cx = island.reduce((sum, [x]) => sum + x, 0) / island.length;
  const cy = island.reduce((sum, [, y]) => sum + y, 0) / island.length;
  return island.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor] as const);
}

/**
 * How much each island is grown, so paths about 180-250 wide are left
 * between them: less by the river corner, where three meet
 */
const TOP_SIDE_GROWTH = [1.15, 1.4, 1.2, 1.5, 1.3, 1.5, 1.3, 1.2];
const TOP_RIVER_GROWTH = [1.1, 1.2];

const TOP_SIDE: Polygon[] = TOP_SIDE_ISLANDS.map((island, i) => grow(island, TOP_SIDE_GROWTH[i]));

/** Blue's half's islands (red's are their mirror images), before they're clipped to the jungle */
export const JUNGLE_ISLANDS: Polygon[] = [
  ...TOP_SIDE,
  ...TOP_SIDE.map(reflectAcrossMid),
  ...TOP_RIVER_ISLANDS.map((island, i) => grow(island, TOP_RIVER_GROWTH[i])),
  grow(BOT_RIVER_ISLANDS[0], TOP_RIVER_GROWTH[1]),
  ...BOT_RIVER_ISLANDS.slice(1),
];

/** Whether a point on blue's half (y > x) is clear of the lanes, the river and the base */
export function inJungle(x: number, y: number): boolean {
  if (y <= x) return false;
  if (Math.hypot(x - BLUE_NEXUS.x, y - BLUE_NEXUS.y) < BASE_CLEARANCE) return false;
  if (distanceToPolyline(x, y, RIVER_PATH) < RIVER_CLEARANCE) return false;
  for (const lane of Object.values(LANE_PATHS)) {
    if (distanceToPolyline(x, y, lane) < LANE_CLEARANCE) return false;
  }
  return true;
}

/** Whether a point on blue's half is forest: in an island, clipped to the jungle. Red's half is the mirror image (buildWalls). */
function isJungleWall(x: number, y: number): boolean {
  return inJungle(x, y) && JUNGLE_ISLANDS.some(island => pointInPolygon(x, y, island));
}

export const SIEGE_MAP_WALLS: WallRect[] = buildWalls([], isJungleWall);
