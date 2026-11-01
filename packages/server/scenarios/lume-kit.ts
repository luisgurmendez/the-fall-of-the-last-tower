/**
 * Lume's orb abilities, piece by piece:
 * - Q sends the orb out past an enemy
 * - E's Prismatic Beam, from her to the orb, hits that enemy once and slows
 *   it while it's in it, and speeds up an ally standing in it
 * - R's Eclipse fires from the orb after its windup and hits an enemy far
 *   beyond it; the orb stays
 */
import { EntityType, GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';
import type { ServerLightOrb } from '../src/simulation/ServerLightOrb';

function damageTo(sim: Simulation, from: string, to: string, after = 0, before = Infinity): number {
  const source = sim.champion(from).id;
  const target = sim.champion(to).id;
  return sim.recorder.events
    .filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === source && e.data.entityId === target && e.time >= after && e.time < before)
    .reduce((sum, e) => sum + (e.data.amount as number), 0);
}

function orb(sim: Simulation): ServerLightOrb | undefined {
  return sim.context.getAllEntities().find(e => e.entityType === EntityType.LIGHT_ORB) as ServerLightOrb | undefined;
}

let allySpeedBefore = 0;
let allySpeedInBeam = 0;
let slowedInBeam = false;
let slowedAfter = true;

export default defineScenario({
  name: 'lume-kit',
  description: "Lume's Prismatic Beam (E) and Eclipse (R) from her orb",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 6,
  setup(sim) {
    allySpeedBefore = 0;
    allySpeedInBeam = 0;
    slowedInBeam = false;
    slowedAfter = true;
    sim.addChampion({ playerId: 'lume', championId: 'lume', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 1, E: 3, R: 1 } });
    // An ally on the beam's line, an enemy between her and the orb, one far past it
    sim.addChampion({ playerId: 'ally', championId: 'warrior', side: 'blue', at: { x: 90, y: 10 }, level: 9 });
    sim.addChampion({ playerId: 'mid', championId: 'gorath', side: 'red', at: { x: 220, y: 0 }, level: 9 });
    sim.addChampion({ playerId: 'far', championId: 'magnus', side: 'red', at: { x: 850, y: 0 }, level: 9 });
  },
  steps: [
    { at: 0.3, note: 'Q: the orb out past Gorath', run: sim => { sim.cast('lume', 'Q', { x: 400, y: 0 }); } },
    { at: 1.5, note: 'E: the beam to the orb', run: sim => {
      allySpeedBefore = sim.champion('ally').getStats().movementSpeed;
      sim.cast('lume', 'E');
    } },
    { at: 1.8, run: sim => {
      allySpeedInBeam = sim.champion('ally').getStats().movementSpeed;
      slowedInBeam = sim.champion('mid').hasEffect('slow_30');
    } },
    { at: 3, note: 'R: Eclipse from the orb toward Magnus', run: sim => { sim.cast('lume', 'R', { x: 900, y: 0 }); } },
    { at: 4.8, run: sim => { slowedAfter = sim.champion('mid').hasEffect('slow_30'); } },
  ],
  view: { center: { x: 400, y: 0 }, size: 1000 },
  check(sim, report, expect) {
    expect(damageTo(sim, 'lume', 'mid', 1.5, 1.7) > 0, 'the beam should hit Gorath between Lume and the orb');
    expect(damageTo(sim, 'lume', 'mid', 1.7, 4.2) === 0, 'the beam should hit him only once');
    expect(slowedInBeam, 'the beam should slow Gorath while he is in it');
    expect(!slowedAfter, 'the slow should end with the beam');
    expect(allySpeedInBeam > allySpeedBefore, `the beam should speed up the ally in it (${Math.round(allySpeedBefore)} -> ${Math.round(allySpeedInBeam)})`);
    expect(damageTo(sim, 'lume', 'far', 3, 3.5) === 0, 'Eclipse should wait for its windup');
    expect(damageTo(sim, 'lume', 'far', 3.5, 4.2) > 0, 'Eclipse should hit Magnus far past the orb');
    expect(orb(sim) !== undefined && !orb(sim)!.isDestroyed, 'the orb should stay after Eclipse');
  },
});
