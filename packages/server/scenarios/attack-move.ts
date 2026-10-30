/**
 * Attack-move: a champion sent across the map with A + click stops to kill
 * an enemy minion in its way, then walks on to where it was sent. A plain
 * move walks past the same minion.
 */
import { defineScenario } from '../src/sim';
import { InputType } from '@siege/shared';

const DESTINATION = { x: -200, y: 200 };

export default defineScenario({
  name: 'attack-move',
  description: 'An attack-moving champion kills an enemy minion on its way, then reaches its destination',
  options: { minionWaves: false, jungle: false, structures: false },
  duration: 30,
  setup(sim) {
    sim.addChampion({ playerId: 'mover', championId: 'warrior', side: 'blue', at: { x: -700, y: 700 }, level: 6 });
    sim.addMinion({ side: 'red', lane: 'mid', at: { x: -450, y: 450 }, type: 'caster' });
  },
  steps: [
    {
      at: 0.5,
      note: 'mover attack-moves past the minion',
      run: sim => sim.input('mover', { type: InputType.ATTACK_MOVE, targetX: DESTINATION.x, targetY: DESTINATION.y }),
    },
  ],
  view: { center: { x: -450, y: 450 }, size: 900 },
  frames: 6,
  check(sim, report, expect) {
    const killed = report.deaths.some(d => d.text.includes('minion') && d.text.includes('mover'));
    expect(killed, 'the attack-moving champion should kill the minion in its way');
    const mover = sim.champion('mover');
    const distance = Math.hypot(mover.position.x - DESTINATION.x, mover.position.y - DESTINATION.y);
    expect(distance < 30, `it should walk on to its destination afterwards (${Math.round(distance)} away)`);
    expect(mover.attackMoveTarget === null, 'the attack-move should end at the destination');
  },
});
