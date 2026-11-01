/**
 * A JungleBot clears its side's camps on its own, with the full map running.
 */
import { defineScenario } from '../src/sim';
import { JungleBot } from '../src/bots/JungleBot';

export default defineScenario({
  name: 'bot-jungles',
  description: 'Kael (red JungleBot, Reap and Mend) clears red jungle camps for three minutes',
  duration: 180,
  setup(sim) {
    sim.addChampion({ playerId: 'jungler', championId: 'warrior', side: 'red', bot: new JungleBot({ playerId: 'jungler' }), summoners: ['reap', 'mend'] });
  },
  view: { center: { x: 1200, y: -1200 }, size: 2600 },
  frames: 9,
  check(sim, report, expect) {
    const jungler = report.champions.find(c => c.playerId === 'jungler')!;
    const monsterKills = report.deaths.filter(d => d.text.includes('killed by red warrior (jungler)') && !d.text.includes('minion')).length;
    expect(monsterKills >= 8, `the jungler should kill at least 8 monsters (killed ${monsterKills})`);
    expect(jungler.level >= 2, `the jungler should level up (level ${jungler.level})`);
    expect(jungler.deaths === 0, 'the jungler should survive its clear');
  },
});
