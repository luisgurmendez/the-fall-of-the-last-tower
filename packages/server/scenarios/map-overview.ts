/**
 * The whole map at the start of a match: walls, river, lanes, bushes, towers
 * (with range), inhibitors and jungle camps. Use it to look at layout changes.
 */
import { MOBAConfig } from '@siege/shared';
import { defineScenario } from '../src/sim';

export default defineScenario({
  name: 'map-overview',
  description: 'The map at game start (walls, lanes, river, bushes, towers, inhibitors, camps)',
  options: { minionWaves: false },
  duration: 0.1,
  view: { size: MOBAConfig.MAP_SIZE.width, px: 1000 },
  frames: 1,
  check(sim, report, expect) {
    expect(report.towers.blue === 6 && report.towers.red === 6, 'each side should have 6 towers');
    expect(report.inhibitors.blue === 3 && report.inhibitors.red === 3, 'each side should have 3 inhibitors');
    expect((report.units['jungle creatures'] ?? 0) > 10, 'jungle camps should spawn');
  },
});
