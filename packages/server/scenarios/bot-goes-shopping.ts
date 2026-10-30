/**
 * A practice bot with gold to spend recalls to buy its next item instead of
 * staying in lane with it, then heads back out.
 */
import { defineScenario } from '../src/sim';

let boughtAt: number | null = null;

export default defineScenario({
  name: 'bot-goes-shopping',
  description: 'A LaneBot with 1500 gold recalls, buys items at base and walks back toward its lane',
  options: { minionWaves: false, jungle: false },
  duration: 40,
  setup(sim) {
    boughtAt = null;
    sim.addChampion({ playerId: 'bot', championId: 'vex', side: 'blue', at: { x: -300, y: 300 }, bot: 'lane', level: 5 });
    sim.champion('bot').gold = 1500;
    sim.onTick(s => {
      if (boughtAt === null && s.champion('bot').items.some(item => item !== null)) boughtAt = s.time;
    });
  },
  view: { center: { x: -900, y: 900 }, size: 1600 },
  frames: 6,
  check(sim, _report, expect) {
    const bot = sim.champion('bot');
    expect(boughtAt !== null, 'the bot should go home and buy an item');
    expect(bot.gold < 600, `the bot should spend most of its gold (has ${Math.round(bot.gold)})`);
    const fountain = { x: -1440, y: 1440 };
    const fromFountain = Math.hypot(bot.position.x - fountain.x, bot.position.y - fountain.y);
    expect(fromFountain > 400, `the bot should head back out after shopping (${Math.round(fromFountain)} from the fountain)`);
  },
});
