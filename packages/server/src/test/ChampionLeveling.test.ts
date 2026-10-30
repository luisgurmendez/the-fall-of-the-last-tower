/**
 * Champion leveling: LEVEL_EXPERIENCE is the total experience to reach each
 * level, and a champion levels up exactly when its total crosses it.
 */

import { describe, test, expect } from 'bun:test';
import { Vector, LEVEL_EXPERIENCE, getChampionDefinition } from '@siege/shared';
import { ServerChampion } from '../simulation/ServerChampion';

/** A level 1 champion, as at the start of a match */
function freshChampion(): ServerChampion {
  return new ServerChampion({
    id: 'leveler',
    position: new Vector(0, 0),
    side: 0,
    definition: getChampionDefinition('vex')!,
    playerId: 'leveler',
  });
}

describe('Champion leveling', () => {
  test('reaches each level at its total experience', () => {
    for (let level = 2; level <= 6; level++) {
      const champion = freshChampion();
      champion.gainExperience(LEVEL_EXPERIENCE[level - 1] - 1);
      expect(champion.level).toBe(level - 1);
      champion.gainExperience(1);
      expect(champion.level).toBe(level);
    }
  });

  test('levels up the same whether experience comes at once or in pieces', () => {
    const atOnce = freshChampion();
    atOnce.gainExperience(2500);
    const inPieces = freshChampion();
    for (let i = 0; i < 50; i++) inPieces.gainExperience(50);

    expect(atOnce.level).toBe(6);
    expect(inPieces.level).toBe(6);
    expect(inPieces.experience).toBe(atOnce.experience);
    expect(atOnce.experience).toBe(2500 - LEVEL_EXPERIENCE[5]);
  });
});
