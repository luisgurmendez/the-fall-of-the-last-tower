/**
 * Jungle tunnels: a champion ordered to a tunnel's mouth crawls through to
 * the other mouth, hidden under the forest, and can't go straight back in.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { MOBAConfig, Vector, isPointInBushGroup } from '@siege/shared';
import { Simulation } from '../sim';

const { LIST, CRAWL_TIME, COOLDOWN, ABILITY_ID } = MOBAConfig.TUNNELS;

describe('Jungle tunnels', () => {
  const tunnel = LIST[0];
  const a = new Vector(tunnel.a.x, tunnel.a.y);
  const b = new Vector(tunnel.b.x, tunnel.b.y);

  function setup() {
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    // A little way from mouth a, on open ground
    const start = a.added(b.subtracted(a).normalized().scaled(-60));
    const champion = sim.addChampion({ playerId: 'p1', championId: 'vex', side: 'blue', at: { x: start.x, y: start.y } });
    return { sim, champion };
  }

  test('every mouth is on open ground, with forest between the two', () => {
    for (const { a: from, b: to } of LIST) {
      expect(MOBAConfig.WALL_FIELD.distance(from.x, from.y)).toBeGreaterThan(40);
      expect(MOBAConfig.WALL_FIELD.distance(to.x, to.y)).toBeGreaterThan(40);
      let deepest = Infinity;
      for (let t = 0; t <= 1; t += 0.02) deepest = Math.min(deepest, MOBAConfig.WALL_FIELD.distance(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t));
      expect(deepest).toBeLessThan(-50);
    }
  });

  test('no mouth is hidden in tall grass', () => {
    const hidden = LIST.flatMap(({ a: from, b: to }) => [from, to])
      .filter(mouth => MOBAConfig.BUSH_GROUPS.some((_, group) => isPointInBushGroup(mouth, group)));
    expect(hidden).toEqual([]);
  });

  test('walking to a mouth crawls through to the other one, hidden as a tunnel dash', () => {
    const { sim, champion } = setup();
    try {
      sim.move('p1', a.x, a.y);
      sim.runUntil(() => champion.dashAbilityId === ABILITY_ID, 3);
      expect(champion.dashAbilityId).toBe(ABILITY_ID);
      sim.run(CRAWL_TIME + 0.2);
      expect(champion.position.distanceTo(b)).toBeLessThan(10);
      expect(champion.dashAbilityId).toBeNull();
    } finally {
      sim.dispose();
    }
  });

  test('it can\'t go straight back in, and can once the cooldown is over', () => {
    const { sim, champion } = setup();
    try {
      sim.move('p1', a.x, a.y);
      sim.runUntil(() => champion.dashAbilityId === ABILITY_ID, 3);
      sim.run(CRAWL_TIME + 0.2);
      sim.move('p1', b.x + 1, b.y);
      sim.run(1);
      expect(champion.position.distanceTo(b)).toBeLessThan(10);

      sim.run(COOLDOWN);
      sim.move('p1', b.x, b.y);
      sim.runUntil(() => champion.dashAbilityId === ABILITY_ID, 2);
      sim.run(CRAWL_TIME + 0.2);
      expect(champion.position.distanceTo(a)).toBeLessThan(10);
    } finally {
      sim.dispose();
    }
  });

  test('another order on the way calls it off', () => {
    const { sim, champion } = setup();
    try {
      sim.move('p1', a.x, a.y);
      sim.move('p1', a.x - 100, a.y + 100);
      sim.run(3);
      expect(champion.position.distanceTo(b)).toBeGreaterThan(200);
    } finally {
      sim.dispose();
    }
  });
});
