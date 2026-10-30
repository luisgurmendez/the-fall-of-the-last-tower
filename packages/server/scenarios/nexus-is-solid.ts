/**
 * The nexus is a solid building. A champion sent from the fountain straight
 * across its own nexus walks around it, a wave of minions leaving the base
 * never walks through it, and neither does a minion chasing an enemy that
 * stands right behind it (chasing ignores paths, so only collision stops it).
 */
import { defineScenario } from '../src/sim';
import { MOBAConfig } from '@siege/shared';

const NEXUS = MOBAConfig.NEXUS.BLUE;
const FOOTPRINT = MOBAConfig.NEXUS.collision;
const DESTINATION = { x: -1120, y: 1120 };

let deepestInside = 0;

/** How far a point is inside the nexus footprint (0 when outside) */
function depthInside(x: number, y: number): number {
  const dx = FOOTPRINT.width / 2 - Math.abs(x - (NEXUS.x + FOOTPRINT.offset.x));
  const dy = FOOTPRINT.height / 2 - Math.abs(y - (NEXUS.y + FOOTPRINT.offset.y));
  return Math.max(0, Math.min(dx, dy));
}

export default defineScenario({
  name: 'nexus-is-solid',
  description: 'A champion and minions go around the nexus building instead of through it',
  options: { minionWaves: false, jungle: false },
  duration: 20,
  setup(sim) {
    deepestInside = 0;
    sim.addChampion({ playerId: 'walker', championId: 'vex', side: 'blue', at: { x: -1440, y: 1440 } });
    sim.spawnWave('mid', 'blue');
    sim.addMinion({ side: 'blue', lane: 'top', at: { x: -1300, y: 1345 }, type: 'melee' });
    sim.addMinion({ side: 'red', lane: 'top', at: { x: -1300, y: 1150 }, type: 'caster' });
    sim.onTick(s => {
      for (const unit of s.entities(e => e.kind === 'champion' || e.kind === 'minion')) {
        deepestInside = Math.max(deepestInside, depthInside(unit.x, unit.y));
      }
    });
  },
  steps: [
    { at: 0.2, note: 'walker walks across the nexus', run: sim => sim.move('walker', DESTINATION.x, DESTINATION.y) },
  ],
  view: { center: { x: -1280, y: 1280 }, size: 500 },
  frames: 6,
  check(sim, _report, expect) {
    expect(deepestInside < 5, `no unit should walk into the nexus (deepest ${deepestInside.toFixed(0)} units inside)`);
    const walker = sim.champion('walker');
    const distance = Math.hypot(walker.position.x - DESTINATION.x, walker.position.y - DESTINATION.y);
    expect(distance < 30, `the walker should get around the nexus to its destination (${distance.toFixed(0)} away)`);
  },
});
