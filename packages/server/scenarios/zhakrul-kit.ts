/**
 * Zhak'rul's kit, piece by piece:
 * - Ancient Venom: an attack poisons the tank, the poison ticks and wears off
 * - Attacks stack doses, Toxic Cloud adds one and slows: three doses, ancient
 * - Q hits the poisoned tank much harder than it did fresh
 * - E travels underground and bursts out under the tank, knocking it up
 * - R stuns the tank and its venom burns for seconds
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

const hits = (sim: Simulation, after: number, before: number) => sim.recorder.events
  .filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === sim.champion('zhakrul').id &&
    e.data.entityId === sim.champion('tank').id && e.time >= after && e.time < before);
const damageIn = (sim: Simulation, after: number, before: number) => hits(sim, after, before)
  .reduce((sum, e) => sum + (e.data.amount as number), 0);
const biggestHit = (sim: Simulation, after: number, before: number) => Math.max(0, ...hits(sim, after, before).map(e => e.data.amount as number));
const doses = (sim: Simulation) => sim.champion('tank').activeEffects.find(e => e.definitionId === 'zhakrul_venom')?.stacks ?? 0;

let poisonedAfterOneHit = 0;
let curedLater = true;
let dosesBeforeCloud = 0;
let ancient = false;
let slowed = false;
let knockedUp = false;
let stunned = false;
let ancientAfterR = false;

export default defineScenario({
  name: 'zhakrul-kit',
  description: "Zhak'rul's venom, pincers, toxic cloud, burrow and stinger",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 14,
  setup(sim) {
    poisonedAfterOneHit = 0;
    curedLater = true;
    dosesBeforeCloud = 0;
    ancient = false;
    slowed = false;
    knockedUp = false;
    stunned = false;
    ancientAfterR = false;
    sim.addChampion({ playerId: 'zhakrul', championId: 'zhakrul', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 2, E: 2, R: 1 } });
    sim.addChampion({ playerId: 'tank', championId: 'gorath', side: 'red', at: { x: 100, y: 0 }, level: 9 });
  },
  steps: [
    { at: 0.3, note: 'Q on the fresh tank', run: sim => { sim.cast('zhakrul', 'Q', { x: 100, y: 0 }); } },
    { at: 1.0, note: 'one attack', run: sim => { sim.attack('zhakrul', sim.champion('tank').id); } },
    { at: 1.8, run: sim => { sim.stop('zhakrul'); poisonedAfterOneHit = doses(sim); } },
    { at: 5.3, run: sim => { curedLater = doses(sim) === 0; } },
    { at: 5.4, note: 'attack a while', run: sim => { sim.attack('zhakrul', sim.champion('tank').id); } },
    { at: 7.6, run: sim => { sim.stop('zhakrul'); dosesBeforeCloud = doses(sim); } },
    { at: 7.7, note: 'W', run: sim => { sim.cast('zhakrul', 'W'); } },
    { at: 7.85, run: sim => {
      ancient = sim.champion('tank').hasEffect('zhakrul_ancient_venom');
      slowed = sim.champion('tank').hasEffect('slow_30');
    } },
    { at: 8.0, note: 'Q on the poisoned tank', run: sim => { sim.cast('zhakrul', 'Q', { x: 100, y: 0 }); } },
    { at: 9.0, note: 'back off, E under the tank', run: sim => {
      sim.champion('zhakrul').position.x = -220;
      sim.cast('zhakrul', 'E', { x: 100, y: 0 });
    } },
    ...[9.3, 9.4, 9.5, 9.6, 9.7, 9.8].map(at => ({ at, run: (sim: Simulation) => {
      knockedUp ||= sim.champion('tank').hasEffect('knockup');
    } })),
    { at: 10.5, note: 'R on the tank', run: sim => { sim.cast('zhakrul', 'R', sim.champion('tank').id); } },
    { at: 10.9, run: sim => { // after R's cast time
      stunned = sim.champion('tank').hasEffect('stun');
      ancientAfterR = doses(sim) === 3 && sim.champion('tank').hasEffect('zhakrul_ancient_venom');
    } },
  ],
  view: { center: { x: 0, y: 0 }, size: 600 },
  check(sim, report, expect) {
    expect(poisonedAfterOneHit === 1, `one attack should give one dose (${poisonedAfterOneHit})`);
    expect(damageIn(sim, 1.9, 5.3) > 0, 'the poison should tick after the attack');
    expect(curedLater, 'the poison should wear off three seconds after the last dose');
    expect(dosesBeforeCloud >= 2, `attacks should stack doses (${dosesBeforeCloud})`);
    expect(ancient, 'the cloud\'s dose should make it three: ancient');
    expect(slowed, 'the cloud should slow the tank');
    const fresh = biggestHit(sim, 0.3, 0.8);
    const poisoned = biggestHit(sim, 8.0, 8.5);
    expect(fresh > 0 && poisoned > fresh * 1.25, `Q should hit the poisoned tank harder (${Math.round(fresh)} -> ${Math.round(poisoned)})`);
    expect(sim.champion('zhakrul').position.distanceTo(sim.champion('tank').position) < 120, 'E should end next to the tank');
    expect(knockedUp, 'bursting out should knock the tank up');
    expect(stunned, 'R should stun');
    expect(ancientAfterR, 'R should leave the venom ancient');
    expect(damageIn(sim, 11.0, 13.6) > 150, `the stinger's venom should keep burning (${Math.round(damageIn(sim, 11.0, 13.6))})`);
  },
});
