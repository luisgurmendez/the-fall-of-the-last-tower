/**
 * A jungle bot with a few levels walks over to a hurt enemy laner out of its
 * towers' reach and fights it.
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import { JungleBot } from '../src/bots/JungleBot';

export default defineScenario({
  name: 'bot-jungle-ganks',
  description: 'Vex (blue JungleBot, level 5) ganks Magnus at 45% health in the middle of mid lane',
  options: { minionWaves: false, structures: false },
  duration: 20,
  setup(sim) {
    sim.addChampion({ playerId: 'jungler', championId: 'vex', side: 'blue', at: { x: -1100, y: -200 }, level: 5,
      bot: new JungleBot({ playerId: 'jungler' }), summoners: ['reap', 'blink'] });
    const laner = sim.addChampion({ playerId: 'laner', championId: 'magnus', side: 'red', at: { x: 0, y: 0 }, level: 4 });
    laner.health = laner.maxHealth * 0.45;
    // Its own side sees it (the jungler only ganks what its side sees)
    sim.addChampion({ playerId: 'ward', championId: 'elara', side: 'blue', at: { x: -150, y: 150 }, level: 1 });
  },
  view: { center: { x: -550, y: -50 }, size: 1400 },
  check(sim, report, expect) {
    const jungler = sim.champion('jungler');
    const laner = sim.champion('laner');
    const hits = sim.recorder.events.filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === jungler.id && e.data.entityId === laner.id);
    expect(hits.length > 0 || laner.isDead, `the jungler should come and fight the hurt laner (${hits.length} hits)`);
  },
});
