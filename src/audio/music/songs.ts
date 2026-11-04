/**
 * The game's music: chiptune songs written for it (notation.ts says how they
 * read; ChiptunePlayer.ts plays them). Both share one 8-note motif (D F A G F,
 * rising and settling), so the match's music recalls the menu's theme.
 *
 * - title: the menu's theme. D minor with a chorus in F major, heroic and a
 *   little melancholic: a music-box intro, the motif (A), the chorus (B), a
 *   bridge climbing to A, then back to A.
 * - match: under a match, quiet: soft arpeggios and bass, light drums, the
 *   motif now and then, so it never covers the game's sounds.
 */

import type { Song } from "./notation";

export type SongId = "title" | "match";

/** Bars joined into a voice */
const bars = (...list: string[]) => list.join(" | ");
/** A 4-note cell played four times: a bar of sixteenths */
const arp16 = (cell: string) => `${cell} ${cell} ${cell} ${cell}`;
/** A 4-note cell in eighths, twice: a bar */
const arp8 = (a: string, b: string, c: string, d: string) => `${a}:2 ${b}:2 ${c}:2 ${d}:2 ${a}:2 ${b}:2 ${c}:2 ${d}:2`;
/** Root and its octave in eighths: a driving bass bar */
const octaves = (low: string, high: string) => `${low}:2 ${high}:2 ${low}:2 ${high}:2 ${low}:2 ${high}:2 ${low}:2 ${high}:2`;

/** Each chord's arpeggio cell (sixteenths) */
const ARP = {
  Dm: "D4:1 F4:1 A4:1 D5:1",
  Bb: "D4:1 F4:1 Bb4:1 D5:1",
  F: "C4:1 F4:1 A4:1 C5:1",
  C: "C4:1 E4:1 G4:1 C5:1",
  Gm: "D4:1 G4:1 Bb4:1 D5:1",
  A: "C#4:1 E4:1 A4:1 C#5:1",
};

/** Each chord's bass, root and octave */
const BASS = {
  Dm: octaves("D2", "D3"),
  Bb: octaves("Bb1", "Bb2"),
  F: octaves("F2", "F3"),
  C: octaves("C2", "C3"),
  Gm: octaves("G1", "G2"),
  A: octaves("A1", "A2"),
};

const GROOVE = "k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2";
const GROOVE_DRIVE = "k:2 h:2 s:2 h:2 k:2 h:2 s:2 k:2";
const FILL = "k:2 s:1 s:1 s:2 s:1 s:1 s:1 s:1 s:1 s:1 s:2 s:2";

type Chord = keyof typeof ARP;
const VERSE: Chord[] = ["Dm", "Bb", "F", "C", "Dm", "Bb", "Gm", "A"];
const CHORUS: Chord[] = ["F", "C", "Dm", "Bb", "F", "C", "Bb", "A"];

