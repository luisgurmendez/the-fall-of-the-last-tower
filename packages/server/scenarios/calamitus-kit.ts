/**
 * Calamitus's kit, piece by piece:
 * - Q bursts lava around him and leaves a pool that burns an enemy in it;
 *   standing in it he's tougher
 * - E's obsidian shield is stronger cast on his lava
 * - W's landslide hits and slows down a line, leaving a stream of lava
 * - R makes all his lava erupt: an enemy standing in the far stream is
 *   stunned too
 */
import { EntityType, GameEventType, calculateAbilityValue, getAbilityDefinition } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';

const damageBy = (sim: Simulation, to: string, after: number, before: number) => sim.recorder.events
  .filter(e => e.type === GameEventType.DAMAGE && e.data.sourceId === sim.champion('calamitus').id &&
    e.data.entityId === sim.champion(to).id && e.time >= after && e.time < before)
  .reduce((sum, e) => sum + (e.data.amount as number), 0);
const lavaPools = (sim: Simulation) => sim.context.getAllEntities()
  .filter(e => e.entityType === EntityType.ZONE && ['calamitus_q', 'calamitus_w'].includes((e as { abilityId?: string }).abilityId ?? '')).length;

let poolsAfterQ = 0;
let armorOff = 0;
let armorOn = 0;
let shield = 0;
let shieldOffLava = 0;
let slowed = false;
let poolsAfterW = 0;
let farStunned = false;

export default defineScenario({
  name: 'calamitus-kit',
  description: "Calamitus's lava flow, obsidian skin, magma landslide and eruption",
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 12,
  setup(sim) {
    poolsAfterQ = 0;
    armorOff = 0;
    armorOn = 0;
    shield = 0;
    shieldOffLava = 0;
    slowed = false;
    poolsAfterW = 0;
    farStunned = false;
    sim.addChampion({ playerId: 'calamitus', championId: 'calamitus', side: 'blue', at: { x: 0, y: 0 }, level: 9, ranks: { Q: 3, W: 3, E: 2, R: 1 } });
    sim.addChampion({ playerId: 'near', championId: 'warrior', side: 'red', at: { x: 90, y: 0 }, level: 9 });
    sim.addChampion({ playerId: 'far', championId: 'magnus', side: 'red', at: { x: 0, y: -330 }, level: 9 });
  },
  steps: [
    { at: 0.2, run: sim => { armorOff = sim.champion('calamitus').getStats().armor; } },
    // (a 0.6 s cast: the ground churns, then it bursts at 0.9)
    { at: 0.3, note: 'Q: lava around him', run: sim => { sim.cast('calamitus', 'Q'); } },
    { at: 1.0, run: sim => {
      poolsAfterQ = lavaPools(sim);
      armorOn = sim.champion('calamitus').getStats().armor;
    } },
    { at: 1.1, note: 'E on his lava', run: sim => { sim.cast('calamitus', 'E'); } },
    { at: 1.2, run: sim => {
      shield = sim.champion('calamitus').shields.filter(s => s.sourceId === 'calamitus_e').reduce((sum, s) => sum + s.amount, 0);
      const skin = getAbilityDefinition('calamitus_e')!;
      const champion = sim.champion('calamitus');
      shieldOffLava = calculateAbilityValue(skin.shield!.scaling, 2, { maxHealth: champion.getStats().maxHealth });
    } },
    { at: 2.0, note: 'W at the far Magnus', run: sim => { sim.cast('calamitus', 'W', sim.champion('far').position); } },
    { at: 2.6, run: sim => {
      slowed = sim.champion('far').hasEffect('slow_30');
      poolsAfterW = lavaPools(sim);
    } },
    { at: 3.0, note: 'R: everything erupts', run: sim => { sim.cast('calamitus', 'R'); } },
    // (it erupts 0.85 s after)
    { at: 4.0, run: sim => { farStunned = sim.champion('far').hasEffect('stun'); } },
  ],
  view: { center: { x: 0, y: -150 }, size: 600 },
  check(sim, report, expect) {
    expect(damageBy(sim, 'near', 0.3, 0.85) === 0, 'Q should wait out its cast before it bursts');
    expect(damageBy(sim, 'near', 0.85, 1.0) > 0, 'Q should burst on the enemy beside him');
    expect(poolsAfterQ >= 1, 'Q should leave a pool of lava');
    expect(damageBy(sim, 'near', 1.0, 2.0) > 0, 'the lava should burn the enemy standing in it');
    expect(armorOn >= armorOff + 10, `standing in his lava he should be tougher (armor ${Math.round(armorOff)} -> ${Math.round(armorOn)})`);
    expect(shield > shieldOffLava * 1.4, `E on his lava should shield more (${Math.round(shield)} vs ${Math.round(shieldOffLava)})`);
    expect(slowed, 'W should slow Magnus down the line');
    expect(poolsAfterW >= poolsAfterQ + 4, `W should leave a stream of lava (${poolsAfterW - poolsAfterQ} pools)`);
    expect(farStunned, 'R should erupt under Magnus in the far stream and stun him');
    expect(damageBy(sim, 'far', 3.8, 4.0) > 80, 'R should hit Magnus hard');
  },
});
