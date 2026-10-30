/**
 * Two LaneBots play mid with the full map running. A smoke test for bots,
 * waves, towers and the jungle together.
 */
import { defineScenario } from '../src/sim';

export default defineScenario({
  name: 'bot-vs-bot-mid',
  description: 'Vex (blue bot) vs Vile (red bot) in mid for two minutes',
  duration: 120,
  setup(sim) {
    sim.addChampion({ playerId: 'blue-bot', championId: 'vex', side: 'blue', bot: 'lane' });
    sim.addChampion({ playerId: 'red-bot', championId: 'vile', side: 'red', bot: 'lane' });
  },
  view: { center: { x: 0, y: 0 }, size: 2200 },
  frames: 8,
  check(sim, report, expect) {
    const blue = report.champions.find(c => c.playerId === 'blue-bot')!;
    const red = report.champions.find(c => c.playerId === 'red-bot')!;
    expect(blue.cs + red.cs > 0, 'the bots should last-hit at least one minion');
    expect(blue.level > 1 || red.level > 1, 'at least one bot should level up');
    const midMinionDeaths = report.deaths.filter(d => d.text.includes('minion')).length;
    expect(midMinionDeaths > 0, 'minions should die in lane');
  },
});
