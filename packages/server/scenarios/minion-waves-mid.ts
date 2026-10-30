/**
 * One wave per side in mid, nothing else. Shows where waves meet and how
 * they fight.
 */
import { defineScenario } from '../src/sim';

export default defineScenario({
  name: 'minion-waves-mid',
  description: 'A blue and a red wave walk mid and fight (no champions, no jungle)',
  options: { minionWaves: false, jungle: false },
  duration: 45,
  setup(sim) {
    sim.spawnWave('mid');
  },
  view: { center: { x: 0, y: 0 }, size: 1600 },
  frames: 8,
  check(sim, report, expect) {
    const deaths = report.deaths.filter(d => d.text.includes('minion'));
    expect(deaths.some(d => d.text.startsWith('blue')), 'some blue minions should die');
    expect(deaths.some(d => d.text.startsWith('red')), 'some red minions should die');
  },
});
