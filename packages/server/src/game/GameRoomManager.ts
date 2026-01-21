/**
 * GameRoomManager - Manages all active game rooms.
 *
 * Responsibilities:
 * - Track active game rooms
 * - Create and destroy rooms
 * - Route players to their rooms
 * - Clean up ended games
 */

import { GameRoom, type GameRoomConfig, type PlayerInfo, type GameRoomState } from './GameRoom';
import type { ClientInput, StateUpdate, FullStateSnapshot, ChampionDefinition, Side } from '@siege/shared';

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

  private gameIdCounter = 0;

  constructor(config: GameRoomManagerConfig) {
    this.championDefinitions = config.championDefinitions;
    this.onStateUpdate = config.onStateUpdate;
    this.onFullState = config.onFullState;
    this.onGameEnd = config.onGameEnd;
  }

  /**
   * Create a new game room.
   */
  createRoom(players: PlayerInfo[]): GameRoom {
    const gameId = `game-${Date.now()}-${this.gameIdCounter++}`;

    const room = new GameRoom({
      gameId,
      players,
      championDefinitions: this.championDefinitions,
      onStateUpdate: (playerId, update) => {
        this.onStateUpdate?.(playerId, update);
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

    console.log(`[GameRoomManager] Created room ${gameId} with ${players.length} players`);
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
      console.warn(`[GameRoomManager] No room found for player ${playerId}`);
      return false;
    }

    room.handleInput(playerId, input);
    return true;
  }

  /**
   * Handle player disconnect.
   */
  handleDisconnect(playerId: string): void {
    const room = this.getRoomByPlayer(playerId);
    if (room) {
      room.handleDisconnect(playerId);
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

    // Stop the game
    room.stop();

    // Remove player mappings
    for (const playerId of room.getPlayerIds()) {
      this.playerToRoom.delete(playerId);
    }

    // Remove the room
    this.rooms.delete(gameId);

    console.log(`[GameRoomManager] Cleaned up room ${gameId}`);
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
    console.log(`[GameRoomManager] Shutting down ${this.rooms.size} rooms`);

    for (const gameId of this.rooms.keys()) {
      this.cleanupRoom(gameId);
    }
  }
}
