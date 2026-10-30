/**
 * Jungle balance guard: a level 3 champion can take each buff camp alone
 * with basic attacks only, without dodging the slams, and never drops low.
 * If monster stats or the slams get stronger, this fails; if they get much
 * weaker, so does the check that the fight costs real health.
 */
import { defineScenario } from '../src/sim';
import type { Simulation } from '../src/sim';
import type { ServerJungleCreature } from '../src/simulation/ServerJungleCreature';

const FIGHTS = [
  { playerId: 'blue', campId: 'blue_bluebuff', at: { x: -820, y: 30 } },
  { playerId: 'red', campId: 'blue_redbuff', at: { x: 330, y: 820 } },
];

/** Lowest health fraction each champion reached */
const lowest = new Map<string, number>();

function campCreature(sim: Simulation, campId: string): ServerJungleCreature | undefined {
  return sim.context.getAllEntities().find(e => (e as unknown as ServerJungleCreature).campId === campId && !e.isDead) as
    ServerJungleCreature | undefined;
}

export default defineScenario({
  name: 'jungle-solo-buffs',
  description: 'A level 3 Vex takes blue buff and red buff alone with basic attacks and survives',
  options: { minionWaves: false, structures: false },
  duration: 40,
  setup(sim) {
    lowest.clear();
    for (const fight of FIGHTS) {
      sim.addChampion({ playerId: fight.playerId, championId: 'vex', side: 'blue', at: fight.at, level: 3 });
    }
    sim.onTick(s => {
      for (const fight of FIGHTS) {
        const champion = s.champion(fight.playerId);
        const creature = campCreature(s, fight.campId);
        if (creature && !champion.isDead && champion.targetEntityId !== creature.id) s.attack(fight.playerId, creature.id);
        const health = champion.isDead ? 0 : champion.health / champion.maxHealth;
        lowest.set(fight.playerId, Math.min(lowest.get(fight.playerId) ?? 1, health));
      }
    });
  },
  view: { center: { x: -330, y: 300 }, size: 1500 },
  frames: 8,
  check(sim, _report, expect) {
    for (const fight of FIGHTS) {
      expect(!campCreature(sim, fight.campId), `${fight.campId} should be cleared`);
      const low = Math.round((lowest.get(fight.playerId) ?? 0) * 100);
      expect(low > 20, `Vex should stay above 20% health fighting ${fight.campId} (lowest ${low}%)`);
      expect(low < 80, `${fight.campId} should cost real health (lowest ${low}%)`);
    }
  },
});
