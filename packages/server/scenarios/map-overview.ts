/**
 * The whole map at the start of a match: walls, river, lanes, bushes, towers
 * (with range), and jungle camps. Use it to look at layout changes.
 */
import { defineScenario } from '../src/sim';

export default defineScenario({
  name: 'map-overview',
  description: 'The map at game start (walls, lanes, river, bushes, towers, camps)',
  options: { minionWaves: false },
  duration: 0.1,
  view: { size: 3600 },
  frames: 1,
  check(sim, report, expect) {
    expect(report.towers.blue === 6 && report.towers.red === 6, 'each side should have 6 towers');
    expect((report.units['jungle creatures'] ?? 0) > 10, 'jungle camps should spawn');
  },
});
