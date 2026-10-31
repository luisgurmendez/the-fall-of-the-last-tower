/**
 * AudioManager - plays the game's sounds (soundCatalog.ts) with the Web
 * Audio API, heard from the camera:
 * - a sound in the world plays at full volume within NEAR of the camera's
 *   middle, fades out by FAR (past the screen's edge; both as shares of the
 *   view's width, so it follows the zoom) and pans with where it is;
 * - a sound plays at most maxVoices at once and doesn't start again within
 *   MIN_GAP, so ten minions hitting at once are one hit, not a roar;
 * - each start picks one of the sound's variants and nudges its pitch, so
 *   frequent sounds don't repeat exactly;
 * - sfx, ui and ambience buses under a master volume (kept in localStorage).
 *
 * Browsers keep audio suspended until the player clicks or presses a key:
 * the first one resumes it. Until a sound has loaded, playing it does
 * nothing.
 */

import { SOUNDS, soundFiles, type SoundBus, type SoundDef, type SoundKey } from "./soundCatalog";

/** Full volume within this share of the view's width from its middle */
const NEAR = 0.45;
/** Silent past this share of the view's width */
const FAR = 0.95;
/** How far left or right a sound at the screen's edge pans (0-1) */
const PAN = 0.6;
/** The same sound doesn't start again within this many seconds */
const MIN_GAP = 0.05;
/** Sounds playing at once, across all of them */
const MAX_VOICES = 24;
/** Pitch varies by up to this much each start (0.04 = 4%) */
const PITCH_VARIATION = 0.04;
/** Seconds a loop takes to fade to a new level */
const LOOP_FADE = 0.6;

const STORAGE_KEY = "siege-audio";

export type VolumeChannel = SoundBus | "master";

interface Settings {
  volumes: Record<VolumeChannel, number>;
  muted: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  volumes: { master: 0.7, sfx: 1, ui: 0.9, ambience: 0.6 },
  muted: false,
};

/** Where a world sound plays; omit for sounds that aren't in the world */
export interface SoundPosition {
  x: number;
  y: number;
}

