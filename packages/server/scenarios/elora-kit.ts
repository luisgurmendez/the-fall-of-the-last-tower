/**
 * Elora's kit, piece by piece:
 * - her basic attacks reach farther than anyone's, and every third one on
 *   the same target strikes a weak point for bonus damage
 * - Q poisons her next arrow: bonus damage, a slow and poison ticks after
 * - W pins (roots) the first enemy it hits
 * - E rolls her away and her attacks quicken
 * - R sweeps a long lane with arrows, hitting a champion far down it
 * - a poisoned arrow on a minion poisons it too
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

function hitsOn(sim: Simulation, from: string, to: string, after = 0, before = Infinity): number[] {
  const source = sim.champion(from).id;
  const target = sim.champion(to).id;
  return sim.recorder.events
    .filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === source && e.data.entityId === target && e.time >= after && e.time < before)
    .map(e => e.data.amount as number);
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

let reachedFarTarget = false;
let poisoned = false;
let slowed = false;
let rooted = false;
let quickened = false;
let rolled = 0;
let minionId = '';

export default defineScenario({
  name: 'elora-kit',
  description: "Elora's weak points, poison arrow, pinning arrow, roll and barrage",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 20,
  setup(sim) {
    reachedFarTarget = false;
    poisoned = false;
    slowed = false;
    rooted = false;
    quickened = false;
    rolled = 0;
    sim.addChampion({ playerId: 'elora', championId: 'elora', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 2, E: 3, R: 1 } });
    // A tank at the edge of her reach (230 apart, edge to edge ~190: past every other ranged champion's)
    sim.addChampion({ playerId: 'tank', championId: 'gorath', side: 'red', at: { x: 270, y: 0 }, level: 9 });
    // A Magnus far down the lane for the barrage
    sim.addChampion({ playerId: 'magnus', championId: 'magnus', side: 'red', at: { x: 0, y: -600 }, level: 9 });
  },
  steps: [
    { at: 0.3, note: 'attack the tank from max range', run: sim => { sim.attack('elora', sim.champion('tank').id); } },
    { at: 0.6, run: sim => { reachedFarTarget = sim.champion('elora').position.x < 20; } },
    { at: 5.5, note: 'Q: a poisoned arrow', run: sim => { sim.cast('elora', 'Q'); } },
    { at: 6.4, run: sim => {
      poisoned = sim.champion('tank').hasEffect('elora_venom');
      slowed = sim.champion('tank').hasEffect('slow_20');
    } },
    { at: 9.5, note: 'W: pin the tank', run: sim => { sim.stop('elora'); sim.cast('elora', 'W', sim.champion('tank').position); } },
    { at: 10.2, run: sim => { rooted = sim.champion('tank').hasEffect('root'); } },
    { at: 11, note: 'E: roll back', run: sim => { sim.cast('elora', 'E', { x: -200, y: 0 }); } },
    { at: 11.4, run: sim => {
      rolled = -sim.champion('elora').position.x;
      quickened = sim.champion('elora').hasEffect('elora_dexterity');
    } },
    { at: 12, note: 'R down the lane at Magnus', run: sim => { sim.cast('elora', 'R', sim.champion('magnus').position); } },
    { at: 14, note: 'a poisoned arrow on a minion', run: sim => {
      const elora = sim.champion('elora').position;
      minionId = sim.addMinion({ side: 'red', lane: 'mid', at: { x: elora.x - 150, y: elora.y + 150 }, type: 'caster' }).id;
      sim.cast('elora', 'Q');
    } },
    { at: 14.1, run: sim => { sim.attack('elora', minionId); } },
  ],
  view: { center: { x: 0, y: -200 }, size: 1000 },
  check(sim, report, expect) {
    expect(reachedFarTarget, 'she should attack the tank without walking up (the longest range)');
    const firstHits = hitsOn(sim, 'elora', 'tank', 0, 5.4);
    expect(firstHits.length >= 5, `she should hit the tank several times (${firstHits.length} hits)`);
    // A weak point is a second damage number in the same moment as an arrow's
    const weakPoints = weakPointsOn(sim, 0, 5.4);
    const arrows = firstHits.length - weakPoints;
    expect(weakPoints === Math.floor(arrows / 3), `every third arrow should strike a weak point (${weakPoints} in ${arrows} arrows)`);
    expect(poisoned, 'Q should poison the tank');
    expect(slowed, 'Q should slow the tank');
    const poisonTicks = sim.recorder.events.filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === sim.champion('elora').id &&
      e.data.entityId === sim.champion('tank').id && e.data.damageType === 'magic' && e.time > 5.5 && e.time < 9.5).length;
    expect(poisonTicks >= 3, `the poison should tick 3 times (${poisonTicks})`);
    expect(rooted, 'W should root the tank');
    expect(rolled > 100, `E should roll her back (${Math.round(rolled)})`);
    expect(quickened, 'E should quicken her attacks');
    expect(sum(hitsOn(sim, 'elora', 'magnus', 12, 16)) > 150, 'R should hit Magnus far down the lane');
    const minionPoison = sim.recorder.events.filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === sim.champion('elora').id &&
      e.data.entityId === minionId && e.data.damageType === 'magic').length;
    expect(minionPoison >= 1, `the poison should tick on the minion (${minionPoison} ticks)`);
  },
});

/** Moments in a span when the tank took two physical hits from her at once (an arrow and its weak point) */
function weakPointsOn(sim: Simulation, after: number, before: number): number {
  const elora = sim.champion('elora').id;
  const tank = sim.champion('tank').id;
  const times = sim.recorder.events
    .filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === elora && e.data.entityId === tank &&
      e.data.damageType === 'physical' && e.time >= after && e.time < before)
    .map(e => e.time.toFixed(3));
  return times.length - new Set(times).size;
}
