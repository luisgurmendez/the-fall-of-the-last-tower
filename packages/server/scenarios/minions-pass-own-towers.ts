/**
 * A lone blue wave walks the whole bot lane. The lane runs straight through
 * blue's two bot towers; the wave should walk around them without jamming
 * (minions pressing into a tower used to shake in place for seconds).
 */
import { defineScenario } from '../src/sim';
import { LanePath } from '../src/navigation/LanePath';
import { MOBAConfig, Vector } from '@siege/shared';

const lane = new LanePath(MOBAConfig.LANES.BOT.waypoints.map(w => w.clone()));
const outerTower = MOBAConfig.TOWERS.POSITIONS.filter(t => t.side === 0 && t.lane === 'bot')
  .map(t => lane.project(t.position).distance)
  .reduce((a, b) => Math.max(a, b));

/** Longest time any minion went without moving, by minion id */
const longestStill = new Map<string, number>();

export default defineScenario({
  name: 'minions-pass-own-towers',
  description: 'A blue wave walks bot lane past both blue bot towers without jamming',
  options: { minionWaves: false, jungle: false },
  duration: 45,
  setup(sim) {
    longestStill.clear();
    sim.spawnWave('bot', 'blue');

    const last = new Map<string, { x: number; y: number; since: number }>();
    sim.onTick(s => {
      for (const minion of s.entities(e => e.kind === 'minion')) {
        const previous = last.get(minion.id);
        if (!previous || Math.hypot(minion.x - previous.x, minion.y - previous.y) > 3) {
          last.set(minion.id, { x: minion.x, y: minion.y, since: s.time });
          continue;
        }
        longestStill.set(minion.id, Math.max(longestStill.get(minion.id) ?? 0, s.time - previous.since));
      }
    });
  },
  view: { center: { x: 150, y: 1250 }, size: 1300 },
  frames: 8,
  check(sim, _report, expect) {
    const minions = sim.entities(e => e.kind === 'minion' && e.side === 0);
    expect(minions.length >= 5, `the whole wave should be alive (${minions.length})`);
    for (const minion of minions) {
      const along = lane.project(new Vector(minion.x, minion.y)).distance;
      expect(along > outerTower + 100, `${minion.id} should be past blue's outer bot tower`);
      const still = longestStill.get(minion.id) ?? 0;
      expect(still < 1, `${minion.id} should never stand still (stood ${still.toFixed(1)}s)`);
    }
  },
});
