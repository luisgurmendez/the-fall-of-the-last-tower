/**
 * Urûk's kit, piece by piece:
 * - Q thrusts through every enemy in a line
 * - W's charged attack hits harder and his physical damage pierces armor
 * - E's scales shield him, then burst in frost around him (damage, slow)
 * - R leaps to a hurt enemy and hits harder the lower its health
 * - Hunter's Instinct speeds him up near a hurt enemy champion
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

function damageTo(sim: Simulation, from: string, to: string, after = 0, before = Infinity): number {
  const source = sim.champion(from).id;
  const target = sim.champion(to).id;
  return sim.recorder.events
    .filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === source && e.data.entityId === target && e.time >= after && e.time < before)
    .reduce((sum, e) => sum + (e.data.amount as number), 0);
}

let speedBefore = 0;
let speedHunting = 0;
let shieldUp = false;

export default defineScenario({
  name: 'uruk-kit',
  description: "Urûk's Q, W, E, R and passive against two dummies",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 14,
  setup(sim) {
    speedBefore = 0;
    speedHunting = 0;
    shieldUp = false;
    sim.addChampion({ playerId: 'uruk', championId: 'uruk', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 3, E: 1, R: 1 } });
    // Two in a line in front of him
    sim.addChampion({ playerId: 'near', championId: 'gorath', side: 'red', at: { x: 120, y: 0 }, level: 9 });
    sim.addChampion({ playerId: 'far', championId: 'magnus', side: 'red', at: { x: 230, y: 0 }, level: 9 });
  },
  steps: [
    { at: 0.5, note: 'Q through both', run: sim => { sim.cast('uruk', 'Q', { x: 300, y: 0 }); } },
    { at: 1.5, note: 'a plain attack on Gorath', run: sim => { sim.attack('uruk', sim.champion('near').id); } },
    { at: 3.5, note: 'W, then the charged attack', run: sim => { sim.stop('uruk'); sim.cast('uruk', 'W'); sim.attack('uruk', sim.champion('near').id); } },
    { at: 5.5, note: 'E: scales, then their burst', run: sim => {
      sim.stop('uruk');
      speedBefore = sim.champion('uruk').getStats().movementSpeed;
      sim.cast('uruk', 'E');
    } },
    { at: 5.6, run: sim => { shieldUp = sim.champion('uruk').shields.some(s => s.sourceId === 'uruk_e'); } },
    { at: 9, note: 'Magnus is hurt: the hunt is on', run: sim => {
      const far = sim.champion('far');
      far.health = far.maxHealth * 0.3;
    } },
    { at: 9.2, run: sim => { speedHunting = sim.champion('uruk').getStats().movementSpeed; } },
    { at: 9.5, note: 'R on Magnus', run: sim => { sim.cast('uruk', 'R', sim.champion('far').id); } },
  ],
  view: { center: { x: 120, y: 0 }, size: 600 },
  check(sim, report, expect) {
    const casts = (id: string) => sim.recorder.events.some(e => e.type === GameEventType.ABILITY_CAST && e.data.abilityId === id);
    expect(damageTo(sim, 'uruk', 'near', 0.5, 1) > 0 && damageTo(sim, 'uruk', 'far', 0.5, 1) > 0, 'Q should hit both enemies in the line');
    // A plain hit, and everything the first attack after W dealt (its hit and the bonus land together)
    const hits = sim.recorder.events.filter(e => e.type === GameEventType.DAMAGE &&
      e.data.sourceId === sim.champion('uruk').id && e.data.entityId === sim.champion('near').id);
    const plain = hits.find(e => e.time >= 1.5 && e.time < 3.4)?.data.amount as number ?? 0;
    const chargedAt = hits.find(e => e.time >= 3.5)?.time;
    const charged = hits.filter(e => e.time === chargedAt).reduce((sum, e) => sum + (e.data.amount as number), 0);
    expect(charged > plain * 2, `the charged attack should hit much harder than a plain one (${Math.round(charged)} vs ${Math.round(plain)})`);
    expect(shieldUp, 'E should shield Urûk');
    expect(casts('uruk_e_burst'), 'the scales should burst when the shield runs out');
    expect(damageTo(sim, 'uruk', 'near', 7.9, 8.6) > 0, 'the burst should damage the enemy beside him');
    expect(speedHunting > speedBefore, `Hunter's Instinct should speed him up near a hurt champion (${Math.round(speedBefore)} -> ${Math.round(speedHunting)})`);
    expect(sim.champion('far').isDead || damageTo(sim, 'uruk', 'far', 9.5, 10.5) > 0, 'R should land on Magnus');
  },
});
