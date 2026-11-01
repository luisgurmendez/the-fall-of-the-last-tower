/**
 * Hop-To-Eat's kit, piece by piece:
 * - Hop to It!: the first attack hops onto a target out of melee reach and hits harder
 * - Q bites through the tank's armor
 * - W heals it, roots it while it eats, then makes it attack faster
 * - E hops away and readies the next hop
 * - R kicks the tank into Magnus behind it: both hurt, Magnus knocked up
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

const damageBy = (sim: Simulation, to: string, after: number, before: number) => sim.recorder.events
  .filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === sim.champion('hop').id &&
    e.data.entityId === sim.champion(to).id && e.time >= after && e.time < before)
  .reduce((sum, e) => sum + (e.data.amount as number), 0);
const healsOn = (sim: Simulation, after: number, before: number) => sim.recorder.events
  .filter(e => e.type === GameEventType.HEAL && e.data.entityId === sim.champion('hop').id && e.time >= after && e.time < before)
  .reduce((sum, e) => sum + (e.data.amount as number), 0);

let hopGap = Infinity;
let hopSpent = false;
let shredded = false;
let eating = false;
let rush = false;
let readyAfterE = false;
let kickedFrom = 0;
let kickedTo = 0;
let crashKnockup = false;

export default defineScenario({
  name: 'hop-kit',
  description: "Hop-To-Eat's hop, fangs, carrot, bunny hop and savage kick",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 8,
  setup(sim) {
    hopGap = Infinity;
    hopSpent = false;
    shredded = false;
    eating = false;
    rush = false;
    readyAfterE = false;
    kickedFrom = 0;
    kickedTo = 0;
    crashKnockup = false;
    sim.addChampion({ playerId: 'hop', championId: 'hop', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 2, E: 2, R: 1 } });
    sim.addChampion({ playerId: 'tank', championId: 'gorath', side: 'red', at: { x: 220, y: 0 }, level: 9 });
    sim.addChampion({ playerId: 'friend', championId: 'magnus', side: 'red', at: { x: 200, y: 400 }, level: 9 });
  },
  steps: [
    { at: 0.3, note: 'attack the tank from out of reach', run: sim => { sim.attack('hop', sim.champion('tank').id); } },
    { at: 0.9, run: sim => {
      const hop = sim.champion('hop');
      hopGap = hop.position.distanceTo(sim.champion('tank').position) - hop.getRadius() - sim.champion('tank').getRadius();
      hopSpent = hop.passiveState.cooldownRemaining > 4;
    } },
    { at: 1.5, note: 'Q on the tank', run: sim => { sim.cast('hop', 'Q', sim.champion('tank').id); } },
    { at: 1.6, run: sim => { shredded = sim.champion('tank').hasEffect('armor_reduction'); } },
    { at: 2.5, note: 'hurt; W', run: sim => {
      sim.champion('hop').health = sim.champion('hop').maxHealth * 0.5;
      sim.cast('hop', 'W');
    } },
    { at: 2.7, run: sim => {
      eating = sim.champion('hop').hasEffect('hop_eating') && !sim.champion('hop').ccStatus.canMove;
      rush = sim.champion('hop').hasEffect('hop_sugar_rush');
    } },
    { at: 3.5, note: 'E away', run: sim => { sim.stop('hop'); sim.cast('hop', 'E', { x: -200, y: 0 }); } },
    { at: 3.7, run: sim => { readyAfterE = sim.champion('hop').passiveState.cooldownRemaining <= 0; } },
    { at: 4.5, note: 'line up: Hop, the tank, Magnus behind it', run: sim => {
      const at = (id: string, x: number) => { sim.champion(id).position.x = x; sim.champion(id).position.y = 0; };
      at('hop', 0);
      at('tank', 90);
      at('friend', 330);
    } },
    { at: 4.55, note: 'R on the tank', run: sim => {
      kickedFrom = sim.champion('tank').position.x;
      sim.cast('hop', 'R', sim.champion('tank').id);
    } },
    ...[4.7, 4.75, 4.8, 4.85, 4.9, 4.95, 5.0, 5.1].map(at => ({ at, run: (sim: Simulation) => {
      crashKnockup ||= sim.champion('friend').hasEffect('knockup');
    } })),
    { at: 5.5, run: sim => { kickedTo = sim.champion('tank').position.x; } },
  ],
  view: { center: { x: 150, y: 100 }, size: 700 },
  check(sim, report, expect) {
    expect(hopGap < 50, `the first attack should hop onto the tank (${Math.round(hopGap)} away)`);
    expect(hopSpent, 'the hop should go on cooldown');
    expect(damageBy(sim, 'tank', 0.3, 1.2) > 80, `the hopping attack should hit harder (${Math.round(damageBy(sim, 'tank', 0.3, 1.2))})`);
    expect(shredded, 'Q should shred the tank\'s armor');
    expect(healsOn(sim, 2.5, 2.8) > 0, 'W should heal');
    expect(eating, 'W should root it while it eats');
    expect(rush, 'W should make it attack faster');
    expect(readyAfterE, 'E should ready the next hop');
    expect(kickedTo - kickedFrom > 250, `R should kick the tank away (${Math.round(kickedTo - kickedFrom)})`);
    expect(damageBy(sim, 'friend', 4.55, 5.3) > 0, 'the tank should crash into Magnus and hurt him');
    expect(crashKnockup, 'Magnus should be knocked up by the crash');
  },
});
