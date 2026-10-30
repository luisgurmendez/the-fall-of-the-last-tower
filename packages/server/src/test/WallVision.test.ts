/**
 * Walls block vision: a champion can't see an enemy on the other side of a
 * wall, even within sight range.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { MOBAConfig, Vector, WallGrid } from '@siege/shared';
import { Simulation } from '../sim';

describe('Walls block vision', () => {
  const grid = new WallGrid(MOBAConfig.WALLS);
  // A wall tile from the layout, and points on either side of it
  const wall = MOBAConfig.WALLS.find(w => w.width >= 128 && w.height >= 64)!;
  const left = new Vector(wall.position.x - wall.width / 2 - 60, wall.position.y);
  const right = new Vector(wall.position.x + wall.width / 2 + 60, wall.position.y);

  test('the wall grid finds walls and blocked sight lines', () => {
    expect(grid.isWall(wall.position.x, wall.position.y)).toBe(true);
    expect(grid.hasLineOfSight(left.x, left.y, right.x, right.y)).toBe(false);
    expect(grid.hasLineOfSight(left.x, left.y, left.x, left.y - 40)).toBe(true);
  });

  test('a champion behind a wall is hidden; walking around it reveals it', () => {
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    try {
      const viewer = sim.addChampion({ playerId: 'blue', championId: 'vex', side: 'blue', at: left });
      const hider = sim.addChampion({ playerId: 'red', championId: 'vex', side: 'red', at: right });
      sim.run(0.1);

      expect(viewer.position.distanceTo(hider.position)).toBeLessThan(800);
      expect(sim.context.isVisibleTo(hider, 0)).toBe(false);

      // Step out in the open next to the viewer
      hider.position = left.added(new Vector(0, -60));
      sim.run(0.1);
      expect(sim.context.isVisibleTo(hider, 0)).toBe(true);
    } finally {
      sim.dispose();
    }
  });
});