const TITLE: Song = {
  bpm: 112,
  stepsPerBar: 16,
  volume: 0.8,
  sections: {
    // A music box under the night sky: the chords slowly, then a pickup
    intro: {
      harmony: bars(arp8("D4", "F4", "A4", "D5"), arp8("D4", "F4", "Bb4", "D5"), arp8("C4", "F4", "A4", "C5"), arp8("C4", "E4", "G4", "C5")),
      bass: bars("D2:16", "Bb1:16", "F2:16", "C2:16"),
      lead: bars("r:16", "r:16", "r:16", "r:12 A4:4"),
      drums: bars("r:16", "r:16", "r:16", "r:8 s:2 s:2 s:2 s:2"),
    },
    // The motif
    A: {
      lead: bars(
        "D5:4 F5:2 A5:2 G5:4 F5:4",
        "D5:6 C5:2 Bb4:4 D5:4",
        "C5:4 F5:2 A5:2 C6:4 A5:4",
        "G5:12 r:4",
        "D5:4 F5:2 A5:2 G5:4 F5:4",
        "Bb5:6 A5:2 G5:4 F5:4",
        "G5:4 Bb5:2 A5:2 G5:4 D5:4",
        "E5:8 C#5:4 A4:4",
      ),
      harmony: bars(...VERSE.map(chord => arp16(ARP[chord]))),
      bass: bars(...VERSE.map(chord => BASS[chord])),
      drums: bars(GROOVE, GROOVE, GROOVE, GROOVE, GROOVE, GROOVE, GROOVE, FILL),
    },
    // The chorus, in F major, higher
    B: {
      lead: bars(
        "A5:4 C6:4 A5:2 G5:2 F5:4",
        "G5:6 E5:2 C5:4 E5:4",
        "F5:4 A5:4 D6:4 C6:4",
        "Bb5:8 A5:4 G5:4",
        "A5:4 C6:4 A5:2 G5:2 F5:4",
        "G5:4 C6:4 E5:4 G5:4",
        "F5:4 D6:4 C6:4 Bb5:4",
        "A5:12 r:4",
      ),
      harmony: bars(...CHORUS.map(chord => arp16(ARP[chord]))),
      bass: bars(...CHORUS.map(chord => BASS[chord])),
      drums: bars(GROOVE_DRIVE, GROOVE_DRIVE, GROOVE_DRIVE, GROOVE_DRIVE, GROOVE_DRIVE, GROOVE_DRIVE, GROOVE_DRIVE, FILL),
    },
    // Climbing to A, a snare roll back into the motif
    bridge: {
      lead: bars("G5:8 Bb5:8", "A5:8 F5:8", "E5:16", "E5:4 A5:4 C#6:4 A5:4"),
      harmony: bars(arp16(ARP.Gm), arp16(ARP.Bb), arp16(ARP.A), arp16(ARP.A)),
      bass: bars(BASS.Gm, BASS.Bb, "A1:16", BASS.A),
      drums: bars(GROOVE, GROOVE, "s:2 s:2 s:2 s:2 s:2 s:2 s:2 s:2", "s:1 s:1 s:1 s:1 s:1 s:1 s:1 s:1 s:1 s:1 s:1 s:1 s:1 s:1 s:1 s:1"),
    },
  },
  order: ["intro", "A", "B", "A", "B", "bridge"],
  loopFrom: 1,
};

const MATCH: Song = {
  bpm: 92,
  stepsPerBar: 16,
  volume: 0.35,
  sections: {
    // The verse's chords, the motif once
    calm: {
      lead: bars("r:16", "r:16", "r:16", "r:16", "D5:4 F5:2 A5:2 G5:8", "F5:16", "r:16", "r:16"),
      harmony: bars(
        arp8("D4", "F4", "A4", "D5"), arp8("D4", "F4", "Bb4", "D5"), arp8("C4", "F4", "A4", "C5"), arp8("C4", "E4", "G4", "C5"),
        arp8("D4", "F4", "A4", "D5"), arp8("D4", "F4", "Bb4", "D5"), arp8("D4", "G4", "Bb4", "D5"), arp8("C#4", "E4", "A4", "C#5"),
      ),
      bass: bars("D2:8 A1:8", "Bb1:8 F2:8", "F2:8 C2:8", "C2:8 G1:8", "D2:8 A1:8", "Bb1:8 F2:8", "G1:8 D2:8", "A1:16"),
      drums: bars(...Array.from({ length: 8 }, (_, i) => (i % 4 === 3 ? "k:4 h:4 h:4 h:2 h:2" : "k:4 h:4 r:4 h:4"))),
    },
    // The chorus's chords, the motif up high
    rise: {
      lead: bars("r:16", "r:16", "F5:4 A5:4 D6:8", "C6:16", "r:16", "r:16", "F5:4 D6:4 C6:4 Bb5:4", "A5:16"),
      harmony: bars(
        arp8("C4", "F4", "A4", "C5"), arp8("C4", "E4", "G4", "C5"), arp8("D4", "F4", "A4", "D5"), arp8("D4", "F4", "Bb4", "D5"),
        arp8("C4", "F4", "A4", "C5"), arp8("C4", "E4", "G4", "C5"), arp8("D4", "F4", "Bb4", "D5"), arp8("C#4", "E4", "A4", "C#5"),
      ),
      bass: bars("F2:8 C2:8", "C2:8 G1:8", "D2:8 A1:8", "Bb1:8 F2:8", "F2:8 C2:8", "C2:8 G1:8", "Bb1:8 F2:8", "A1:16"),
      drums: bars(...Array.from({ length: 8 }, (_, i) => (i % 4 === 3 ? "k:4 h:4 s:4 h:2 h:2" : "k:4 h:4 s:4 h:4"))),
    },
  },
  order: ["calm", "rise"],
  loopFrom: 0,
};

export const SONGS: Record<SongId, Song> = { title: TITLE, match: MATCH };
