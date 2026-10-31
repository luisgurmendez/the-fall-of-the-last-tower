/**
 * A practice bot farms by default, but turns on a champion that attacks it.
 */
import { CHAMPION_DEFINITIONS } from '@siege/shared';
import { defineScenario } from '../src/sim';

/** The player starts within its attack range of the bot, diagonally */
const OFFSET = (CHAMPION_DEFINITIONS.lume.baseStats.attackRange * 0.8) / Math.SQRT2;

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
    sim.addChampion({ playerId: 'player', championId: 'lume', side: 'blue', at: { x: -OFFSET, y: OFFSET }, level: 3 });
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
    // Right away, while the bot (walking off to its lane) is still in range
    { at: 0.2, note: 'player attacks the bot', run: sim => sim.attack('player', sim.champion('bot').id) },
  ],
  view: { center: { x: -OFFSET / 2, y: OFFSET / 2 }, size: 600 },
  check(sim, report, expect) {
    expect(firstHit !== null, 'the player should hit the bot');
    expect(response !== null && response - firstHit! <= 2, `the bot should hit back within 2s (took ${response === null ? 'forever' : (response - firstHit!).toFixed(2) + 's'})`);
  },
});
