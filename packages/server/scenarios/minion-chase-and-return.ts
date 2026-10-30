/**
 * A minion notices an enemy minion off to the side of the lane, chases and
 * kills it, then rejoins the lane further along instead of walking back.
 */
import { defineScenario } from '../src/sim';
import { LanePath } from '../src/navigation/LanePath';
import { MOBAConfig, Vector } from '@siege/shared';

const lane = new LanePath(MOBAConfig.LANES.MID.waypoints.map(w => w.clone()));

export default defineScenario({
  name: 'minion-chase-and-return',
  description: 'A blue melee minion chases a red caster standing off the lane, kills it and walks on down the lane',
  options: { structures: false, jungle: false, minionWaves: false },
  duration: 40,
  setup(sim) {
    sim.addMinion({ side: 'blue', lane: 'mid', at: { x: -300, y: 300 }, type: 'melee' });
    sim.addMinion({ side: 'blue', lane: 'mid', at: { x: -320, y: 320 }, type: 'melee' });
    // Off-lane, within sight but outside attack range
    sim.addMinion({ side: 'red', lane: 'mid', at: { x: -60, y: 260 }, type: 'caster' });
  },
  view: { center: { x: 0, y: 0 }, size: 1400 },
  check(sim, report, expect) {
    expect(report.deaths.some(d => d.text.startsWith('red caster')), 'the red caster should be chased down and killed');
    const blues = sim.entities(e => e.kind === 'minion' && e.side === 0);
    expect(blues.length > 0, 'blue minions should survive');
    for (const blue of blues) {
      const projection = lane.project(new Vector(blue.x, blue.y));
      expect(projection.offset < 60, `blue minion ${blue.id} should be back on the lane (offset ${projection.offset.toFixed(0)})`);
      expect(projection.distance > lane.project(new Vector(-60, 260)).distance + 200,
        `blue minion ${blue.id} should have moved on past the fight`);
    }
  },
});
