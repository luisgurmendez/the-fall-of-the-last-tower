/**
 * The room screen: play with friends.
 *
 * First the entry view: the player's name (kept in localStorage), make a
 * room or join one with its code. Then the room: its code to send (with a
 * copy button), the host's map and players per side, both sides' players
 * with their champions (empty slots are bots), and the buttons to leave,
 * change champion, switch side and, for the host, start. The server keeps
 * the room (LobbyManager); this only shows its LOBBY_STATE and reports
 * clicks to MatchmakingUI.
 */

import { MAPS, getChampionDefinition, type LobbyMember, type LobbyState } from "@siege/shared";
import { showPortrait } from "./portraits";

const NAME_KEY = "siege-player-name";

/** What MatchmakingUI does on the screen's buttons */
export interface LobbyScreenActions {
  create(name: string): void;
  join(code: string, name: string): void;
  back(): void;
  leave(): void;
  changeChampion(): void;
  switchSide(): void;
  settings(changes: { mapId?: string; teamSize?: number }): void;
  start(): void;
}

/** Errors the server answers a join with, in the player's words */
const ERRORS: Record<string, string> = {
  lobby_not_found: "No room with that code.",
  lobby_full: "That room is full.",
};

export class LobbyScreen {
  private readonly entry = getEl("lobby-entry");
  private readonly room = getEl("lobby-room");
  private readonly nameInput = getEl("lobby-name") as HTMLInputElement;
  private readonly codeInput = getEl("lobby-code") as HTMLInputElement;
  private readonly error = getEl("lobby-error");
  private readonly codeValue = getEl("lobby-code-value");
  private readonly mapSelect = getEl("lobby-map") as HTMLSelectElement;
  private readonly sizeSelect = getEl("lobby-size") as HTMLSelectElement;
  private readonly hint = getEl("lobby-hint");
  private readonly startButton = getEl("btn-lobby-start") as HTMLButtonElement;
  private state: LobbyState | null = null;

  constructor(private readonly actions: LobbyScreenActions, private readonly localPlayerId: () => string) {
    this.nameInput.value = readName();
    for (const [id, map] of Object.entries(MAPS)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = map.NAME;
      this.mapSelect.append(option);
    }

    getEl("btn-lobby-create").addEventListener("click", () => actions.create(this.name()));
    getEl("btn-lobby-join").addEventListener("click", () => this.join());
    this.codeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.join();
    });
    getEl("btn-lobby-back").addEventListener("click", () => actions.back());
    getEl("btn-lobby-leave").addEventListener("click", () => actions.leave());
    getEl("btn-lobby-champion").addEventListener("click", () => actions.changeChampion());
    getEl("btn-lobby-switch").addEventListener("click", () => actions.switchSide());
    this.startButton.addEventListener("click", () => actions.start());
    getEl("btn-lobby-copy").addEventListener("click", () => {
      if (this.state?.code) void navigator.clipboard?.writeText(this.state.code);
    });
    this.mapSelect.addEventListener("change", () => actions.settings({ mapId: this.mapSelect.value }));
    this.sizeSelect.addEventListener("change", () => actions.settings({ teamSize: Number(this.sizeSelect.value) }));
  }

  /** Whether the player is in a room */
  inRoom(): boolean {
    return !!this.state?.code;
  }

  /** The entry view (make or join a room), with an error from the server if any */
  showEntry(error?: string): void {
    this.state = null;
    this.entry.hidden = false;
    this.room.hidden = true;
    this.error.textContent = error ? ERRORS[error] ?? error : "";
  }

  /** The room's state from the server */
  showState(state: LobbyState): void {
    if (state.code === null) {
      this.showEntry(state.reason);
      return;
    }
    this.state = state;
    this.entry.hidden = true;
    this.room.hidden = false;
    this.codeValue.textContent = state.code;

    const host = state.hostId === this.localPlayerId();
    this.mapSelect.value = state.mapId;
    this.sizeSelect.value = String(state.teamSize);
    this.mapSelect.disabled = !host;
    this.sizeSelect.disabled = !host;
    this.startButton.hidden = !host;
    this.hint.textContent = host
      ? "Send your friends the code. Empty slots are played by bots."
      : "Waiting for the host to start.";

    for (const side of [0, 1] as const) {
      const slots = getEl(side === 0 ? "lobby-blue" : "lobby-red");
      slots.replaceChildren();
      const members = state.members.filter((member) => member.side === side);
      for (const member of members) slots.append(this.memberSlot(member, state.hostId));
      for (let i = members.length; i < state.teamSize; i++) slots.append(botSlot());
    }
  }

  private memberSlot(member: LobbyMember, hostId: string): HTMLElement {
    const slot = document.createElement("div");
    slot.className = "lobby-slot player";
    if (member.playerId === this.localPlayerId()) slot.classList.add("you");
    const portrait = document.createElement("div");
    portrait.className = "lobby-slot-portrait";
    showPortrait(portrait, member.championId);
    const text = document.createElement("div");
    const name = document.createElement("div");
    name.className = "lobby-slot-name";
    name.textContent = member.name;
    const champion = document.createElement("div");
    champion.className = "lobby-slot-champion";
    champion.textContent = getChampionDefinition(member.championId)?.name ?? member.championId;
    text.append(name, champion);
    slot.append(portrait, text);
    if (member.playerId === hostId) {
      const badge = document.createElement("div");
      badge.className = "lobby-badge";
      badge.textContent = "HOST";
      slot.append(badge);
    }
    return slot;
  }

  private join(): void {
    const code = this.codeInput.value.trim();
    if (code.length === 0) {
      this.error.textContent = "Type your friend's room code.";
      return;
    }
    this.actions.join(code, this.name());
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

/** An empty slot: a bot plays it */
function botSlot(): HTMLElement {
  const slot = document.createElement("div");
  slot.className = "lobby-slot bot";
  const portrait = document.createElement("div");
  portrait.className = "lobby-slot-portrait";
  portrait.textContent = "🤖";
  const name = document.createElement("div");
  name.className = "lobby-slot-name";
  name.textContent = "Bot";
  slot.append(portrait, name);
  return slot;
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
