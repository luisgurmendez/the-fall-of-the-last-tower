// @ts-nocheck - This file uses Bun-specific APIs that are only available in Bun runtime
/**
 * BunWebSocketServer - Concrete WebSocket server implementation using Bun.
 *
 * Uses Bun's native high-performance WebSocket support.
 * Handles connection management, message routing, and broadcasting.
 */

import {
  WebSocketServer,
  type WebSocketConnection,
  type WebSocketServerConfig,
} from './WebSocketServer';

/**
 * Bun WebSocket data attached to each connection.
 */
interface BunWebSocketData {
  connectionId: string;
  playerId: string | null;
  gameId: string | null;
}

/**
 * Concrete implementation of WebSocketConnection for Bun.
 */
class BunConnection implements WebSocketConnection {
  id: string;
  playerId: string | null = null;
  gameId: string | null = null;

  private ws: { send: (data: string | ArrayBuffer) => void; close: (code?: number, reason?: string) => void };
  private open = true;

  constructor(id: string, ws: any) {
    this.id = id;
    this.ws = ws;
  }

  send(data: ArrayBuffer | string): void {
    if (!this.open) return;
    try {
      this.ws.send(data);
    } catch (error) {
      console.error(`[BunConnection] Failed to send to ${this.id}:`, error);
    }
  }

  close(code?: number, reason?: string): void {
    this.open = false;
    try {
      this.ws.close(code, reason);
    } catch (error) {
      // Connection might already be closed
    }
  }

  isOpen(): boolean {
    return this.open;
  }

  markClosed(): void {
    this.open = false;
  }
}

/**
 * WebSocket server using Bun's native WebSocket support.
 */
export class BunWebSocketServer extends WebSocketServer {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private connectionMap: Map<any, BunConnection> = new Map();
  private idCounter = 0;

  constructor(config: WebSocketServerConfig = {}) {
    super(config);
  }

  /**
   * Start the WebSocket server on the specified port.
   */
  async start(port: number): Promise<void> {
    const self = this;

    this.server = Bun.serve({
      port,
      fetch(req, server) {
        // Handle WebSocket upgrade
        const url = new URL(req.url);

        if (url.pathname === '/ws' || url.pathname === '/') {
          const upgraded = server.upgrade(req, {
            data: {
              connectionId: `conn-${self.idCounter++}`,
              playerId: null,
              gameId: null,
            } as BunWebSocketData,
          });

          if (upgraded) {
            return undefined;
          }

          return new Response('WebSocket upgrade failed', { status: 400 });
        }

        // Health check endpoint
        if (url.pathname === '/health') {
          return new Response(JSON.stringify({
            status: 'ok',
            connections: self.getConnectionCount(),
            uptime: process.uptime(),
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response('Siege Game Server', { status: 200 });
      },

      websocket: {
        open(ws) {
          const data = ws.data as BunWebSocketData;
          const connection = new BunConnection(data.connectionId, ws);

          self.connectionMap.set(ws, connection);
          self.handleConnect(connection);
        },

        message(ws, message) {
          const connection = self.connectionMap.get(ws);
          if (!connection) return;

          // Handle both string and binary messages
          const msgData = typeof message === 'string'
            ? message
            : message;

          self.handleMessage(connection, msgData);
        },

        close(ws, code, reason) {
          const connection = self.connectionMap.get(ws);
          if (!connection) return;

          connection.markClosed();
          self.connectionMap.delete(ws);
          self.handleDisconnect(connection, code, reason || 'Connection closed');
        },

        error(ws, error) {
          console.error('[BunWebSocketServer] WebSocket error:', error);
          const connection = self.connectionMap.get(ws);
          if (connection) {
            connection.markClosed();
            self.connectionMap.delete(ws);
            self.handleDisconnect(connection, 1006, 'Connection error');
          }
        },

        // Bun WebSocket settings
        maxPayloadLength: 64 * 1024, // 64KB max message size
        idleTimeout: 120, // 2 minutes idle timeout
        backpressureLimit: 1024 * 1024, // 1MB backpressure limit
        closeOnBackpressureLimit: false,
      },
    });

    console.log(`[BunWebSocketServer] Listening on port ${port}`);
    console.log(`[BunWebSocketServer] WebSocket endpoint: ws://localhost:${port}/ws`);
    console.log(`[BunWebSocketServer] Health check: http://localhost:${port}/health`);
  }

  /**
   * Stop the WebSocket server.
   */
  async stop(): Promise<void> {
    if (this.server) {
      // Close all connections
      for (const connection of this.connections.values()) {
        connection.close(1001, 'Server shutting down');
      }

      this.server.stop();
      this.server = null;
      this.connections.clear();
      this.connectionMap.clear();

      console.log('[BunWebSocketServer] Server stopped');
    }
  }

  /**
   * Get the server port (if running).
   */
  getPort(): number | null {
    return this.server?.port ?? null;
  }
}
