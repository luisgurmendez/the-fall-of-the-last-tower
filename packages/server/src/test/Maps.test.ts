/**
 * Every map (shared maps.ts) is playable: spawns, structures and lane
 * waypoints are on open ground and reachable from both spawns, the
 * navigation grid is connected, tall grass is out of the forest, and red's
 * half mirrors blue's. Also: matches run on their map, and a client swaps
 * maps in and out of MOBAConfig.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { MAPS, MOBAConfig, activeMapId, calculateIndividualBushPositions, mapLanes, useMap, type MapId } from '@siege/shared';
import { Terrain } from '../navigation/Terrain';
import { GameRoom } from '../game/GameRoom';

for (const mapId of Object.keys(MAPS) as MapId[]) {
  const map = MAPS[mapId];
  const terrain = new Terrain(map);

  describe(`Map: ${map.NAME}`, () => {
    const spawns = [map.CHAMPION_SPAWN.BLUE, map.CHAMPION_SPAWN.RED];
    const places = [
      ...map.TOWERS.POSITIONS.map((tower, i) => ({ name: `tower ${i}`, position: tower.position })),
      ...map.INHIBITORS.POSITIONS.map((inhibitor, i) => ({ name: `inhibitor ${i}`, position: inhibitor.position })),
      ...map.JUNGLE.CAMPS.map(camp => ({ name: camp.id, position: camp.position })),
      ...mapLanes(map).flatMap(lane => lane.waypoints.slice(1, -1).map((point, i) => ({ name: `${lane.id} waypoint ${i + 1}`, position: point }))),
      ...spawns.map((spawn, i) => ({ name: `spawn ${i}`, position: spawn })),
    ];

    test('spawns, structures, camps and lane waypoints are on open ground', () => {
      expect(places.filter(place => terrain.isBlocked(place.position.x, place.position.y)).map(place => place.name)).toEqual([]);
    });

    test('all of them are reachable from both spawns', () => {
      const unreachable = spawns.flatMap(spawn => places
        .filter(place => !terrain.findPath(spawn, place.position))
        .map(place => `${place.name} from (${spawn.x}, ${spawn.y})`));
      expect(unreachable).toEqual([]);
    });

    test('its tall grass is out of the forest', () => {
      const inWalls: string[] = [];
      for (let group = 0; group < map.BUSH_GROUPS.length; group++) {
        for (const bush of calculateIndividualBushPositions(group, map.BUSH_GROUPS)) {
          if (map.WALL_FIELD.distance(bush.x, bush.y) < 0) inWalls.push(`group ${group} (${Math.round(bush.x)}, ${Math.round(bush.y)})`);
        }
      }
      expect(inWalls).toEqual([]);
    });

    test("red's half is blue's mirror image", () => {
      for (let i = 0; i < 200; i++) {
        const x = Math.sin(i * 12.9898) * 2600;
        const y = Math.cos(i * 78.233) * 2600;
        expect(map.WALL_FIELD.distance(x, y)).toBeCloseTo(map.WALL_FIELD.distance(-x, -y), 3);
      }
      expect(map.NEXUS.RED).toEqual({ x: -map.NEXUS.BLUE.x, y: -map.NEXUS.BLUE.y });
    });
  });
}

describe('The Narrows', () => {
  test('is one lane with two towers and an inhibitor a side, and no jungle', () => {
    const map = MAPS.narrows;
    expect(mapLanes(map).map(lane => lane.id)).toEqual(['mid']);
    expect(map.TOWERS.POSITIONS.filter(tower => tower.side === 0).length).toBe(2);
    expect(map.INHIBITORS.POSITIONS.filter(inhibitor => inhibitor.side === 0).length).toBe(1);
    expect(map.JUNGLE.CAMPS.length).toBe(0);
    expect(map.TUNNELS.LIST.length).toBe(0);
  });

  test('a match on it spawns its structures and waves in its lane only', () => {
    const room = new GameRoom({
      gameId: 'narrows-test',
      players: [],
      championDefinitions: new Map(),
      mapId: 'narrows',
    });
    room.start();
    const context = (room as unknown as { context: { mapConfig: typeof MOBAConfig; getStructures(): unknown[] } }).context;
    expect(context.mapConfig).toBe(MAPS.narrows);
    // Two towers, an inhibitor and a nexus a side
    expect(context.getStructures().length).toBe(8);
    room.stop();
  });
});

describe('Swapping maps on a client', () => {
  test('useMap makes a map the active one, and back', () => {
    expect(activeMapId()).toBe('vale');
    useMap('narrows');
    try {
      expect(MOBAConfig.WALL_FIELD).toBe(MAPS.narrows.WALL_FIELD);
      expect(MOBAConfig.NAME).toBe('The Narrows');
      expect(activeMapId()).toBe('narrows');
    } finally {
      useMap('vale');
    }
    expect(MOBAConfig.WALL_FIELD).toBe(MAPS.vale.WALL_FIELD);
    expect(MOBAConfig.JUNGLE.CAMPS.length).toBeGreaterThan(0);
  });
});
