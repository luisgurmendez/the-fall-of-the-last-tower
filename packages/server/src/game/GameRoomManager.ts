/**
 * GameRoomManager - Manages all active game rooms.
 *
 * Responsibilities:
 * - Track active game rooms
 * - Create and destroy rooms
 * - Route players to their rooms
 * - Clean up ended games
 */

import { GameRoom, type PlayerInfo, type GameRoomState } from './GameRoom';
import type { BotController } from '../bots/BotController';
import type { ClientInput, StateUpdate, FullStateSnapshot, ChampionDefinition, Side, MapId, DebugStateData } from '@siege/shared';
import { Logger } from '../utils/Logger';

/**
 * Callback for sending state updates to players.
 */
export type StateUpdateCallback = (playerId: string, update: StateUpdate) => void;

/**
 * Callback for sending full state snapshots.
 */
export type FullStateCallback = (playerId: string, snapshot: FullStateSnapshot) => void;

/**
 * Callback for game end.
 */
export type GameEndCallback = (gameId: string, winningSide: Side) => void;

export type DebugStateCallback = (playerId: string, data: DebugStateData) => void;

/**
 * Configuration for GameRoomManager.
 */
export interface GameRoomManagerConfig {
  /** Champion definitions for spawning */
  championDefinitions: Map<string, ChampionDefinition>;
  /** Callback when state updates need to be sent */
  onStateUpdate?: StateUpdateCallback;
  /** Callback when full state needs to be sent */
  onFullState?: FullStateCallback;
  /** Callback when a game ends */
  onGameEnd?: GameEndCallback;
  /** Callback with a debug overlay's DEBUG_STATE (practice matches) */
  onDebugState?: DebugStateCallback;
  /** How long a room with no connected humans is kept for reconnects (ms, default 60s) */
  abandonTimeoutMs?: number;
}

/**
 * Manages all active game rooms on the server.
 */
