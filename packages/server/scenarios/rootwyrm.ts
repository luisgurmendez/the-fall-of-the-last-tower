/**
 * The Rootwyrm wakes in the top river's pit at 4:00 (clients get its timer
 * from the start), roots champions with its eruption, and slain it toughens
 * the killer's whole team with the Heartwood Pact.
 */
import { GameEventType, MOBAConfig } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

const FIRST_SPAWN = 240;
const PIT = MOBAConfig.JUNGLE.CAMPS.find(camp => camp.id === 'rootwyrm')!.position;

function rootwyrm(sim: Simulation) {
  return sim.context.getAllEntities().find(e => (e as unknown as { creatureType?: string }).creatureType === 'rootwyrm' && !e.isDead);
}

let aliveBeforeTime = false;
let aliveAfter = false;
let rooted = false;

export default defineScenario({
  name: 'rootwyrm',
  description: 'The Rootwyrm spawns at 4:00, roots with its eruption, and gives the Heartwood Pact to the team that slays it',
  options: { minionWaves: false, structures: false },
  duration: FIRST_SPAWN + 12,
  setup(sim) {
    aliveBeforeTime = false;
    aliveAfter = false;
    rooted = false;
    sim.addChampion({ playerId: 'tank', championId: 'gorath', side: 'blue', at: { x: PIT.x + 90, y: PIT.y + 60 }, level: 11 });
    sim.addChampion({ playerId: 'ally', championId: 'vex', side: 'blue', at: { x: -2000, y: 2000 }, level: 11 });
    sim.addChampion({ playerId: 'enemy', championId: 'warrior', side: 'red', at: { x: 2000, y: -2000 }, level: 11 });
    sim.onTick(s => {
      if (s.time < FIRST_SPAWN - 1 && rootwyrm(s)) aliveBeforeTime = true;
      if (s.time > FIRST_SPAWN + 1 && rootwyrm(s)) aliveAfter = true;
      if (s.champion('tank').ccStatus.isRooted) rooted = true;
    });
  },
  steps: [
    { at: FIRST_SPAWN + 0.5, note: 'Gorath attacks the Rootwyrm', run: sim => sim.attack('tank', rootwyrm(sim)!.id) },
    { at: FIRST_SPAWN + 9, note: 'Gorath finishes it', run: sim => {
      const monster = rootwyrm(sim)!;
      monster.takeDamage(monster.health + 1, 'true', sim.champion('tank').id, sim.context);
    } },
  ],
  view: { center: { x: PIT.x, y: PIT.y }, size: 700 },
  check(sim, report, expect) {
    expect(!aliveBeforeTime, 'the Rootwyrm should not be up before 4:00');
    expect(aliveAfter, 'the Rootwyrm should spawn at 4:00');
    expect(sim.recorder.events.some(e => e.type === GameEventType.CAMP_CLEARED && e.data.campId === 'rootwyrm' && e.data.respawnAt === FIRST_SPAWN),
      'clients should get the Rootwyrm\'s first spawn as a camp timer');
    expect(rooted, 'its eruption should root the champion fighting it');
    expect(['tank', 'ally'].every(id => sim.champion(id).getEffect('heartwood_pact')), 'the Heartwood Pact should go to the whole team');
    expect(!sim.champion('enemy').getEffect('heartwood_pact'), 'the enemy team should not get it');
    expect(sim.recorder.events.some(e => e.type === GameEventType.DRAGON_KILLED && e.data.creatureType === 'rootwyrm'),
      'an epic kill event should name the Rootwyrm');
  },
});
