/**
 * ControlsPanel - The controls settings: the cast mode, and a key for each
 * action (click one, then press the new key). A key another action has is
 * swapped onto it; keys the game keeps (Escape, Enter, the modifiers, the
 * function keys) are refused with a note. Changes are kept at once
 * (controls.ts). Shown by the main menu's Settings and the in-match menu.
 *
 * While it waits for a key it takes every key press before the game does,
 * so pressing Q there doesn't cast; Escape or a click elsewhere stops
 * waiting.
 */

import { CAST_MODES } from "@/core/input/castModes";
import { getControls, type ControlSettings } from "@/core/input/controls";
import { CONTROL_ACTIONS, keyLabel, type ControlAction, type ControlGroup } from "@/core/input/keyBindings";

const GROUPS: ControlGroup[] = ["Abilities", "Summoner spells", "Items", "Commands", "Camera"];

const RESERVED_NOTE = "That key is kept by the game (Esc, Enter, Ctrl, Alt, Shift, F1-F12)";

export class ControlsPanel {
  readonly element: HTMLDivElement;
  private readonly modeButtons = new Map<string, HTMLButtonElement>();
  private readonly modeHint: HTMLDivElement;
  private readonly keyButtons = new Map<ControlAction, HTMLButtonElement>();
  private readonly message: HTMLDivElement;
  private listeningFor: ControlAction | null = null;
  private readonly unsubscribe: () => void;

  constructor(onBack: () => void) {
    const controls = getControls();
    this.element = document.createElement("div");
    this.element.className = "controls-panel";

    const title = document.createElement("div");
    title.className = "controls-title";
    title.textContent = "Controls";

    // Cast mode
    const modes = document.createElement("div");
    modes.className = "controls-modes";
    for (const info of CAST_MODES) {
      const button = document.createElement("button");
      button.className = "pixel-button controls-mode";
      button.textContent = info.label;
      button.addEventListener("click", () => controls.setCastMode(info.mode));
      this.modeButtons.set(info.mode, button);
      modes.append(button);
    }
    this.modeHint = document.createElement("div");
    this.modeHint.className = "controls-hint";

    // Keys, by group
    const keys = document.createElement("div");
    keys.className = "controls-keys";
    for (const group of GROUPS) {
      const heading = document.createElement("div");
      heading.className = "controls-group";
      heading.textContent = group;
      keys.append(heading);
      for (const info of CONTROL_ACTIONS.filter(action => action.group === group)) {
        const label = document.createElement("span");
        label.className = "controls-label";
        label.textContent = info.label;
        const button = document.createElement("button");
        button.className = "controls-key";
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          this.listen(this.listeningFor === info.action ? null : info.action);
        });
        this.keyButtons.set(info.action, button);
        keys.append(label, button);
      }
    }

    this.message = document.createElement("div");
    this.message.className = "controls-message";

    const buttons = document.createElement("div");
    buttons.className = "controls-buttons";
    const reset = document.createElement("button");
    reset.className = "pixel-button";
    reset.textContent = "Defaults";
    reset.addEventListener("click", () => {
      controls.reset();
      this.say("Back to quick cast and the usual keys");
    });
    const back = document.createElement("button");
    back.className = "pixel-button primary";
    back.textContent = "Back";
    back.addEventListener("click", () => {
      this.listen(null);
      onBack();
    });
    buttons.append(reset, back);

    this.element.append(title, modes, this.modeHint, keys, this.message, buttons);

    // Waiting for a key: a click anywhere else stops it
    this.element.addEventListener("click", () => this.listen(null));
    window.addEventListener("keydown", this.onKeyDown, true);
    this.unsubscribe = controls.subscribe(settings => this.show(settings));
    this.show(controls.get());
  }

  /** Stop waiting for a key (the panel was put away) */
  stopListening(): void {
    this.listen(null);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.unsubscribe();
    this.element.remove();
  }

  /** Capture: the new key, before the game or the menu hears it */
  private readonly onKeyDown = (event: KeyboardEvent) => {
    const action = this.listeningFor;
    if (action === null || !this.element.isConnected) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === "Escape") {
      this.listen(null);
      return;
    }
    const result = getControls().setKey(action, event.key);
    if ("error" in result) {
      this.say(RESERVED_NOTE);
      return;
    }
    this.listen(null);
    const swapped = result.swappedWith && CONTROL_ACTIONS.find(info => info.action === result.swappedWith);
    this.say(swapped ? `Swapped: ${swapped.label} is on ${keyLabel(getControls().keyFor(swapped.action))} now` : "");
  };

  private listen(action: ControlAction | null): void {
    const was = this.listeningFor;
    this.listeningFor = action;
    if (action) this.say("Press a key (Esc to cancel)");
    else if (was) this.say("");
    this.show(getControls().get());
  }

  private say(text: string): void {
    this.message.textContent = text;
  }

  private show(settings: ControlSettings): void {
    for (const [mode, button] of this.modeButtons) button.classList.toggle("selected", mode === settings.castMode);
    this.modeHint.textContent = CAST_MODES.find(info => info.mode === settings.castMode)?.description ?? "";
    for (const [action, button] of this.keyButtons) {
      const listening = action === this.listeningFor;
      button.classList.toggle("listening", listening);
      button.textContent = listening ? "..." : keyLabel(settings.keys[action]);
    }
  }
}
