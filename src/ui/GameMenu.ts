/**
 * GameMenu - The in-match menu Escape opens: resume, the sound's volumes
 * (master, effects, ambience; kept by AudioManager), or surrender.
 *
 * The game keeps running on the server while it's open. Surrendering asks
 * for a second click instead of a browser dialog; the match then ends like
 * any other (GAME_END, the final scoreboard, back to the menu).
 */

import { getAudio, type VolumeChannel } from "@/audio/AudioManager";

const CONFIRM_MS = 3000;

/** The volume sliders, in order */
const VOLUMES: { channel: VolumeChannel; label: string }[] = [
  { channel: "master", label: "Volume" },
  { channel: "sfx", label: "Effects" },
  { channel: "ambience", label: "Ambience" },
];

export class GameMenu {
  private readonly root: HTMLDivElement;
  private readonly surrenderButton: HTMLButtonElement;
  private confirmUntil = 0;
  private closed = false;

  constructor(private readonly onSurrender: () => void) {
    this.root = document.createElement("div");
    this.root.className = "game-menu";
    this.root.hidden = true;

    const panel = document.createElement("div");
    panel.className = "game-menu-panel";

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

    panel.append(title, resumeButton, this.createSoundControls(), this.surrenderButton, hint);
    this.root.append(panel);
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
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /**
   * Remove it for good (the match is over).
   */
  dispose(): void {
    this.closed = true;
    this.root.remove();
  }

  /** A slider per volume and a mute toggle */
  private createSoundControls(): HTMLElement {
    const audio = getAudio();
    const section = document.createElement("div");
    section.className = "game-menu-sound";
    for (const { channel, label } of VOLUMES) {
      const row = document.createElement("label");
      row.className = "game-menu-volume";
      const name = document.createElement("span");
      name.textContent = label;
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.value = String(Math.round(audio.getVolume(channel) * 100));
      slider.addEventListener("input", () => audio.setVolume(channel, Number(slider.value) / 100));
      row.append(name, slider);
      section.append(row);
    }
    const mute = document.createElement("button");
    mute.className = "pixel-button game-menu-mute";
    const label = () => (mute.textContent = audio.isMuted() ? "Sound: off" : "Sound: on");
    label();
    mute.addEventListener("click", () => {
      audio.setMuted(!audio.isMuted());
      label();
    });
    section.append(mute);
    return section;
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
