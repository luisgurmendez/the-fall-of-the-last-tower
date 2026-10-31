/**
 * Every bush on the map hides a champion inside it from an enemy standing
 * right outside it (the server's fog of war, ServerBushManager).
 */
import { test, expect } from 'bun:test';
import { MOBAConfig, calculateIndividualBushPositions, Vector } from '@siege/shared';
import { createTestArena } from './ServerTestUtils';

test('every bush group hides a champion inside it from a nearby enemy', () => {
  const failures: string[] = [];
  for (let group = 0; group < MOBAConfig.BUSH_GROUPS.length; group++) {
    const bush = calculateIndividualBushPositions(group)[1];
    const inside = new Vector(bush.x, bush.y);
    const arena = createTestArena({ bluePosition: inside, redPosition: new Vector(bush.x + 220, bush.y + 20) });
    arena.context.getFogOfWar().updateVision(arena.context, 1);
    const seen = arena.context.getFogOfWar().isVisibleTo(arena.blue, 1 as any);
    if (seen) failures.push(`group ${group} at (${bush.x.toFixed(0)}, ${bush.y.toFixed(0)})`);
  }
  expect(failures).toEqual([]);
});
