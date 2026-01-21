/**
 * NetworkedGame - High-level integration of client networking for online play.
 *
 * Integrates:
 * - NetworkClient for server communication
 * - Predictor for client-side prediction and interpolation
 * - StateBuffer for server state snapshots
 *
 * Provides a simple API for the game rendering layer to:
 * - Connect/disconnect from server
 * - Send player inputs
 * - Get interpolated entity states for rendering
 * - Handle game lifecycle events
 */

import {
  Vector,
  GameConfig,
  InputType,
  type StateUpdate,
  type FullStateSnapshot,
  type EntitySnapshot,
  type ChampionSnapshot,
  type AbilitySlot,
  type GameEvent,
} from '@siege/shared';
import {
  NetworkClient,
  ConnectionState,
  type NetworkClientConfig,
} from './network';
import {
  Predictor,
  type PredictorConfig,
  type PredictedEntityState,
  type PredictionStats,
} from './prediction';
import { StateBuffer, type StateBufferConfig } from './network/StateBuffer';

/**
 * Configuration for NetworkedGame.
 */
export interface NetworkedGameConfig {
  serverUrl: string;
  playerId: string;
  gameId?: string;
  interpolationDelay?: number;
  snapThreshold?: number;
  correctionThreshold?: number;
  reconnectAttempts?: number;
}

/**
 * Game state for rendering.
 */
export interface NetworkedGameState {
  /** All entity states for rendering (interpolated + predicted) */
  entities: PredictedEntityState[];
  /** Local player's champion snapshot */
  localPlayer: ChampionSnapshot | null;
  /** Current server tick */
  tick: number;
  /** Current game time in ms */
  gameTime: number;
  /** Whether we're connected to the server */
  isConnected: boolean;
  /** Whether the game has started */
  isGameStarted: boolean;
}

/**
 * Event types emitted by NetworkedGame.
 */
export interface NetworkedGameEvents {
  onConnect?: () => void;
  onDisconnect?: (code: number, reason: string) => void;
  onGameStart?: (data: GameStartData) => void;
  onGameEnd?: (winningSide: number, duration: number) => void;
  onFullState?: (snapshot: FullStateSnapshot) => void;
  onGameEvent?: (event: GameEvent) => void;
  onError?: (error: string) => void;
  onLatencyUpdate?: (latency: number) => void;
  onQueueJoined?: () => void;
}

/**
 * Data provided when game starts.
 */
export interface GameStartData {
  tick: number;
  gameTime: number;
  gameId: string;
  yourSide: number;
  players: Array<{
    playerId: string;
    championId: string;
    side: number;
    entityId: string;
  }>;
}

/**
 * NetworkedGame integrates all client networking for online play.
 */
export class NetworkedGame {
  private networkClient: NetworkClient;
  private predictor: Predictor | null = null;
  private stateBuffer: StateBuffer;
  private events: NetworkedGameEvents = {};

  // Game state
  private isGameStarted = false;
  private currentTick = 0;
  private currentGameTime = 0;
  private gameId: string | null = null;
  private localPlayerId: string;
  private localEntityId: string | null = null;
  private localSide: number = 0;

  // Configuration
  private config: Required<NetworkedGameConfig>;

  constructor(config: NetworkedGameConfig) {
    this.config = {
      serverUrl: config.serverUrl,
      playerId: config.playerId,
      gameId: config.gameId || '',
      interpolationDelay: config.interpolationDelay ?? GameConfig.NETWORK.INTERPOLATION_DELAY,
      snapThreshold: config.snapThreshold ?? 100,
      correctionThreshold: config.correctionThreshold ?? 5,
      reconnectAttempts: config.reconnectAttempts ?? 5,
    };

    this.localPlayerId = config.playerId;

    // Create network client
    this.networkClient = new NetworkClient({
      serverUrl: this.config.serverUrl,
      playerId: this.config.playerId,
      gameId: this.config.gameId,
      reconnectAttempts: this.config.reconnectAttempts,
    });

    // Create state buffer
    this.stateBuffer = new StateBuffer();

    // Set up network event handlers
    this.setupNetworkHandlers();
  }

  /**
   * Set event handlers.
   */
  setEvents(events: NetworkedGameEvents): void {
    this.events = events;
  }

  /**
   * Connect to the game server.
   */
  async connect(): Promise<void> {
    await this.networkClient.connect();
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    this.networkClient.disconnect();
    this.isGameStarted = false;
    this.predictor?.clear();
    this.stateBuffer.clear();
  }

