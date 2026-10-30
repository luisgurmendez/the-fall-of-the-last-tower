/**
 * GameRoom - Manages a single game match.
 *
 * Coordinates:
 * - Game loop (ServerGame)
 * - Game state (ServerGameContext)
 * - Input processing (InputHandler)
 * - State broadcasting
 */

import {
  EntityType,
  Side,
  StateUpdate,
  FullStateSnapshot,
  GameEvent,
  ChampionDefinition,
} from '@siege/shared';
import { ServerGame } from './ServerGame';
import { ServerGameContext } from './ServerGameContext';
import { spawnStructures, spawnChampion } from './MatchSetup';
import { InputHandler } from '../network/InputHandler';
import { BotDriver } from '../bots/BotDriver';
import type { BotController } from '../bots/BotController';
import { StateSerializer } from '../network/StateSerializer';
import { ReliableEventQueue, shouldSendReliably } from '../network/ReliableEventQueue';
import type { ClientInput } from '@siege/shared';
import { Logger } from '../utils/Logger';

export interface PlayerInfo {
  playerId: string;
  side: Side;
  championId: string;
  connected: boolean;
  /** Played by a server-side bot instead of a connection */
  isBot?: boolean;
}

export interface GameRoomConfig {
  gameId: string;
  players: PlayerInfo[];
  championDefinitions: Map<string, ChampionDefinition>;
  /** Controllers for players with isBot set */
  bots?: BotController[];
  onStateUpdate?: (playerId: string, update: StateUpdate) => void;
  onGameEnd?: (winningSide: Side) => void;
}

export type GameRoomState = 'waiting' | 'starting' | 'playing' | 'ended';

export class GameRoom {
  readonly gameId: string;
  private state: GameRoomState = 'waiting';

  private game: ServerGame;
  private context: ServerGameContext;
  private inputHandler: InputHandler;
  private stateSerializer: StateSerializer;
  private reliableEventQueue: ReliableEventQueue;
  private botDriver = new BotDriver();

  private players: Map<string, PlayerInfo> = new Map();
  private championDefinitions: Map<string, ChampionDefinition>;

  private onStateUpdate?: (playerId: string, update: StateUpdate) => void;
  private onGameEnd?: (winningSide: Side) => void;

  // Game timing
  private gameStartTime = 0;

  constructor(config: GameRoomConfig) {
    this.gameId = config.gameId;
    this.championDefinitions = config.championDefinitions;
    this.onStateUpdate = config.onStateUpdate;
    this.onGameEnd = config.onGameEnd;

    // Initialize players
    for (const player of config.players) {
      this.players.set(player.playerId, player);
    }
    for (const bot of config.bots ?? []) {
      this.botDriver.add(bot);
    }

    // Create game context
    this.context = new ServerGameContext({
      gameId: config.gameId,
    });

    // Create input handler
    this.inputHandler = new InputHandler();

    // Create state serializer for delta compression
    this.stateSerializer = new StateSerializer();

    // Create reliable event queue for important events
    this.reliableEventQueue = new ReliableEventQueue();

    // Create game loop
    this.game = new ServerGame({
      onTick: this.onTick.bind(this),
      onStateUpdate: this.broadcastState.bind(this),
    });
  }

  /**
   * Start the game.
   */
  start(): void {
    if (this.state !== 'waiting') {
      Logger.game.warn(`Cannot start game ${this.gameId}, state is ${this.state}`);
      return;
    }

    this.state = 'starting';
    Logger.game.info(`Starting game ${this.gameId} with ${this.players.size} players`);

    // Spawn structures first (nexuses and towers)
    spawnStructures(this.context);

    // Spawn jungle camps
    this.context.spawnJungleCamps();

    // Spawn champions
    this.spawnChampions();

    // Start the game loop
    this.state = 'playing';
    this.gameStartTime = Date.now();
    this.game.start();
  }

  /**
   * Stop the game.
   */
  stop(): void {
    this.game.stop();
    this.state = 'ended';
  }

  /**
   * Spawn all champions.
   */
  private spawnChampions(): void {
    for (const [playerId, playerInfo] of this.players) {
      const definition = this.championDefinitions.get(playerInfo.championId);
      if (!definition) {
        Logger.game.error(`Unknown champion: ${playerInfo.championId} for player ${playerId}`);
        continue;
      }
      spawnChampion(this.context, { playerId, side: playerInfo.side, definition });
    }
  }

  /**
   * Handle a player input.
   */
  handleInput(playerId: string, input: ClientInput): void {
    if (this.state !== 'playing') return;

    const result = this.inputHandler.queueInput(playerId, input);
    if (!result.valid) {
      Logger.input.debug(`Invalid input from ${playerId}: ${result.reason}`);
    }
  }

  /**
   * Called each game tick.
   */
  private onTick(tick: number, dt: number): void {
    // 1. Process inputs (bots queue theirs first, like a client would)
    this.botDriver.update(this.context, this.inputHandler, dt, Date.now());
    this.inputHandler.processInputs(this.context);

    // 2. Update game state
    this.context.update(dt);

    // 3. Check win conditions
    this.checkWinConditions();
  }

