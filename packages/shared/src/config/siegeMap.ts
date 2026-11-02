/**
 * The map's layout: lanes, river and the jungle's walls.
 *
 * Proportions follow the classic MOBA map at 0.4 of its size (1 unit = 2.5
 * of those): outer lanes along the edges 280 wide, a diagonal mid, a river
 * 360 wide crossing it, and a jungle quadrant on each side of mid per team.
 * The jungle's shapes are our own.
 *
 * The jungle is carved: each quadrant is forest, and paths are cut through
 * it (corridors, polylines with a width) between clearings (the camps, and
 * junctions where paths meet). Corridors meet in rounded junctions, their
 * mouths flare where they open onto a lane, the river or mid, and the edges
 * wander a little (noise), so walls are curves rather than tiles. Blue's
 * top-side jungle is designed here and reflected across mid for blue's
 * bot-side jungle, which has the dragon's pit in its river bank; red's half
 * is the point reflection of blue's (so red's top-side jungle has the
 * Rootwyrm's pit). The result is a distance field (wallField.ts).
 *
 * Preview the result with `bun run sim map-overview` (packages/server).
 */

import { distanceToPolyline, distanceToSegment, tileRects, type WallRect } from './mapLayout';
import { WallField, smoothMax, smoothMin, valueNoise } from './wallField';

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
 * y > x), 330 off the river's centerline and open toward it.
 */
export const DRAGON_PIT = { x: 867, y: 1333, radius: 250 } as const;

/** Half the map's side: the field covers it all */
const MAP_HALF = 2880;

// =============================================================================
// Blue's top-side jungle (between top lane, the top river and mid)
// =============================================================================

/** Camps in blue's top-side jungle; the bot side's are their reflections across mid */
export const TOP_SIDE_CAMPS = {
  blueBuff: point(-1400, -260),
  thornspitter: point(-1930, -560),
  wolves: point(-1240, 380),
} as const;

const { blueBuff, thornspitter, wolves } = TOP_SIDE_CAMPS;

/** Where paths meet */
const NORTH = point(-1840, -1180);
const CROSSROADS = point(-860, -80);
const SOUTH = point(-1800, 640);
const BASE_GATE = point(-1680, 1060);

export interface Clearing {
  center: Point;
  radius: number;
}

export interface Corridor {
  points: readonly Point[];
  width: number;
}

export const TOP_SIDE_CLEARINGS: Clearing[] = [
  { center: blueBuff, radius: 150 },
  { center: thornspitter, radius: 120 },
  { center: wolves, radius: 130 },
  { center: NORTH, radius: 100 },
  { center: CROSSROADS, radius: 115 },
  { center: SOUTH, radius: 95 },
  { center: BASE_GATE, radius: 95 },
];

/**
 * Paths through blue's top-side jungle. Nine open onto the outside: three
 * onto top lane, three onto the river, two onto mid and one into the base.
 */
export const TOP_SIDE_CORRIDORS: Corridor[] = [
  // Top lane by the river corner, through to the river
  { points: [point(-2300, -1560), point(-2050, -1400), NORTH], width: 160 },
  { points: [NORTH, point(-1680, -1320), point(-1560, -1500)], width: 160 },
  // The north junction down to the thornspitter
  { points: [NORTH, point(-1990, -900), thornspitter], width: 150 },
  // Top lane into the thornspitter's pit, and on to the blue buff
  { points: [point(-2300, -560), thornspitter], width: 170 },
  { points: [thornspitter, point(-1660, -380), blueBuff], width: 150 },
  // The blue buff to the crossroads, which opens onto the river and mid
  { points: [blueBuff, point(-1100, -150), CROSSROADS], width: 150 },
  { points: [CROSSROADS, point(-600, -330)], width: 170 },
  { points: [CROSSROADS, point(-640, 150), point(-480, 330)], width: 170 },
  // The blue buff down to the wolves, and the wolves out to mid
  { points: [blueBuff, point(-1480, 60), wolves], width: 150 },
  { points: [wolves, point(-1060, 640), point(-930, 790)], width: 160 },
  // The wolves west to the south junction: top lane, the thornspitter (along the lane), the base gate
  { points: [wolves, point(-1550, 560), SOUTH], width: 150 },
  { points: [SOUTH, point(-2300, 560)], width: 160 },
  { points: [SOUTH, point(-1880, 400), point(-1900, 0), point(-1960, -300), thornspitter], width: 160 },
  { points: [SOUTH, point(-1800, 870), BASE_GATE], width: 150 },
  // The base gate into the base
  { points: [BASE_GATE, point(-1880, 1330)], width: 170 },
];

