/**
 * Plays the chiptune songs (songs.ts) with Web Audio, like an old console's
 * sound chip:
 * - lead: a 25% pulse wave, with a little vibrato on long notes;
 * - harmony: a thin 12.5% pulse, quiet, for the arpeggios;
 * - bass: a triangle wave;
 * - drums: noise (snare, hi-hat) and a falling sine (kick).
 *
 * Notes are scheduled on the audio clock a section ahead, so the music keeps
 * time even when the page's timers lag. A new song fades the old one out and
 * fades in; it loops from its loopFrom section forever.
 */

import { noteFrequency, parseVoice, sectionSteps, type NoteEvent, type Song, type VoiceId } from "./notation";

/** Schedule a section when it starts within this many seconds */
const SCHEDULE_AHEAD = 2;
/** How often to check (ms) */
const TICK_MS = 250;
const FADE_IN = 1.5;

interface ToneVoice {
  wave: "pulse25" | "pulse12" | "triangle";
  gain: number;
  /** Share of the note's length it sounds (the rest is silence between notes) */
  gate: number;
  vibrato: boolean;
}

const TONES: Record<Exclude<VoiceId, "drums">, ToneVoice> = {
  lead: { wave: "pulse25", gain: 0.13, gate: 0.9, vibrato: true },
  harmony: { wave: "pulse12", gain: 0.045, gate: 0.7, vibrato: false },
  bass: { wave: "triangle", gain: 0.32, gate: 0.92, vibrato: false },
};

interface Playing {
  song: Song;
  /** Its voices' notes by section, parsed once */
  notes: Map<string, Partial<Record<VoiceId, NoteEvent[]>>>;
  gain: GainNode;
  /** Index into song.order of the next section to schedule, and when it starts */
  next: number;
  nextTime: number;
  timer: ReturnType<typeof setInterval>;
}

export class ChiptunePlayer {
  private playing: Playing | null = null;
  private readonly waves = new Map<string, PeriodicWave>();
  private noise: AudioBuffer | null = null;

  constructor(private readonly context: AudioContext, private readonly output: AudioNode) {}

  /** The song playing now, if any */
  current(): Song | null {
    return this.playing?.song ?? null;
  }

  /** Play a song from its start (the one playing fades out) */
  play(song: Song): void {
    if (this.playing?.song === song) return;
    this.stop(1);
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(song.volume, now + FADE_IN);
    gain.connect(this.output);

    const notes = new Map<string, Partial<Record<VoiceId, NoteEvent[]>>>();
    for (const [name, section] of Object.entries(song.sections)) {
      const parsed: Partial<Record<VoiceId, NoteEvent[]>> = {};
      for (const [voice, line] of Object.entries(section) as [VoiceId, string][]) parsed[voice] = parseVoice(line, song.stepsPerBar);
      notes.set(name, parsed);
    }

    const playing: Playing = {
      song, notes, gain, next: 0, nextTime: now + 0.1,
      timer: setInterval(() => this.schedule(playing), TICK_MS),
    };
    this.playing = playing;
    this.schedule(playing);
  }

  /** Fade the music out over `fade` seconds and stop */
  stop(fade = 1): void {
    const playing = this.playing;
    if (!playing) return;
    this.playing = null;
    clearInterval(playing.timer);
    const now = this.context.currentTime;
    playing.gain.gain.cancelScheduledValues(now);
    playing.gain.gain.setValueAtTime(playing.gain.gain.value, now);
    playing.gain.gain.linearRampToValueAtTime(0, now + fade);
    // Notes already scheduled play on into silence, then the gain lets go
    setTimeout(() => playing.gain.disconnect(), (fade + SCHEDULE_AHEAD + 20) * 1000);
  }

