/**
 * A practice bot alone in mid farms the waves: it times last hits around
 * what its own minions are doing to the enemy minions, and stays out of the
 * enemy tower's range unless its minions are tanking the tower.
 */
import { defineScenario } from '../src/sim';
import { EntityType } from '@siege/shared';

let towerDamage = 0;

export default defineScenario({
  name: 'bot-farms-alone',
  description: 'A LaneBot (Magnus) alone in mid for 5 minutes last-hits most of what it can and never dies to the tower',
  options: { jungle: false },
  duration: 300,
  setup(sim) {
    towerDamage = 0;
    sim.addChampion({ playerId: 'bot', championId: 'magnus', side: 'blue', bot: 'lane' });
    const bot = sim.champion('bot');
    const takeDamage = bot.takeDamage.bind(bot);
    bot.takeDamage = (amount, type, sourceId, context) => {
      const dealt = takeDamage(amount, type, sourceId, context);
      if (sourceId && sim.context.getEntity(sourceId)?.entityType === EntityType.TOWER) towerDamage += dealt;
      return dealt;
    };
  },
  view: { center: { x: 0, y: 0 }, size: 1400 },
  frames: 6,
  check(sim, _report, expect) {
    const bot = sim.champion('bot');
    expect(bot.deaths === 0, `the bot should survive alone in lane (died ${bot.deaths} times)`);
    expect(bot.cs >= 20, `the bot should farm (cs ${bot.cs})`);
    expect(towerDamage < 300, `the bot should stay out of tower range (took ${Math.round(towerDamage)} tower damage)`);
  },
});
