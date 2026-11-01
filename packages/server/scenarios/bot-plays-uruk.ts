/**
 * A LaneBot playing Urûk uses his kit in a fight: W and E up close, and the
 * Fatal Strike only on an enemy under half health.
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';

export default defineScenario({
  name: 'bot-plays-uruk',
  description: 'Urûk (LaneBot, level 9) fights a Magnus he outclasses',
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 15,
  setup(sim) {
    sim.addChampion({ playerId: 'bot', championId: 'uruk', side: 'red', at: { x: 0, y: 0 }, bot: 'lane', level: 9 });
    const enemy = sim.addChampion({ playerId: 'enemy', championId: 'magnus', side: 'blue', at: { x: -150, y: 150 }, level: 7 });
    enemy.health = enemy.maxHealth * 0.7;
  },
  steps: [{ at: 0.2, note: 'Magnus pokes the bot', run: sim => { sim.attack('enemy', sim.champion('bot').id); } }],
  view: { center: { x: -75, y: 75 }, size: 600 },
  check(sim, report, expect) {
    const bot = sim.champion('bot');
    const casts = sim.recorder.events.filter(e => e.type === GameEventType.ABILITY_CAST && e.data.entityId === bot.id);
    const used = new Set(casts.map(e => e.data.abilityId as string));
    expect(used.has('uruk_w') || used.has('uruk_e') || used.has('uruk_q'), `the bot should use its abilities (used ${[...used].join(', ') || 'none'})`);
    expect(sim.champion('enemy').isDead, 'Urûk should win this fight');
  },
});
