/**
 * A practice bot farms by default, but turns on a champion that attacks it.
 */
import { defineScenario } from '../src/sim';

let firstHit: number | null = null;
let response: number | null = null;

export default defineScenario({
  name: 'bot-fights-back',
  description: 'A farming LaneBot hits back (attack or ability) within 2s of being attacked',
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 10,
  setup(sim) {
    firstHit = null;
    response = null;
    sim.addChampion({ playerId: 'bot', championId: 'vex', side: 'red', at: { x: 0, y: 0 }, bot: 'lane', level: 3 });
    sim.addChampion({ playerId: 'player', championId: 'lume', side: 'blue', at: { x: -200, y: 200 }, level: 3 });
    sim.onTick(s => {
      const player = s.champion('player');
      const bot = s.champion('bot');
      if (firstHit === null && s.recorder.events.some(e => e.type === 14 && e.data.sourceId === player.id && e.data.entityId === bot.id)) {
        firstHit = s.time;
      }
      if (firstHit !== null && response === null &&
          s.recorder.events.some(e => e.type === 14 && e.data.sourceId === bot.id && e.data.entityId === player.id)) {
        response = s.time;
      }
    });
  },
  steps: [
    { at: 1, note: 'player attacks the bot', run: sim => sim.attack('player', sim.champion('bot').id) },
  ],
  view: { center: { x: -100, y: 100 }, size: 800 },
  check(sim, report, expect) {
    expect(firstHit !== null, 'the player should hit the bot');
    expect(response !== null && response - firstHit! <= 2, `the bot should hit back within 2s (took ${response === null ? 'forever' : (response - firstHit!).toFixed(2) + 's'})`);
  },
});
