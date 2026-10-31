/**
 * Terrain: walls block units, paths go around walls, and the map is connected.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { InputType, MOBAConfig, Vector } from '@siege/shared';
import { WALL_GRID_HALF, WALL_TILE_SIZE } from '../../../shared/src/config/mapLayout';
import { Terrain } from '../navigation/Terrain';
import { LanePath } from '../navigation/LanePath';
import { Simulation } from '../sim';

const terrain = new Terrain(MOBAConfig);

describe('Terrain', () => {
  test('the map has walls', () => {
    expect(MOBAConfig.WALLS.length).toBeGreaterThan(20);
  });

  test('every camp, tower, inhibitor and lane waypoint is reachable from both spawns', () => {
    const spawns = [MOBAConfig.CHAMPION_SPAWN.BLUE, MOBAConfig.CHAMPION_SPAWN.RED];
    const destinations: { name: string; position: Vector }[] = [
      ...MOBAConfig.JUNGLE.CAMPS.map(camp => ({ name: camp.id, position: camp.position })),
      ...MOBAConfig.TOWERS.POSITIONS.map((tower, i) => ({ name: `tower ${i}`, position: tower.position })),
      ...MOBAConfig.INHIBITORS.POSITIONS.map((inhibitor, i) => ({ name: `inhibitor ${i}`, position: inhibitor.position })),
      ...Object.values(MOBAConfig.LANES).flatMap(lane =>
        lane.waypoints.slice(1, -1).map((point, i) => ({ name: `${lane.id} waypoint ${i + 1}`, position: point }))),
    ];

    const unreachable: string[] = [];
    for (const spawn of spawns) {
      for (const destination of destinations) {
        if (!terrain.findPath(spawn, destination.position)) unreachable.push(`${destination.name} from (${spawn.x}, ${spawn.y})`);
      }
    }
    expect(unreachable).toEqual([]);
  });

  test('no walkable part of the navigation grid is cut off from the rest', () => {
    // A champion's body fits in gaps paths can't use (they keep 30 units off
    // walls); if one led to a cut-off patch of the grid, a champion that
    // walked in could never path out
    const grid = terrain.navGrid;
    const start = grid.worldToGrid(0, 0);
    const reached = new Uint8Array(grid.width * grid.height);
    const queue = [start.y * grid.width + start.x];
    reached[queue[0]] = 1;
    while (queue.length > 0) {
      const index = queue.pop()!;
      const x = index % grid.width;
      const y = Math.floor(index / grid.width);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const next = ny * grid.width + nx;
        if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height || reached[next] || !grid.isWalkable(nx, ny)) continue;
        reached[next] = 1;
        queue.push(next);
      }
    }

    const cutOff: string[] = [];
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.isWalkable(x, y) && !reached[y * grid.width + x]) {
          const at = grid.gridToWorld(x, y);
          cutOff.push(`(${Math.round(at.x)}, ${Math.round(at.y)})`);
        }
      }
    }
    expect(cutOff).toEqual([]);
  });

  test('walls leave no crack one tile wide (a body fits in, a path does not)', () => {
    const tile = WALL_TILE_SIZE;
    const count = (WALL_GRID_HALF * 2) / tile;
    const solid = Array.from({ length: count }, () => new Array<boolean>(count).fill(false));
    for (const wall of MOBAConfig.WALLS) {
      const col0 = Math.round((wall.position.x - wall.width / 2 + WALL_GRID_HALF) / tile);
      const row0 = Math.round((wall.position.y - wall.height / 2 + WALL_GRID_HALF) / tile);
      for (let row = row0; row < row0 + wall.height / tile; row++) {
        for (let col = col0; col < col0 + wall.width / tile; col++) solid[row][col] = true;
      }
    }
    const isWall = (row: number, col: number) => row < 0 || col < 0 || row >= count || col >= count || solid[row][col];

    const cracks: string[] = [];
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (solid[row][col]) continue;
        const across = [[0, 1], [1, 0], [1, 1], [1, -1]].some(([dr, dc]) => isWall(row - dr, col - dc) && isWall(row + dr, col + dc));
        if (across) cracks.push(`(${-WALL_GRID_HALF + (col + 0.5) * tile}, ${-WALL_GRID_HALF + (row + 0.5) * tile})`);
      }
    }
    expect(cracks).toEqual([]);
  });

  test('camps, towers, inhibitors, spawns and lane waypoints are not inside walls', () => {
    const points = [
      MOBAConfig.CHAMPION_SPAWN.BLUE, MOBAConfig.CHAMPION_SPAWN.RED,
      ...MOBAConfig.JUNGLE.CAMPS.map(camp => camp.position),
      ...MOBAConfig.TOWERS.POSITIONS.map(tower => tower.position),
      ...MOBAConfig.INHIBITORS.POSITIONS.map(inhibitor => inhibitor.position),
      ...Object.values(MOBAConfig.LANES).flatMap(lane => lane.waypoints),
    ];
    const blocked = points.filter(p => terrain.isBlocked(p.x, p.y)).map(p => `(${p.x}, ${p.y})`);
    expect(blocked).toEqual([]);
  });

  test('inhibitors stand on their lane, with room for units to walk around them', () => {
    // Waves walk around their own inhibitor, on either side
    const { radius } = MOBAConfig.INHIBITORS.STATS.collision;
    const clearance = radius + 60;
    for (const { lane, position } of MOBAConfig.INHIBITORS.POSITIONS) {
      const path = new LanePath(MOBAConfig.LANES[lane.toUpperCase() as 'TOP' | 'MID' | 'BOT'].waypoints.map(w => w.clone()));
      expect(path.project(position).offset).toBeLessThan(10);
      for (let angle = 0; angle < 360; angle += 15) {
        const radians = (angle * Math.PI) / 180;
        const x = position.x + Math.cos(radians) * clearance;
        const y = position.y + Math.sin(radians) * clearance;
        expect(terrain.isBlocked(x, y)).toBe(false);
      }
    }
  });

  test('pushes a unit out of a wall', () => {
    // Just inside the left edge of a wall with open ground beside it
    const wall = MOBAConfig.WALLS.find(w => !terrain.isBlocked(w.position.x - w.width / 2 - 40, w.position.y))!;
    const position = new Vector(wall.position.x - wall.width / 2 + 10, wall.position.y);
    expect(terrain.resolveCircle(position, 25)).toBe(true);
    expect(terrain.isBlocked(position.x, position.y)).toBe(false);
  });

  test('a path across the map is found quickly', () => {
    const started = performance.now();
    const path = terrain.findPath(MOBAConfig.CHAMPION_SPAWN.BLUE, MOBAConfig.CHAMPION_SPAWN.RED);
    expect(path).not.toBeNull();
    expect(performance.now() - started).toBeLessThan(50);
  });

  test('a champion ordered across a wall walks around it and arrives', () => {
    // From the thornspitter to the wolves: forest in between, the way round is by the blue buff
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    try {
      const camp = (id: string) => MOBAConfig.JUNGLE.CAMPS.find(c => c.id === id)!.position;
      const start = camp('blue_thornspitter');
      const champion = sim.addChampion({ playerId: 'p1', championId: 'vex', side: 'blue', at: { x: start.x, y: start.y } });
      const destination = { x: camp('blue_wolves').x, y: camp('blue_wolves').y };
      expect(terrain.hasLineOfSight(champion.position, new Vector(destination.x, destination.y))).toBe(false);

      sim.move('p1', destination.x, destination.y);
      let touchedWall = false;
      sim.onTick(s => {
        const p = s.champion('p1').position;
        if (terrain.isBlocked(p.x, p.y)) touchedWall = true;
      });
      sim.runUntil(s => s.champion('p1').position.distanceTo(new Vector(destination.x, destination.y)) < 5, 30);

      expect(champion.position.distanceTo(new Vector(destination.x, destination.y))).toBeLessThan(5);
      expect(touchedWall).toBe(false);
    } finally {
      sim.dispose();
    }
  });

  describe('a point inside a wall', () => {
    const wall = MOBAConfig.WALLS[3];
    const inWall = { x: wall.position.x + wall.width / 2, y: wall.position.y + wall.height / 2 };

    function walkToWall(order: InputType.MOVE | InputType.ATTACK_MOVE) {
      const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
      const champion = sim.addChampion({ playerId: 'p1', championId: 'vex', side: 'blue', at: { x: inWall.x - 250, y: inWall.y } });
      sim.input('p1', { type: order, targetX: inWall.x, targetY: inWall.y });
      sim.runUntil(s => s.champion('p1').targetPosition === null, 20);
      return { sim, champion };
    }

    test('is in a wall', () => {
      expect(terrain.isBlocked(inWall.x, inWall.y)).toBe(true);
    });

    test('ordering a move there again from next to it leaves the champion standing', () => {
      const { sim, champion } = walkToWall(InputType.MOVE);
      try {
        expect(terrain.findPath(champion.position, new Vector(inWall.x, inWall.y))).toEqual([]);
        sim.input('p1', { type: InputType.MOVE, targetX: inWall.x, targetY: inWall.y });
        sim.run(1);
        expect(champion.targetPosition).toBeNull();
      } finally {
        sim.dispose();
      }
    });

    test('an attack-move there ends when it can get no closer', () => {
      const { sim, champion } = walkToWall(InputType.ATTACK_MOVE);
      try {
        sim.run(1);
        expect(champion.attackMoveTarget).toBeNull();
        expect(champion.targetPosition).toBeNull();
      } finally {
        sim.dispose();
      }
    });
  });
});
