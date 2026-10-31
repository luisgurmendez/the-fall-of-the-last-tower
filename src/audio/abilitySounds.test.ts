import { describe, expect, it } from 'vitest';
import { getAllChampionDefinitions } from '@siege/shared';
import { ABILITY_CUES } from './abilitySounds';
import { SOUNDS } from './soundCatalog';

describe('ability sounds', () => {
  it('gives every champion ability a sound', () => {
    const silent = getAllChampionDefinitions()
      .flatMap(champion => Object.values(champion.abilities))
      .filter(abilityId => !ABILITY_CUES[abilityId] && !(abilityId in SOUNDS));
    expect(silent).toEqual([]);
  });

  it('only cues sounds in the catalog', () => {
    const missing = Object.values(ABILITY_CUES).flat().filter(cue => !(cue.sound in SOUNDS));
    expect(missing).toEqual([]);
  });
});
