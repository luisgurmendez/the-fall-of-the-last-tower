/**
 * A practice bot alone in mid hits the enemy outer tower while its minions
 * tank it, so a lane it wins turns into a lost tower (it never hit towers,
 * so a bot could not win a match). It still stays out of tower fire.
 */
import { defineScenario } from '../src/sim';
import { EntityType } from '@siege/shared';

let botTowerDamage = 0;
let towerDamageTaken = 0;

export default defineScenario({
  name: 'bot-sieges-tower',
  description: 'A LaneBot (Kael) alone in mid damages the red outer tower under minion cover without taking tower shots',
  options: { jungle: false },
  duration: 240,
  setup(sim) {
    botTowerDamage = 0;
    towerDamageTaken = 0;
    sim.addChampion({ playerId: 'bot', championId: 'warrior', side: 'blue', bot: 'lane' });
    const bot = sim.champion('bot');

    const takeDamage = bot.takeDamage.bind(bot);
    bot.takeDamage = (amount, type, sourceId, context) => {
      const dealt = takeDamage(amount, type, sourceId, context);
      if (sourceId && sim.context.getEntity(sourceId)?.entityType === EntityType.TOWER) towerDamageTaken += dealt;
      return dealt;
    };

    for (const tower of sim.context.getAllEntities()) {
      if (tower.entityType !== EntityType.TOWER || tower.side !== 1) continue;
      const towerTakeDamage = tower.takeDamage.bind(tower);
      tower.takeDamage = (amount, type, sourceId, context) => {
        const dealt = towerTakeDamage(amount, type, sourceId, context);
        if (sourceId === bot.id) botTowerDamage += dealt;
        return dealt;
      };
    }
  },
  view: { center: { x: 300, y: -300 }, size: 1000 },
  frames: 6,
  check(sim, _report, expect) {
    expect(botTowerDamage > 300, `the bot should hit the enemy tower under minion cover (dealt ${Math.round(botTowerDamage)})`);
    expect(towerDamageTaken < 300, `the bot should not take tower shots (took ${Math.round(towerDamageTaken)})`);
    expect(sim.champion('bot').deaths === 0, 'the bot should survive');
  },
});
