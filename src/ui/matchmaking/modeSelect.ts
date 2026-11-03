/**
 * How to play, picked before the champion: three cards.
 *
 * - Practice: you against bots, with chips for the match (1v1, 3v3, 5v5 or
 *   ARAM, remembered in localStorage).
 * - With friends: the player's name (remembered), make a room or join one
 *   with its code. A failed join shows its error here.
 * - Online 1v1: the queue.
 *
 * This only reads the cards; MatchmakingUI does what each button asks.
 */

import { MAPS, type MapId } from "@siege/shared";

/** Practice matches, in the order of their chips */
export const PRACTICE_MODES = [
  { label: "1V1", size: 1, map: "vale", detail: "You in mid on The Vale" },
  { label: "3V3", size: 3, map: "vale", detail: "You in mid, bots in top and bot" },
  { label: "5V5", size: 5, map: "vale", detail: "You in mid, bots in every other role" },
  { label: "ARAM", size: 1, map: "narrows", detail: "1v1 on The Narrows: one lane, no jungle" },
] as const satisfies readonly { label: string; size: number; map: MapId; detail: string }[];
export type PracticeMode = (typeof PRACTICE_MODES)[number];

const PRACTICE_MODE_KEY = "siege-practice-mode";
const NAME_KEY = "siege-player-name";

/** Errors the server answers a join with, in the player's words */
const ERRORS: Record<string, string> = {
  lobby_not_found: "No room with that code.",
  lobby_full: "That room is full.",
};

/** What MatchmakingUI does on the cards' buttons */
export interface ModeSelectActions {
  practice(mode: PracticeMode): void;
  createRoom(name: string): void;
  joinRoom(code: string, name: string): void;
  online(): void;
  back(): void;
}

export class ModeSelect {
  private readonly chips = getEl("practice-chips");
  private readonly practiceDetail = getEl("practice-detail");
  private readonly nameInput = getEl("lobby-name") as HTMLInputElement;
  private readonly codeInput = getEl("lobby-code") as HTMLInputElement;
  private readonly error = getEl("lobby-error");
  private readonly roomButtons = [getEl("btn-lobby-create"), getEl("btn-lobby-join")] as HTMLButtonElement[];
  private practiceMode: PracticeMode = loadPracticeMode();

  constructor(private readonly actions: ModeSelectActions) {
    for (const mode of PRACTICE_MODES) {
      const chip = document.createElement("button");
      chip.className = "mode-chip";
      chip.textContent = mode.label;
      chip.dataset.mode = mode.label;
      chip.addEventListener("click", () => this.pickPracticeMode(mode));
      this.chips.append(chip);
    }
    this.showPracticeMode();

    this.nameInput.value = readName();
    getEl("btn-mode-practice").addEventListener("click", () => actions.practice(this.practiceMode));
    getEl("btn-lobby-create").addEventListener("click", () => actions.createRoom(this.name()));
    getEl("btn-lobby-join").addEventListener("click", () => this.join());
    this.codeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.join();
    });
    getEl("btn-mode-online").addEventListener("click", () => actions.online());
    getEl("btn-modes-back").addEventListener("click", () => actions.back());
  }

  /** A room is being made or joined: its buttons wait for the server */
  setConnecting(connecting: boolean): void {
    for (const button of this.roomButtons) button.disabled = connecting;
    if (connecting) this.error.textContent = "";
  }

  /** Why making or joining a room failed (a server error code or a message) */
  showError(error: string): void {
    this.setConnecting(false);
    this.error.textContent = ERRORS[error] ?? error;
  }

  private pickPracticeMode(mode: PracticeMode): void {
    this.practiceMode = mode;
    try {
      localStorage.setItem(PRACTICE_MODE_KEY, mode.label);
    } catch {
      // Storage unavailable: it lasts until the page reloads
    }
    this.showPracticeMode();
  }

  private showPracticeMode(): void {
    for (const chip of this.chips.children) {
      chip.classList.toggle("selected", (chip as HTMLElement).dataset.mode === this.practiceMode.label);
    }
    this.practiceDetail.textContent = this.practiceMode.detail;
  }

  private join(): void {
    const code = this.codeInput.value.trim();
    if (code.length === 0) {
      this.error.textContent = "Type your friend's room code.";
      return;
    }
    this.actions.joinRoom(code, this.name());
  }

  /** The name typed, remembered for next time */
  private name(): string {
    const name = this.nameInput.value.trim();
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // Storage unavailable: asked again next visit
    }
    return name;
  }
}

/** How a practice match reads in champion select's context line */
export function describePracticeMode(mode: PracticeMode): string {
  return `PRACTICE · ${mode.label} · ${MAPS[mode.map].NAME.toUpperCase()}`;
}

function loadPracticeMode(): PracticeMode {
  try {
    const saved = localStorage.getItem(PRACTICE_MODE_KEY);
    return PRACTICE_MODES.find(mode => mode.label === saved) ?? PRACTICE_MODES[0];
  } catch {
    return PRACTICE_MODES[0];
  }
}

function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function getEl(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}
