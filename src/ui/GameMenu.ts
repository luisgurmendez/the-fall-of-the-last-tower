/**
 * GameMenu - The in-match menu Escape opens: resume, the sound's volumes
 * (master, effects, ambience, music; kept by AudioManager), the controls (cast
 * mode and keys: ControlsPanel), the debug overlay (F3 too), the practice
 * tools' panel (F2 too; practice matches), or surrender.
 *
 * The game keeps running on the server while it's open. Surrendering asks
 * for a second click instead of a browser dialog; the match then ends like
 * any other (GAME_END, the final scoreboard, back to the menu).
 */

import { createSoundControls } from "./soundControls";
import { ControlsPanel } from "@/ui/ControlsPanel";
import type { PracticeSwitch } from "@/ui/PracticePanel";

const CONFIRM_MS = 3000;

/** The debug overlay's switch (src/debug/DebugOverlay.ts) */
export interface DebugSwitch {
  isEnabled(): boolean;
  toggle(): void;
}


export class GameMenu {
  private readonly root: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly controls: ControlsPanel;
  private readonly surrenderButton: HTMLButtonElement;
  private readonly debugButton: HTMLButtonElement | null = null;
  private readonly practiceButton: HTMLButtonElement | null = null;
  private confirmUntil = 0;
  private closed = false;

  constructor(
    private readonly onSurrender: () => void,
    private readonly debug?: DebugSwitch,
    private readonly practice?: PracticeSwitch,
  ) {
    this.root = document.createElement("div");
    this.root.className = "game-menu";
    this.root.hidden = true;

    const panel = document.createElement("div");
    panel.className = "game-menu-panel";
    this.panel = panel;

    // The controls take the menu's place, and Back brings it back
    this.controls = new ControlsPanel(() => this.showControls(false));
    this.controls.element.hidden = true;
    const controlsButton = document.createElement("button");
    controlsButton.className = "pixel-button";
    controlsButton.textContent = "Controls";
    controlsButton.addEventListener("click", () => this.showControls(true));

    const title = document.createElement("div");
    title.className = "game-menu-title";
    title.textContent = "Menu";

    const resumeButton = document.createElement("button");
    resumeButton.className = "pixel-button primary";
    resumeButton.textContent = "Resume";
    resumeButton.addEventListener("click", () => this.hide());

    this.surrenderButton = document.createElement("button");
    this.surrenderButton.className = "pixel-button game-menu-surrender";
    this.surrenderButton.addEventListener("click", () => this.handleSurrenderClick());

    const hint = document.createElement("div");
    hint.className = "game-menu-hint";
    hint.textContent = "The match keeps going while this is open";

    panel.append(title, resumeButton, createSoundControls(), controlsButton);
    if (debug) {
      const button = document.createElement("button");
      button.className = "pixel-button";
      button.addEventListener("click", () => {
        debug.toggle();
        this.labelDebugButton();
      });
      panel.append(button);
      this.debugButton = button;
    }
    if (practice) {
      const button = document.createElement("button");
      button.className = "pixel-button";
      button.addEventListener("click", () => {
        practice.toggle();
        this.labelPracticeButton();
      });
      panel.append(button);
      this.practiceButton = button;
    }
    panel.append(this.surrenderButton, hint);
    this.root.append(panel, this.controls.element);
    // Clicks on the dimmed backdrop close it
    this.root.addEventListener("mousedown", (event) => {
      if (event.target === this.root) this.hide();
    });
    document.body.append(this.root);
    this.resetSurrenderButton();
  }

  isOpen(): boolean {
    return !this.root.hidden;
  }

  toggle(): void {
    if (this.isOpen()) this.hide();
    else this.show();
  }

  show(): void {
    if (this.closed) return;
    this.resetSurrenderButton();
    this.labelDebugButton();
    this.labelPracticeButton();
    this.root.hidden = false;
  }

  private labelPracticeButton(): void {
    if (!this.practiceButton || !this.practice) return;
    this.practiceButton.textContent = `Practice tools: ${this.practice.isShown() ? "shown" : "hidden"} (F2)`;
  }

  private labelDebugButton(): void {
    if (!this.debugButton || !this.debug) return;
    this.debugButton.textContent = `Debug: ${this.debug.isEnabled() ? "on" : "off"} (F3)`;
  }

  hide(): void {
    this.root.hidden = true;
    this.showControls(false);
  }

  private showControls(shown: boolean): void {
    this.panel.hidden = shown;
    this.controls.element.hidden = !shown;
    if (!shown) this.controls.stopListening();
  }

  /**
   * Remove it for good (the match is over).
   */
  dispose(): void {
    this.closed = true;
    this.controls.dispose();
    this.root.remove();
  }

  private handleSurrenderClick(): void {
    if (performance.now() < this.confirmUntil) {
      this.onSurrender();
      this.dispose();
      return;
    }
    this.confirmUntil = performance.now() + CONFIRM_MS;
    this.surrenderButton.textContent = "Click again to surrender";
    this.surrenderButton.classList.add("confirming");
    setTimeout(() => {
      if (performance.now() >= this.confirmUntil) this.resetSurrenderButton();
    }, CONFIRM_MS);
  }

  private resetSurrenderButton(): void {
    this.confirmUntil = 0;
    this.surrenderButton.textContent = "Surrender";
    this.surrenderButton.classList.remove("confirming");
  }
}
