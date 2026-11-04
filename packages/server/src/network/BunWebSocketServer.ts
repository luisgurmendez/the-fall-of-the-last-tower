// @ts-nocheck - This file uses Bun-specific APIs that are only available in Bun runtime
/**
 * BunWebSocketServer - Concrete WebSocket server implementation using Bun.
 *
 * Uses Bun's native high-performance WebSocket support.
 * Handles connection management, message routing, and broadcasting.
 */

import { join, resolve, sep } from 'node:path';
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
 * Messages from this size up are compressed (permessage-deflate, for clients
 * that support it: every browser). Smaller ones, like PONG, go as they are:
 * compressing them saves nothing and a pong should be quick.
 */
const COMPRESS_MIN_BYTES = 256;

/**
 * Concrete implementation of WebSocketConnection for Bun.
 */
class BunConnection implements WebSocketConnection {
  id: string;
  playerId: string | null = null;
  gameId: string | null = null;

  private ws: { send: (data: string | ArrayBuffer, compress?: boolean) => void; close: (code?: number, reason?: string) => void };
  private open = true;

  constructor(id: string, ws: any) {
    this.id = id;
    this.ws = ws;
  }

  send(data: ArrayBuffer | string): void {
    if (!this.open) return;
    try {
      const size = typeof data === 'string' ? data.length : data.byteLength;
      this.ws.send(data, size >= COMPRESS_MIN_BYTES);
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

  private readonly staticDir?: string;
  private readonly httpHandler?: WebSocketServerConfig['httpHandler'];

  constructor(config: WebSocketServerConfig = {}) {
    super(config);
    this.staticDir = config.staticDir;
    this.httpHandler = config.httpHandler;
  }

  /**
   * Start the WebSocket server on the specified port.
   */
  async start(port: number): Promise<void> {
    const self = this;
    const staticDir = this.staticDir ? resolve(this.staticDir) : null;

    this.server = Bun.serve({
      port,
      async fetch(req, server) {
        // Handle WebSocket upgrade
        const url = new URL(req.url);

        // The game's socket; '/' too when no client is served here (local development)
        if (url.pathname === '/ws' || (url.pathname === '/' && !staticDir)) {
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

        // Metrics endpoint
        if (url.pathname === '/metrics') {
          const metrics = self.getMetricsHandler?.() ?? { error: 'No metrics available' };
          return new Response(JSON.stringify(metrics, null, 2), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // The accounts' API (and anything else the server answers over HTTP).
        // Behind Fly's proxy the caller's address is in Fly-Client-IP
        if (self.httpHandler) {
          const clientIp = req.headers.get('Fly-Client-IP') ?? server.requestIP(req)?.address ?? 'unknown';
          const response = await self.httpHandler(req, clientIp);
          if (response) return response;
        }

        if (staticDir) return serveStatic(staticDir, url.pathname);

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
        // One compressor for every socket, each message on its own. A 5v5
        // state update goes about 5x smaller. Bun's per-socket compressors
        // ('dedicated', '32KB', ...), which keep context across messages,
        // compressed these less (3.6-3.9x) and take memory per socket.
        perMessageDeflate: { compress: 'shared', decompress: 'shared' },
      },
    });

    console.log(`[BunWebSocketServer] Listening on port ${port}`);
    console.log(`[BunWebSocketServer] WebSocket endpoint: ws://localhost:${port}/ws`);
    console.log(`[BunWebSocketServer] Health check: http://localhost:${port}/health`);
    console.log(`[BunWebSocketServer] Metrics: http://localhost:${port}/metrics`);
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

/**
 * A file of the built client: `/` is index.html; paths can't leave the
 * folder. Vite's hashed assets are cached for a long time, the pages not.
 */
async function serveStatic(root: string, pathname: string): Promise<Response> {
  const relative = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const path = resolve(join(root, relative));
  if (path !== root && !path.startsWith(root + sep)) return new Response('Not found', { status: 404 });
  const file = Bun.file(path);
  if (!(await file.exists())) return new Response('Not found', { status: 404 });
  const hashed = relative.startsWith('/assets/') && /-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(relative);
  return new Response(file, {
    headers: { 'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' },
  });
}
