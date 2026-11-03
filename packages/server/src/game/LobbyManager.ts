/**
 * LobbyManager - Rooms where friends gather before a match.
 *
 * A player creates a room and gets its code; friends join with it. Each
 * player picks a side (blue or red) and their champion; the host picks the
 * map and the players per side (1, 3 or 5) and starts the match, with bots
 * in the empty slots (buildLobbyMatch). Rooms live only in the server's
 * memory: a room whose players all leave is gone, and one that starts
 * becomes a match.
 *
 * This class only keeps the rooms; server.ts turns client messages into
 * calls and sends each member the room's state (LOBBY_STATE) when it changes.
 */

import { LOBBY_MAX_TEAM_SIZE, isMapId, type LobbyMember, type LobbyState, type MapId, type SummonerSpellId } from '@siege/shared';

/** A player in a room, with what the match needs from them */
export interface LobbyPlayer extends LobbyMember {
  summonerSpells: SummonerSpellId[];
}

export interface Lobby {
  code: string;
  hostId: string;
  mapId: MapId;
  teamSize: 1 | 3 | 5;
  /** In the order they joined (the host first) */
  members: LobbyPlayer[];
}

/** Why joining failed */
export type JoinError = 'lobby_not_found' | 'lobby_full';

/** Letters for codes: no 0/O or 1/I/L, which read alike */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const TEAM_SIZES = [1, 3, 5] as const;

export class LobbyManager {
  private readonly lobbies = new Map<string, Lobby>();
  /** Which room each player is in */
  private readonly playerLobby = new Map<string, string>();

  constructor(private readonly random: () => number = Math.random) {}

  /** Make a room with the player as its host (leaving any room they're in) */
  create(player: Omit<LobbyPlayer, 'side'>): Lobby {
    this.leave(player.playerId);
    const lobby: Lobby = {
      code: this.newCode(),
      hostId: player.playerId,
      mapId: 'vale',
      teamSize: 3,
      members: [{ ...player, side: 0 }],
    };
    this.lobbies.set(lobby.code, lobby);
    this.playerLobby.set(player.playerId, lobby.code);
    return lobby;
  }

  /** Put the player in a room, on the side with fewer players */
  join(code: string, player: Omit<LobbyPlayer, 'side'>): Lobby | JoinError {
    const lobby = this.lobbies.get(normalizeCode(code));
    if (!lobby) return 'lobby_not_found';
    if (lobby.members.some(member => member.playerId === player.playerId)) return lobby;
    if (lobby.members.length >= LOBBY_MAX_TEAM_SIZE * 2) return 'lobby_full';
    this.leave(player.playerId);
    const blue = lobby.members.filter(member => member.side === 0).length;
    const red = lobby.members.length - blue;
    const side = red < blue ? 1 : blue < LOBBY_MAX_TEAM_SIZE ? 0 : 1;
    lobby.members.push({ ...player, side });
    this.growTeams(lobby);
    this.playerLobby.set(player.playerId, lobby.code);
    return lobby;
  }

  /**
   * Take the player out of their room. The next player hosts if the host
   * left; an empty room is gone.
   * @returns The room they left, if they were in one (empty if it's gone)
   */
  leave(playerId: string): Lobby | null {
    const lobby = this.lobbyOf(playerId);
    if (!lobby) return null;
    this.playerLobby.delete(playerId);
    lobby.members = lobby.members.filter(member => member.playerId !== playerId);
    if (lobby.members.length === 0) {
      this.lobbies.delete(lobby.code);
    } else if (lobby.hostId === playerId) {
      lobby.hostId = lobby.members[0].playerId;
    }
    return lobby;
  }

  /**
   * The player's champion or summoner spells changed. A champion a teammate
   * plays isn't taken (the room comes back as it was, so the player's
   * screen goes back to their champion).
   */
  update(playerId: string, championId: string, summonerSpells?: SummonerSpellId[]): Lobby | null {
    const lobby = this.lobbyOf(playerId);
    const member = lobby?.members.find(m => m.playerId === playerId);
    if (!lobby || !member) return null;
    const taken = lobby.members.some(m => m !== member && m.side === member.side && m.championId === championId);
    if (!taken) member.championId = championId;
    if (summonerSpells) member.summonerSpells = summonerSpells;
    return lobby;
  }

  /** Move the player to the other side, if it has room */
  switchSide(playerId: string): Lobby | null {
    const lobby = this.lobbyOf(playerId);
    const member = lobby?.members.find(m => m.playerId === playerId);
    if (!lobby || !member) return null;
    const other = member.side === 0 ? 1 : 0;
    if (lobby.members.filter(m => m.side === other).length >= LOBBY_MAX_TEAM_SIZE) return lobby;
    member.side = other;
    this.growTeams(lobby);
    return lobby;
  }

  /**
   * The host changes the map or the players per side (never fewer than the
   * side with the most players).
   */
  settings(playerId: string, changes: { mapId?: unknown; teamSize?: unknown }): Lobby | null {
    const lobby = this.lobbyOf(playerId);
    if (!lobby || lobby.hostId !== playerId) return lobby;
    if (isMapId(changes.mapId)) lobby.mapId = changes.mapId;
    if (TEAM_SIZES.includes(changes.teamSize as 1 | 3 | 5)) {
      const size = changes.teamSize as 1 | 3 | 5;
      if (size >= this.biggestSide(lobby)) lobby.teamSize = size;
    }
    return lobby;
  }

  /**
   * The host starts: the room is gone (its players are in the match now).
   * @returns The room, or null if the player isn't a room's host
   */
  start(playerId: string): Lobby | null {
    const lobby = this.lobbyOf(playerId);
    if (!lobby || lobby.hostId !== playerId) return null;
    this.lobbies.delete(lobby.code);
    for (const member of lobby.members) this.playerLobby.delete(member.playerId);
    return lobby;
  }

  lobbyOf(playerId: string): Lobby | null {
    const code = this.playerLobby.get(playerId);
    return code ? this.lobbies.get(code) ?? null : null;
  }

  /** How many rooms there are (for metrics) */
  get size(): number {
    return this.lobbies.size;
  }

  /** What a member's client is told about the room */
  static stateOf(lobby: Lobby): LobbyState {
    return {
      code: lobby.code,
      hostId: lobby.hostId,
      mapId: lobby.mapId,
      teamSize: lobby.teamSize,
      members: lobby.members.map(({ playerId, name, championId, side }) => ({ playerId, name, championId, side })),
    };
  }

  /** More players on a side than the size: the size grows to fit them */
  private growTeams(lobby: Lobby): void {
    const needed = this.biggestSide(lobby);
    if (needed > lobby.teamSize) lobby.teamSize = TEAM_SIZES.find(size => size >= needed) ?? 5;
  }

  private biggestSide(lobby: Lobby): number {
    const blue = lobby.members.filter(member => member.side === 0).length;
    return Math.max(blue, lobby.members.length - blue);
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)];
      if (!this.lobbies.has(code)) return code;
    }
  }
}

/** A code as typed: upper case, without spaces */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** A player's name: printable, trimmed, up to 16 characters ("Player" if none) */
export function sanitizeName(name: unknown): string {
  const clean = typeof name === 'string' ? name.replace(/[^\p{L}\p{N} _\-.]/gu, '').trim().slice(0, 16) : '';
  return clean.length > 0 ? clean : 'Player';
}
