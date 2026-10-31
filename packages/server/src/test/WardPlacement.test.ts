/**
 * Ward placement: a click past the placement range places the ward at the
 * edge of the range toward it, one in a wall at the wall's edge, and each
 * player keeps at most one control ward (apart from the others).
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { GameConfig, InputType, MOBAConfig, type WardType } from '@siege/shared';
import { Simulation } from '../sim';

function setup(at: { x: number; y: number }): Simulation {
  const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
  sim.addChampion({ playerId: 'p1', championId: 'warrior', side: 'blue', at });
  return sim;
}

function place(sim: Simulation, wardType: WardType, x: number, y: number): void {
  // Skip the trinket's cooldown between wards
  sim.champion('p1').trinketCooldown = 0;
  sim.input('p1', { type: InputType.PLACE_WARD, wardType, x, y });
  sim.run(0.1);
}

describe('Ward placement', () => {
  test('a click past the placement range places the ward at the edge of the range toward it', () => {
    const sim = setup({ x: 0, y: 0 });
    place(sim, 'stealth', 1000, 0);
    const [ward] = sim.context.getWardsByOwner('p1');
    expect(ward).toBeDefined();
    expect(ward.position.x).toBeCloseTo(GameConfig.VISION.WARD_PLACE_RANGE, 0);
    expect(ward.position.y).toBeCloseTo(0, 0);
    sim.dispose();
  });

  test('a ward aimed into a wall goes at the edge of the wall', () => {
    const wall = MOBAConfig.WALLS.find(w => w.width >= 192 && w.height >= 192)!;
    // Stand just left of the wall and aim at its middle
    const sim = setup({ x: wall.position.x - wall.width / 2 - 60, y: wall.position.y });
    place(sim, 'stealth', wall.position.x, wall.position.y);
    const [ward] = sim.context.getWardsByOwner('p1');
    expect(ward).toBeDefined();
    expect(sim.context.terrain.isBlocked(ward.position.x, ward.position.y)).toBe(false);
    expect(ward.position.x).toBeGreaterThan(wall.position.x - wall.width / 2 - 20);
    sim.dispose();
  });

  test('a second control ward replaces the first, and stealth wards are counted apart', () => {
    const sim = setup({ x: 0, y: 0 });
    sim.champion('p1').trinketCharges = 5;
    place(sim, 'control', 100, 0);
    place(sim, 'stealth', 0, 100);
    place(sim, 'control', -100, 0);
    const wards = sim.context.getWardsByOwner('p1');
    const controls = wards.filter(ward => ward.wardType === 'control');
    expect(controls.length).toBe(GameConfig.VISION.MAX_CONTROL_WARDS);
    expect(controls[0].position.x).toBeCloseTo(-100, 0);
    expect(wards.filter(ward => ward.wardType === 'stealth').length).toBe(1);
    sim.dispose();
  });
});
