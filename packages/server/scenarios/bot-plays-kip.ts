/**
 * A LaneBot playing Kip uses his kit in a fight: Target Practice marks,
 * his arrows pop the marks, and Run Them Down / Show Them All only once
 * something is marked.
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';

export default defineScenario({
  name: 'bot-plays-kip',
  description: 'Kip (LaneBot, level 9) fights a weaker Gorath',
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 20,
  setup(sim) {
    sim.addChampion({ playerId: 'bot', championId: 'kip', side: 'red', at: { x: 0, y: 0 }, bot: 'lane', level: 9 });
    const enemy = sim.addChampion({ playerId: 'enemy', championId: 'gorath', side: 'blue', at: { x: -180, y: 180 }, level: 7 });
    enemy.health = enemy.maxHealth * 0.7;
  },
  steps: [{ at: 0.2, note: 'Gorath goes for the bot', run: sim => { sim.attack('enemy', sim.champion('bot').id); } }],
  view: { center: { x: -90, y: 90 }, size: 700 },
  check(sim, _report, expect) {
    const bot = sim.champion('bot');
    const casts = sim.recorder.events.filter(e => e.type === GameEventType.ABILITY_CAST && e.data.entityId === bot.id);
    const used = new Set(casts.map(e => e.data.abilityId as string));
    expect(used.has('kip_q'), `the bot should shoot Target Practice (used ${[...used].join(', ') || 'none'})`);
    expect(sim.champion('enemy').isDead, 'Kip should win this fight');
  },
});
