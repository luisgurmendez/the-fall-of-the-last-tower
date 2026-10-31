/**
 * Neutral monsters: a champion walks past the wolves (they ignore it), hits
 * one wolf (the whole pack fights back), then runs away past the leash (the
 * wolves walk home, can't be hurt on the way, and end at full health).
 */
import { MOBAConfig } from '@siege/shared';
import { defineScenario } from '../src/sim';
import type { ServerJungleCreature } from '../src/simulation/ServerJungleCreature';

const wolves = (sim: Parameters<NonNullable<Parameters<typeof defineScenario>[0]['setup']>>[0]) =>
  sim.context.getAllEntities().filter(e => (e as ServerJungleCreature).campId === 'blue_wolves') as ServerJungleCreature[];

const CAMP = MOBAConfig.JUNGLE.CAMPS.find(camp => camp.id === 'blue_wolves')!.position;
/** On mid lane, out through the wolves' entrance and well past their leash */
const ESCAPE = { x: -950, y: 950 };

let damageBeforeAttack = 0;
let packTargetedChampion = false;
let damagedWhileReturning = false;

export default defineScenario({
  name: 'jungle-aggro-and-reset',
  description: 'Wolves ignore a passing champion, fight back as a pack when hit, and reset when kited past their leash',
  options: { minionWaves: false, structures: false },
  duration: 40,
  setup(sim) {
    damageBeforeAttack = 0;
    packTargetedChampion = false;
    damagedWhileReturning = false;
    // Next to the wolves
    sim.addChampion({ playerId: 'jungler', championId: 'vex', side: 'blue', at: { x: CAMP.x + 120, y: CAMP.y - 40 }, level: 3 });
    sim.onTick(s => {
      const champion = s.champion('jungler');
      const pack = wolves(s);
      if (s.time < 3) damageBeforeAttack = champion.maxHealth - champion.health;
      if (pack.length === 2 && pack.every(w => w.toSnapshot().targetEntityId === champion.id)) packTargetedChampion = true;
      for (const wolf of pack) {
        if (wolf.isReturning()) {
          const before = wolf.health;
          if (wolf.takeDamage(50, 'true', champion.id, s.context) > 0 || wolf.health < before) damagedWhileReturning = true;
        }
      }
    });
  },
  steps: [
    { at: 3, note: 'jungler attacks one wolf', run: sim => sim.attack('jungler', wolves(sim)[0].id) },
    { at: 6, note: 'jungler runs away to mid lane', run: sim => sim.move('jungler', ESCAPE.x, ESCAPE.y) },
  ],
  view: { center: { x: (CAMP.x + ESCAPE.x) / 2, y: (CAMP.y + ESCAPE.y) / 2 }, size: 1200 },
  check(sim, report, expect) {
    expect(damageBeforeAttack === 0, 'wolves should not attack a champion that walks by');
    expect(packTargetedChampion, 'hitting one wolf should make both wolves fight the champion');
    expect(!damagedWhileReturning, 'wolves walking home should not take damage');
    const pack = wolves(sim);
    expect(pack.length === 2, 'both wolves should be alive');
    for (const wolf of pack) {
      expect(!wolf.isReturning() && wolf.position.distanceTo(wolf.homePosition) < 15, `wolf ${wolf.id} should be back home`);
      expect(wolf.health === wolf.maxHealth, `wolf ${wolf.id} should be back to full health`);
    }
  },
});
