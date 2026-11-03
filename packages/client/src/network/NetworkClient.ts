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
  type GameEndData,
  type DebugStateData,
  type LobbyRequest,
  type LobbyState,
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
  /** Session token from an earlier connection, to resume the same player */
  sessionToken?: string;
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
  onGameEnd?: (data: GameEndData) => void;
  onError?: (error: string) => void;
  onLatencyUpdate?: (latency: number) => void;
  onEvent?: (event: { event: string; [key: string]: any }) => void;
  onDebugState?: (data: DebugStateData) => void;
  onLobbyState?: (state: LobbyState) => void;
}

/**
 * Network client for connecting to game server.
 */
export class NetworkClient {
  private ws: WebSocket | null = null;
  private config: NetworkClientConfig;
  private handlers: NetworkEventHandlers = {};
  private state: ConnectionState = ConnectionState.DISCONNECTED;

  // Issued by the server on first READY; required to resume this playerId
  private sessionToken: string | null;

  // Input sequence tracking
  private inputSeq = 0;
  private pendingInputs: Map<number, ClientInput> = new Map();
  /** The highest reliable event ID received (resends come with one no higher) */
  private highestEventId = 0;

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
  onGameEnd?: (data: GameEndData) => void;
  onError?: (error: string) => void;
  onLatencyUpdate?: (latency: number) => void;
  onEvent?: (event: { event: string; [key: string]: any }) => void;
  /** What the server thinks about the units in sight, while the debug overlay is on (sendDebug) */
  onDebugState?: (data: DebugStateData) => void;
  /** The room the player is in, after every change (a null code: none) */
  onLobbyState?: (state: LobbyState) => void;

  constructor(config: NetworkClientConfig) {
    this.config = {
      reconnectAttempts: 5,
      reconnectDelay: 2000,
      heartbeatInterval: 5000,
      ...config,
    };
    this.sessionToken = config.sessionToken ?? null;
  }

  /**
   * Get the session token issued by the server (null until the first READY).
   */
  getSessionToken(): string | null {
    return this.sessionToken;
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
   * Concede the match.
   */
  /**
   * Ask the server for DEBUG_STATE messages, or to stop them (practice matches only).
   */
  sendDebug(enabled: boolean): void {
    this.sendMessage({ type: ClientMessageType.DEBUG, data: { enabled } });
  }

  sendSurrender(): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.SURRENDER,
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
   * Cast a summoner spell (slot 0 = D, 1 = F) at the cursor, on the unit under it if any.
   */
  /**
   * Use the item in an inventory slot (its active or a consumable), aimed at a point.
   */
  sendUseItemInput(slot: number, targetX: number, targetY: number): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.USE_ITEM,
      slot,
      targetX,
      targetY,
    });
  }

  sendSummonerSpellInput(slot: 0 | 1, targetX: number, targetY: number, targetEntityId?: string): void {
    this.sendInput({
      seq: ++this.inputSeq,
      clientTime: Date.now(),
      type: InputType.SUMMONER_SPELL,
      slot,
      targetX,
      targetY,
      targetEntityId,
    });
  }

  /**
   * Send ready message to server (joins queue).
   */
  sendReady(
    championId: string = 'warrior',
    options: {
      mode?: 'queue' | 'practice' | 'lobby';
      botChampionId?: string;
      summonerSpells?: string[];
      practiceSize?: number;
      mapId?: string;
      /** 'lobby' mode: make a room, or join one by its code */
      lobby?: { create?: boolean; code?: string };
      /** The player's name, shown in rooms */
      name?: string;
    } = {}
  ): void {
    console.log(`[NetworkClient] sendReady: playerId="${this.config.playerId}", championId="${championId}"`);
    this.sendMessage({
      type: ClientMessageType.READY,
      data: {
        playerId: this.config.playerId,
        championId,
        sessionToken: this.sessionToken ?? undefined,
        mode: options.mode,
        botChampionId: options.botChampionId,
        summonerSpells: options.summonerSpells,
        practiceSize: options.practiceSize,
        mapId: options.mapId,
        lobby: options.lobby,
        name: options.name,
      },
    });
  }

  /**
   * Ask something about the player's room: a new champion, the other side,
   * the host's settings, starting, leaving.
   */
  sendLobby(request: LobbyRequest): void {
    this.sendMessage({ type: ClientMessageType.LOBBY, data: request });
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
          (this.onGameEnd || this.handlers.onGameEnd)?.(message.data as GameEndData);
          break;

        case ServerMessageType.ERROR:
          (this.onError || this.handlers.onError)?.((message.data as { error: string }).error);
          break;

        case ServerMessageType.LOBBY_STATE:
          (this.onLobbyState || this.handlers.onLobbyState)?.(message.data as LobbyState);
          break;

        case ServerMessageType.DEBUG_STATE:
          (this.onDebugState || this.handlers.onDebugState)?.(message.data as DebugStateData);
          break;

        case ServerMessageType.PONG:
          this.handlePong(message.data as { clientTimestamp: number; serverTimestamp: number });
          break;

        case ServerMessageType.EVENT: {
          // Custom events (session, queue_joined, etc.)
          const event = message.data as { event: string; [key: string]: any };
          if (event.event === 'session' && typeof event.sessionToken === 'string') {
            this.sessionToken = event.sessionToken;
          }
          (this.onEvent || this.handlers.onEvent)?.(event);
          break;
        }
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

    (this.onStateUpdate || this.handlers.onStateUpdate)?.(this.withoutRepeatedEvents(update));
  }

  /**
   * The server resends a reliable event (a kill, a tower falling) until it's
   * acknowledged. Messages arrive in order, so one with an ID no higher than
   * the highest seen is a resend: drop it, and acknowledge the new ones.
   */
  private withoutRepeatedEvents(update: StateUpdate): StateUpdate {
    if (!update.events?.some(event => event.eventId !== undefined)) return update;
    const highestBefore = this.highestEventId;
    const events = update.events.filter(event => {
      if (event.eventId === undefined) return true;
      if (event.eventId <= highestBefore) return false;
      this.highestEventId = Math.max(this.highestEventId, event.eventId);
      return true;
    });
    if (this.highestEventId > highestBefore) {
      this.sendMessage({ type: ClientMessageType.EVENT_ACK, data: { lastEventId: this.highestEventId } });
    }
    return events.length === update.events.length ? update : { ...update, events };
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
