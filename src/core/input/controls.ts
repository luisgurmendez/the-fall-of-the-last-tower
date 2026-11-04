/**
 * The player's control settings: the cast mode (castModes.ts) and the key
 * bindings (keyBindings.ts), kept in the browser's storage under
 * "siege-controls". Whatever was stored is checked part by part: a bad cast
 * mode or a bad key falls back to its default and the rest is kept. With
 * no storage (blocked, or it throws) the settings still work for the
 * session.
 *
 * getControls() is the game's one copy; the input handler, the HUD's key
 * labels, the controls panel and the how-to-play screen read it, and
 * subscribe() tells them about changes.
 */

import { isCastMode, type CastMode } from "@/core/input/castModes";
import { DEFAULT_KEYS, rebind, type ControlAction, type KeyBindings } from "@/core/input/keyBindings";

export const CONTROLS_STORAGE_KEY = "siege-controls";

export const DEFAULT_CAST_MODE: CastMode = "quick";

export interface ControlSettings {
  castMode: CastMode;
  keys: KeyBindings;
}

/** The part of the browser's Storage this needs */
export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaults(): ControlSettings {
  return { castMode: DEFAULT_CAST_MODE, keys: { ...DEFAULT_KEYS } };
}

/** Settings from what was stored (anything), defaults for what's wrong */
export function parseControlSettings(raw: unknown): ControlSettings {
  const settings = defaults();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return settings;
  const stored = raw as { castMode?: unknown; keys?: unknown };
  if (isCastMode(stored.castMode)) settings.castMode = stored.castMode;
  if (typeof stored.keys === "object" && stored.keys !== null) {
    // One at a time, as if the player rebound them: a key two actions claim ends up with the later one
    for (const [action, key] of Object.entries(stored.keys)) {
      if (!(action in DEFAULT_KEYS) || typeof key !== "string") continue;
      const result = rebind(settings.keys, action as ControlAction, key);
      if (!("error" in result)) settings.keys = result.bindings;
    }
  }
  return settings;
}

type Listener = (settings: ControlSettings) => void;

export class Controls {
  private settings: ControlSettings;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly storage: SettingsStorage | null) {
    this.settings = this.load();
  }

  /** A copy of the settings */
  get(): ControlSettings {
    return { castMode: this.settings.castMode, keys: { ...this.settings.keys } };
  }

  getCastMode(): CastMode {
    return this.settings.castMode;
  }

  keyFor(action: ControlAction): string {
    return this.settings.keys[action];
  }

  setCastMode(mode: CastMode): void {
    this.settings = { ...this.settings, castMode: mode };
    this.changed();
  }

  /** Bind an action to a key (swapping with the action that had it) */
  setKey(action: ControlAction, key: string): { swappedWith: ControlAction | null } | { error: "reserved" } {
    const result = rebind(this.settings.keys, action, key);
    if ("error" in result) return result;
    this.settings = { ...this.settings, keys: result.bindings };
    this.changed();
    return { swappedWith: result.swappedWith };
  }

  /** Back to quick cast and the default keys */
  reset(): void {
    this.settings = defaults();
    this.changed();
  }

  /** Hear every change; returns how to stop */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private load(): ControlSettings {
    try {
      return parseControlSettings(JSON.parse(this.storage?.getItem(CONTROLS_STORAGE_KEY) ?? "null"));
    } catch {
      return defaults();
    }
  }

  private changed(): void {
    try {
      this.storage?.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Not kept past this session
    }
    for (const listener of this.listeners) listener(this.get());
  }
}

let instance: Controls | null = null;

/** The game's control settings */
export function getControls(): Controls {
  if (!instance) {
    let storage: SettingsStorage | null = null;
    try {
      storage = typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      // Storage blocked
    }
    instance = new Controls(storage);
  }
  return instance;
}
