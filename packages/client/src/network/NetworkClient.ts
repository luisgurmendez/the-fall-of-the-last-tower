/**
 * NetworkClient - Client-side WebSocket connection to game server.
 *
 * Responsibilities:
 * - Connect to game server
 * - Send player inputs
 * - Receive state updates
 * - Handle reconnection
 * - Manage connection state
 */

import {
  ClientMessageType,
  ServerMessageType,
  InputType,
  type ClientInput,
  type StateUpdate,
  type FullStateSnapshot,
  type GameEvent,
  type AbilitySlot,
  type WardType,
} from '@siege/shared';

/**
 * Connection state.
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
}

/**
 * Network client configuration.
 */
export interface NetworkClientConfig {
  serverUrl: string;
  playerId: string;
  gameId: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
}

/**
 * Server message types.
 */
export interface ServerMessage {
  type: ServerMessageType;
  data: unknown;
}

/**
 * Event handlers for network events.
 */
export interface NetworkEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (code: number, reason: string) => void;
  onStateUpdate?: (update: StateUpdate) => void;
  onFullState?: (snapshot: FullStateSnapshot) => void;
  onGameStart?: (data: { tick: number; gameTime: number; gameId?: string; yourSide?: number; players?: any[] }) => void;
  onGameEnd?: (data: { winningSide: number; duration: number }) => void;
  onError?: (error: string) => void;
  onLatencyUpdate?: (latency: number) => void;
  onEvent?: (event: { event: string; [key: string]: any }) => void;
}

/**
 * Network client for connecting to game server.
 */
export class NetworkClient {
  private ws: WebSocket | null = null;
  private config: NetworkClientConfig;
  private handlers: NetworkEventHandlers = {};
  private state: ConnectionState = ConnectionState.DISCONNECTED;

  // Input sequence tracking
  private inputSeq = 0;
  private pendingInputs: Map<number, ClientInput> = new Map();

  // Reconnection
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Latency tracking
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private lastPingTime = 0;
  private latency = 0;

  // Direct event handler properties
  onConnect?: () => void;
  onDisconnect?: (code: number, reason: string) => void;
  onStateUpdate?: (update: StateUpdate) => void;
  onFullState?: (snapshot: FullStateSnapshot) => void;
  onGameStart?: (data: any) => void;
  onGameEnd?: (data: { winningSide: number; duration: number }) => void;
  onError?: (error: string) => void;
  onLatencyUpdate?: (latency: number) => void;
  onEvent?: (event: { event: string; [key: string]: any }) => void;

  constructor(config: NetworkClientConfig) {
    this.config = {
      reconnectAttempts: 5,
      reconnectDelay: 2000,
      heartbeatInterval: 5000,
      ...config,
    };
  }

  /**
   * Get current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get current latency in milliseconds.
   */
  getLatency(): number {
    return this.latency;
  }

  /**
   * Get pending (unacknowledged) inputs.
   */
  getPendingInputs(): ClientInput[] {
    return Array.from(this.pendingInputs.values());
  }

  /**
   * Set event handlers.
   */
  setHandlers(handlers: NetworkEventHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Connect to the game server.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.state === ConnectionState.CONNECTED) {
        resolve();
        return;
      }

      this.state = ConnectionState.CONNECTING;

      try {
        this.ws = new WebSocket(this.config.serverUrl);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this.state = ConnectionState.CONNECTED;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          (this.onConnect || this.handlers.onConnect)?.();

          resolve();
        };

        this.ws.onclose = (event) => {
          this.handleDisconnect(event.code, event.reason);
        };

