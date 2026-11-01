/**
 * A bot finishes a weakened enemy with its summoner spells: Scorch on it
 * when it's low, Hinder when the bot is losing the trade.
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';

export default defineScenario({
  name: 'bot-summoners-finish',
  description: 'A healthy LaneBot Scorches an enemy champion at 20% health beside it',
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 6,
  setup(sim) {
    sim.addChampion({ playerId: 'bot', championId: 'vex', side: 'red', at: { x: 0, y: 0 }, bot: 'lane', level: 5, summoners: ['scorch', 'blink'] });
    const player = sim.addChampion({ playerId: 'player', championId: 'magnus', side: 'blue', at: { x: -100, y: 100 }, level: 5 });
    player.health = player.maxHealth * 0.2;
  },
  view: { center: { x: -50, y: 50 }, size: 600 },
  check(sim, report, expect) {
    const bot = sim.champion('bot');
    const casts = sim.recorder.events
      .filter(e => e.type === GameEventType.SUMMONER_CAST && e.data.entityId === bot.id)
      .map(e => e.data.spellId);
    expect(casts.includes('scorch'), `the bot should Scorch the weak enemy (cast: ${casts.join(', ') || 'nothing'})`);
  },
});
