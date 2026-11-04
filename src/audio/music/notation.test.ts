import { describe, expect, it } from 'vitest';
import { noteFrequency, parseVoice, sectionSteps, songSteps, type Song } from './notation';
import { SONGS } from './songs';

describe('noteFrequency', () => {
  it('A4 is 440 Hz, an octave doubles it', () => {
    expect(noteFrequency('A4')).toBeCloseTo(440, 5);
    expect(noteFrequency('A5')).toBeCloseTo(880, 5);
    expect(noteFrequency('A3')).toBeCloseTo(220, 5);
  });

  it('sharps and flats, across the octave line', () => {
    expect(noteFrequency('C4')).toBeCloseTo(261.626, 2);
    expect(noteFrequency('C#4')).toBeCloseTo(277.183, 2);
    expect(noteFrequency('Db4')).toBeCloseTo(noteFrequency('C#4'), 6);
    expect(noteFrequency('Bb3')).toBeCloseTo(233.082, 2);
    expect(noteFrequency('B3')).toBeCloseTo(246.942, 2);
    expect(noteFrequency('D2')).toBeCloseTo(73.416, 2);
  });

  it('something that is not a note throws', () => {
    expect(() => noteFrequency('H4')).toThrow();
    expect(() => noteFrequency('C')).toThrow();
  });
});

describe('parseVoice', () => {
  it('notes with their lengths in steps, one after the other; rests take time and sound nothing', () => {
    expect(parseVoice('D5:4 F5:2 r:2 A5:8', 16)).toEqual([
      { step: 0, length: 4, note: 'D5' },
      { step: 4, length: 2, note: 'F5' },
      { step: 8, length: 8, note: 'A5' },
    ]);
  });

  it('bars are marked with |, and each must last a whole bar', () => {
    expect(parseVoice('D5:16 | F5:8 A5:8', 16)).toHaveLength(3);
    expect(() => parseVoice('D5:12 | F5:16', 16)).toThrow(/bar 1/);
  });

  it('drum hits are their own symbols', () => {
    expect(parseVoice('k:4 s:4 h:2 h:2 r:4', 16).map(e => e.note)).toEqual(['k', 's', 'h', 'h']);
  });

  it('a token it does not understand throws', () => {
    expect(() => parseVoice('D5', 16)).toThrow();
    expect(() => parseVoice('D5:0 r:16', 16)).toThrow();
  });
});

describe('the songs', () => {
  for (const [id, song] of Object.entries(SONGS) as [string, Song][]) {
    describe(id, () => {
      it('every voice of every section lasts the same whole bars, and every note is playable', () => {
        for (const [name, section] of Object.entries(song.sections)) {
          const lengths = Object.values(section).map(voice => {
            const events = parseVoice(voice, song.stepsPerBar);
            for (const event of events) if (!'ksh'.includes(event.note)) expect(noteFrequency(event.note)).toBeGreaterThan(20);
            return voice.split('|').length;
          });
          expect(new Set(lengths).size, `section ${name}`).toBe(1);
          expect(sectionSteps(song, name)).toBe(lengths[0] * song.stepsPerBar);
        }
      });

      it('plays its sections in an order that exists, and loops from inside it', () => {
        for (const name of song.order) expect(song.sections[name]).toBeDefined();
        expect(song.loopFrom).toBeGreaterThanOrEqual(0);
        expect(song.loopFrom).toBeLessThan(song.order.length);
        expect(songSteps(song)).toBe(song.order.reduce((total, name) => total + sectionSteps(song, name), 0));
      });

      it('has a sane tempo', () => {
        expect(song.bpm).toBeGreaterThanOrEqual(60);
        expect(song.bpm).toBeLessThanOrEqual(180);
      });
    });
  }

  it('the menu has its theme and the match its calmer one', () => {
    expect(SONGS.title).toBeDefined();
    expect(SONGS.match).toBeDefined();
    expect(SONGS.match.volume).toBeLessThan(SONGS.title.volume);
  });
});
