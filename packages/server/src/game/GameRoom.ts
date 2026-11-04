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
  GameEventType,
  InputType,
  Side,
  StateUpdate,
  FullStateSnapshot,
  GameEvent,
  ChampionDefinition,
  DEFAULT_SUMMONER_SPELLS,
  type SummonerSpellId,
  MAPS,
  type MapId,
} from '@siege/shared';
import { ServerGame } from './ServerGame';
import { ServerGameContext } from './ServerGameContext';
import { spawnStructures, spawnChampion } from './MatchSetup';
import { InputHandler } from '../network/InputHandler';
import { BotDriver } from '../bots/BotDriver';
import { LaneBot } from '../bots/LaneBot';
import { TAKEOVER_DELAY, takeoverLane } from '../bots/takeover';
import type { BotController } from '../bots/BotController';
import { StateSerializer } from '../network/StateSerializer';
import { ReliableEventQueue, shouldSendReliably } from '../network/ReliableEventQueue';
import { reachesSide } from '../network/eventAudience';
import type { ClientInput, DebugStateData, FinalPlayerStats } from '@siege/shared';
import { buildDebugState } from './DebugReport';
import type { MatchMode } from '../accounts/AccountStore';
import { Logger } from '../utils/Logger';

export interface PlayerInfo {
  playerId: string;
  side: Side;
  championId: string;
  connected: boolean;
  /** Played by a server-side bot instead of a connection */
  isBot?: boolean;
  /** Summoner spells (D, F); the defaults when absent */
  summonerSpells?: SummonerSpellId[];
  /** The player's name: their account's, or the one they gave a room (none for bots and guests in the queue) */
  name?: string;
}

export interface GameRoomConfig {
  gameId: string;
  players: PlayerInfo[];
  championDefinitions: Map<string, ChampionDefinition>;
  /** Controllers for players with isBot set */
  bots?: BotController[];
  /** The map it's played on (default the main map) */
  mapId?: MapId;
  /** Players may turn on the debug overlay (practice matches) */
  allowDebug?: boolean;
  /** A practice match (against bots): its result doesn't count for accounts */
  practice?: boolean;
  /** Where it came from: the queue (default) or a room of friends (its match history says) */
  mode?: MatchMode;
  onStateUpdate?:(playerId: string, update: StateUpdate) => void;
  /** A debug overlay's DEBUG_STATE for a player who turned it on */
  onDebugState?: (playerId: string, data: DebugStateData) => void;
  onGameEnd?: (winningSide: Side) => void;
}

export type GameRoomState = 'waiting' | 'starting' | 'playing' | 'ended';

export class GameRoom {
  readonly gameId: string;
  /** The map it's played on */
  readonly mapId: MapId;
  private state: GameRoomState = 'waiting';

  private game: ServerGame;
  private context: ServerGameContext;
  private inputHandler: InputHandler;
  /** Players who have surrendered */
  private readonly surrendered = new Set<string>();
  private stateSerializer: StateSerializer;
  private reliableEventQueue: ReliableEventQueue;
  private botDriver = new BotDriver();
  /** Players without their connection, and since when (game time): a bot plays for them after TAKEOVER_DELAY */
  private readonly awaySince = new Map<string, number>();

  private players: Map<string, PlayerInfo> = new Map();
  private championDefinitions: Map<string, ChampionDefinition>;

  private onStateUpdate?: (playerId: string, update: StateUpdate) => void;
  private onDebugState?: (playerId: string, data: DebugStateData) => void;
  private onGameEnd?: (winningSide: Side) => void;

  /** Players may turn on the debug overlay */
  private readonly allowDebug: boolean;
  private readonly practice: boolean;
  /** From the queue or a room of friends */
  readonly mode: MatchMode;
  /** Players who turned it on */
  private readonly debugPlayers = new Set<string>();
  /** Debug states go out every this many broadcasts (10 a second at 30) */
  private static readonly DEBUG_EVERY = 3;

  // Game timing
  private gameStartTime = 0;

  constructor(config: GameRoomConfig) {
    this.gameId = config.gameId;
    this.championDefinitions = config.championDefinitions;
    this.onStateUpdate = config.onStateUpdate;
    this.onDebugState = config.onDebugState;
    this.onGameEnd = config.onGameEnd;
    this.allowDebug = config.allowDebug ?? false;
    this.practice = config.practice ?? false;
    this.mode = config.mode ?? 'queue';

    // Initialize players
    for (const player of config.players) {
      this.players.set(player.playerId, player);
    }
    for (const bot of config.bots ?? []) {
      this.botDriver.add(bot);
    }

    // Create game context
    this.mapId = config.mapId ?? 'vale';
    this.context = new ServerGameContext({
      gameId: config.gameId,
      mapConfig: MAPS[this.mapId],
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
      const champion = spawnChampion(this.context, { playerId, side: playerInfo.side, definition });
      champion.summoners.set(playerInfo.summonerSpells ?? DEFAULT_SUMMONER_SPELLS);
    }
  }

  /**
   * Handle a player input.
   */
  handleInput(playerId: string, input: ClientInput): void {
    if (this.state !== 'playing') return;

    if (input.type === InputType.SURRENDER) {
      this.surrender(playerId);
      return;
    }

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
    this.takeOverAwayPlayers();
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

      // Combine reliable events with the unreliable ones this player gets (pings only for its team...)
      let visibleIds: Set<string> | undefined;
      const sees = (id: string) => (visibleIds ??= new Set(visibleEntities.map(entity => entity.id))).has(id);
      const eventsForPlayer = [
        ...reliableEventsToSend,
        ...unreliableEvents.filter(event => reachesSide(event, playerInfo.side, sees)),
      ];

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

      if (this.debugPlayers.has(playerId) && tick % GameRoom.DEBUG_EVERY === 0) {
        this.onDebugState?.(playerId, buildDebugState(
          visibleEntities, this.context, tick, id => this.botDriver.decisionOf(id),
        ));
      }
    }
  }

