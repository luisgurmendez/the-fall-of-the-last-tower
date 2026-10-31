/**
 * The Siege map layout: lanes, river and terrain walls.
 *
 * Proportions follow the classic MOBA map at 0.4 of its size (1 Siege unit
 * = 2.5 of those): outer lanes along the edges 280 wide, a diagonal mid, a
 * river 360 wide crossing it, and a jungle quadrant on each side of mid per
 * team. The jungle's shapes are our own.
 *
 * The jungle is carved, not built: each quadrant between the lanes, the
 * river and the base is solid forest, and clearings (the camps, a few
 * crossroads) and corridors about 170 wide are cut out of it, so paths run
 * between thick walls the way they do in the classic map. Blue's top-side
 * jungle (between top lane and mid) is designed here, reflected across mid
 * for blue's bot-side jungle, and mirrored through the map center for red.
 * The bot-side jungle differs near the river: the dragon's pit is cut into
 * blue's bank of the bot river (open toward it, so walking along the river
 * is never blocked), which mirrors into an empty pit on red's bank of the
 * top river. Tiles are 64 units, so the client draws them as cliffs.
 *
 * Preview the result with `bun run sim map-overview` (packages/server).
 */

import { buildWalls, distanceToPolyline, distanceToSegment, type WallRect } from './mapLayout';

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
 * y > x). Its center is 330 off the river's centerline, so the clearing cut
 * for it opens into the river.
 */
export const DRAGON_PIT = { x: 867, y: 1333, radius: 220 } as const;

/** Width of the jungle's corridors */
const CORRIDOR = 170;

/** The forest stops this far from a lane's centerline, the river's, and blue's nexus */
const LANE_CLEARANCE = 200;
const RIVER_CLEARANCE = 240;
const BASE_CLEARANCE = 950;

interface Clearing { x: number; y: number; radius: number }
interface Corridor { ax: number; ay: number; bx: number; by: number; width: number }

const clearing = (x: number, y: number, radius: number): Clearing => ({ x, y, radius });
const corridor = (a: Point, b: Point, width = CORRIDOR): Corridor => ({ ax: a.x, ay: a.y, bx: b.x, by: b.y, width });

// Blue's top-side jungle: its camps, crossroads and where corridors come out
const BLUE_BUFF = point(-1440, -200);
const THORNSPITTER = point(-2000, -480);
const WOLVES = point(-1440, 360);
const CORNER_CROSSROADS = point(-1750, -950);
const RIVER_CROSSROADS = point(-850, -50);
const BASE_CROSSROADS = point(-1800, 650);

const TOP_SIDE_CLEARINGS: Clearing[] = [
  clearing(BLUE_BUFF.x, BLUE_BUFF.y, 210),
  clearing(THORNSPITTER.x, THORNSPITTER.y, 170),
  clearing(WOLVES.x, WOLVES.y, 190),
  clearing(CORNER_CROSSROADS.x, CORNER_CROSSROADS.y, 150),
  clearing(RIVER_CROSSROADS.x, RIVER_CROSSROADS.y, 150),
  clearing(BASE_CROSSROADS.x, BASE_CROSSROADS.y, 140),
];

const TOP_SIDE_CORRIDORS: Corridor[] = [
  // From top lane: by the river corner, to the thornspitter, and near the base
  corridor(point(-2300, -1400), CORNER_CROSSROADS),
  corridor(point(-2300, -480), THORNSPITTER),
  corridor(point(-2300, 700), BASE_CROSSROADS),
  // Around the camps
  corridor(CORNER_CROSSROADS, THORNSPITTER),
  corridor(THORNSPITTER, BLUE_BUFF),
  corridor(BLUE_BUFF, WOLVES),
  corridor(BLUE_BUFF, RIVER_CROSSROADS),
  corridor(WOLVES, BASE_CROSSROADS),
  // Out to the base
  corridor(BASE_CROSSROADS, point(-1750, 1250)),
  // To mid: into the wolves, and from the river crossroads near the river
  corridor(WOLVES, point(-950, 950)),
  corridor(RIVER_CROSSROADS, point(-380, 380)),
];

/** Where blue's top-side jungle opens onto the top river: by the corner and by mid */
const TOP_RIVER_ENTRANCES: Corridor[] = [
  corridor(CORNER_CROSSROADS, point(-1220, -1080)),
  corridor(RIVER_CROSSROADS, point(-480, -420)),
];

/** Reflect across the mid lane (the line y = -x): blue's top-side jungle onto its bot-side jungle */
const reflectPoint = (p: Point): Point => point(-p.y, -p.x);
const reflectClearing = (c: Clearing): Clearing => ({ ...c, x: -c.y, y: -c.x });
const reflectCorridor = (c: Corridor): Corridor => ({ ...c, ax: -c.ay, ay: -c.ax, bx: -c.by, by: -c.bx });

/**
 * Where blue's bot-side jungle opens onto the bot river: by mid (the
 * reflection of the top side's), and past the dragon pit instead of into it
 */
const BOT_RIVER_ENTRANCES: Corridor[] = [
  reflectCorridor(TOP_RIVER_ENTRANCES[1]),
  corridor(reflectPoint(CORNER_CROSSROADS), point(1480, 1700)),
];

const CLEARINGS: Clearing[] = [
  ...TOP_SIDE_CLEARINGS,
  ...TOP_SIDE_CLEARINGS.map(reflectClearing),
  clearing(DRAGON_PIT.x, DRAGON_PIT.y, DRAGON_PIT.radius),
];

const CORRIDORS: Corridor[] = [
  ...TOP_SIDE_CORRIDORS,
  ...TOP_SIDE_CORRIDORS.map(reflectCorridor),
  ...TOP_RIVER_ENTRANCES,
  ...BOT_RIVER_ENTRANCES,
];

/**
 * Whether a point on blue's half (y > x) is forest: inside the lane ring,
 * clear of the lanes, the river and the base, and not in a clearing or a
 * corridor. Red's half is the mirror image (buildWalls).
 */
function isJungleWall(x: number, y: number): boolean {
  if (y <= x) return false;
  if (Math.abs(x) > 2420 || Math.abs(y) > 2420) return false;
  if (Math.hypot(x - BLUE_NEXUS.x, y - BLUE_NEXUS.y) < BASE_CLEARANCE) return false;
  if (distanceToPolyline(x, y, RIVER_PATH) < RIVER_CLEARANCE) return false;
  for (const lane of Object.values(LANE_PATHS)) {
    if (distanceToPolyline(x, y, lane) < LANE_CLEARANCE) return false;
  }
  for (const c of CLEARINGS) {
    if (Math.hypot(x - c.x, y - c.y) < c.radius) return false;
  }
  for (const c of CORRIDORS) {
    if (distanceToSegment(x, y, c.ax, c.ay, c.bx, c.by) < c.width / 2) return false;
  }
  return true;
}

export const SIEGE_MAP_WALLS: WallRect[] = buildWalls([], isJungleWall);