  /** Schedule the sections that start soon */
  private schedule(playing: Playing): void {
    const { song } = playing;
    const step = 60 / song.bpm / (song.stepsPerBar / 4);
    while (playing.nextTime < this.context.currentTime + SCHEDULE_AHEAD) {
      // Fell behind (a sleeping tab): pick up from now, not with a burst
      if (playing.nextTime < this.context.currentTime) playing.nextTime = this.context.currentTime + 0.05;
      const name = song.order[playing.next];
      const voices = playing.notes.get(name) ?? {};
      for (const [voice, events] of Object.entries(voices) as [VoiceId, NoteEvent[]][]) {
        for (const event of events) {
          const at = playing.nextTime + event.step * step;
          if (voice === "drums") this.drum(event.note, at, playing.gain);
          else this.tone(TONES[voice], event.note, at, event.length * step, playing.gain);
        }
      }
      playing.nextTime += sectionSteps(song, name) * step;
      playing.next = playing.next + 1 < song.order.length ? playing.next + 1 : song.loopFrom;
    }
  }

  /** A short blip right now: notes one after another (the menus' sounds, uiSounds.ts) */
  blip(notes: [string, number][], wave: "pulse25" | "pulse12" | "square", gain: number, out: AudioNode): void {
    let at = this.context.currentTime + 0.005;
    for (const [note, seconds] of notes) {
      const osc = this.context.createOscillator();
      if (wave === "square") osc.type = "square";
      else osc.setPeriodicWave(this.pulse(wave === "pulse25" ? 0.25 : 0.125));
      osc.frequency.setValueAtTime(noteFrequency(note), at);
      const env = this.context.createGain();
      env.gain.setValueAtTime(gain, at);
      env.gain.setValueAtTime(gain, at + seconds * 0.7);
      env.gain.linearRampToValueAtTime(0, at + seconds);
      osc.connect(env).connect(out);
      osc.start(at);
      osc.stop(at + seconds + 0.01);
      at += seconds;
    }
  }

  /** One note of a tone voice */
  private tone(voice: ToneVoice, note: string, at: number, length: number, out: AudioNode): void {
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const frequency = noteFrequency(note);
    if (voice.wave === "triangle") osc.type = "triangle";
    else osc.setPeriodicWave(this.pulse(voice.wave === "pulse25" ? 0.25 : 0.125));
    osc.frequency.setValueAtTime(frequency, at);

    const gate = Math.max(0.03, length * voice.gate);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(voice.gain, at + 0.006);
    env.gain.linearRampToValueAtTime(voice.gain * 0.7, at + Math.min(0.08, gate * 0.5));
    env.gain.setValueAtTime(voice.gain * 0.7, at + gate - 0.02);
    env.gain.linearRampToValueAtTime(0, at + gate);

    // A long note wavers a little after it starts, as chip leads do
    if (voice.vibrato && length > 0.3) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, at);
      depth.gain.linearRampToValueAtTime(frequency * 0.006, at + 0.25);
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + gate);
    }

    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + gate + 0.01);
  }

  /** A drum hit: kick, snare or hi-hat */
  private drum(hit: string, at: number, out: AudioNode): void {
    const ctx = this.context;
    if (hit === "k") {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, at);
      osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
      env.gain.setValueAtTime(0.55, at);
      env.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
      osc.connect(env).connect(out);
      osc.start(at);
      osc.stop(at + 0.17);
      return;
    }
    const snare = hit === "s";
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = snare ? "bandpass" : "highpass";
    filter.frequency.value = snare ? 1800 : 7000;
    const env = ctx.createGain();
    const length = snare ? 0.14 : 0.04;
    env.gain.setValueAtTime(snare ? 0.28 : 0.07, at);
    env.gain.exponentialRampToValueAtTime(0.001, at + length);
    source.connect(filter).connect(env).connect(out);
    source.start(at);
    source.stop(at + length + 0.01);
  }

  /** A pulse wave of a duty cycle, built from its harmonics (cached) */
  private pulse(duty: number): PeriodicWave {
    const key = String(duty);
    let wave = this.waves.get(key);
    if (!wave) {
      const harmonics = 48;
      const real = new Float32Array(harmonics + 1);
      const imag = new Float32Array(harmonics + 1);
      for (let n = 1; n <= harmonics; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
      wave = this.context.createPeriodicWave(real, imag);
      this.waves.set(key, wave);
    }
    return wave;
  }

  /** A second of white noise (made once) */
  private noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const buffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    return this.noise;
  }
}
