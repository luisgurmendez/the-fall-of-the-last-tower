/**
 * Key bindings: which key does what. Every action a player can rebind has a
 * default (the keys the game always used); no two actions share a key, so
 * binding an action to a key another one has swaps the two. Some keys stay
 * the game's: Escape (the menu, cancelling), Enter (chat), the modifiers
 * (Ctrl levels abilities, Alt pings) and the function keys (F3 debug, F4
 * profiler, the browser's own).
 *
 * Keys are KeyboardEvent.key, with letters in lowercase (normalizeKey):
 * InputManager stores them that way, so Shift or Caps Lock don't change
 * what a key does. The player's bindings live in controls.ts.
 */

import type { AbilitySlot } from "@siege/shared";

export type ControlAction =
  | "ability_q" | "ability_w" | "ability_e" | "ability_r"
  | "summoner_1" | "summoner_2"
  | "item_1" | "item_2" | "item_3" | "item_4" | "item_5" | "item_6"
  | "ward" | "control_ward"
  | "attack_move" | "stop" | "recall"
  | "shop" | "scoreboard" | "ping" | "emotes"
  | "camera_center" | "camera_lock" | "zoom_in" | "zoom_out";

export type ControlGroup = "Abilities" | "Summoner spells" | "Items" | "Commands" | "Camera";

export interface ControlActionInfo {
  action: ControlAction;
  label: string;
  group: ControlGroup;
}

/** Every bindable action, in the order the controls panel lists them */
export const CONTROL_ACTIONS: readonly ControlActionInfo[] = [
  { action: "ability_q", label: "Ability 1", group: "Abilities" },
  { action: "ability_w", label: "Ability 2", group: "Abilities" },
  { action: "ability_e", label: "Ability 3", group: "Abilities" },
  { action: "ability_r", label: "Ultimate", group: "Abilities" },
  { action: "summoner_1", label: "Summoner spell 1", group: "Summoner spells" },
  { action: "summoner_2", label: "Summoner spell 2", group: "Summoner spells" },
  { action: "item_1", label: "Item 1", group: "Items" },
  { action: "item_2", label: "Item 2", group: "Items" },
  { action: "item_3", label: "Item 3", group: "Items" },
  { action: "item_4", label: "Item 4", group: "Items" },
  { action: "item_5", label: "Item 5", group: "Items" },
  { action: "item_6", label: "Item 6", group: "Items" },
  { action: "ward", label: "Ward (hold, release to place)", group: "Items" },
  { action: "control_ward", label: "Control ward (hold, release)", group: "Items" },
  { action: "attack_move", label: "Attack-move (with left-click)", group: "Commands" },
  { action: "stop", label: "Stop", group: "Commands" },
  { action: "recall", label: "Recall", group: "Commands" },
  { action: "shop", label: "Shop", group: "Commands" },
  { action: "scoreboard", label: "Scoreboard (hold)", group: "Commands" },
  { action: "ping", label: "Ping (with left-click; Alt too)", group: "Commands" },
  { action: "emotes", label: "Emotes (hold)", group: "Commands" },
  { action: "camera_center", label: "Center on your champion", group: "Camera" },
  { action: "camera_lock", label: "Lock on your champion", group: "Camera" },
  { action: "zoom_in", label: "Zoom in", group: "Camera" },
  { action: "zoom_out", label: "Zoom out", group: "Camera" },
];

export type KeyBindings = Readonly<Record<ControlAction, string>>;

/** The keys the game always used */
export const DEFAULT_KEYS: KeyBindings = Object.freeze({
  ability_q: "q",
  ability_w: "w",
  ability_e: "e",
  ability_r: "r",
  summoner_1: "d",
  summoner_2: "f",
  item_1: "1",
  item_2: "2",
  item_3: "3",
  item_4: "6",
  item_5: "7",
  item_6: "8",
  ward: "4",
  control_ward: "5",
  attack_move: "a",
  stop: "s",
  recall: "b",
  shop: "p",
  scoreboard: "Tab",
  ping: "g",
  emotes: "t",
  camera_center: " ",
  camera_lock: "y",
  zoom_in: ".",
  zoom_out: ",",
});

/** Keys the game keeps for itself */
const RESERVED_KEYS = new Set([
  "Escape", "Enter", "Control", "Alt", "AltGraph", "Shift", "Meta", "CapsLock", "Fn", "OS",
  // Not a key yet (an accent waiting for its letter) or not known
  "Dead", "Unidentified", "Process", "",
]);

const ABILITY_ACTIONS: Record<AbilitySlot, ControlAction> = {
  Q: "ability_q",
  W: "ability_w",
  E: "ability_e",
  R: "ability_r",
};

/** The action that casts the ability in a slot */
export function abilityAction(slot: AbilitySlot): ControlAction {
  return ABILITY_ACTIONS[slot];
}

/** The action that casts the summoner spell in slot 0 or 1 */
export function summonerAction(slot: 0 | 1): ControlAction {
  return slot === 0 ? "summoner_1" : "summoner_2";
}

/** The action that uses the item in inventory slot 0 to 5 */
export function itemAction(slot: number): ControlAction {
  return `item_${slot + 1}` as ControlAction;
}

/** A key as bindings hold it: letters in lowercase */
export function normalizeKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

/** Whether the game keeps the key for itself */
export function isReservedKey(key: string): boolean {
  return RESERVED_KEYS.has(key) || /^F\d{1,2}$/.test(key);
}

const KEY_NAMES: Record<string, string> = {
  " ": "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

/** How a key is shown: letters in capitals, keys that print nothing by name */
export function keyLabel(key: string): string {
  return KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}

/** The action a key is bound to, if any */
export function actionForKey(bindings: KeyBindings, key: string): ControlAction | null {
  const wanted = normalizeKey(key);
  const found = (Object.keys(bindings) as ControlAction[]).find(action => bindings[action] === wanted);
  return found ?? null;
}

export type RebindResult =
  | { bindings: KeyBindings; swappedWith: ControlAction | null }
  | { error: "reserved" };

/**
 * Bind an action to a key. The action that had the key, if another one,
 * gets the action's old key. Doesn't change the bindings it's given.
 */
export function rebind(bindings: KeyBindings, action: ControlAction, key: string): RebindResult {
  const wanted = normalizeKey(key);
  if (isReservedKey(wanted)) return { error: "reserved" };
  const holder = actionForKey(bindings, wanted);
  const next: Record<ControlAction, string> = { ...bindings };
  if (holder !== null && holder !== action) next[holder] = bindings[action];
  next[action] = wanted;
  return { bindings: next, swappedWith: holder !== null && holder !== action ? holder : null };
}
