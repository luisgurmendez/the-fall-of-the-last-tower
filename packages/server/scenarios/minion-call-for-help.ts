/**
 * Minions fight minions, but switch to an enemy champion that attacks an
 * allied champion near them ("call for help").
 */
import { defineScenario } from '../src/sim';

let firstHitTime: number | null = null;
let responseTime: number | null = null;

export default defineScenario({
  name: 'minion-call-for-help',
  description: 'Blue minions ignore an idle red champion, then turn on it when it attacks a blue champion',
  options: { structures: false, jungle: false, minionWaves: false },
  duration: 8,
  setup(sim) {
    firstHitTime = null;
    responseTime = null;
    for (const [i, offset] of [-20, 0, 20].entries()) {
      sim.addMinion({ side: 'blue', lane: 'mid', at: { x: -60 + i * 10 + offset, y: 60 - i * 10 + offset } });
    }
    sim.addMinion({ side: 'red', lane: 'mid', at: { x: 120, y: -120 }, type: 'melee' });
    sim.addMinion({ side: 'red', lane: 'mid', at: { x: 160, y: -160 }, type: 'melee' });
    sim.addChampion({ playerId: 'ally', championId: 'vex', side: 'blue', at: { x: -150, y: 250 } });
    sim.addChampion({ playerId: 'enemy', championId: 'vex', side: 'red', at: { x: 50, y: 250 } });

    sim.onTick(s => {
      const enemy = s.champion('enemy');
      if (firstHitTime === null && s.recorder.events.some(e => e.type === 14 && e.data.sourceId === enemy.id)) {
        firstHitTime = s.time;
      }
      if (firstHitTime !== null && responseTime === null &&
          s.entities(e => e.kind === 'minion' && e.side === 0 && e.targetId === enemy.id).length > 0) {
        responseTime = s.time;
      }
    });
  },
  steps: [
    { at: 3, note: 'red champion attacks the blue champion', run: sim => sim.attack('enemy', sim.champion('ally').id) },
  ],
  view: { center: { x: 0, y: 100 }, size: 700 },
  check(sim, report, expect) {
    const enemy = sim.champion('enemy');
    const minionHitsBeforeAggro = sim.recorder.events.filter(e =>
      e.type === 14 && e.data.entityId === enemy.id && e.time < 3 &&
      String(e.data.sourceId).includes('sim_e') && sim.recorder.describe(e.data.sourceId as string).includes('minion')
    );
    expect(minionHitsBeforeAggro.length === 0, 'minions should not attack an idle champion while enemy minions are around');
    expect(firstHitTime !== null, 'the red champion should hit the blue champion');
    expect(responseTime !== null && responseTime - firstHitTime! <= 1.0,
      `blue minions should switch to the red champion within 1s of the call for help (took ${responseTime === null ? 'forever' : (responseTime - firstHitTime!).toFixed(2) + 's'})`);
  },
});