        this.ws.onerror = (error) => {
          console.error('[NetworkClient] WebSocket error:', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.state = ConnectionState.DISCONNECTED;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.cancelReconnect();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state = ConnectionState.DISCONNECTED;
  }

  /**
   * Send a movement input.
   */
  sendMoveInput(targetX: number, targetY: number): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.MOVE,
      targetX,
      targetY,
    });
  }

  /**
   * Send an attack-move input.
   */
  sendAttackMoveInput(targetX: number, targetY: number): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.ATTACK_MOVE,
      targetX,
      targetY,
    });
  }

  /**
   * Send a target unit input.
   */
  sendTargetUnitInput(targetEntityId: string): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.TARGET_UNIT,
      targetEntityId,
    });
  }

  /**
   * Send a stop input.
   */
  sendStopInput(): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.STOP,
    });
  }

  /**
   * Send an ability input.
   * @param slot - Ability slot (Q, W, E, R)
   * @param targetType - How the ability is targeted
   * @param targetX - Target X position (for ground/skillshot)
   * @param targetY - Target Y position (for ground/skillshot)
   * @param targetEntityId - Target entity ID (for unit-targeted)
   * @param chargeTime - Charge time in seconds (for charge abilities)
   */
  sendAbilityInput(
    slot: AbilitySlot,
    targetType: 'none' | 'position' | 'unit',
    targetX?: number,
    targetY?: number,
    targetEntityId?: string,
    chargeTime?: number
  ): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.ABILITY,
      slot,
      targetType,
      targetX,
      targetY,
      targetEntityId,
      chargeTime,
    });
  }

  /**
   * Send a level up input.
   */
  sendLevelUpInput(slot: AbilitySlot): void {
    console.log(`[NetworkClient] Sending level up input for slot ${slot}`);
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.LEVEL_UP,
      slot,
    });
  }

  /**
   * Send a buy item input.
   */
  sendBuyItemInput(itemId: string): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.BUY_ITEM,
      itemId,
    });
  }

  /**
   * Send a sell item input.
   */
  sendSellItemInput(slot: number): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.SELL_ITEM,
      slot,
    });
  }

  /**
   * Send a recall input.
   */
  sendRecallInput(): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.RECALL,
    });
  }

  /**
   * Send a place ward input.
   */
  sendPlaceWardInput(wardType: WardType, x: number, y: number): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.PLACE_WARD,
      wardType,
      x,
      y,
    });
  }

  /**
   * Send ready message to server (joins queue).
   */
  sendReady(championId: string = 'warrior'): void {
    console.log(`[NetworkClient] sendReady: playerId="${this.config.playerId}", championId="${championId}"`);
    this.sendMessage({
      type: ClientMessageType.READY,
      data: {
        playerId: this.config.playerId,
        championId,
      },
    });
  }

  /**
   * Send an input to the server.
   */
  private sendInput(input: ClientInput): void {
    // Store for reconciliation
    this.pendingInputs.set(input.seq, input);

    this.sendMessage({
      type: ClientMessageType.INPUT,
      data: input,
    });
  }

  /**
   * Send a message to the server.
   */
  private sendMessage(message: { type: ClientMessageType; data: unknown }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[NetworkClient] Cannot send message, not connected');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[NetworkClient] Failed to send message:', error);
    }
  }

  /**
   * Handle incoming message from server.
   */
  private handleMessage(data: ArrayBuffer | string): void {
    try {
      const str = typeof data === 'string' ? data : new TextDecoder().decode(data);
      const message = JSON.parse(str) as ServerMessage;

      switch (message.type) {
        case ServerMessageType.STATE_UPDATE:
          this.handleStateUpdate(message.data as StateUpdate);
          break;

        case ServerMessageType.FULL_STATE:
          (this.onFullState || this.handlers.onFullState)?.(message.data as FullStateSnapshot);
          break;

        case ServerMessageType.GAME_START:
          (this.onGameStart || this.handlers.onGameStart)?.(message.data as any);
          break;

        case ServerMessageType.GAME_END:
          (this.onGameEnd || this.handlers.onGameEnd)?.(message.data as { winningSide: number; duration: number });
          break;

        case ServerMessageType.ERROR:
          (this.onError || this.handlers.onError)?.((message.data as { error: string }).error);
          break;

        case ServerMessageType.PONG:
          this.handlePong(message.data as { clientTimestamp: number; serverTimestamp: number });
          break;

        case ServerMessageType.EVENT:
          // Custom events (queue_joined, etc.)
          (this.onEvent || this.handlers.onEvent)?.(message.data as { event: string });
          break;
      }
    } catch (error) {
      console.error('[NetworkClient] Failed to parse message:', error);
    }
  }

  /**
   * Handle state update from server.
   */
  private handleStateUpdate(update: StateUpdate): void {
    // Clear acknowledged inputs
    const ackedSeq = update.inputAcks[this.config.playerId];
    if (ackedSeq !== undefined) {
      for (const [seq] of this.pendingInputs) {
        if (seq <= ackedSeq) {
          this.pendingInputs.delete(seq);
        }
      }
    }

    (this.onStateUpdate || this.handlers.onStateUpdate)?.(update);
  }

  /**
   * Handle disconnect.
   */
  private handleDisconnect(code: number, reason: string): void {
    this.stopHeartbeat();
    this.ws = null;

    if (this.state === ConnectionState.CONNECTED) {
      (this.onDisconnect || this.handlers.onDisconnect)?.(code, reason);
    }

    // Attempt reconnection
    if (code !== 1000 && this.reconnectAttempts < (this.config.reconnectAttempts ?? 5)) {
      this.state = ConnectionState.RECONNECTING;
      this.scheduleReconnect();
    } else {
      this.state = ConnectionState.DISCONNECTED;
    }
  }

  /**
   * Schedule reconnection attempt.
   */
  private scheduleReconnect(): void {
    const delay = this.config.reconnectDelay ?? 2000;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`[NetworkClient] Reconnecting (attempt ${this.reconnectAttempts})...`);

      this.connect().catch(() => {
        if (this.reconnectAttempts < (this.config.reconnectAttempts ?? 5)) {
          this.scheduleReconnect();
        } else {
          this.state = ConnectionState.DISCONNECTED;
          console.error('[NetworkClient] Failed to reconnect after max attempts');
        }
      });
    }, delay);
  }

  /**
   * Cancel scheduled reconnection.
   */
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Start heartbeat/ping.
   */
  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, this.config.heartbeatInterval ?? 5000);
  }

  /**
   * Stop heartbeat.
   */
  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Send ping to measure latency.
   */
  private sendPing(): void {
    this.lastPingTime = Date.now();
    this.sendMessage({
      type: ClientMessageType.PING,
      data: { timestamp: this.lastPingTime },
    });
  }

  /**
   * Handle pong response.
   */
  private handlePong(data: { clientTimestamp: number; serverTimestamp: number }): void {
    this.latency = Date.now() - data.clientTimestamp;
    (this.onLatencyUpdate || this.handlers.onLatencyUpdate)?.(this.latency);
  }
}
