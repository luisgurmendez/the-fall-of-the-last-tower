/**
 * Buff camps and the dragon: killing the red buff gives burn-on-hit, the
 * blue buff gives ability haste, and the dragon buffs the whole team.
 */
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

function kill(sim: Simulation, creatureType: string, killerId: string): void {
  const creature = sim.context.getAllEntities().find(e => (e as unknown as { creatureType?: string }).creatureType === creatureType && !e.isDead);
  if (!creature) throw new Error(`No ${creatureType} alive`);
  creature.takeDamage(creature.health + 1, 'true', sim.champion(killerId).id, sim.context);
}

let burnApplied = false;

export default defineScenario({
  name: 'jungle-buffs',
  description: 'Red buff, blue buff and dragon kills grant their buffs; red buff attacks burn',
  options: { minionWaves: false, structures: false },
  duration: 8,
  setup(sim) {
    burnApplied = false;
    sim.addChampion({ playerId: 'blue1', championId: 'vex', side: 'blue', at: { x: 300, y: 300 }, level: 6 });
    sim.addChampion({ playerId: 'blue2', championId: 'vile', side: 'blue', at: { x: -1440, y: 1440 }, level: 6 });
    sim.addChampion({ playerId: 'red1', championId: 'warrior', side: 'red', at: { x: 380, y: 300 }, level: 6 });
    sim.onTick(s => {
      if (s.champion('red1').getEffect('cinders_burn')) burnApplied = true;
    });
  },
  steps: [
    { at: 1, note: 'blue1 takes red buff, blue buff and dragon', run: sim => {
      kill(sim, 'red_buff', 'blue1');
      kill(sim, 'blue_buff', 'blue1');
      kill(sim, 'dragon', 'blue1');
    } },
    { at: 1.5, note: 'blue1 attacks red1', run: sim => sim.attack('blue1', sim.champion('red1').id) },
  ],
  view: { center: { x: 340, y: 300 }, size: 600 },
  check(sim, report, expect) {
    const blue1 = sim.champion('blue1');
    const blue2 = sim.champion('blue2');
    const red1 = sim.champion('red1');
    expect(!!blue1.getEffect('crest_of_cinders'), 'killer should have red buff');
    expect(!!blue1.getEffect('crest_of_insight'), 'killer should have blue buff');
    expect(blue1.getStats().abilityHaste >= 15, 'blue buff should give ability haste');
    expect(!!blue1.getEffect('dragons_might') && !!blue2.getEffect('dragons_might'), 'dragon should buff the whole team');
    expect(!red1.getEffect('dragons_might'), 'dragon should not buff the enemy team');
    expect(burnApplied, 'red buff basic attacks should burn');
    expect(sim.recorder.events.some(e => e.type === 2), 'a DRAGON_KILLED event should be sent');
    expect(sim.recorder.events.some(e => e.type === 17 && e.data.campId === 'dragon'), 'a CAMP_CLEARED event should be sent for the dragon');
  },
});
