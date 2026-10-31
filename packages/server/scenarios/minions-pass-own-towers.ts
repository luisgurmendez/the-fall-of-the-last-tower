/**
 * A lone blue wave walks the whole bot lane. The lane runs straight through
 * blue's two bot towers; the wave should walk around them without jamming
 * (minions pressing into a tower used to shake in place for seconds).
 */
import { defineScenario } from '../src/sim';
import { LanePath } from '../src/navigation/LanePath';
import { DEFAULT_MINION_STATS, MOBAConfig, Vector } from '@siege/shared';

const lane = new LanePath(MOBAConfig.LANES.BOT.waypoints.map(w => w.clone()));
const blueTowers = MOBAConfig.TOWERS.POSITIONS.filter(t => t.side === 0 && t.lane === 'bot');
const outerTower = blueTowers.map(t => lane.project(t.position).distance).reduce((a, b) => Math.max(a, b));
/** Long enough to walk 400 past the outer tower (with the spawn stagger), well short of red's towers */
const DURATION = Math.ceil((outerTower + 400) / DEFAULT_MINION_STATS.melee.movementSpeed + 3);

/** Longest time any minion went without moving, by minion id */
const longestStill = new Map<string, number>();

export default defineScenario({
  name: 'minions-pass-own-towers',
  description: 'A blue wave walks bot lane past both blue bot towers without jamming',
  options: { minionWaves: false, jungle: false },
  duration: DURATION,
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
  view: {
    center: { x: (blueTowers[0].position.x + blueTowers[1].position.x) / 2, y: (blueTowers[0].position.y + blueTowers[1].position.y) / 2 },
    size: 2200,
  },
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
