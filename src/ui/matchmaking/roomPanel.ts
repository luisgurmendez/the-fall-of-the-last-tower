/**
 * A room on champion select: playing with friends.
 *
 * Champion select shows the room around the champions while the player is
 * in one: the room's code to send (with a copy button) and the host's map
 * and players per side above the grid, and both sides' players with their
 * champions on either side of the detail panel (empty slots are bots). The
 * server keeps the room (LobbyManager); this only shows its LOBBY_STATE and
 * reports the host's settings to MatchmakingUI. Champions a teammate plays
 * can't be picked (takenByTeammates).
 */

import { MAPS, getChampionDefinition, type LobbyMember, type LobbyState } from "@siege/shared";
import { showPortrait } from "./portraits";

/** A room the player is in */
export type Room = Extract<LobbyState, { code: string }>;

export class RoomPanel {
  private readonly bar = getEl("room-bar");
  private readonly code = getEl("room-code");
  private readonly mapSelect = getEl("room-map") as HTMLSelectElement;
  private readonly sizeSelect = getEl("room-size") as HTMLSelectElement;
  private readonly teams = [getEl("room-team-blue"), getEl("room-team-red")];
  private readonly slots = [getEl("room-blue"), getEl("room-red")];
  private readonly hint = getEl("room-hint");
  private room: Room | null = null;

  constructor(
    settings: (changes: { mapId?: string; teamSize?: number }) => void,
    private readonly localPlayerId: () => string,
  ) {
    for (const [id, map] of Object.entries(MAPS)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = map.NAME;
      this.mapSelect.append(option);
    }
    this.mapSelect.addEventListener("change", () => settings({ mapId: this.mapSelect.value }));
    this.sizeSelect.addEventListener("change", () => settings({ teamSize: Number(this.sizeSelect.value) }));
    getEl("btn-room-copy").addEventListener("click", () => {
      if (this.room) void navigator.clipboard?.writeText(this.room.code);
    });
  }

  /** The room the player is in, if any */
  getRoom(): Room | null {
    return this.room;
  }

  /** The player in the room */
  me(): LobbyMember | undefined {
    return this.room?.members.find((member) => member.playerId === this.localPlayerId());
  }

  isHost(): boolean {
    return !!this.room && this.room.hostId === this.localPlayerId();
  }

  /** Champions the player's teammates play, with who plays each */
  takenByTeammates(): Map<string, string> {
    const me = this.me();
    const taken = new Map<string, string>();
    for (const member of this.room?.members ?? []) {
      if (member !== me && member.side === me?.side) taken.set(member.championId, member.name);
    }
    return taken;
  }

  /** Show the room's state; null hides the room (not in one) */
  show(room: Room | null): void {
    this.room = room;
    this.bar.hidden = !room;
    this.hint.hidden = !room;
    for (const team of this.teams) team.hidden = !room;
    if (!room) return;

    this.code.textContent = room.code;
    const host = this.isHost();
    this.mapSelect.value = room.mapId;
    this.sizeSelect.value = String(room.teamSize);
    this.mapSelect.disabled = !host;
    this.sizeSelect.disabled = !host;
    this.hint.textContent = host
      ? "Send your friends the code. Empty slots are played by bots."
      : "Pick your champion. The host starts the match.";

    for (const side of [0, 1] as const) {
      const members = room.members.filter((member) => member.side === side);
      this.slots[side].replaceChildren(
        ...members.map((member) => this.memberSlot(member, room.hostId)),
        ...Array.from({ length: Math.max(0, room.teamSize - members.length) }, botSlot),
      );
    }
  }

  private memberSlot(member: LobbyMember, hostId: string): HTMLElement {
    const slot = document.createElement("div");
    slot.className = "room-slot player";
    if (member.playerId === this.localPlayerId()) slot.classList.add("you");
    const portrait = document.createElement("div");
    portrait.className = "room-slot-portrait";
    showPortrait(portrait, member.championId);
    const text = document.createElement("div");
    text.className = "room-slot-text";
    const name = document.createElement("div");
    name.className = "room-slot-name";
    name.textContent = member.name;
    const champion = document.createElement("div");
    champion.className = "room-slot-champion";
    champion.textContent = getChampionDefinition(member.championId)?.name ?? member.championId;
    text.append(name, champion);
    slot.append(portrait, text);
    if (member.playerId === hostId) {
      const badge = document.createElement("div");
      badge.className = "room-badge";
      badge.textContent = "HOST";
      slot.append(badge);
    }
    return slot;
  }
}

/** An empty slot: a bot plays it */
function botSlot(): HTMLElement {
  const slot = document.createElement("div");
  slot.className = "room-slot bot";
  const portrait = document.createElement("div");
  portrait.className = "room-slot-portrait";
  portrait.textContent = "?";
  const name = document.createElement("div");
  name.className = "room-slot-name";
  name.textContent = "Bot";
  slot.append(portrait, name);
  return slot;
}

function getEl(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}