  /**
   * Turn a player's debug overlay on or off. False if this match doesn't
   * allow it (only practice matches do).
   */
  setDebug(playerId: string, enabled: boolean): boolean {
    if (!this.allowDebug || !this.players.has(playerId)) return false;
    if (enabled) this.debugPlayers.add(playerId);
    else this.debugPlayers.delete(playerId);
    return true;
  }

  /**
   * Check win conditions.
   */
  private checkWinConditions(): void {
    if (this.state !== 'playing') return;

    for (const entity of this.context.getAllEntities()) {
      if (entity.entityType === EntityType.NEXUS && entity.isDead) {
        Logger.game.info(`Game ${this.gameId}: ${entity.side === 0 ? 'Blue' : 'Red'} nexus destroyed`);
        this.endGame((1 - entity.side) as Side);
        return;
      }
    }
  }

  /**
   * A player concedes. Once every human on their side has, the other side wins.
   */
  private surrender(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.isBot) return;
    this.surrendered.add(playerId);

    const team = Array.from(this.players.values()).filter(member => member.side === player.side && !member.isBot);
    if (!team.every(member => this.surrendered.has(member.playerId))) return;

    Logger.game.info(`Game ${this.gameId}: ${player.side === 0 ? 'Blue' : 'Red'} surrendered`);
    this.endGame((1 - player.side) as Side);
  }

  /**
   * End the match with `winningSide` winning.
   */
  private endGame(winningSide: Side): void {
    this.state = 'ended';
    // Let the final state reach clients before the room is torn down
    this.broadcastState(this.game.getCurrentTick());
    this.onGameEnd?.(winningSide);
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
      // A bot plays for them if they're not back soon
      if (!playerInfo.isBot && !this.awaySince.has(playerId)) this.awaySince.set(playerId, this.context.getGameTime());
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

    // The bot playing for them lets go; their inputs are numbered afresh (a reloaded page starts at 1)
    this.awaySince.delete(playerId);
    this.inputHandler.clearPlayer(playerId);
    if (this.isBotPlaying(playerId)) {
      this.botDriver.remove(playerId);
      // The champion stands where the bot left it, not walking on where the bot was going
      this.context.getChampionByPlayerId(playerId)?.stop();
      this.announceConnection(playerId, 'back');
    }

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
   * A bot (a LaneBot, in the lane the champion is nearest) for each player
   * away for TAKEOVER_DELAY seconds; everyone hears it.
   */
  private takeOverAwayPlayers(): void {
    const now = this.context.getGameTime();
    for (const [playerId, since] of this.awaySince) {
      if (now - since < TAKEOVER_DELAY || this.botDriver.has(playerId)) continue;
      const champion = this.context.getChampionByPlayerId(playerId);
      if (!champion) continue;
      this.botDriver.add(new LaneBot({ playerId, lane: takeoverLane(champion.position, this.context.mapConfig) }));
      this.announceConnection(playerId, 'bot');
      Logger.game.info(`A bot plays for ${playerId} in game ${this.gameId}`);
    }
  }

  /** Tell everyone a bot plays a player's champion, or they're back */
  private announceConnection(playerId: string, status: 'bot' | 'back'): void {
    const champion = this.context.getChampionByPlayerId(playerId);
    if (!champion) return;
    this.context.addEvent(GameEventType.PLAYER_CONNECTION, {
      entityId: champion.id,
      side: champion.side,
      championId: champion.definition.id,
      status,
    });
  }

  /** A practice match: its result doesn't count for accounts */
  isPractice(): boolean {
    return this.practice;
  }

  /** Whether a bot plays for a player who lost their connection */
  isBotPlaying(playerId: string): boolean {
    const player = this.players.get(playerId);
    return player !== undefined && !player.isBot && this.botDriver.has(playerId);
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
   * Every champion's final stats, for the end-of-match scoreboard.
   */
  getFinalStats(): FinalPlayerStats[] {
    return this.context.getAllChampions().map(champion => ({
      playerId: champion.playerId,
      championId: champion.definition.id,
      side: champion.side,
      level: champion.level,
      kills: champion.kills,
      deaths: champion.deaths,
      assists: champion.assists,
      cs: champion.cs,
      gold: Math.floor(champion.gold),
      items: champion.items.map(item => item?.definitionId ?? null),
      totals: champion.matchStats.toTotals(),
    }));
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
    isBot: boolean;
    summonerSpells: SummonerSpellId[];
    name?: string;
  }> {
    const result = [];
    for (const [playerId, playerInfo] of this.players) {
      const champion = this.context.getChampionByPlayerId(playerId);
      result.push({
        playerId,
        championId: playerInfo.championId,
        side: playerInfo.side,
        entityId: champion?.id || '',
        isBot: playerInfo.isBot === true,
        summonerSpells: playerInfo.summonerSpells ?? [...DEFAULT_SUMMONER_SPELLS],
        ...(playerInfo.name !== undefined && { name: playerInfo.name }),
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
