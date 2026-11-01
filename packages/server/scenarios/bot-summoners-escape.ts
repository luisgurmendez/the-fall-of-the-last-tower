/**
 * A hurt bot under attack uses its summoner spells to get away: Mend while
 * running, Blink toward home when the chaser nearly has it.
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';

export default defineScenario({
  name: 'bot-summoners-escape',
  description: 'A LaneBot at 22% health, chased by Kael, casts Mend and then Blink',
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 12,
  setup(sim) {
    const bot = sim.addChampion({ playerId: 'bot', championId: 'gorath', side: 'red', at: { x: 0, y: 0 }, bot: 'lane', level: 5, summoners: ['mend', 'blink'] });
    bot.health = bot.maxHealth * 0.22;
    sim.addChampion({ playerId: 'player', championId: 'warrior', side: 'blue', at: { x: -60, y: 60 }, level: 9 });
  },
  steps: [
    { at: 0.1, note: 'Kael attacks the bot and keeps after it', run: sim => sim.attack('player', sim.champion('bot').id) },
  ],
  view: { center: { x: 200, y: -200 }, size: 900 },
  check(sim, report, expect) {
    const bot = sim.champion('bot');
    const casts = sim.recorder.events
      .filter(e => e.type === GameEventType.SUMMONER_CAST && e.data.entityId === bot.id)
      .map(e => e.data.spellId);
    expect(casts.includes('mend'), `the bot should Mend (cast: ${casts.join(', ') || 'nothing'})`);
    expect(casts.includes('blink'), `the bot should Blink away (cast: ${casts.join(', ') || 'nothing'})`);
  },
});
