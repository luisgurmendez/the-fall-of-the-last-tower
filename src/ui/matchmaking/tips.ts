/**
 * Gameplay tips shown at the bottom of the matchmaking overlay, changed
 * every 10 seconds.
 */

import { getControls } from "@/core/input/controls";
import { abilityAction, keyLabel, type ControlAction } from "@/core/input/keyBindings";

/**
 * Tips to display randomly (with the player's keys).
 */
function tips(): string[] {
  const key = (action: ControlAction) => keyLabel(getControls().keyFor(action));
  const abilities = (["Q", "W", "E", "R"] as const).map(slot => key(abilityAction(slot))).join("");
  return [
    `Tip: Use ${abilities} for abilities, right-click to move`,
    `Tip: Press ${key("shop")} to open the shop`,
    "Tip: Last hitting minions gives bonus gold",
    "Tip: Stay behind your minions to avoid tower damage",
    `Tip: Hold ${key("scoreboard")} to see the scoreboard`,
    "Tip: Settings has the cast modes and lets you change every key",
    "Tip: Wards reveal invisible enemies",
    "Tip: Killing dragon gives team-wide buffs",
    "Tip: The Rootwyrm wakes in the top river at 4:00; slaying it toughens your whole team",
  ];
}

/**
 * Start tip rotation.
 */
export function startTipRotation(tipText: HTMLElement): void {
  setInterval(() => {
    showRandomTip(tipText);
  }, 10000);
}

/**
 * Show a random tip.
 */
export function showRandomTip(tipText: HTMLElement): void {
  if (!tipText) return;
  const all = tips();
  const tip = all[Math.floor(Math.random() * all.length)];
  tipText.textContent = tip;
}