  /**
   * Send ready signal (joins matchmaking queue).
   */
  sendReady(championId: string = 'warrior'): void {
    this.networkClient.sendReady(championId);
  }

  /**
   * Send a move input.
   */
  sendMove(targetX: number, targetY: number): void {
    this.networkClient.sendMoveInput(targetX, targetY);

    // Apply local prediction
    if (this.predictor) {
      this.predictor.applyInput({
        seq: 0, // Sequence tracked by network client
        clientTime: Date.now(),
        type: InputType.MOVE,
        targetX,
        targetY,
      });
    }
  }

  /**
   * Send an attack-move input.
   */
  sendAttackMove(targetX: number, targetY: number): void {
    this.networkClient.sendAttackMoveInput(targetX, targetY);

    // Apply local prediction for movement
    if (this.predictor) {
      this.predictor.applyInput({
        seq: 0,
        clientTime: Date.now(),
        type: InputType.ATTACK_MOVE,
        targetX,
        targetY,
      });
    }
  }

  /**
   * Send a target unit input (attack specific unit).
   */
  sendTargetUnit(targetEntityId: string): void {
    this.networkClient.sendTargetUnitInput(targetEntityId);
  }

  /**
   * Send a stop input.
   */
  sendStop(): void {
    this.networkClient.sendStopInput();
  }

  /**
   * Send an ability input.
   */
  sendAbility(
    slot: AbilitySlot,
    targetX?: number,
    targetY?: number,
    targetEntityId?: string
  ): void {
    let targetType: 'none' | 'position' | 'unit' = 'none';
    if (targetEntityId !== undefined) {
      targetType = 'unit';
    } else if (targetX !== undefined && targetY !== undefined) {
      targetType = 'position';
    }

    this.networkClient.sendAbilityInput(slot, targetType, targetX, targetY, targetEntityId);
  }

  /**
   * Send a level up ability input.
   */
  sendLevelUp(slot: AbilitySlot): void {
    this.networkClient.sendLevelUpInput(slot);
  }

  /**
   * Send a buy item input.
   */
  sendBuyItem(itemId: string): void {
    this.networkClient.sendBuyItemInput(itemId);
  }

  /**
   * Send a sell item input.
   */
  sendSellItem(slot: number): void {
    this.networkClient.sendSellItemInput(slot);
  }

  /**
   * Send a recall input.
   */
  sendRecall(): void {
    this.networkClient.sendRecallInput();
  }

  /**
   * Get the current game state for rendering.
   */
  getState(): NetworkedGameState {
    const renderTime = Date.now();

    // Get entity states from predictor
    const entities = this.predictor
      ? this.predictor.getEntityStates(renderTime)
      : [];

    // Get local player snapshot
    const localPlayer = this.predictor?.getLocalPlayerSnapshot() ?? null;

    return {
      entities,
      localPlayer,
      tick: this.currentTick,
      gameTime: this.currentGameTime,
      isConnected: this.networkClient.getState() === ConnectionState.CONNECTED,
      isGameStarted: this.isGameStarted,
    };
  }

  /**
   * Get local player's predicted position.
   */
  getLocalPlayerPosition(): Vector | null {
    return this.predictor?.getLocalPlayerPosition() ?? null;
  }

  /**
   * Get entity state from state buffer.
   */
  getEntity(entityId: string): EntitySnapshot | undefined {
    return this.stateBuffer.getEntity(entityId);
  }

  /**
   * Get all current entity states from state buffer.
   */
  getCurrentEntities(): Map<string, EntitySnapshot> {
    return this.stateBuffer.getCurrentEntities();
  }

  /**
   * Get connection state.
   */
  getConnectionState(): ConnectionState {
    return this.networkClient.getState();
  }

  /**
   * Get current latency in ms.
   */
  getLatency(): number {
    return this.networkClient.getLatency();
  }

  /**
   * Get prediction statistics.
   */
  getPredictionStats(): PredictionStats | null {
    return this.predictor?.getStats() ?? null;
  }

  /**
   * Get local player ID.
   */
  getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  /**
   * Get local entity ID (champion).
   */
  getLocalEntityId(): string | null {
    return this.localEntityId;
  }

  /**
   * Get local player's side/team.
   */
  getLocalSide(): number {
    return this.localSide;
  }

  /**
   * Get the current game ID.
   */
  getGameId(): string | null {
    return this.gameId;
  }

