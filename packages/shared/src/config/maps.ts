/**
 * The maps a match can be played on. Each is a whole map config, the shape
 * of MOBAConfig: the main map (Wildcrown Vale, 5v5 with the jungle) and
 * The Narrows (a one-lane duel map, narrowsMap.ts).
 *
 * The server builds each match on its map (GameRoom: ServerGameContext's
 * mapConfig). A client plays one match at a time: when one starts it calls
 * useMap(), which swaps the map's fields into MOBAConfig, so everything
 * that reads MOBAConfig sees the match's map.
 */

import { Vector } from '../math/Vector';
import { MOBAConfig } from './MOBAConfig';
import {
  NARROWS_BLUE_BUSHES,
  NARROWS_BLUE_INHIBITOR,
  NARROWS_BLUE_NEXUS,
  NARROWS_BLUE_SPAWN,
  NARROWS_BLUE_TOWERS,
  NARROWS_LANE,
  NARROWS_WALLS,
  NARROWS_WALL_FIELD,
} from './narrowsMap';

type MapConfig = typeof MOBAConfig;

/** The main map, as MOBAConfig was built (a copy, so swapping maps in and out keeps it) */
const WILDCROWN: MapConfig = { ...MOBAConfig };

const mirror = (p: { x: number; y: number }) => new Vector(-p.x, -p.y);
const vector = (p: { x: number; y: number }) => new Vector(p.x, p.y);

const narrowsBushes = NARROWS_BLUE_BUSHES.map(spot => ({ center: vector(spot.at), bushCount: spot.count, spread: spot.line }));

const NARROWS: MapConfig = {
  ...WILDCROWN,
  NAME: "The Narrows",
  NEXUS: { ...WILDCROWN.NEXUS, BLUE: vector(NARROWS_BLUE_NEXUS), RED: mirror(NARROWS_BLUE_NEXUS) },
  LANES: {
    MID: { id: "mid", waypoints: NARROWS_LANE.map(vector), width: WILDCROWN.LANES.MID!.width },
  },
  RIVER: { points: [], width: 0, pits: [] },
  JUNGLE: { ...WILDCROWN.JUNGLE, CAMPS: [] },
  CHAMPION_SPAWN: { BLUE: vector(NARROWS_BLUE_SPAWN), RED: mirror(NARROWS_BLUE_SPAWN) },
  TRAILS: [],
  TUNNELS: { ...WILDCROWN.TUNNELS, LIST: [] },
  // Red's groups follow blue's in the same order (calculateIndividualBushPositions mirrors them)
  BUSH_GROUPS: [...narrowsBushes, ...narrowsBushes.map(group => ({ ...group, center: mirror(group.center) }))],
  WALL_FIELD: NARROWS_WALL_FIELD,
  WALLS: NARROWS_WALLS,
  TOWERS: {
    ...WILDCROWN.TOWERS,
    POSITIONS: [
      ...NARROWS_BLUE_TOWERS.map(at => ({ side: 0 as const, lane: "mid" as const, position: vector(at) })),
      ...NARROWS_BLUE_TOWERS.map(at => ({ side: 1 as const, lane: "mid" as const, position: mirror(at) })),
    ],
  },
  INHIBITORS: {
    ...WILDCROWN.INHIBITORS,
    POSITIONS: [
      { side: 0 as const, lane: "mid" as const, position: vector(NARROWS_BLUE_INHIBITOR) },
      { side: 1 as const, lane: "mid" as const, position: mirror(NARROWS_BLUE_INHIBITOR) },
    ],
  },
  DECORATIONS: [],
};

export const MAPS = {
  wildcrown: WILDCROWN,
  narrows: NARROWS,
} satisfies Record<string, MapConfig>;

export type MapId = keyof typeof MAPS;

export function isMapId(value: unknown): value is MapId {
  return typeof value === "string" && value in MAPS;
}

/**
 * Make a map the active one: its fields replace MOBAConfig's. Clients only
 * (the server runs matches on different maps side by side).
 */
export function useMap(id: MapId): void {
  Object.assign(MOBAConfig, MAPS[id]);
}

/** Which map is active (the one MOBAConfig holds) */
export function activeMapId(): MapId {
  return (Object.keys(MAPS) as MapId[]).find(id => MAPS[id].WALL_FIELD === MOBAConfig.WALL_FIELD) ?? "wildcrown";
}
