/**
 * Nocthar's kit, piece by piece, against Kael and a few red minions:
 * - Minions dying next to him rise as Hollows (one per passive wait)
 * - Heed Me sends them at Kael (a charge)
 * - Grasping Hands drags and slows Kael; Lament scares him off
 * - Colossus of Bones: the Hollows sink, the colossus rises under Kael
 * - Bone Volley and Trample, paid with the colossus's health
 */
import { GameEventType, InputType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';
import { ServerSummon } from '../src/simulation/ServerSummon';
import { noctharState } from '../src/abilities/handlers/nocthar/state';

const summons = (sim: Simulation, type: 'hollow' | 'colossus') =>
  sim.context.getAllEntities().filter((entity): entity is ServerSummon =>
    entity instanceof ServerSummon && entity.minionType === type && !entity.isDead);

/** A red minion right next to Nocthar, killed by him: it rises (the passive made ready for the scenario) */
function raise(sim: Simulation, x: number, y: number): void {
  const nocthar = sim.champion('nocthar');
  noctharState(nocthar).raiseCooldown = 0;
  const minion = sim.addMinion({ side: 'red', lane: 'mid', at: { x, y } });
  minion.takeDamage(1e9, 'true', nocthar.id, sim.context);
}

let raised = 0;
let hunting = 0;
let feared = false;
let slowed = false;
let colossusUp = false;
let absorbed = false;
let volleyPaid = false;
let healthBeforeVolley = 0;
let castsSeen = new Set<string>();

export default defineScenario({
  name: 'nocthar-kit',
  description: "Nocthar's army: Hollows rising, ordered, frenzied, fused into the colossus",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 14,
  setup(sim) {
    raised = 0;
    hunting = 0;
    feared = false;
    slowed = false;
    colossusUp = false;
    absorbed = false;
    volleyPaid = false;
    healthBeforeVolley = 0;
    castsSeen = new Set();
    sim.addChampion({ playerId: 'nocthar', championId: 'nocthar', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 2, E: 3, R: 1 } });
    sim.addChampion({ playerId: 'kael', championId: 'warrior', side: 'red', at: { x: 220, y: -220 }, level: 9 });
  },
  steps: [
    { at: 0.2, note: 'three red minions fall next to him: three Hollows climb out', run: sim => {
      raise(sim, 40, -20);
      raise(sim, -30, -40);
      raise(sim, 20, 40);
      raised = summons(sim, 'hollow').length;
    } },
    { at: 1.2, note: 'Heed Me: at Kael (a charge)', run: sim => {
      // As the client sends it: the unit under the cursor, and where the cursor is
      const kael = sim.champion('kael');
      sim.input('nocthar', { type: InputType.ABILITY, slot: 'E', targetType: 'unit', targetEntityId: kael.id, targetX: kael.position.x, targetY: kael.position.y });
    } },
    { at: 1.4, run: sim => {
      hunting = summons(sim, 'hollow').filter(hollow => hollow.order.kind === 'attack').length;
    } },
    { at: 3, note: 'Grasping Hands on Kael', run: sim => { sim.cast('nocthar', 'Q', sim.champion('kael').position); } },
    // (its cast, then the circle filling before the hands)
    { at: 4.15, run: sim => { slowed = sim.champion('kael').hasEffect('slow_30'); } },
    { at: 4.2, note: 'Kael walks up to him; Lament', run: sim => {
      const nocthar = sim.champion('nocthar').position;
      sim.champion('kael').position.setFrom(nocthar.added(nocthar.subtracted(nocthar).normalized().scaled(0)).clone());
      sim.champion('kael').position.x += 80;
      sim.cast('nocthar', 'W');
    } },
    { at: 4.7, run: sim => { feared = sim.champion('kael').hasEffect('fear'); } },
    { at: 6, note: 'Colossus of Bones at Kael', run: sim => { sim.cast('nocthar', 'R', sim.champion('kael').position); } },
    { at: 7.8, run: sim => {
      colossusUp = summons(sim, 'colossus').length === 1;
      absorbed = summons(sim, 'hollow').length === 0;
    } },
    { at: 8.5, note: 'Bone Volley at Kael', run: sim => {
      healthBeforeVolley = summons(sim, 'colossus')[0]?.health ?? 0;
      sim.cast('nocthar', 'W', sim.champion('kael').position);
    } },
    { at: 8.6, run: sim => {
      const colossus = summons(sim, 'colossus')[0];
      volleyPaid = !!colossus && colossus.health < healthBeforeVolley;
    } },
    { at: 10.5, note: 'Trample through Kael', run: sim => { sim.cast('nocthar', 'E', sim.champion('kael').position); } },
    { at: 13.5, run: sim => {
      for (const event of sim.recorder.events) {
        if (event.type === GameEventType.ABILITY_CAST) castsSeen.add(event.data.abilityId as string);
      }
    } },
  ],
  view: { center: { x: 110, y: -110 }, size: 700 },
  check(_sim, _report, expect) {
    expect(raised === 3, `three Hollows should rise (${raised})`);
    expect(hunting === 3, `Heed Me should send all three at Kael (${hunting})`);
    expect(slowed, 'Grasping Hands should slow Kael');
    expect(feared, 'Lament should scare Kael off');
    expect(colossusUp, 'the colossus should rise');
    expect(absorbed, 'the Hollows should sink into it');
    expect(volleyPaid, 'Bone Volley should cost the colossus health');
    for (const id of ['nocthar_hollow_rise', 'nocthar_e_charge', 'nocthar_q_burst', 'nocthar_r_emerge', 'nocthar_colossus_w_throw', 'nocthar_colossus_w_impact', 'nocthar_colossus_e_trample', 'nocthar_colossus_e_end']) {
      expect(castsSeen.has(id), `the clients should hear of ${id}`);
    }
  },
});