/** A started sound */
export interface SoundHandle {
  /** Fade it out and stop it */
  stop(fade?: number): void;
}

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses = new Map<SoundBus, GainNode>();
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Set<string>();
  private voices = new Map<SoundKey, number>();
  private lastStart = new Map<SoundKey, number>();
  private totalVoices = 0;
  private loops = new Map<SoundKey, { gain: GainNode; source: AudioBufferSourceNode }>();
  private listener = { x: 0, y: 0, viewWidth: 900 };
  private settings: Settings = AudioManager.loadSettings();

  constructor() {
    // Outside a browser (tests) it stays silent
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return;
    const resume = () => void this.resume();
    window.addEventListener("pointerdown", resume);
    window.addEventListener("keydown", resume);
  }

  /** Start the audio (browsers allow it from a click or key press) */
  async resume(): Promise<void> {
    this.ensureContext();
    await this.context?.resume();
  }

  /** Start loading every sound (they play once loaded) */
  preloadAll(): void {
    for (const key of Object.keys(SOUNDS) as SoundKey[]) {
      for (const file of soundFiles(key)) void this.load(file);
    }
  }

  /** Where the camera is and how much of the world it shows across */
  setListener(x: number, y: number, viewWidth: number): void {
    this.listener.x = x;
    this.listener.y = y;
    this.listener.viewWidth = viewWidth;
  }

  /**
   * Play a sound, in the world at `at` (heard from the camera) or, without
   * it, as is, `delay` seconds from now. Null if it didn't start (too far,
   * too many playing, not loaded yet).
   */
  play(key: SoundKey, at?: SoundPosition, volume = 1, delay = 0): SoundHandle | null {
    const def: SoundDef = SOUNDS[key];
    const context = this.context;
    if (!context || context.state !== "running" || this.settings.muted) return null;

    const placed = at && def.bus !== "ui" ? this.placement(at) : { gain: 1, pan: 0 };
    if (placed.gain <= 0.02) return null;

    const now = context.currentTime + delay;
    const voices = this.voices.get(key) ?? 0;
    if (voices >= (def.maxVoices ?? 3) || this.totalVoices >= MAX_VOICES) return null;
    if (now - (this.lastStart.get(key) ?? -Infinity) < MIN_GAP) return null;

    const files = soundFiles(key);
    const buffer = this.buffers.get(files[Math.floor(Math.random() * files.length)]);
    if (!buffer) {
      for (const file of files) void this.load(file);
      return null;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = def.loop ?? false;
    if (!def.steadyPitch) source.playbackRate.value = 1 + (Math.random() * 2 - 1) * PITCH_VARIATION;
    const gain = context.createGain();
    const level = (def.volume ?? 1) * volume * placed.gain;
    gain.gain.value = level;
    if (def.rise != null) {
      gain.gain.setValueAtTime(level * def.rise, now);
      gain.gain.linearRampToValueAtTime(level, now + buffer.duration);
    }
    const panner = context.createStereoPanner();
    panner.pan.value = placed.pan;
    source.connect(gain).connect(panner).connect(this.bus(def.bus ?? "sfx"));

    this.voices.set(key, voices + 1);
    this.totalVoices++;
    this.lastStart.set(key, now);
    source.onended = () => {
      this.voices.set(key, (this.voices.get(key) ?? 1) - 1);
      this.totalVoices--;
    };
    source.start(now);

    return {
      stop: (fade = 0.15) => {
        const end = context.currentTime + fade;
        // From where a rise has got to (Firefox has no cancelAndHoldAtTime)
        const hold = (gain.gain as Partial<AudioParam>).cancelAndHoldAtTime;
        if (hold) hold.call(gain.gain, context.currentTime);
        else gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.setTargetAtTime(0, context.currentTime, fade / 3);
        try {
          source.stop(end);
        } catch {
          // Already stopped
        }
      },
    };
  }

  /**
   * Keep a looping sound playing at `level` (0-1), fading between levels;
   * at 0 it's silent but keeps its place in the loop.
   */
  setLoopLevel(key: SoundKey, level: number): void {
    const context = this.context;
    if (!context || context.state !== "running") return;
    let loop = this.loops.get(key);
    if (!loop) {
      if (level <= 0) return;
      const buffer = this.buffers.get(soundFiles(key)[0]);
      if (!buffer) {
        void this.load(soundFiles(key)[0]);
        return;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(this.bus((SOUNDS[key] as SoundDef).bus ?? "ambience"));
      source.start();
      loop = { gain, source };
      this.loops.set(key, loop);
    }
    const target = this.settings.muted ? 0 : level * ((SOUNDS[key] as SoundDef).volume ?? 1);
    loop.gain.gain.setTargetAtTime(target, context.currentTime, LOOP_FADE / 3);
  }

  getVolume(channel: VolumeChannel): number {
    return this.settings.volumes[channel];
  }

  setVolume(channel: VolumeChannel, volume: number): void {
    this.settings.volumes[channel] = Math.min(1, Math.max(0, volume));
    this.applyVolumes();
    this.saveSettings();
  }

  isMuted(): boolean {
    return this.settings.muted;
  }

  setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.applyVolumes();
    this.saveSettings();
  }

  /** How loud and where a sound at `at` is, heard from the camera */
  private placement(at: SoundPosition): { gain: number; pan: number } {
    const { x, y, viewWidth } = this.listener;
    const distance = Math.hypot(at.x - x, at.y - y);
    const near = viewWidth * NEAR;
    const far = viewWidth * FAR;
    const fade = distance <= near ? 1 : distance >= far ? 0 : 1 - (distance - near) / (far - near);
    const pan = Math.max(-1, Math.min(1, (at.x - x) / (viewWidth / 2))) * PAN;
    return { gain: fade * fade, pan };
  }

  private ensureContext(): void {
    if (this.context) return;
    const context = new AudioContext();
    this.context = context;
    this.master = context.createGain();
    this.master.connect(context.destination);
    for (const bus of ["sfx", "ui", "ambience"] as SoundBus[]) {
      const gain = context.createGain();
      gain.connect(this.master);
      this.buses.set(bus, gain);
    }
    this.applyVolumes();
    this.preloadAll();
  }

  private bus(bus: SoundBus): GainNode {
    return this.buses.get(bus)!;
  }

  private applyVolumes(): void {
    if (!this.master) return;
    this.master.gain.value = this.settings.muted ? 0 : this.settings.volumes.master;
    for (const [bus, gain] of this.buses) gain.gain.value = this.settings.volumes[bus];
  }

  private async load(file: string): Promise<void> {
    if (!this.context || this.buffers.has(file) || this.loading.has(file)) return;
    this.loading.add(file);
    try {
      const response = await fetch(file);
      if (!response.ok) return;
      this.buffers.set(file, await this.context.decodeAudioData(await response.arrayBuffer()));
    } catch {
      // Missing or undecodable: the sound stays silent
    } finally {
      this.loading.delete(file);
    }
  }

  private static loadSettings(): Settings {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Settings> | null;
      return {
        volumes: { ...DEFAULT_SETTINGS.volumes, ...saved?.volumes },
        muted: saved?.muted ?? false,
      };
    } catch {
      return { volumes: { ...DEFAULT_SETTINGS.volumes }, muted: false };
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Storage unavailable: the settings last until the page reloads
    }
  }
}

let instance: AudioManager | null = null;

/** The game's audio, created on first use */
export function getAudio(): AudioManager {
  if (!instance) {
    instance = new AudioManager();
    // In development, reachable from the console as siegeAudio
    if (import.meta.env?.DEV && typeof window !== "undefined") Object.assign(window, { siegeAudio: instance });
  }
  return instance;
}
