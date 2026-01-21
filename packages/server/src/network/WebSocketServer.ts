/**
 * WebSocketServer - Handles WebSocket connections and messaging.
 *
 * Responsibilities:
 * - Accept WebSocket connections
 * - Route messages to game rooms
 * - Broadcast state updates to players
 * - Handle connection/disconnection
 */

import {
  ClientMessageType,
  ServerMessageType,
  type ClientInput,
  type StateUpdate,
  type FullStateSnapshot,
} from '@siege/shared';

/**
 * WebSocket connection interface.
 * Abstraction over different WebSocket implementations.
 */
export interface WebSocketConnection {
  id: string;
  playerId: string | null;
  gameId: string | null;
  send(data: ArrayBuffer | string): void;
  close(code?: number, reason?: string): void;
  isOpen(): boolean;
}

/**
 * Message handler for incoming WebSocket messages.
 */
export type MessageHandler = (connection: WebSocketConnection, message: ParsedMessage) => void;

/**
 * Connection handler for new connections.
 */
export type ConnectionHandler = (connection: WebSocketConnection) => void;

/**
 * Disconnect handler for closed connections.
 */
export type DisconnectHandler = (connection: WebSocketConnection, code: number, reason: string) => void;

/**
 * Parsed message from client.
 */
export interface ParsedMessage {
  type: ClientMessageType;
  data: unknown;
}

/**
 * Server message to send to client.
 */
export interface ServerMessage {
  type: ServerMessageType;
  data: unknown;
}

/**
 * WebSocket server configuration.
 */
export interface WebSocketServerConfig {
  onMessage?: MessageHandler;
  onConnect?: ConnectionHandler;
  onDisconnect?: DisconnectHandler;
  heartbeatInterval?: number;
}

/**
 * Abstract WebSocket server.
 * Implement this class with a specific WebSocket library (ws, uWebSockets.js, etc.)
 */
export abstract class WebSocketServer {
  protected connections: Map<string, WebSocketConnection> = new Map();
  protected messageHandler?: MessageHandler;
  protected connectHandler?: ConnectionHandler;
  protected disconnectHandler?: DisconnectHandler;
  protected heartbeatInterval: number;

  constructor(config: WebSocketServerConfig = {}) {
    this.messageHandler = config.onMessage;
    this.connectHandler = config.onConnect;
    this.disconnectHandler = config.onDisconnect;
    this.heartbeatInterval = config.heartbeatInterval ?? 30000;
  }

  /**
   * Start the WebSocket server on the specified port.
   */
  abstract start(port: number): Promise<void>;

  /**
   * Stop the WebSocket server.
   */
  abstract stop(): Promise<void>;

  /**
   * Set message handler.
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Set connection handler.
   */
  onConnect(handler: ConnectionHandler): void {
    this.connectHandler = handler;
  }

  /**
   * Set disconnect handler.
   */
  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandler = handler;
  }

  /**
   * Get connection by ID.
   */
  getConnection(connectionId: string): WebSocketConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections.
   */
  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connections by game ID.
   */
  getConnectionsByGame(gameId: string): WebSocketConnection[] {
    return Array.from(this.connections.values()).filter(c => c.gameId === gameId);
  }

  /**
   * Get connection by player ID.
   */
  getConnectionByPlayer(playerId: string): WebSocketConnection | undefined {
    return Array.from(this.connections.values()).find(c => c.playerId === playerId);
  }

  /**
   * Send a message to a specific connection.
   */
  sendToConnection(connectionId: string, message: ServerMessage): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isOpen()) {
      return false;
    }

    try {
      const encoded = this.encodeMessage(message);
      connection.send(encoded);
      return true;
    } catch (error) {
      console.error(`[WebSocketServer] Failed to send to ${connectionId}:`, error);
      return false;
    }
  }

  /**
   * Send a message to a player.
   */
  sendToPlayer(playerId: string, message: ServerMessage): boolean {
    const connection = this.getConnectionByPlayer(playerId);
    if (!connection) {
      return false;
    }
    return this.sendToConnection(connection.id, message);
  }

  /**
   * Broadcast to all connections in a game.
   */
  broadcastToGame(gameId: string, message: ServerMessage): void {
    const connections = this.getConnectionsByGame(gameId);
    const encoded = this.encodeMessage(message);

    for (const connection of connections) {
      if (connection.isOpen()) {
        try {
          connection.send(encoded);
        } catch (error) {
          console.error(`[WebSocketServer] Broadcast error to ${connection.id}:`, error);
        }
      }
    }
  }

  /**
   * Send state update to a player.
   */
  sendStateUpdate(playerId: string, update: StateUpdate): boolean {
    return this.sendToPlayer(playerId, {
      type: ServerMessageType.STATE_UPDATE,
      data: update,
    });
  }

  /**
   * Send full state snapshot to a player.
   */
  sendFullState(playerId: string, snapshot: FullStateSnapshot): boolean {
    return this.sendToPlayer(playerId, {
      type: ServerMessageType.FULL_STATE,
      data: snapshot,
    });
  }

  /**
   * Send game start message.
   */
  sendGameStart(playerId: string, data: { tick: number; gameTime: number }): boolean {
    return this.sendToPlayer(playerId, {
      type: ServerMessageType.GAME_START,
      data,
    });
  }

  /**
   * Send game end message.
   */
  sendGameEnd(playerId: string, data: { winningSide: number; duration: number }): boolean {
    return this.sendToPlayer(playerId, {
      type: ServerMessageType.GAME_END,
      data,
    });
  }

  /**
   * Send error message.
   */
  sendError(playerId: string, error: string): boolean {
    return this.sendToPlayer(playerId, {
      type: ServerMessageType.ERROR,
      data: { error },
    });
  }

  /**
   * Handle incoming message from connection.
   */
  protected handleMessage(connection: WebSocketConnection, rawMessage: ArrayBuffer | string): void {
    try {
      const message = this.decodeMessage(rawMessage);
      this.messageHandler?.(connection, message);
    } catch (error) {
      console.error(`[WebSocketServer] Failed to parse message from ${connection.id}:`, error);
    }
  }

  /**
   * Handle new connection.
   */
  protected handleConnect(connection: WebSocketConnection): void {
    this.connections.set(connection.id, connection);
    console.log(`[WebSocketServer] Connection opened: ${connection.id}`);
    this.connectHandler?.(connection);
  }

  /**
   * Handle connection close.
   */
  protected handleDisconnect(connection: WebSocketConnection, code: number, reason: string): void {
    this.connections.delete(connection.id);
    console.log(`[WebSocketServer] Connection closed: ${connection.id} (${code}: ${reason})`);
    this.disconnectHandler?.(connection, code, reason);
  }

  /**
   * Encode a message for sending.
   */
  protected encodeMessage(message: ServerMessage): string {
    return JSON.stringify(message);
  }

  /**
   * Decode an incoming message.
   */
  protected decodeMessage(rawMessage: ArrayBuffer | string): ParsedMessage {
    const str = typeof rawMessage === 'string' ? rawMessage : new TextDecoder().decode(rawMessage);
    return JSON.parse(str) as ParsedMessage;
  }

  /**
   * Get number of active connections.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}

/**
 * Input message received from client.
 */
export interface InputMessageData {
  type: ClientMessageType.INPUT;
  data: ClientInput;
}

/**
 * Ping message from client.
 */
export interface PingMessageData {
  type: ClientMessageType.PING;
  data: { timestamp: number };
}

/**
 * Ready message from client.
 */
export interface ReadyMessageData {
  type: ClientMessageType.READY;
  data: { playerId: string };
}