export class GameRoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerToRoom: Map<string, string> = new Map();
  private championDefinitions: Map<string, ChampionDefinition>;

  private onStateUpdate?: StateUpdateCallback;
  private onFullState?: FullStateCallback;
  private onGameEnd?: GameEndCallback;
  private onDebugState?: DebugStateCallback;

  private gameIdCounter = 0;

  // Rooms whose humans all disconnected, waiting to be cleaned up
  private abandonTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly abandonTimeoutMs: number;

  constructor(config: GameRoomManagerConfig) {
    this.championDefinitions = config.championDefinitions;
    this.abandonTimeoutMs = config.abandonTimeoutMs ?? 60_000;
    this.onStateUpdate = config.onStateUpdate;
    this.onFullState = config.onFullState;
    this.onGameEnd = config.onGameEnd;
    this.onDebugState = config.onDebugState;
  }

  /**
   * Create a new game room.
   * @param bots Controllers for the players marked isBot
   */
  createRoom(
    players: PlayerInfo[],
    bots: BotController[] = [],
    mapId: MapId = 'wildcrown',
    options: { allowDebug?: boolean } = {},
  ): GameRoom {
    const gameId = `game-${Date.now()}-${this.gameIdCounter++}`;

    const room = new GameRoom({
      gameId,
      players,
      bots,
      mapId,
      allowDebug: options.allowDebug,
      championDefinitions: this.championDefinitions,
      onStateUpdate: (playerId, update) => {
        this.onStateUpdate?.(playerId, update);
      },
      onDebugState: (playerId, data) => {
        this.onDebugState?.(playerId, data);
      },
      onGameEnd: (winningSide) => {
        this.onGameEnd?.(gameId, winningSide);
        this.cleanupRoom(gameId);
      },
    });

    this.rooms.set(gameId, room);

    // Map players to this room
    for (const player of players) {
      this.playerToRoom.set(player.playerId, gameId);
    }

    Logger.game.debug(`Created room ${gameId} with ${players.length} players`);
    return room;
  }

  /**
   * Get a room by ID.
   */
  getRoom(gameId: string): GameRoom | undefined {
    return this.rooms.get(gameId);
  }

  /**
   * Get a room by player ID.
   */
  getRoomByPlayer(playerId: string): GameRoom | undefined {
    const gameId = this.playerToRoom.get(playerId);
    if (!gameId) return undefined;
    return this.rooms.get(gameId);
  }

  /**
   * Get game ID for a player.
   */
  getGameIdByPlayer(playerId: string): string | undefined {
    return this.playerToRoom.get(playerId);
  }

  /**
   * Handle player input.
   */
  handleInput(playerId: string, input: ClientInput): boolean {
    const room = this.getRoomByPlayer(playerId);
    if (!room) {
      return false;
    }

    room.handleInput(playerId, input);
    return true;
  }

  /**
   * Turn a player's debug overlay on or off; false if their match doesn't allow it.
   */
  setDebug(playerId: string, enabled: boolean): boolean {
    return this.getRoomByPlayer(playerId)?.setDebug(playerId, enabled) ?? false;
  }

  /**
   * The player's client got reliable events up to `lastEventId`.
   */
  handleEventAck(playerId: string, lastEventId: number): void {
    this.getRoomByPlayer(playerId)?.handleEventAck(playerId, lastEventId);
  }

  /**
   * Handle player disconnect.
   */
  handleDisconnect(playerId: string): void {
    const room = this.getRoomByPlayer(playerId);
    if (room) {
      room.handleDisconnect(playerId);

      // Nobody left to play: keep the room around for a reconnect, then close it
      if (!room.hasConnectedHumans() && !this.abandonTimers.has(room.gameId)) {
        const gameId = room.gameId;
        this.abandonTimers.set(gameId, setTimeout(() => {
          this.abandonTimers.delete(gameId);
          Logger.game.info(`Closing abandoned room ${gameId}`);
          this.cleanupRoom(gameId);
        }, this.abandonTimeoutMs));
      }
    }
  }

  /**
   * Handle player reconnect.
   */
  handleReconnect(playerId: string): FullStateSnapshot | null {
    const room = this.getRoomByPlayer(playerId);
    if (!room) {
      return null;
    }

    const snapshot = room.handleReconnect(playerId);
    const abandonTimer = this.abandonTimers.get(room.gameId);
    if (snapshot && abandonTimer) {
      clearTimeout(abandonTimer);
      this.abandonTimers.delete(room.gameId);
    }
    if (snapshot && this.onFullState) {
      this.onFullState(playerId, snapshot);
    }

    return snapshot;
  }

  /**
   * Clean up a room.
   */
  cleanupRoom(gameId: string): void {
    const room = this.rooms.get(gameId);
    if (!room) return;

    const abandonTimer = this.abandonTimers.get(gameId);
    if (abandonTimer) {
      clearTimeout(abandonTimer);
      this.abandonTimers.delete(gameId);
    }

    // Stop the game
    room.stop();

    // Remove player mappings
    for (const playerId of room.getPlayerIds()) {
      this.playerToRoom.delete(playerId);
    }

    // Remove the room
    this.rooms.delete(gameId);

    Logger.game.debug(`Cleaned up room ${gameId}`);
  }

  /**
   * Check if a player is in a game.
   */
  isPlayerInGame(playerId: string): boolean {
    return this.playerToRoom.has(playerId);
  }

  /**
   * Get all active room IDs.
   */
  getActiveRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Get total number of active rooms.
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Get total number of players in games.
   */
  getTotalPlayers(): number {
    return this.playerToRoom.size;
  }

  /**
   * Get room statistics.
   */
  getStats(): { rooms: number; players: number; roomStates: Record<GameRoomState, number> } {
    const roomStates: Record<GameRoomState, number> = {
      waiting: 0,
      starting: 0,
      playing: 0,
      ended: 0,
    };

    for (const room of this.rooms.values()) {
      roomStates[room.getState()]++;
    }

    return {
      rooms: this.rooms.size,
      players: this.playerToRoom.size,
      roomStates,
    };
  }

  /**
   * Stop all rooms and clean up.
   */
  shutdown(): void {
    Logger.game.info(`Shutting down ${this.rooms.size} active rooms`);

    for (const gameId of this.rooms.keys()) {
      this.cleanupRoom(gameId);
    }
  }

  /**
   * Get metrics from all active game rooms.
   */
  getAllMetrics(): { gameId: string; state: string; metrics: ReturnType<GameRoom['getMetrics']> }[] {
    const result = [];
    for (const [gameId, room] of this.rooms) {
      if (room.getState() === 'playing') {
        result.push({
          gameId,
          state: room.getState(),
          metrics: room.getMetrics(),
        });
      }
    }
    return result;
  }
}
