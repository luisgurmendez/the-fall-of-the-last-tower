/**
 * Recall: B stops the champion right away and starts the channel, even in
 * combat; damage cancels it.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { InputType } from '@siege/shared';
import { Simulation } from '../sim';

function walking(): Simulation {
  const sim = new Simulation({ seed: 1, minionWaves: false, jungle: false, structures: false });
  sim.addChampion({ playerId: 'p1', championId: 'warrior', side: 'blue', at: { x: 0, y: 0 } });
  sim.input('p1', { type: InputType.MOVE, targetX: 400, targetY: 0 });
  sim.run(0.3);
  expect(sim.champion('p1').position.x).toBeGreaterThan(10);
  return sim;
}

describe('Recall', () => {
  test('stops a walking champion right away and starts recalling', () => {
    const sim = walking();
    const champion = sim.champion('p1');
    sim.input('p1', { type: InputType.RECALL });
    sim.run(0.1);
    const stoppedAt = champion.position.x;
    sim.run(0.5);
    expect(champion.isRecalling).toBe(true);
    expect(champion.position.x).toBe(stoppedAt);
    sim.dispose();
  });

  test('starts in combat too, and taking damage cancels it', () => {
    const sim = walking();
    const champion = sim.champion('p1');
    champion.enterCombat();
    sim.input('p1', { type: InputType.RECALL });
    sim.run(0.1);
    expect(champion.isRecalling).toBe(true);
    expect(champion.targetPosition).toBeNull();

    champion.takeDamage(10, 'true');
    expect(champion.isRecalling).toBe(false);
    sim.dispose();
  });
});
