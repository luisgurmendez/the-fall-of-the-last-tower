/**
 * Skillshots are slow enough to sidestep: a champion who starts walking
 * sideways a quarter second after a fireball or a shuriken is thrown from
 * near its maximum range gets out of the way, while one standing still is hit.
 */
import { GameEventType } from '@siege/shared';
import { defineScenario } from '../src/sim';

/** Seconds between seeing the throw and starting to move, like a player */
const REACTION = 0.25;
/** Throwers aimed at the dodger, and when the dodger last reacted to one */
const AT_DODGER = ['mage-b', 'ninja-b'];
let reactAt: number | null = null;
let seenCasts = 0;
let side = 1;

function damageTo(sim: { recorder: { events: { type: number; time: number; data: Record<string, unknown> }[] } }, playerEntityId: string, from: number, to: number): number {
  return sim.recorder.events.filter(e =>
    e.type === GameEventType.DAMAGE && e.data.entityId === playerEntityId && e.time >= from && e.time < to
  ).length;
}

export default defineScenario({
  name: 'skillshots-can-be-dodged',
  description: 'A fireball and a shuriken thrown from near max range miss a champion who sidesteps and hit one who stands',
  options: { minionWaves: false, structures: false, jungle: false },
  duration: 10,
  setup(sim) {
    reactAt = null;
    seenCasts = 0;
    side = 1;
    // Top lane: throwers at both ends, aiming inward at targets 800 (fireball) or 700 (shuriken) away
    sim.addChampion({ playerId: 'mage-a', championId: 'magnus', side: 'red', at: { x: -1450, y: -1400 }, level: 3, ranks: { Q: 1 } });
    sim.addChampion({ playerId: 'ninja-a', championId: 'vex', side: 'red', at: { x: -1350, y: -1400 }, level: 3, ranks: { Q: 1 } });
    sim.addChampion({ playerId: 'stand', championId: 'warrior', side: 'blue', at: { x: -650, y: -1400 } });
    sim.addChampion({ playerId: 'mage-b', championId: 'magnus', side: 'red', at: { x: 450, y: -1400 }, level: 3, ranks: { Q: 1 } });
    sim.addChampion({ playerId: 'ninja-b', championId: 'vex', side: 'red', at: { x: 350, y: -1400 }, level: 3, ranks: { Q: 1 } });
    sim.addChampion({ playerId: 'dodge', championId: 'warrior', side: 'blue', at: { x: -350, y: -1400 } });

    sim.onTick(s => {
      const throwers = AT_DODGER.map(id => s.champion(id).id);
      const casts = s.recorder.events.filter(e => e.type === GameEventType.ABILITY_CAST && throwers.includes(e.data.entityId as string));
      if (casts.length > seenCasts) {
        seenCasts = casts.length;
        reactAt = s.time + REACTION;
      }
      if (reactAt !== null && s.time >= reactAt) {
        reactAt = null;
        const dodger = s.champion('dodge');
        s.move('dodge', dodger.position.x, dodger.position.y + 160 * side);
        side = -side;
      }
    });
  },
  steps: [
    { at: 0.5, note: 'fireballs at both targets', run: sim => {
      sim.cast('mage-a', 'Q', sim.champion('stand').position);
      sim.cast('mage-b', 'Q', sim.champion('dodge').position);
    } },
    { at: 5, note: 'shurikens at both targets', run: sim => {
      sim.cast('ninja-a', 'Q', sim.champion('stand').position);
      sim.cast('ninja-b', 'Q', sim.champion('dodge').position);
    } },
  ],
  view: { center: { x: -500, y: -1400 }, size: 2100 },
  frames: 8,
  check(sim, _report, expect) {
    const stand = sim.champion('stand').id;
    const dodge = sim.champion('dodge').id;
    expect(damageTo(sim, stand, 0, 5) > 0, 'the fireball should hit the champion standing still');
    expect(damageTo(sim, dodge, 0, 5) === 0, 'the fireball should miss the champion who sidesteps');
    expect(damageTo(sim, stand, 5, 10) > 0, 'the shuriken should hit the champion standing still');
    expect(damageTo(sim, dodge, 5, 10) === 0, 'the shuriken should miss the champion who sidesteps');
  },
});