/** Only on the top side: where the bot side has the dragon's pit */
const TOP_ONLY_CORRIDORS: Corridor[] = [
  // The north junction to the blue buff, inside the river bank
  { points: [NORTH, point(-1600, -900), point(-1470, -560), blueBuff], width: 150 },
  // The blue buff's way to the river
  { points: [blueBuff, point(-1260, -520), point(-1120, -760), point(-1040, -880)], width: 160 },
];

/** Only on the bot side (in the top side's frame): the red buff's way to the river, past the dragon's pit */
const BOT_ONLY_CORRIDORS: Corridor[] = [
  { points: [blueBuff, point(-1150, -420), point(-850, -560)], width: 160 },
];

// =============================================================================
// Tall grass
// =============================================================================

/** How a group of bushes lines up (see calculateIndividualBushPositions in MOBAConfig) */
export type BushLine = 'horizontal' | 'vertical' | 'diagonal' | 'antidiagonal' | 'cluster';

export interface BushSpot {
  at: Point;
  count: number;
  line: BushLine;
}

/**
 * Tall grass on blue's top side, reflected across mid for the bot side: at
 * the mouths of paths (where you wait for someone coming through), in the
 * river by the jungle's entrances, and inside on the long paths.
 */
export const TOP_SIDE_BUSHES: BushSpot[] = [
  // Top lane, outer side
  { at: point(-2590, -900), count: 3, line: 'vertical' },
  // The lane mouths: by the river corner, the thornspitter's, the south one
  { at: point(-2060, -1400), count: 3, line: 'cluster' },
  { at: point(-2150, -560), count: 2, line: 'vertical' },
  { at: point(-2050, 595), count: 3, line: 'horizontal' },
  // The north junction, toward the river, and the river at that path's mouth
  { at: point(-1710, -1310), count: 2, line: 'antidiagonal' },
  { at: point(-1640, -1400), count: 3, line: 'cluster' },
  // Inside: the path from the blue buff to the wolves, and the long path along the lane
  { at: point(-1465, 20), count: 2, line: 'vertical' },
  { at: point(-1895, 40), count: 3, line: 'vertical' },
  // The crossroads' mouths onto the river and onto mid, and the wolves' onto mid
  { at: point(-610, -360), count: 3, line: 'cluster' },
  { at: point(-520, 280), count: 3, line: 'cluster' },
  { at: point(-960, 760), count: 3, line: 'cluster' },
];

/** Only on the top side: the river by the blue buff's way out */
export const TOP_ONLY_BUSHES: BushSpot[] = [
  { at: point(-1090, -830), count: 3, line: 'cluster' },
];

/** Only on the bot side (in its own coordinates): the red buff's way out, and the river by the dragon's pit */
export const BOT_ONLY_BUSHES: BushSpot[] = [
  { at: point(560, 860), count: 3, line: 'cluster' },
  { at: point(1150, 1180), count: 3, line: 'cluster' },
];

// =============================================================================
// Tunnels
// =============================================================================

/** A burrow through the forest, from one mouth to the other (either way) */
export interface Tunnel {
  a: Point;
  b: Point;
}

/** Tunnels on blue's top side, reflected for the bot side: shortcuts through the thickest forest */
const TOP_SIDE_TUNNELS: Tunnel[] = [
  // The path along the lane to the blue buff's path down to the wolves
  { a: point(-1922, -120), b: point(-1445, -100) },
  // The wolves' pit to the crossroads, under the forest between them
  { a: point(-1200, 310), b: point(-890, -50) },
];

/** Only on the top side: from the path inside the river bank out to the river */
const TOP_ONLY_TUNNELS: Tunnel[] = [
  { a: point(-1560, -860), b: point(-1330, -1080) },
];

/** Only on the bot side (in its own coordinates): from the thornspitter's pit into the dragon's pit */
const BOT_ONLY_TUNNELS: Tunnel[] = [
  { a: point(580, 1850), b: point(860, 1520) },
];

/** Every tunnel on the map */
export function jungleTunnels(): Tunnel[] {
  const reflect = (p: Point) => point(-p.y, -p.x);
  const blue = [
    ...TOP_SIDE_TUNNELS,
    ...TOP_ONLY_TUNNELS,
    ...TOP_SIDE_TUNNELS.map(tunnel => ({ a: reflect(tunnel.a), b: reflect(tunnel.b) })),
    ...BOT_ONLY_TUNNELS,
  ];
  return [...blue, ...blue.map(tunnel => ({ a: point(-tunnel.a.x, -tunnel.a.y), b: point(-tunnel.b.x, -tunnel.b.y) }))];
}

// =============================================================================
// The field
// =============================================================================

/** The forest stays this far from a lane's centerline, the river's, and blue's nexus */
const LANE_CLEARANCE = 225;
const RIVER_CLEARANCE = 255;
const BASE_CLEARANCE = 950;
/** How round junctions are, and how much corridor mouths flare */
const JUNCTION_ROUNDING = 45;
const MOUTH_FLARE = 60;