  /**
   * Check if game has started.
   */
  isStarted(): boolean {
    return this.isGameStarted;
  }

  /**
   * Set up network client event handlers.
   */
  private setupNetworkHandlers(): void {
    this.networkClient.onConnect = () => {
      console.log('[NetworkedGame] Connected to server');
      this.events.onConnect?.();
    };

    this.networkClient.onDisconnect = (code, reason) => {
      console.log(`[NetworkedGame] Disconnected: ${code} - ${reason}`);
      this.events.onDisconnect?.(code, reason);
    };

    this.networkClient.onGameStart = (data) => {
      console.log('[NetworkedGame] Game started:', data);
      this.handleGameStart(data);
    };

    this.networkClient.onFullState = (snapshot) => {
      console.log('[NetworkedGame] Received full state');
      this.handleFullState(snapshot);
    };

    this.networkClient.onStateUpdate = (update) => {
      this.handleStateUpdate(update);
    };

    this.networkClient.onGameEnd = (data) => {
      console.log('[NetworkedGame] Game ended:', data);
      this.isGameStarted = false;
      this.events.onGameEnd?.(data.winningSide, data.duration);
    };

    this.networkClient.onError = (error) => {
      console.error('[NetworkedGame] Error:', error);
      this.events.onError?.(error);
    };

    this.networkClient.onLatencyUpdate = (latency) => {
      this.events.onLatencyUpdate?.(latency);
    };

    this.networkClient.onEvent = (event) => {
      if (event.event === 'queue_joined') {
        console.log('[NetworkedGame] Joined matchmaking queue');
        this.events.onQueueJoined?.();
      }
    };
  }

  /**
   * Handle game start event.
   */
  private handleGameStart(data: any): void {
    this.isGameStarted = true;
    this.gameId = data.gameId;
    this.currentTick = data.tick;
    this.currentGameTime = data.gameTime;
    this.localSide = data.yourSide;

    // Find local player's entity ID
    const localPlayerData = data.players?.find(
      (p: any) => p.playerId === this.localPlayerId
    );
    if (localPlayerData) {
      this.localEntityId = localPlayerData.entityId;
    }

    // Create predictor now that we know local entity ID
    if (this.localEntityId) {
      this.predictor = new Predictor({
        localPlayerId: this.localEntityId,
        interpolationDelay: this.config.interpolationDelay,
        snapThreshold: this.config.snapThreshold,
        correctionThreshold: this.config.correctionThreshold,
      });
    }

    this.events.onGameStart?.({
      tick: data.tick,
      gameTime: data.gameTime,
      gameId: data.gameId,
      yourSide: data.yourSide,
      players: data.players || [],
    });
  }

  /**
   * Handle full state snapshot (initial or reconnection).
   */
  private handleFullState(snapshot: FullStateSnapshot): void {
    // Process into state buffer
    this.stateBuffer.processFullState(snapshot);

    this.currentTick = snapshot.tick;
    this.currentGameTime = snapshot.timestamp;

    // Initialize predictor with full state
    if (this.predictor && this.localEntityId) {
      // Find local player's entity in the snapshot
      const localEntity = snapshot.entities.find(
        e => e.entityId === this.localEntityId
      );
      if (localEntity) {
        this.predictor.setLocalPlayerPosition(
          new Vector(localEntity.x, localEntity.y)
        );
      }
    }

    // Add all entities to predictor's interpolator
    if (this.predictor) {
      for (const entity of snapshot.entities) {
        if (entity.entityId !== this.localEntityId) {
          // Feed to predictor for interpolation
          this.predictor.processStateUpdate({
            tick: snapshot.tick,
            timestamp: snapshot.timestamp,
            gameTime: snapshot.timestamp,
            inputAcks: {},
            deltas: [{ entityId: entity.entityId, changeMask: 0xFFFF, data: entity }],
            events: [],
          });
        }
      }
    }

    this.events.onFullState?.(snapshot);
  }

  /**
   * Handle delta state update from server.
   */
  private handleStateUpdate(update: StateUpdate): void {
    // Update game time tracking
    this.currentTick = update.tick;
    this.currentGameTime = update.gameTime;

    // Process into state buffer
    this.stateBuffer.processStateUpdate(update);

    // Process through predictor (handles local + remote entities)
    this.predictor?.processStateUpdate(update);

    // Handle game events
    if (update.events) {
      for (const event of update.events) {
        this.events.onGameEvent?.(event);
      }
    }
  }
}
