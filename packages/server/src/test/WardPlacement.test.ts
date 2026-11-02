/**
 * Ward placement: a click past the placement range places the ward at the
 * edge of the range toward it, one in a wall at the wall's edge, and each
 * player keeps at most one control ward (apart from the others). Control
 * wards are bought in the shop and carried, not trinket charges.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { CONTROL_WARD_ITEM_ID, GameConfig, InputType, MOBAConfig, type WardType } from '@siege/shared';
import { Simulation } from '../sim';
import { findWallCrossing } from './wallSpots';

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
    const wall = findWallCrossing(192, 300);
    // Stand just left of the wall and aim at its middle
    const sim = setup({ x: wall.left - 60, y: wall.y });
    place(sim, 'stealth', wall.x, wall.y);
    const [ward] = sim.context.getWardsByOwner('p1');
    expect(ward).toBeDefined();
    expect(sim.context.terrain.isBlocked(ward.position.x, ward.position.y)).toBe(false);
    expect(ward.position.x).toBeGreaterThan(wall.left - 20);
    sim.dispose();
  });

  test('a second control ward replaces the first, and stealth wards are counted apart', () => {
    const sim = setup({ x: 0, y: 0 });
    sim.champion('p1').trinketCharges = 5;
    sim.champion('p1').controlWards = 2;
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

  test('control wards are bought at the fountain, up to two carried, and placing one uses one', () => {
    const { CONTROL_WARD_COST, MAX_CONTROL_WARDS_CARRIED } = GameConfig.VISION;
    const sim = setup(MOBAConfig.CHAMPION_SPAWN.BLUE);
    const champion = sim.champion('p1');
    champion.gold = 1000;
    for (let i = 0; i < MAX_CONTROL_WARDS_CARRIED + 1; i++) {
      sim.input('p1', { type: InputType.BUY_ITEM, itemId: CONTROL_WARD_ITEM_ID });
      sim.run(0.05);
    }
    expect(champion.controlWards).toBe(MAX_CONTROL_WARDS_CARRIED);
    expect(champion.gold).toBeCloseTo(1000 - MAX_CONTROL_WARDS_CARRIED * CONTROL_WARD_COST, -1);

    const charges = champion.trinketCharges;
    place(sim, 'control', champion.position.x + 100, champion.position.y);
    expect(sim.context.getWardsByOwner('p1').filter(ward => ward.wardType === 'control').length).toBe(1);
    expect(champion.controlWards).toBe(MAX_CONTROL_WARDS_CARRIED - 1);
    expect(champion.trinketCharges).toBe(charges);
    sim.dispose();
  });

  test('without a control ward carried, key 5 places nothing', () => {
    const sim = setup({ x: 0, y: 0 });
    place(sim, 'control', 100, 0);
    expect(sim.context.getWardsByOwner('p1').length).toBe(0);
    sim.dispose();
  });
});
