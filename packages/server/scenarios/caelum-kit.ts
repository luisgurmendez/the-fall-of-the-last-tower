/**
 * Caelum's kit, piece by piece:
 * - Lightweaving heals him and a hurt ally beside him every 8 seconds
 * - Q's ray stings and slows the first enemy it meets
 * - W emboldens an ally: more attack damage
 * - E's roots rise after a moment and hold an enemy
 * - R gives a quarter of his health to an ally, who heals much more; he
 *   can't give it to himself
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

const healsBy = (sim: Simulation, to: string, after: number, before: number) => sim.recorder.events
  .filter(e => e.type === GameEventType.HEAL && e.data.sourceId === sim.champion('caelum').id &&
    e.data.entityId === sim.champion(to).id && e.time >= after && e.time < before)
  .reduce((sum, e) => sum + (e.data.amount as number), 0);

let slowed = false;
let attackDamageBefore = 0;
let attackDamageEmboldened = 0;
let rootedEarly = true;
let rooted = false;
let caelumBeforeR = 0;
let caelumAfterR = 0;
let selfMartyrRefused = false;

export default defineScenario({
  name: 'caelum-kit',
  description: "Caelum's lightweaving, ray, embolden, roots and martyr",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 14,
  setup(sim) {
    slowed = false;
    attackDamageBefore = 0;
    attackDamageEmboldened = 0;
    rootedEarly = true;
    rooted = false;
    caelumBeforeR = 0;
    caelumAfterR = 0;
    selfMartyrRefused = false;
    sim.addChampion({ playerId: 'caelum', championId: 'caelum', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 2, E: 3, R: 1 } });
    const ally = sim.addChampion({ playerId: 'ally', championId: 'warrior', side: 'blue', at: { x: 60, y: 60 }, level: 9 });
    ally.health = ally.maxHealth * 0.3;
    sim.addChampion({ playerId: 'enemy', championId: 'gorath', side: 'red', at: { x: 300, y: 0 }, level: 9 });
  },
  steps: [
    { at: 0.5, note: 'Q at the enemy', run: sim => { sim.cast('caelum', 'Q', sim.champion('enemy').position); } },
    { at: 1.4, run: sim => { slowed = sim.champion('enemy').hasEffect('slow_20'); } },
    { at: 2, note: 'W on the ally', run: sim => {
      attackDamageBefore = sim.champion('ally').getStats().attackDamage;
      sim.cast('caelum', 'W', sim.champion('ally').id);
    } },
    { at: 2.1, run: sim => { attackDamageEmboldened = sim.champion('ally').getStats().attackDamage; } },
    { at: 3, note: 'E under the enemy', run: sim => { sim.cast('caelum', 'E', sim.champion('enemy').position); } },
    { at: 3.4, run: sim => { rootedEarly = sim.champion('enemy').hasEffect('root'); } },
    { at: 4.0, run: sim => { rooted = sim.champion('enemy').hasEffect('root'); } },
    { at: 10, note: 'R on himself: refused', run: sim => { sim.cast('caelum', 'R', sim.champion('caelum').id); } },
    { at: 10.2, run: sim => {
      selfMartyrRefused = sim.champion('caelum').abilityStates.R.cooldownRemaining === 0;
      caelumBeforeR = sim.champion('caelum').health;
    } },
    { at: 10.3, note: 'R on the ally', run: sim => { sim.cast('caelum', 'R', sim.champion('ally').id); } },
    { at: 10.5, run: sim => { caelumAfterR = sim.champion('caelum').health; } },
  ],
  view: { center: { x: 150, y: 0 }, size: 600 },
  check(sim, report, expect) {
    expect(healsBy(sim, 'ally', 0, 9.5) > 0, 'Lightweaving should heal the hurt ally within 8 seconds');
    expect(slowed, 'Q should slow the enemy');
    expect(attackDamageEmboldened > attackDamageBefore * 1.15, `W should embolden the ally (${Math.round(attackDamageBefore)} -> ${Math.round(attackDamageEmboldened)})`);
    expect(!rootedEarly, 'the roots should take a moment to rise');
    expect(rooted, 'E should root the enemy');
    expect(selfMartyrRefused, 'R should be refused on himself');
    const given = caelumBeforeR - caelumAfterR;
    expect(given > caelumBeforeR * 0.2, `R should cost him a quarter of his health (gave ${Math.round(given)} of ${Math.round(caelumBeforeR)})`);
    expect(healsBy(sim, 'ally', 10.3, 10.5) > 150 + given, `R should heal the ally its heal plus twice what he gave (${Math.round(healsBy(sim, 'ally', 10.3, 10.5))})`);
  },
});
