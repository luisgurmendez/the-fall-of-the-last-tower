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
/** Across the nexus from the walker's start, toward mid */
const DESTINATION = { x: NEXUS.x + 180, y: NEXUS.y - 180 };

let deepestInside = 0;
/** How close the walker got to its destination (the mid wave leaving the base may shove it off it afterward) */
let closestToDestination = Infinity;

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
    closestToDestination = Infinity;
    sim.addChampion({ playerId: 'walker', championId: 'vex', side: 'blue', at: { x: NEXUS.x - 140, y: NEXUS.y + 140 } });
    sim.spawnWave('mid', 'blue');
    // A minion just below the nexus, chasing an enemy just above it
    sim.addMinion({ side: 'blue', lane: 'top', at: { x: NEXUS.x, y: NEXUS.y + 45 }, type: 'melee' });
    sim.addMinion({ side: 'red', lane: 'top', at: { x: NEXUS.x, y: NEXUS.y - 150 }, type: 'caster' });
    sim.onTick(s => {
      for (const unit of s.entities(e => e.kind === 'champion' || e.kind === 'minion')) {
        deepestInside = Math.max(deepestInside, depthInside(unit.x, unit.y));
      }
      const walker = s.champion('walker').position;
      closestToDestination = Math.min(closestToDestination, Math.hypot(walker.x - DESTINATION.x, walker.y - DESTINATION.y));
    });
  },
  steps: [
    { at: 0.2, note: 'walker walks across the nexus', run: sim => sim.move('walker', DESTINATION.x, DESTINATION.y) },
  ],
  view: { center: { x: NEXUS.x + 20, y: NEXUS.y - 20 }, size: 500 },
  frames: 6,
  check(sim, _report, expect) {
    expect(deepestInside < 5, `no unit should walk into the nexus (deepest ${deepestInside.toFixed(0)} units inside)`);
    expect(closestToDestination < 30, `the walker should get around the nexus to its destination (closest ${closestToDestination.toFixed(0)} away)`);
  },
});
