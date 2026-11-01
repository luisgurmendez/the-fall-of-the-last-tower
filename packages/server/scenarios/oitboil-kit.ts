/**
 * Oitboil's kit, piece by piece:
 * - Q's sparks hit the enemy beside him and heat him up
 * - E rockets him away and leaves a trail of fire that burns an enemy in it
 * - casting heats him to an overheat: he burns, his abilities hit harder
 * - W heals him and puts the overheat out
 * - R pours fire on a champion in front of him (a share of its current
 *   health), then he can't cast or attack for a while
 */
import { GameEventType, OITBOIL_HEAT } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

function damageTo(sim: Simulation, from: string, to: string, after = 0, before = Infinity): number {
  const source = sim.champion(from).id;
  const target = sim.champion(to).id;
  return sim.recorder.events
    .filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === source && e.data.entityId === target && e.time >= after && e.time < before)
    .reduce((sum, e) => sum + (e.data.amount as number), 0);
}

const heat = (sim: Simulation) => sim.champion('oitboil').passiveState.stacks;

let heatAfterQ = 0;
let plainQ = 0;
let overheated = false;
let burnedHealth = 0;
let heatedQ = 0;
let healthBeforeW = 0;
let healedByW = 0;
let overheatedAfterW = true;
let magnusHealthBeforeR = 0;
let castDuringExhaustion = true;

export default defineScenario({
  name: 'oitboil-kit',
  description: "Oitboil's sparks, trail of fire, overheat, blue fire and flamethrower",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 18,
  setup(sim) {
    heatAfterQ = 0;
    plainQ = 0;
    overheated = false;
    burnedHealth = 0;
    heatedQ = 0;
    healthBeforeW = 0;
    healedByW = 0;
    overheatedAfterW = true;
    magnusHealthBeforeR = 0;
    castDuringExhaustion = true;
    sim.addChampion({ playerId: 'oitboil', championId: 'oitboil', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 2, E: 3, R: 1 } });
    // A tank beside him for the sparks, a Magnus for the flamethrower
    sim.addChampion({ playerId: 'tank', championId: 'gorath', side: 'red', at: { x: 90, y: 0 }, level: 9 });
    sim.addChampion({ playerId: 'magnus', championId: 'magnus', side: 'red', at: { x: -400, y: 300 }, level: 9 });
  },
  steps: [
    { at: 0.5, note: 'Q on the tank', run: sim => { sim.cast('oitboil', 'Q'); } },
    { at: 0.6, run: sim => { heatAfterQ = heat(sim); plainQ = damageTo(sim, 'oitboil', 'tank', 0.5, 0.6); } },
    { at: 1.0, note: 'E away, over where the tank will walk', run: sim => { sim.cast('oitboil', 'E', { x: -220, y: 0 }); } },
    { at: 1.6, note: 'the tank walks into the fire', run: sim => { sim.move('tank', -150, 0); } },
    // Heat it up: Q every 3 seconds (heat doesn't fall in between) plus the E
    { at: 4.0, run: sim => { sim.cast('oitboil', 'Q'); } },
    { at: 7.1, run: sim => { sim.cast('oitboil', 'Q'); } },
    { at: 10.2, run: sim => { sim.cast('oitboil', 'Q'); } },
    { at: 10.3, run: sim => { overheated = sim.champion('oitboil').hasEffect('oitboil_overheated'); burnedHealth = sim.champion('oitboil').health; } },
    { at: 13.3, note: 'an overheated Q', run: sim => { sim.cast('oitboil', 'Q'); } },
    { at: 13.4, run: sim => {
      heatedQ = damageTo(sim, 'oitboil', 'tank', 13.3, 13.4);
      burnedHealth -= sim.champion('oitboil').health;
    } },
    { at: 13.6, note: 'W puts it out', run: sim => { healthBeforeW = sim.champion('oitboil').health; sim.cast('oitboil', 'W'); } },
    { at: 13.7, run: sim => {
      healedByW = sim.champion('oitboil').health - healthBeforeW;
      overheatedAfterW = sim.champion('oitboil').hasEffect('oitboil_overheated');
    } },
    { at: 14, note: 'Magnus walks up', run: sim => { sim.move('magnus', -330, 0); sim.move('oitboil', -200, 0); } },
    { at: 15.5, note: 'R on Magnus', run: sim => {
      magnusHealthBeforeR = sim.champion('magnus').health;
      sim.cast('oitboil', 'R', sim.champion('magnus').position);
    } },
    { at: 16.7, note: 'exhausted: Q fails', run: sim => {
      const before = sim.recorder.events.filter(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'oitboil_q').length;
      sim.cast('oitboil', 'Q');
      castDuringExhaustion = sim.recorder.events.filter(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === 'oitboil_q').length > before;
    } },
  ],
  view: { center: { x: -150, y: 50 }, size: 700 },
  check(sim, report, expect) {
    expect(plainQ > 0, 'Q should hit the tank beside him');
    expect(heatAfterQ === OITBOIL_HEAT.gain.oitboil_q, `Q should heat him by ${OITBOIL_HEAT.gain.oitboil_q} (heat ${heatAfterQ})`);
    expect(damageTo(sim, 'oitboil', 'tank', 1.6, 3.5) > 0, 'the trail of fire should burn the tank walking into it');
    expect(overheated, 'Q, E, Q, Q, Q should overheat him');
    expect(burnedHealth > 0, 'the overheat should burn him');
    expect(heatedQ > plainQ * 1.1, `an overheated Q should hit harder (${Math.round(heatedQ)} vs ${Math.round(plainQ)})`);
    expect(healedByW > 0, 'W should heal him');
    expect(!overheatedAfterW, 'W should put the overheat out');
    const flamed = magnusHealthBeforeR - sim.champion('magnus').health;
    expect(flamed > magnusHealthBeforeR * 0.2, `R should burn a good share of Magnus's health (${Math.round(flamed)} of ${Math.round(magnusHealthBeforeR)})`);
    expect(!castDuringExhaustion, 'he should be unable to cast while exhausted');
  },
});