  /**
   * Broadcast state to all players.
   * Uses delta compression and priority-based filtering to minimize bandwidth.
   * Important events are sent via reliable delivery with retries.
   */
  private broadcastState(tick: number): void {
    if (!this.onStateUpdate) return;

    const allEvents = this.context.flushEvents();
    const inputAcks = this.inputHandler.getAllAckedSeqs();
    const playerIds = this.getHumanPlayerIds();

    // Separate reliable and unreliable events
    const reliableEvents: GameEvent[] = [];
    const unreliableEvents: GameEvent[] = [];

    for (const event of allEvents) {
      if (shouldSendReliably(event)) {
        reliableEvents.push(event);
        // Queue reliable events for all players
        this.reliableEventQueue.queueEventForAll(playerIds, event, tick);
      } else {
        unreliableEvents.push(event);
      }
    }

    for (const [playerId, playerInfo] of this.players) {
      if (playerInfo.isBot) continue;

      // Get visible entities for this player (based on fog of war)
      // Send ALL visible entities every tick - simpler and no disappearing entity bugs
      const visibleEntities = this.context.getVisibleEntities(playerInfo.side);

      // Get reliable events to send (new + retries)
      const reliableEventsToSend = this.reliableEventQueue.getEventsToSend(playerId, tick);

      // Combine reliable events with unreliable ones
      const eventsForPlayer = [...reliableEventsToSend, ...unreliableEvents];

      // Use StateSerializer for delta compression
      const update = this.stateSerializer.createStateUpdate(
        visibleEntities,
        playerId,
        tick,
        this.context.getGameTime(),
        inputAcks,
        eventsForPlayer,
        visibleEntities,
        entityId => this.context.getEntity(entityId) !== undefined
      );

      // Include the last event ID for acknowledgment
      if (reliableEventsToSend.length > 0) {
        const lastReliableEvent = reliableEventsToSend[reliableEventsToSend.length - 1];
        update.lastEventId = lastReliableEvent.eventId;
      }

      this.onStateUpdate(playerId, update);
    }
  }

  /**
   * Check win conditions.
   */
  private checkWinConditions(): void {
    if (this.state !== 'playing') return;

    for (const entity of this.context.getAllEntities()) {
      if (entity.entityType === EntityType.NEXUS && entity.isDead) {
        const winningSide = (1 - entity.side) as Side;
        this.state = 'ended';
        Logger.game.info(`Game ${this.gameId}: ${entity.side === 0 ? 'Blue' : 'Red'} nexus destroyed`);
        // Let the final state (nexus death) reach clients before the room is torn down
        this.broadcastState(this.game.getCurrentTick());
        this.onGameEnd?.(winningSide);
        return;
      }
    }
  }

  /**
   * Handle event acknowledgment from client.
   * Removes acknowledged events from reliable delivery queue.
   */
  handleEventAck(playerId: string, lastEventId: number): void {
    this.reliableEventQueue.acknowledgeEvents(playerId, lastEventId);
  }

  /**
   * Handle player disconnect.
   */
  handleDisconnect(playerId: string): void {
    const playerInfo = this.players.get(playerId);
    if (playerInfo) {
      playerInfo.connected = false;
    }

    this.inputHandler.clearPlayer(playerId);
    // Clear serializer and reliable event queue state
    this.stateSerializer.clearPlayerState(playerId);
    this.reliableEventQueue.clearPlayer(playerId);
    Logger.game.info(`Player ${playerId} disconnected from game ${this.gameId}`);
  }

  /**
   * Handle player reconnect.
   */
  handleReconnect(playerId: string): FullStateSnapshot | null {
    const playerInfo = this.players.get(playerId);
    if (!playerInfo) {
      return null;
    }

    playerInfo.connected = true;
    Logger.game.info(`Player ${playerId} reconnected to game ${this.gameId}`);

    // Send full state snapshot
    return {
      tick: this.game.getCurrentTick(),
      timestamp: Date.now(),
      gameTime: this.context.getGameTime(),
      entities: this.context.createSnapshot(playerId),
      events: [], // Don't send old events on reconnect
    };
  }

  /**
   * Get current game state.
   */
  getState(): GameRoomState {
    return this.state;
  }

  /**
   * Get game time in seconds.
   */
  getGameTime(): number {
    return this.context.getGameTime();
  }

  /**
   * Get a player's side.
   */
  getPlayerSide(playerId: string): Side | undefined {
    return this.players.get(playerId)?.side;
  }

  /**
   * Get all player IDs.
   */
  getPlayerIds(): string[] {
    return Array.from(this.players.keys());
  }

  /**
   * Get IDs of players with a connection (not bots).
   */
  getHumanPlayerIds(): string[] {
    return Array.from(this.players.values())
      .filter(player => !player.isBot)
      .map(player => player.playerId);
  }

  /**
   * Check if all human players are connected.
   */
  allPlayersConnected(): boolean {
    for (const player of this.players.values()) {
      if (!player.connected && !player.isBot) return false;
    }
    return true;
  }

  /**
   * Check if any human player is still connected.
   */
  hasConnectedHumans(): boolean {
    for (const player of this.players.values()) {
      if (player.connected && !player.isBot) return true;
    }
    return false;
  }

  /**
   * Get player info with entity IDs.
   * Used for game start message.
   */
  getPlayersWithEntityIds(): Array<{
    playerId: string;
    championId: string;
    side: number;
    entityId: string;
  }> {
    const result = [];
    for (const [playerId, playerInfo] of this.players) {
      const champion = this.context.getChampionByPlayerId(playerId);
      result.push({
        playerId,
        championId: playerInfo.championId,
        side: playerInfo.side,
        entityId: champion?.id || '',
      });
    }
    return result;
  }

  /**
   * Get initial full state snapshot for a player.
   * Used to send entity state immediately on game start.
   */
  getInitialState(playerId: string): FullStateSnapshot {
    return {
      tick: this.game.getCurrentTick(),
      timestamp: Date.now(),
      gameTime: this.context.getGameTime(),
      entities: this.context.createSnapshot(playerId),
      events: [],
    };
  }

  /**
   * Get game loop metrics for monitoring.
   */
  getMetrics() {
    return this.game.getMetrics();
  }
}
