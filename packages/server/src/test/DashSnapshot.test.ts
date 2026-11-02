/**
 * A dash shows as one in the champion's snapshot (isDashing and the
 * ability's id), so clients hold its frame of motion and draw its
 * afterimages, and stops showing when it ends.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { Simulation } from '../sim';

describe('Dash snapshots', () => {
  test("Kael's charge (a generic dash) shows as a dash while it lasts", () => {
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    try {
      const champion = sim.addChampion({ playerId: 'p1', championId: 'warrior', side: 'blue', at: { x: 0, y: 0 }, level: 3, ranks: { E: 1 } });
      expect(sim.cast('p1', 'E', { x: 250, y: 0 })).toBe(true);
      sim.run(0.1);
      const dashing = champion.toSnapshot();
      expect(dashing.isDashing).toBe(true);
      expect(dashing.dashAbilityId).toBe('warrior_charge');

      sim.run(1);
      const done = champion.toSnapshot();
      expect(done.isDashing).toBe(false);
      expect(done.dashAbilityId).toBeNull();
    } finally {
      sim.dispose();
    }
  });

  test("Vex's dash shows as a dash", () => {
    const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
    try {
      const probe = sim.addChampion({ playerId: 'probe', championId: 'vex', side: 'red', at: { x: 2000, y: 0 } });
      const slot = (['Q', 'W', 'E'] as const).find(s => probe.definition.abilities[s] === 'vex_dash')!;
      const champion = sim.addChampion({ playerId: 'p1', championId: 'vex', side: 'blue', at: { x: 0, y: 0 }, level: 3, ranks: { [slot]: 1 } });
      expect(sim.cast('p1', slot, { x: 250, y: 0 })).toBe(true);
      sim.run(0.05);
      expect(champion.toSnapshot().dashAbilityId).toBe('vex_dash');
    } finally {
      sim.dispose();
    }
  });
});
