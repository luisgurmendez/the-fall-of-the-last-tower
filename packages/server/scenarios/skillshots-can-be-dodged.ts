/**
 * Skillshots are slow enough to sidestep: a champion who starts walking
 * sideways a quarter second after a fireball or a shuriken is thrown from
 * near its maximum range gets out of the way, while one standing still is hit.
 */
import { GameEventType, getAbilityDefinition } from '@siege/shared';
import { defineScenario } from '../src/sim';

/** Seconds between seeing the throw and starting to move, like a player */
const REACTION = 0.25;
/** How far the dodger steps sideways */
const STEP = 160;
/** Throwers aimed at the dodger, and when the dodger last reacted to one */
const AT_DODGER = ['mage-b', 'ninja-b'];
let reactAt: number | null = null;
let seenCasts = 0;
let side = 1;

/** Along the top edge lane */
const LANE_Y = -2420;
/** The standing target, and the dodger to its right (far enough that neither volley reaches the other target) */
const STAND_X = -600;
const DODGE_X = -300;
/** Thrown from 90-95% of each skillshot's range */
const FIREBALL_DISTANCE = getAbilityDefinition('magnus_fireball')!.range! * 0.9;
const SHURIKEN_DISTANCE = getAbilityDefinition('vex_shuriken')!.range! * 0.95;
/** The ninjas stand a little off the lane, so they don't bump into the mages */
const NINJA_OFFSET = 60;
const NINJA_ALONG = Math.sqrt(SHURIKEN_DISTANCE ** 2 - NINJA_OFFSET ** 2);

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
    // Top edge lane: throwers on either side, aiming inward at their targets
    sim.addChampion({ playerId: 'mage-a', championId: 'magnus', side: 'red', at: { x: STAND_X - FIREBALL_DISTANCE, y: LANE_Y }, level: 3, ranks: { Q: 1 } });
    sim.addChampion({ playerId: 'ninja-a', championId: 'vex', side: 'red', at: { x: STAND_X - NINJA_ALONG, y: LANE_Y - NINJA_OFFSET }, level: 3, ranks: { Q: 1 } });
    sim.addChampion({ playerId: 'stand', championId: 'warrior', side: 'blue', at: { x: STAND_X, y: LANE_Y } });
    sim.addChampion({ playerId: 'mage-b', championId: 'magnus', side: 'red', at: { x: DODGE_X + FIREBALL_DISTANCE, y: LANE_Y }, level: 3, ranks: { Q: 1 } });
    sim.addChampion({ playerId: 'ninja-b', championId: 'vex', side: 'red', at: { x: DODGE_X + NINJA_ALONG, y: LANE_Y - NINJA_OFFSET }, level: 3, ranks: { Q: 1 } });
    sim.addChampion({ playerId: 'dodge', championId: 'warrior', side: 'blue', at: { x: DODGE_X, y: LANE_Y } });

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
        s.move('dodge', dodger.position.x, dodger.position.y + STEP * side);
        side = -side;
      }
    });
  },
  steps: [
    { at: 0.5, note: 'fireballs at both targets', run: sim => {
      sim.cast('mage-a', 'Q', sim.champion('stand').position);
      sim.cast('mage-b', 'Q', sim.champion('dodge').position);
    } },
    // Back in line, so the shuriken is thrown from the same distance
    { at: 3, note: 'the dodger steps back into the lane', run: sim => sim.move('dodge', DODGE_X, LANE_Y) },
    { at: 5, note: 'shurikens at both targets', run: sim => {
      sim.cast('ninja-a', 'Q', sim.champion('stand').position);
      sim.cast('ninja-b', 'Q', sim.champion('dodge').position);
    } },
  ],
  view: { center: { x: (STAND_X + DODGE_X) / 2, y: LANE_Y }, size: (DODGE_X - STAND_X) + FIREBALL_DISTANCE * 2 + 300 },
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
