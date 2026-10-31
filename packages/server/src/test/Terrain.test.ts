/**
 * Terrain: walls block units, paths go around walls, and the map is connected.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { InputType, MOBAConfig, Vector } from '@siege/shared';
import { Terrain } from '../navigation/Terrain';
import { Simulation } from '../sim';

const terrain = new Terrain(MOBAConfig);

describe('Terrain', () => {
  test('the map has walls', () => {
    expect(MOBAConfig.WALLS.length).toBeGreaterThan(20);
  });

  test('every camp, tower and lane waypoint is reachable from both spawns', () => {
    const spawns = [MOBAConfig.CHAMPION_SPAWN.BLUE, MOBAConfig.CHAMPION_SPAWN.RED];
    const destinations: { name: string; position: Vector }[] = [
      ...MOBAConfig.JUNGLE.CAMPS.map(camp => ({ name: camp.id, position: camp.position })),
      ...MOBAConfig.TOWERS.POSITIONS.map((tower, i) => ({ name: `tower ${i}`, position: tower.position })),
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

  test('camps, towers, spawns and lane waypoints are not inside walls', () => {
    const points = [
      MOBAConfig.CHAMPION_SPAWN.BLUE, MOBAConfig.CHAMPION_SPAWN.RED,
      ...MOBAConfig.JUNGLE.CAMPS.map(camp => camp.position),
      ...MOBAConfig.TOWERS.POSITIONS.map(tower => tower.position),
      ...Object.values(MOBAConfig.LANES).flatMap(lane => lane.waypoints),
    ];
    const blocked = points.filter(p => terrain.isBlocked(p.x, p.y)).map(p => `(${p.x}, ${p.y})`);
    expect(blocked).toEqual([]);
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
