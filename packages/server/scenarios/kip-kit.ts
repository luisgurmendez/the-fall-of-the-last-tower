/**
 * Kip's kit, piece by piece, against a tank and two more champions:
 * - Q marks the tank; his next arrow pops the mark for a big hit (and he
 *   speeds up), bigger than his arrows
 * - Q again, then W slows the marked tank
 * - E leaps in among the other two and marks them both
 * - R with three marks: three arrows at each of the three
 */
import { GameEventType, KIP_KIT } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

function hitsOn(sim: Simulation, to: string, after = 0, before = Infinity): number[] {
  const source = sim.champion('kip').id;
  const target = sim.champion(to).id;
  return sim.recorder.events
    .filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === source && e.data.entityId === target && e.time >= after && e.time < before)
    .map(e => e.data.amount as number);
}

let markedByQ = false;
let popped = false;
let hunting = false;
let slowed = false;
let markedByE = 0;
let ultimateArrows = 0;

export default defineScenario({
  name: 'kip-kit',
  description: "Kip's marks: the pop, the slow, the leap and the volleys",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 14,
  setup(sim) {
    markedByQ = false;
    popped = false;
    hunting = false;
    slowed = false;
    markedByE = 0;
    ultimateArrows = 0;
    sim.addChampion({ playerId: 'kip', championId: 'kip', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 2, E: 3, R: 1 } });
    sim.addChampion({ playerId: 'tank', championId: 'gorath', side: 'red', at: { x: 330, y: 0 }, level: 9 });
    sim.addChampion({ playerId: 'mage', championId: 'magnus', side: 'red', at: { x: 120, y: -330 }, level: 9 });
    sim.addChampion({ playerId: 'brute', championId: 'warrior', side: 'red', at: { x: 200, y: -260 }, level: 9 });
  },
  steps: [
    { at: 0.3, note: 'Q: mark the tank', run: sim => { sim.cast('kip', 'Q', sim.champion('tank').position); } },
    { at: 1.3, note: 'his arrow pops the mark', run: sim => {
      markedByQ = sim.champion('tank').hasEffect(KIP_KIT.markEffect);
      sim.attack('kip', sim.champion('tank').id);
    } },
    { at: 4, run: sim => {
      popped = !sim.champion('tank').hasEffect(KIP_KIT.markEffect);
      hunting = sim.champion('kip').hasEffect(KIP_KIT.huntSpeedEffect);
      sim.stop('kip');
    } },
    { at: 9.5, note: 'Q again, then W slows the marked tank', run: sim => { sim.cast('kip', 'Q', sim.champion('tank').position); } },
    { at: 10.5, run: sim => { sim.cast('kip', 'W'); } },
    { at: 10.6, run: sim => { slowed = sim.champion('tank').hasEffect(KIP_KIT.wSlowEffect); } },
    { at: 11, note: 'E: leap in among the other two', run: sim => { sim.cast('kip', 'E', { x: 120, y: -200 }); } },
    { at: 11.6, run: sim => {
      markedByE = ['mage', 'brute'].filter(id => sim.champion(id).hasEffect(KIP_KIT.markEffect)).length;
    } },
    { at: 11.7, note: 'R: three marks, three arrows at each', run: sim => { sim.cast('kip', 'R'); } },
    { at: 13.5, run: sim => {
      ultimateArrows = ['tank', 'mage', 'brute']
        .map(id => hitsOn(sim, id, 11.7, 13.5).length)
        .reduce((a, b) => a + b, 0);
    } },
  ],
  view: { center: { x: 160, y: -150 }, size: 800 },
  check(sim, _report, expect) {
    expect(markedByQ, 'Target Practice should mark the tank');
    const arrowsAndPop = hitsOn(sim, 'tank', 1.3, 4);
    expect(popped, 'his arrow should pop the mark');
    expect(arrowsAndPop.length >= 2 && Math.max(...arrowsAndPop) > Math.min(...arrowsAndPop) * 1.2,
      `the pop should hit harder than an arrow (${arrowsAndPop.map(Math.round).join(', ')})`);
    expect(hunting, 'hitting the marked should speed him up');
    expect(slowed, 'Run Them Down should slow the marked tank');
    expect(markedByE === 2, `Grand Entrance should mark both champions where he lands (${markedByE})`);
    expect(ultimateArrows === 9, `Show Them All with three marks should land 9 arrows (${ultimateArrows})`);
  },
});
