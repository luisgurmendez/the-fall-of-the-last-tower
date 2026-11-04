/**
 * The How to Play screen's list of controls, written from the player's
 * keys (controls.ts) each time the screen opens, so it says what each key
 * does for them.
 */

import { CAST_MODES } from "@/core/input/castModes";
import { getControls } from "@/core/input/controls";
import { abilityAction, itemAction, keyLabel, summonerAction, type ControlAction } from "@/core/input/keyBindings";

const ITEM_SLOTS = [0, 1, 2, 3, 4, 5];

/** The rows: what to press, and what it does */
export function howToPlayRows(): [string, string][] {
  const controls = getControls();
  const key = (action: ControlAction) => keyLabel(controls.keyFor(action));
  const abilities = (["Q", "W", "E", "R"] as const).map(slot => key(abilityAction(slot))).join(" ");
  const castMode = CAST_MODES.find(info => info.mode === controls.getCastMode())!;
  return [
    ["Right-click", "Move, or attack what's under the cursor"],
    [`${key("attack_move")} + left-click`, "Attack-move: walk there, attacking enemies on the way"],
    [key("stop"), "Stop"],
    [abilities, `Cast an ability (${castMode.label.toLowerCase()}: change it in Settings; hold Black Arrows to charge it)`],
    [`Ctrl + ${abilities}`, "Spend a skill point on that ability (or click the + over it)"],
    [`${key(summonerAction(0))} ${key(summonerAction(1))}`, "Summoner spells"],
    [ITEM_SLOTS.map(slot => key(itemAction(slot))).join(" "), "Use an item (potions, actives)"],
    [key("recall"), "Recall to base"],
    [key("shop"), "Shop (buy at your fountain)"],
    [`${key("ward")} / ${key("control_ward")}`, "Hold to aim a ward / a control ward, let go to place it"],
    [key("scoreboard"), "Scoreboard (hold)"],
    [`Alt or ${key("ping")} + left-click`, "Ping (hold and drag for the ping wheel)"],
    [key("emotes"), "Emotes (hold, let go over one)"],
    [key("camera_lock"), "Lock the camera on your champion"],
    [key("camera_center"), "Center the camera on your champion"],
    [`Mouse wheel, ${key("zoom_in")} ${key("zoom_out")}`, "Zoom"],
    ["Minimap", "Left-click to look there, right-click to walk there"],
    ["Esc", "Menu (controls, surrender); drops an ability being aimed"],
  ];
}

/** Write the rows into the screen's grid */
export function fillHowToPlay(grid: HTMLElement): void {
  grid.replaceChildren(...howToPlayRows().flatMap(([keys, action]) => {
    const keyCell = document.createElement("div");
    keyCell.className = "how-to-play-key";
    keyCell.textContent = keys;
    const actionCell = document.createElement("div");
    actionCell.className = "how-to-play-action";
    actionCell.textContent = action;
    return [keyCell, actionCell];
  }));
}
