/**
 * Telegraphed monster attacks: the blue buff slams a champion that keeps
 * hitting it, a champion fighting the red buff steps out of every slam, and
 * the dragon's breath hits the champion in front of it but not the one
 * behind it.
 */
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';
import type { ServerJungleCreature } from '../src/simulation/ServerJungleCreature';

function creature(sim: Simulation, campId: string): ServerJungleCreature | undefined {
  return sim.context.getAllEntities().find(e => (e as unknown as ServerJungleCreature).campId === campId && !e.isDead) as
    ServerJungleCreature | undefined;
}

/** Champions that were ever slowed by a monster's special attack */
const slowed = new Set<string>();
let dodging = false;
let dodges = 0;

export default defineScenario({
  name: 'jungle-special-attacks',
  description: 'Buff monsters slam the ground and the dragon breathes fire; both can be dodged',
  options: { minionWaves: false, structures: false },
  duration: 20,
  setup(sim) {
    slowed.clear();
    dodging = false;
    dodges = 0;
    sim.addChampion({ playerId: 'tank', championId: 'vex', side: 'blue', at: { x: -620, y: -150 }, level: 6 });
    sim.addChampion({ playerId: 'dodger', championId: 'vex', side: 'blue', at: { x: 400, y: 820 }, level: 3 });
    sim.addChampion({ playerId: 'front', championId: 'vile', side: 'red', at: { x: 470, y: 720 }, level: 6 });
    sim.addChampion({ playerId: 'behind', championId: 'vile', side: 'red', at: { x: 900, y: 720 }, level: 6 });

    sim.onTick(s => {
      for (const playerId of ['tank', 'dodger', 'front', 'behind']) {
        const champion = s.champion(playerId);
        if (champion.getEffect('slow_30') || champion.getEffect('slow_20')) slowed.add(playerId);
      }

      // The dodger walks out of the red buff's slam whenever it winds up
      const redBuff = creature(s, 'blue_redbuff');
      if (!redBuff) return;
      if (redBuff.isWindingUp() && !dodging) {
        dodging = true;
        dodges++;
        s.move('dodger', redBuff.position.x + 320, redBuff.position.y);
      } else if (!redBuff.isWindingUp() && dodging) {
        dodging = false;
        s.attack('dodger', redBuff.id);
      }
    });
  },
  steps: [
    { at: 0.5, note: 'tank attacks blue buff, dodger attacks red buff, front attacks the dragon', run: sim => {
      sim.attack('tank', creature(sim, 'blue_bluebuff')!.id);
      sim.attack('dodger', creature(sim, 'blue_redbuff')!.id);
      sim.attack('front', creature(sim, 'dragon')!.id);
    } },
  ],
  view: { center: { x: 300, y: 450 }, size: 1700 },
  frames: 8,
  check(sim, report, expect) {
    const casts = (abilityId: string) => sim.recorder.events.filter(e => e.type === 10 && e.data.abilityId === abilityId).length;
    expect(casts('jungle_slam_blue') >= 2, `the blue buff should slam repeatedly (${casts('jungle_slam_blue')})`);
    expect(casts('jungle_slam_red') >= 2, `the red buff should slam repeatedly (${casts('jungle_slam_red')})`);
    expect(casts('dragon_breath') >= 1, `the dragon should breathe fire (${casts('dragon_breath')})`);
    expect(slowed.has('tank'), 'the champion standing in the slam should be hit');
    expect(dodges >= 2 && !slowed.has('dodger'), `the champion stepping out should never be hit (${dodges} dodges)`);
    expect(slowed.has('front'), 'the champion in front of the dragon should be hit by its breath');
    expect(!slowed.has('behind'), 'the champion behind the dragon should not be hit');
  },
});
