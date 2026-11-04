import { describe, expect, it } from 'vitest';
import { STATUS_SOUNDS, newStatusSounds } from './statusSounds';
import { noteFrequency } from './music/notation';

const fx = (definitionId: string, timeRemaining = 1) => ({ definitionId, timeRemaining });

describe('newStatusSounds', () => {
  it('a crowd control or a slow newly on our champion sounds once', () => {
    expect(newStatusSounds([], [fx('stun')])).toEqual(['stun']);
    expect(newStatusSounds([], [fx('slow_30')])).toEqual(['slow']);
    expect(newStatusSounds([], [fx('vile_root')])).toEqual(['root']);
    expect(newStatusSounds([], [fx('fear'), fx('silence')]).sort()).toEqual(['fear', 'silence']);
  });

  it('one already on it, or refreshed, is quiet', () => {
    expect(newStatusSounds([fx('stun', 0.5)], [fx('stun', 1)])).toEqual([]);
    expect(newStatusSounds([fx('slow_20')], [fx('slow_20'), fx('slow_30')])).toEqual([]);
  });

  it('effects without a sound (buffs, damage over time) are quiet', () => {
    expect(newStatusSounds([], [fx('armor_buff'), fx('burn'), fx('speed_30')])).toEqual([]);
  });

  it('the strongest first, one of each', () => {
    expect(newStatusSounds([], [fx('slow_30'), fx('stun'), fx('slow_20')])).toEqual(['stun', 'slow']);
  });

  it('nothing before or after: nothing', () => {
    expect(newStatusSounds(undefined, undefined)).toEqual([]);
  });
});

describe('STATUS_SOUNDS', () => {
  it('each is a few short playable notes', () => {
    for (const [name, sound] of Object.entries(STATUS_SOUNDS)) {
      const length = sound.notes.reduce((total, [, seconds]) => total + seconds, 0);
      expect(length, name).toBeLessThanOrEqual(0.4);
      for (const [note] of sound.notes) expect(noteFrequency(note)).toBeGreaterThan(20);
    }
  });
});