/** Signed distance to a polyline of a width (negative inside it) */
function corridorDistance(x: number, y: number, corridor: Corridor): number {
  let best = Infinity;
  const { points } = corridor;
  for (let i = 0; i < points.length - 1; i++) {
    best = Math.min(best, distanceToSegment(x, y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y));
  }
  return best - corridor.width / 2;
}

/** Signed distance to the open ground carved out of a quadrant (negative inside), in the top side's frame */
function carvedDistance(x: number, y: number, clearings: readonly Clearing[], corridors: readonly Corridor[]): number {
  let carved = Infinity;
  for (const clearing of clearings) {
    carved = smoothMin(carved, Math.hypot(x - clearing.center.x, y - clearing.center.y) - clearing.radius, JUNCTION_ROUNDING);
  }
  for (const corridor of corridors) carved = smoothMin(carved, corridorDistance(x, y, corridor), JUNCTION_ROUNDING);
  return carved;
}

/** The outer lanes' ring: their straight stretches, and the corners they cut */
const RING_SIDE = 2420;
const RING_CORNER = 4370;

/**
 * Signed distance to the jungle's forest region (negative inside): inside
 * the outer lanes' ring, clear of the lanes, the river and the base
 */
function forestRegionDistance(x: number, y: number): number {
  let lane = Infinity;
  for (const path of Object.values(LANE_PATHS)) lane = Math.min(lane, distanceToPolyline(x, y, path));
  return Math.max(
    LANE_CLEARANCE - lane,
    RIVER_CLEARANCE - distanceToPolyline(x, y, RIVER_PATH),
    BASE_CLEARANCE - Math.hypot(x - BLUE_NEXUS.x, y - BLUE_NEXUS.y),
    Math.max(Math.abs(x), Math.abs(y)) - RING_SIDE,
    (Math.abs(x + y) - RING_CORNER) / Math.SQRT2,
  );
}

/** Edges wander this much (world units) */
function edgeNoise(x: number, y: number): number {
  return valueNoise(x, y, 190, 1) * 22 + valueNoise(x, y, 70, 2) * 8;
}

/**
 * Signed distance to the walls at a point on blue's half (y >= x): the
 * forest region minus the carved paths, with wandering edges.
 */
function blueHalfWallDistance(x: number, y: number): number {
  const region = forestRegionDistance(x, y);
  // Well clear of the forest: open ground (exact values this far out don't matter)
  if (region > 140) return region;

  // Bot-side points are designed in the top side's frame (reflected across mid)
  const botSide = x + y > 0;
  const [fx, fy] = botSide ? [-y, -x] : [x, y];
  let carved = carvedDistance(fx, fy, TOP_SIDE_CLEARINGS, TOP_SIDE_CORRIDORS);
  carved = smoothMin(carved, carvedDistance(fx, fy, [], botSide ? BOT_ONLY_CORRIDORS : TOP_ONLY_CORRIDORS), JUNCTION_ROUNDING);
  if (botSide) carved = smoothMin(carved, Math.hypot(x - DRAGON_PIT.x, y - DRAGON_PIT.y) - DRAGON_PIT.radius, JUNCTION_ROUNDING);

  // The noise is the same on both sides, so tall grass placed on one fits the other
  return smoothMax(region, -carved, MOUTH_FLARE) + edgeNoise(fx, fy);
}

/**
 * The jungle's paths as centerlines over the whole map, both sides and both
 * halves, for the art's trodden trails.
 */
export function jungleTrails(): Point[][] {
  const reflect = (p: Point) => point(-p.y, -p.x);
  const blue = [
    ...[...TOP_SIDE_CORRIDORS, ...TOP_ONLY_CORRIDORS].map(corridor => [...corridor.points]),
    ...[...TOP_SIDE_CORRIDORS, ...BOT_ONLY_CORRIDORS].map(corridor => corridor.points.map(reflect)),
  ];
  return [...blue, ...blue.map(points => points.map(p => point(-p.x, -p.y)))];
}

/** The walls, as a distance field over the whole map */
export const SIEGE_WALL_FIELD: WallField = WallField.buildSymmetric(blueHalfWallDistance, MAP_HALF);

/** The walls as tile rectangles, for drawings that work in tiles (collision uses the field) */
export const SIEGE_MAP_WALLS: WallRect[] = tileRects((x, y) => SIEGE_WALL_FIELD.isWall(x, y));

/** Whether a point on blue's half (y > x) is in the jungle: clear of the lanes, the river and the base */
export function inJungle(x: number, y: number): boolean {
  return y > x && forestRegionDistance(x, y) < 0;
}
