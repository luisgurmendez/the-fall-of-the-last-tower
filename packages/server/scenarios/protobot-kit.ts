/**
 * Protobot 45's kit, piece by piece:
 * - Q's claw catches Magnus and pulls him in, stunned, and shields Protobot
 * - E punches him up into the air
 * - hit by an enemy champion, Protobot learns: armor and magic resist stacks
 * - R charges, then the pulse breaks Magnus's shield and silences him
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

const damageBy = (sim: Simulation, to: string, after: number, before: number) => sim.recorder.events
  .filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === sim.champion('protobot').id &&
    e.data.entityId === sim.champion(to).id && e.time >= after && e.time < before)
  .reduce((sum, e) => sum + (e.data.amount as number) + ((e.data.shieldAbsorbed as number) ?? 0), 0);

let stunnedOnTheWay = false;
let pulledTo = Infinity;
let caughtShield = false;
let knockedUp = false;
let lessons = 0;
let armorGain = 0;
let silenced = false;
let shieldBroken = false;

export default defineScenario({
  name: 'protobot-kit',
  description: "Protobot's claw, rocket punch, machine learning and overload",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 9,
  setup(sim) {
    stunnedOnTheWay = false;
    pulledTo = Infinity;
    caughtShield = false;
    knockedUp = false;
    lessons = 0;
    armorGain = 0;
    silenced = false;
    shieldBroken = false;
    sim.addChampion({ playerId: 'protobot', championId: 'protobot', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 2, E: 2, R: 1 } });
    sim.addChampion({ playerId: 'prey', championId: 'magnus', side: 'red', at: { x: 380, y: 0 }, level: 9 });
  },
  steps: [
    { at: 0.3, note: 'Q at Magnus', run: sim => { sim.cast('protobot', 'Q', sim.champion('prey').position); } },
    ...[0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1].map(at => ({ at, run: (sim: Simulation) => {
      stunnedOnTheWay ||= sim.champion('prey').hasEffect('stun');
      caughtShield ||= sim.champion('protobot').shields.length > 0;
    } })),
    { at: 1.5, run: sim => { pulledTo = sim.champion('protobot').position.distanceTo(sim.champion('prey').position); } },
    { at: 2.0, note: 'E on Magnus', run: sim => { sim.cast('protobot', 'E', sim.champion('prey').id); } },
    { at: 2.2, run: sim => { knockedUp = sim.champion('prey').hasEffect('knockup'); } },
    { at: 3.0, note: 'Magnus fights back', run: sim => { sim.attack('prey', sim.champion('protobot').id); } },
    { at: 3.0, run: sim => { armorGain = -sim.champion('protobot').getStats().armor; } },
    { at: 6.4, run: sim => {
      lessons = sim.champion('protobot').getEffect('protobot_learning')?.stacks ?? 0;
      armorGain += sim.champion('protobot').getStats().armor;
    } },
    { at: 6.5, note: 'Magnus shields himself, Protobot overloads', run: sim => {
      sim.champion('prey').shields.push({ amount: 300, remainingDuration: 5, sourceId: 'test', shieldType: 'normal' });
      sim.cast('protobot', 'R');
    } },
    { at: 7.2, run: sim => {
      silenced = sim.champion('prey').hasEffect('silence');
      shieldBroken = sim.champion('prey').shields.length === 0;
    } },
  ],
  view: { center: { x: 150, y: 0 }, size: 600 },
  check(sim, report, expect) {
    expect(damageBy(sim, 'prey', 0.3, 1.2) > 0, 'the claw should hit Magnus');
    expect(stunnedOnTheWay, 'Magnus should be stunned while he is pulled');
    expect(pulledTo < 90, `Magnus should be pulled to Protobot (${Math.round(pulledTo)} away)`);
    expect(caughtShield, 'catching a champion should shield Protobot');
    expect(knockedUp, 'E should knock Magnus up');
    expect(lessons >= 2, `Magnus's attacks should teach Protobot (${lessons} lessons)`);
    expect(armorGain >= 6, `the lessons should give armor (+${armorGain})`);
    expect(damageBy(sim, 'prey', 6.9, 7.3) > 0, 'the pulse should damage Magnus');
    expect(silenced, 'the pulse should silence Magnus');
    expect(shieldBroken, "the pulse should break Magnus's shield");
  },
});
