/**
 * Zhak'rul's Burrowed Ambush goes under walls: from beside a thin jungle
 * wall he comes out on its far side, where walking would have to go around.
 */
import { defineScenario } from '../src/sim';

/** A wall 128 wide in the blue jungle (siegeMap.ts), centered at (-2176, -768) */
const WALL_X = -2176;
const WALL_HALF = 64;
const Y = -768;

export default defineScenario({
  name: 'zhakrul-burrow',
  description: "Zhak'rul burrows under a thin jungle wall",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 1.5,
  setup(sim) {
    sim.addChampion({ playerId: 'zhakrul', championId: 'zhakrul', side: 'blue', at: { x: WALL_X + WALL_HALF + 45, y: Y }, level: 3, ranks: { E: 1 } });
  },
  steps: [
    { at: 0.2, note: 'E across the wall', run: sim => { sim.cast('zhakrul', 'E', { x: WALL_X - WALL_HALF - 60, y: Y }); } },
  ],
  view: { center: { x: WALL_X, y: Y }, size: 500 },
  check(sim, report, expect) {
    const x = sim.champion('zhakrul').position.x;
    expect(x < WALL_X - WALL_HALF, `he should come out past the wall (x ${Math.round(x)}, the wall ends at ${WALL_X - WALL_HALF})`);
  },
});
