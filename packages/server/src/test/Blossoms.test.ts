/**
 * Healing blossoms (The Narrows): the first champion to walk over one in
 * bloom is healed, and it regrows a while later; nothing can hit it.
 */
import './ServerTestUtils';
import { describe, test, expect } from 'bun:test';
import { EntityType, MAPS, type BlossomSnapshot } from '@siege/shared';
import { Simulation } from '../sim';

const { SPOTS, FIRST_BLOOM, REGROW, HEAL } = MAPS.narrows.BLOSSOMS;

describe('Healing blossoms', () => {
  function setup() {
    const sim = new Simulation({ seed: 1, map: MAPS.narrows, minionWaves: false, structures: false });
    const spot = SPOTS[0];
    const champion = sim.addChampion({ playerId: 'p1', championId: 'warrior', side: 'blue', at: { x: spot.x - 150, y: spot.y } });
    const blossom = () => sim.context.getAllEntities().find(e => e.entityType === EntityType.BLOSSOM && e.position.x === spot.x && e.position.y === spot.y)!;
    return { sim, spot, champion, blossom };
  }

  test('The Narrows has them, on open ground; the main map has none', () => {
    expect(SPOTS.length).toBe(4);
    for (const spot of SPOTS) expect(MAPS.narrows.WALL_FIELD.distance(spot.x, spot.y)).toBeGreaterThan(40);
    expect(MAPS.vale.BLOSSOMS.SPOTS.length).toBe(0);
  });

  test('a champion walking over one in bloom is healed, and it regrows later', () => {
    const { sim, spot, champion, blossom } = setup();
    try {
      expect((blossom().toSnapshot() as BlossomSnapshot).regrowsAt).toBe(FIRST_BLOOM);
      sim.run(FIRST_BLOOM + 0.1);
      champion.health = champion.maxHealth * 0.5;
      sim.move('p1', spot.x, spot.y);
      sim.runUntil(() => (blossom().toSnapshot() as BlossomSnapshot).regrowsAt !== null, 4);
      // Its heal, and a little regeneration on the way
      expect(champion.health).toBeGreaterThanOrEqual(champion.maxHealth * (0.5 + HEAL));
      expect(champion.health).toBeLessThan(champion.maxHealth * (0.5 + HEAL) + 30);
      const regrowsAt = (blossom().toSnapshot() as BlossomSnapshot).regrowsAt!;
      expect(regrowsAt).toBeGreaterThan(sim.time + REGROW - 1);

      // Standing on it doesn't pick it again until it regrows
      sim.run(2);
      expect((blossom().toSnapshot() as BlossomSnapshot).regrowsAt).toBe(regrowsAt);
      sim.run(REGROW);
      expect((blossom().toSnapshot() as BlossomSnapshot).regrowsAt).toBeGreaterThan(regrowsAt);
    } finally {
      sim.dispose();
    }
  });

  test('nothing can hurt it', () => {
    const { sim, blossom } = setup();
    try {
      expect(blossom().takeDamage(500, 'physical', 'p1', sim.context)).toBe(0);
      expect(blossom().isDead).toBe(false);
    } finally {
      sim.dispose();
    }
  });
});
