/**
 * Fenris's kit, piece by piece:
 * - Q bites an enemy and heals him
 * - W rakes the enemy in front of him and slows it
 * - E pounces on an enemy away from him
 * - hurt under 40% he turns feral: faster, harder claws, a bigger bite heal
 * - R: his attacks heal him, and killing a champion heals him to full
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

const damageBy = (sim: Simulation, to: string, after: number, before: number) => sim.recorder.events
  .filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === sim.champion('fenris').id &&
    e.data.entityId === sim.champion(to).id && e.time >= after && e.time < before)
  .reduce((sum, e) => sum + (e.data.amount as number), 0);
const healsOn = (sim: Simulation, after: number, before: number) => sim.recorder.events
  .filter(e => e.type === GameEventType.HEAL && e.data.entityId === sim.champion('fenris').id && e.time >= after && e.time < before)
  .reduce((sum, e) => sum + (e.data.amount as number), 0);

let slowedByW = false;
let pounceGap = 0;
let feral = false;
let fullAfterKill = false;

export default defineScenario({
  name: 'fenris-kit',
  description: "Fenris's bite, claws, pounce, feral rush and bloodthirst",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 20,
  setup(sim) {
    slowedByW = false;
    pounceGap = 0;
    feral = false;
    fullAfterKill = false;
    const fenris = sim.addChampion({ playerId: 'fenris', championId: 'fenris', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 3, E: 2, R: 1 } });
    fenris.health = fenris.maxHealth * 0.7;
    sim.addChampion({ playerId: 'tank', championId: 'gorath', side: 'red', at: { x: 80, y: 0 }, level: 9 });
    sim.addChampion({ playerId: 'prey', championId: 'magnus', side: 'red', at: { x: -300, y: 0 }, level: 9 });
  },
  steps: [
    { at: 0.3, note: 'Q on the tank', run: sim => { sim.cast('fenris', 'Q', sim.champion('tank').id); } },
    { at: 1.0, note: 'W on the tank', run: sim => { sim.cast('fenris', 'W', sim.champion('tank').position); } },
    { at: 1.6, run: sim => { slowedByW = sim.champion('tank').hasEffect('slow_30'); } }, // after W's cast time and swing
    { at: 2.0, note: 'E on Magnus', run: sim => { sim.cast('fenris', 'E', sim.champion('prey').id); } },
    { at: 2.8, run: sim => { pounceGap = sim.champion('fenris').position.distanceTo(sim.champion('prey').position); } },
    { at: 3.0, note: 'hurt: feral', run: sim => { sim.champion('fenris').health = sim.champion('fenris').maxHealth * 0.3; } },
    { at: 3.2, run: sim => { feral = sim.champion('fenris').hasEffect('fenris_feral'); } },
    { at: 9.3, note: 'hurt again (he regenerated)', run: sim => { sim.champion('fenris').health = sim.champion('fenris').maxHealth * 0.3; } },
    { at: 9.5, note: 'feral Q and W on Magnus', run: sim => { sim.cast('fenris', 'Q', sim.champion('prey').id); } },
    { at: 10.5, run: sim => { sim.cast('fenris', 'W', sim.champion('prey').position); } },
    { at: 11.5, note: 'R, then attack Magnus to death', run: sim => {
      sim.champion('prey').health = 250;
      sim.cast('fenris', 'R');
    } },
    { at: 11.6, run: sim => { sim.attack('fenris', sim.champion('prey').id); } },
    { at: 16, run: sim => { fullAfterKill = sim.champion('fenris').health >= sim.champion('fenris').maxHealth - 1; } },
  ],
  view: { center: { x: -100, y: 0 }, size: 600 },
  check(sim, report, expect) {
    expect(damageBy(sim, 'tank', 0.3, 0.6) > 0, 'Q should bite the tank');
    const biteHeal = healsOn(sim, 0.3, 0.6);
    expect(biteHeal > 0, 'Q should heal him');
    expect(slowedByW, 'W should slow the tank');
    expect(pounceGap < 80, `E should land him on Magnus (${Math.round(pounceGap)} away)`);
    expect(feral, 'under 40% health he should be feral');
    expect(healsOn(sim, 9.5, 9.8) > biteHeal * 1.8, `a feral bite should heal about twice as much (${Math.round(healsOn(sim, 9.5, 9.8))} vs ${Math.round(biteHeal)})`);
    expect(sim.champion('prey').isDead, 'Fenris should kill Magnus');
    expect(fullAfterKill, 'a kill in his bloodthirst should heal him to full');
  },
});
