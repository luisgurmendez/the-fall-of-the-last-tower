/**
 * PracticePanel - The practice tools (practice matches only): a panel on
 * the right with a button per tool, F2 or the Escape menu shows and hides
 * it (shown at first; the browser remembers it hidden).
 *
 * Each tool also has a key, Shift + a letter (src/core/state/practiceTools.ts),
 * shown on its button; they work with the panel hidden too. Teleport's
 * button waits for a left-click on the map or the minimap (Escape stops
 * waiting); Shift+T teleports to the cursor at once. The toggles (no
 * cooldowns, invulnerable, frozen bots) show on or off as the server says
 * (PRACTICE_TOOLS events). The server does the rest (game/practiceTools.ts).
 */

import { PRACTICE_TOOLS, type PracticeTool, type PracticeToggles } from "@siege/shared";
import type { NetworkClient } from "@siege/client";
import type Vector from "@/physics/vector";
import { isTypingTarget } from "@/core/state/chat";
import { PRACTICE_TOOL_INFO, practiceToolForKey, type PracticeTogglesStore } from "@/core/state/practiceTools";

const HIDDEN_KEY = "siege-practice-panel-hidden";

/** Which toggle each toggle tool turns on and off */
const TOGGLE_OF: Partial<Record<PracticeTool, keyof PracticeToggles>> = {
  toggle_no_cooldowns: "noCooldowns",
  toggle_invulnerable: "invulnerable",
  toggle_freeze_bots: "freezeBots",
};

/** The panel's switch, for the Escape menu */
export interface PracticeSwitch {
  isShown(): boolean;
  toggle(): void;
}

export class PracticePanel implements PracticeSwitch {
  private readonly root: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly buttons = new Map<PracticeTool, HTMLButtonElement>();
  private readonly unsubscribe: () => void;
  /** Teleport waits for a click */
  private aiming = false;
  private cursor: () => Vector | null = () => null;
  private disposed = false;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) return;
    if (event.key === "F2") {
      event.preventDefault();
      this.toggle();
      return;
    }
    // Before the menu hears it
    if (event.key === "Escape" && this.aiming) {
      event.stopImmediatePropagation();
      this.setAiming(false);
      return;
    }
    const tool = practiceToolForKey(event);
    if (!tool || event.repeat) return;
    // The game doesn't hear it (Shift+Q isn't a Q here)
    event.preventDefault();
    event.stopImmediatePropagation();
    if (tool === "teleport") {
      const at = this.cursor();
      if (at) this.send("teleport", at);
    } else {
      this.send(tool);
    }
  };

  constructor(private readonly networkClient: NetworkClient, private readonly toggles: PracticeTogglesStore) {
    this.root = document.createElement("div");
    this.root.className = "practice-panel";
    this.root.hidden = readHidden();

    const title = document.createElement("div");
    title.className = "practice-panel-title";
    title.innerHTML = "PRACTICE <span>F2 to hide</span>";

    const list = document.createElement("div");
    list.className = "practice-panel-tools";
    for (const tool of PRACTICE_TOOLS) {
      const button = document.createElement("button");
      button.className = "practice-panel-tool";
      button.type = "button";
      // It takes no focus: Space or Enter afterwards are the game's, not another press
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => this.press(tool));
      list.append(button);
      this.buttons.set(tool, button);
    }

    this.status = document.createElement("div");
    this.status.className = "practice-panel-status";

    this.root.append(title, list, this.status);
    document.body.append(this.root);

    this.unsubscribe = toggles.subscribe(() => this.refresh());
    // Capture: before the game's keys and the Escape menu
    window.addEventListener("keydown", this.onKeyDown, true);
    this.refresh();
  }

  /** Where the cursor points in the world (Shift+T teleports there) */
  setCursorSource(cursor: () => Vector | null): void {
    this.cursor = cursor;
  }

  /**
   * A left-click in the world or on the minimap: teleport's, while it waits
   * for one (true: it took the click).
   */
  takeClick(at: Vector): boolean {
    if (!this.aiming) return false;
    this.setAiming(false);
    this.send("teleport", at);
    return true;
  }

  isShown(): boolean {
    return !this.root.hidden;
  }

  toggle(): void {
    if (this.disposed) return;
    this.root.hidden = !this.root.hidden;
    if (this.root.hidden) this.setAiming(false);
    writeHidden(this.root.hidden);
  }

  /** Remove it for good (the match is over) */
  dispose(): void {
    this.disposed = true;
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.unsubscribe();
    this.root.remove();
  }

  private press(tool: PracticeTool): void {
    if (tool === "teleport") {
      this.setAiming(!this.aiming);
      return;
    }
    this.send(tool);
  }

  private send(tool: PracticeTool, at?: Vector): void {
    this.setAiming(false);
    this.networkClient.sendPracticeTool(tool, at?.x, at?.y);
  }

  private setAiming(aiming: boolean): void {
    this.aiming = aiming;
    this.refresh();
  }

  private refresh(): void {
    const toggles = this.toggles.get();
    for (const [tool, button] of this.buttons) {
      const { label, key } = PRACTICE_TOOL_INFO[tool];
      const toggle = TOGGLE_OF[tool];
      const on = toggle ? toggles[toggle] : tool === "teleport" && this.aiming;
      const state = toggle ? (on ? " · on" : " · off") : "";
      button.replaceChildren();
      const name = document.createElement("span");
      name.textContent = `${label}${state}`;
      const chip = document.createElement("span");
      chip.className = "practice-panel-key";
      chip.textContent = `⇧${key.toUpperCase()}`;
      button.append(name, chip);
      button.classList.toggle("on", on);
    }
    this.status.textContent = this.aiming ? "Click where to go (Esc to cancel)" : "";
  }
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(HIDDEN_KEY, "1");
    else localStorage.removeItem(HIDDEN_KEY);
  } catch {
    // No storage: it's shown again next time
  }
}
