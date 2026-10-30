/**
 * The Siege map layout: terrain walls.
 *
 * Designed for blue's top-side jungle (between top lane and mid), reflected
 * across mid for blue's bot-side jungle, then mirrored through the map center
 * for red. Tiles are 64 units, so the client draws them as cliffs.
 *
 * Preview the result with `bun run sim map-overview` (packages/server).
 */

import { arc, blob, buildWalls, reflectAcrossMid, stroke, type Polygon, type WallRect } from './mapLayout';

/** Blue's top-side jungle */
const TOP_SIDE_JUNGLE: Polygon[] = [
  // Along mid, with an entrance in the middle
  stroke(-912, 572, -650, 310, 110),
  stroke(-470, 130, -255, -85, 110),
  // Along the river, with an entrance toward the river bush
  stroke(-1047, -721, -790, -464, 110),
  stroke(-600, -274, -375, -49, 110),
  // Along top lane, with an entrance in the middle
  stroke(-1150, -720, -1150, -230, 100),
  stroke(-1150, 80, -1150, 520, 100),
  // Blocks between camps
  blob(-600, -110, 95, 95, 4, Math.PI / 4),
  blob(-1000, 420, 90, 110, 6),
];

/** Pillars flanking blue's base exits (top/mid; reflected for mid/bot) */
const BASE_GATE: Polygon[] = arc(-1300, 1300, 660, -78, -62, 120);

/** Dragon pit in the bot river (mirrored into a matching pit in the top river), open toward the map center */
const RIVER_PIT: Polygon[] = arc(720, 720, 250, -85, 175, 90);

export const SIEGE_MAP_WALLS: WallRect[] = buildWalls([
  ...TOP_SIDE_JUNGLE,
  ...TOP_SIDE_JUNGLE.map(reflectAcrossMid),
  ...BASE_GATE,
  ...BASE_GATE.map(reflectAcrossMid),
  ...RIVER_PIT,
]);
