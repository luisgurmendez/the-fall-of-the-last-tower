/**
 * How the game's chiptune songs are written (songs.ts) and read
 * (ChiptunePlayer.ts): each voice is a line of `note:steps` tokens, bars
 * split by `|`. A step is a sixteenth note (stepsPerBar 16 in 4/4). A note is
 * its name and octave (`D5`, `C#4`, `Bb3`; A4 = 440 Hz), `r` a rest, and the
 * drums' hits are `k` (kick), `s` (snare) and `h` (hi-hat). Every bar must
 * add up to a whole bar, so voices can't drift apart.
 */

export type VoiceId = "lead" | "harmony" | "bass" | "drums";

export interface Song {
  /** Beats (quarter notes) a minute */
  bpm: number;
  stepsPerBar: number;
  /** Its loudness, of the music volume */
  volume: number;
  /** Each section's voices (any it leaves out are silent in it) */
  sections: Record<string, Partial<Record<VoiceId, string>>>;
  /** The sections in the order played */
  order: string[];
  /** Where it loops back to after the last one (an index into order: past the intro) */
  loopFrom: number;
}

export interface NoteEvent {
  /** Step it starts on, from the voice's start */
  step: number;
  length: number;
  /** A note name (`D5`) or a drum hit (`k`, `s`, `h`) */
  note: string;
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DRUMS = new Set(["k", "s", "h"]);

/** A note's frequency (Hz), equal temperament with A4 = 440 */
export function noteFrequency(note: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!match) throw new Error(`Not a note: "${note}"`);
  const [, letter, accidental, octave] = match;
  const semitone = SEMITONES[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  const fromA4 = (Number(octave) - 4) * 12 + semitone - 9;
  return 440 * 2 ** (fromA4 / 12);
}

/** A voice's notes, each where it starts and how long it lasts (in steps) */
export function parseVoice(voice: string, stepsPerBar: number): NoteEvent[] {
  const events: NoteEvent[] = [];
  let step = 0;
  voice.split("|").forEach((bar, index) => {
    let barSteps = 0;
    for (const token of bar.trim().split(/\s+/).filter(Boolean)) {
      const match = /^([^:]+):(\d+)$/.exec(token);
      const length = match ? Number(match[2]) : 0;
      if (!match || length <= 0) throw new Error(`Bad token "${token}" in bar ${index + 1}`);
      const note = match[1];
      if (note !== "r") {
        if (!DRUMS.has(note)) noteFrequency(note);
        events.push({ step, length, note });
      }
      step += length;
      barSteps += length;
    }
    if (barSteps !== stepsPerBar) throw new Error(`bar ${index + 1} lasts ${barSteps} steps, not ${stepsPerBar}`);
  });
  return events;
}

/** How many steps a section lasts (its voices all last as long) */
export function sectionSteps(song: Song, name: string): number {
  const voices = Object.values(song.sections[name]);
  return voices.length === 0 ? 0 : voices[0]!.split("|").length * song.stepsPerBar;
}

/** How many steps the song lasts, once through */
export function songSteps(song: Song): number {
  return song.order.reduce((total, name) => total + sectionSteps(song, name), 0);
}
