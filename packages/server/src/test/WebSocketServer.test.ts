/**
 * WebSocketServer Unit Tests
 *
 * Tests the WebSocket server connection management, message routing,
 * and broadcast functionality.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  WebSocketServer,
  type WebSocketConnection,
  type WebSocketServerConfig,
  type ParsedMessage,
  type ServerMessage,
} from '../network/WebSocketServer';
import { ClientMessageType, ServerMessageType } from '@siege/shared';

/**
 * Mock WebSocket connection for testing.
 */
class MockWebSocketConnection implements WebSocketConnection {
  id: string;
  playerId: string | null = null;
  gameId: string | null = null;
  private open = true;
  sentMessages: (ArrayBuffer | string)[] = [];
  closeCode?: number;
  closeReason?: string;

  constructor(id: string) {
    this.id = id;
  }

  send(data: ArrayBuffer | string): void {
    if (!this.open) {
      throw new Error('Connection is closed');
    }
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.open = false;
    this.closeCode = code;
    this.closeReason = reason;
  }

  isOpen(): boolean {
    return this.open;
  }
}

/**
 * Concrete implementation of WebSocketServer for testing.
 */
class TestWebSocketServer extends WebSocketServer {
  private started = false;
  private port = 0;

  async start(port: number): Promise<void> {
    this.port = port;
    this.started = true;
  }

  async stop(): Promise<void> {
    this.started = false;
    this.connections.clear();
  }

  isStarted(): boolean {
    return this.started;
  }

  getPort(): number {
    return this.port;
  }

  // Expose protected methods for testing
  simulateConnection(connection: WebSocketConnection): void {
    this.handleConnect(connection);
  }

  simulateMessage(connection: WebSocketConnection, message: ArrayBuffer | string): void {
    this.handleMessage(connection, message);
  }

  simulateDisconnect(connection: WebSocketConnection, code: number, reason: string): void {
    this.handleDisconnect(connection, code, reason);
  }

  // Expose protected methods for testing encoding/decoding
  testEncodeMessage(message: ServerMessage): string {
    return this.encodeMessage(message);
  }

  testDecodeMessage(rawMessage: ArrayBuffer | string): ParsedMessage {
    return this.decodeMessage(rawMessage);
  }
}

describe('WebSocketServer', () => {
  let server: TestWebSocketServer;

  beforeEach(() => {
    server = new TestWebSocketServer();
  });

  describe('Server Lifecycle', () => {
    it('should start on specified port', async () => {
      await server.start(3000);
      expect(server.isStarted()).toBe(true);
      expect(server.getPort()).toBe(3000);
    });

    it('should stop the server', async () => {
      await server.start(3000);
      await server.stop();
      expect(server.isStarted()).toBe(false);
    });

    it('should clear connections on stop', async () => {
      await server.start(3000);
      const conn = new MockWebSocketConnection('conn-1');
      server.simulateConnection(conn);

      expect(server.getConnectionCount()).toBe(1);

      await server.stop();
      expect(server.getConnectionCount()).toBe(0);
    });
  });

  describe('Connection Management', () => {
    it('should track new connections', () => {
      const conn = new MockWebSocketConnection('conn-1');
      server.simulateConnection(conn);

      expect(server.getConnectionCount()).toBe(1);
      expect(server.getConnection('conn-1')).toBe(conn);
    });

    it('should handle multiple connections', () => {
      const conn1 = new MockWebSocketConnection('conn-1');
      const conn2 = new MockWebSocketConnection('conn-2');
      const conn3 = new MockWebSocketConnection('conn-3');

      server.simulateConnection(conn1);
      server.simulateConnection(conn2);
      server.simulateConnection(conn3);

      expect(server.getConnectionCount()).toBe(3);
      expect(server.getAllConnections()).toHaveLength(3);
    });

    it('should remove connection on disconnect', () => {
      const conn = new MockWebSocketConnection('conn-1');
      server.simulateConnection(conn);

      expect(server.getConnectionCount()).toBe(1);

      server.simulateDisconnect(conn, 1000, 'Normal closure');
      expect(server.getConnectionCount()).toBe(0);
    });

    it('should return undefined for unknown connection', () => {
      expect(server.getConnection('unknown')).toBeUndefined();
    });
  });

  describe('Handler Registration', () => {
    it('should call connect handler on new connection', () => {
      let connectCalled = false;
      let connectedConn: WebSocketConnection | null = null;

      server.onConnect((conn) => {
        connectCalled = true;
        connectedConn = conn;
      });

      const conn = new MockWebSocketConnection('conn-1');
      server.simulateConnection(conn);

      expect(connectCalled).toBe(true);
      expect(connectedConn).toBe(conn);
    });

    it('should call disconnect handler on close', () => {
      let disconnectCalled = false;
      let disconnectedConn: WebSocketConnection | null = null;
      let receivedCode = 0;
      let receivedReason = '';

      server.onDisconnect((conn, code, reason) => {
        disconnectCalled = true;
        disconnectedConn = conn;
        receivedCode = code;
        receivedReason = reason;
      });

      const conn = new MockWebSocketConnection('conn-1');
      server.simulateConnection(conn);
      server.simulateDisconnect(conn, 1001, 'Going away');

      expect(disconnectCalled).toBe(true);
      expect(disconnectedConn).toBe(conn);
      expect(receivedCode).toBe(1001);
      expect(receivedReason).toBe('Going away');
    });

    it('should call message handler on incoming message', () => {
      let messageCalled = false;
      let receivedConn: WebSocketConnection | null = null;
      let receivedMessage: ParsedMessage | null = null;

      server.onMessage((conn, message) => {
        messageCalled = true;
        receivedConn = conn;
        receivedMessage = message;
      });

      const conn = new MockWebSocketConnection('conn-1');
      server.simulateConnection(conn);

      const testMessage = JSON.stringify({
        type: ClientMessageType.INPUT,
        data: { seq: 1 },
      });
      server.simulateMessage(conn, testMessage);

      expect(messageCalled).toBe(true);
      expect(receivedConn).toBe(conn);
      expect(receivedMessage?.type).toBe(ClientMessageType.INPUT);
    });
  });

  describe('Message Sending', () => {
    it('should send message to specific connection', () => {
      const conn = new MockWebSocketConnection('conn-1');
      server.simulateConnection(conn);

      const result = server.sendToConnection('conn-1', {
        type: ServerMessageType.PONG,
        data: { timestamp: 12345 },
      });

      expect(result).toBe(true);
      expect(conn.sentMessages).toHaveLength(1);

      const sent = JSON.parse(conn.sentMessages[0] as string);
      expect(sent.type).toBe(ServerMessageType.PONG);
      expect(sent.data.timestamp).toBe(12345);
    });

    it('should return false for unknown connection', () => {
      const result = server.sendToConnection('unknown', {
        type: ServerMessageType.PONG,
        data: {},
      });

      expect(result).toBe(false);
    });

    it('should return false for closed connection', () => {
      const conn = new MockWebSocketConnection('conn-1');
      server.simulateConnection(conn);
      conn.close();

      const result = server.sendToConnection('conn-1', {
        type: ServerMessageType.PONG,
        data: {},
      });

      expect(result).toBe(false);
    });
  });

  describe('Player and Game Filtering', () => {
    it('should get connection by player ID', () => {
      const conn = new MockWebSocketConnection('conn-1');
      conn.playerId = 'player-1';
      server.simulateConnection(conn);

      const found = server.getConnectionByPlayer('player-1');
      expect(found).toBe(conn);
    });

    it('should return undefined for unknown player', () => {
      const found = server.getConnectionByPlayer('unknown');
      expect(found).toBeUndefined();
    });

    it('should get connections by game ID', () => {
      const conn1 = new MockWebSocketConnection('conn-1');
      conn1.gameId = 'game-1';
      const conn2 = new MockWebSocketConnection('conn-2');
      conn2.gameId = 'game-1';
      const conn3 = new MockWebSocketConnection('conn-3');
      conn3.gameId = 'game-2';

      server.simulateConnection(conn1);
      server.simulateConnection(conn2);
      server.simulateConnection(conn3);

      const game1Conns = server.getConnectionsByGame('game-1');
      expect(game1Conns).toHaveLength(2);
      expect(game1Conns).toContain(conn1);
      expect(game1Conns).toContain(conn2);

      const game2Conns = server.getConnectionsByGame('game-2');
      expect(game2Conns).toHaveLength(1);
      expect(game2Conns).toContain(conn3);
    });

    it('should return empty array for unknown game', () => {
      const conns = server.getConnectionsByGame('unknown');
      expect(conns).toEqual([]);
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all connections in a game', () => {
      const conn1 = new MockWebSocketConnection('conn-1');
      conn1.gameId = 'game-1';
      const conn2 = new MockWebSocketConnection('conn-2');
      conn2.gameId = 'game-1';
      const conn3 = new MockWebSocketConnection('conn-3');
      conn3.gameId = 'game-2';

      server.simulateConnection(conn1);
      server.simulateConnection(conn2);
      server.simulateConnection(conn3);

      server.broadcastToGame('game-1', {
        type: ServerMessageType.STATE_UPDATE,
        data: { tick: 100 },
      });

      expect(conn1.sentMessages).toHaveLength(1);
      expect(conn2.sentMessages).toHaveLength(1);
      expect(conn3.sentMessages).toHaveLength(0);
    });

    it('should not send to closed connections in broadcast', () => {
      const conn1 = new MockWebSocketConnection('conn-1');
      conn1.gameId = 'game-1';
      const conn2 = new MockWebSocketConnection('conn-2');
      conn2.gameId = 'game-1';

      server.simulateConnection(conn1);
      server.simulateConnection(conn2);

      conn2.close();

      server.broadcastToGame('game-1', {
        type: ServerMessageType.STATE_UPDATE,
        data: { tick: 100 },
      });

      expect(conn1.sentMessages).toHaveLength(1);
      expect(conn2.sentMessages).toHaveLength(0);
    });
  });

  describe('Specialized Message Methods', () => {
    it('should send state update', () => {
      const conn = new MockWebSocketConnection('conn-1');
      conn.playerId = 'player-1';
      server.simulateConnection(conn);

      const update = {
        tick: 100,
        timestamp: Date.now(),
        gameTime: 60.5,
        inputAcks: {},
        deltas: [],
        events: [],
      };

      const result = server.sendStateUpdate('player-1', update);
      expect(result).toBe(true);

      const sent = JSON.parse(conn.sentMessages[0] as string);
      expect(sent.type).toBe(ServerMessageType.STATE_UPDATE);
      expect(sent.data.tick).toBe(100);
    });

    it('should send full state snapshot', () => {
      const conn = new MockWebSocketConnection('conn-1');
      conn.playerId = 'player-1';
      server.simulateConnection(conn);

      const snapshot = {
        tick: 100,
        timestamp: Date.now(),
        gameTime: 60.5,
        entities: [],
      };

      const result = server.sendFullState('player-1', snapshot);
      expect(result).toBe(true);

      const sent = JSON.parse(conn.sentMessages[0] as string);
      expect(sent.type).toBe(ServerMessageType.FULL_STATE);
    });

    it('should send game start message', () => {
      const conn = new MockWebSocketConnection('conn-1');
      conn.playerId = 'player-1';
      server.simulateConnection(conn);

      const result = server.sendGameStart('player-1', { tick: 0, gameTime: 0 });
      expect(result).toBe(true);

      const sent = JSON.parse(conn.sentMessages[0] as string);
      expect(sent.type).toBe(ServerMessageType.GAME_START);
    });

    it('should send game end message', () => {
      const conn = new MockWebSocketConnection('conn-1');
      conn.playerId = 'player-1';
      server.simulateConnection(conn);

      const result = server.sendGameEnd('player-1', { winningSide: 0, duration: 1800 });
      expect(result).toBe(true);

      const sent = JSON.parse(conn.sentMessages[0] as string);
      expect(sent.type).toBe(ServerMessageType.GAME_END);
    });

    it('should send error message', () => {
      const conn = new MockWebSocketConnection('conn-1');
      conn.playerId = 'player-1';
      server.simulateConnection(conn);

      const result = server.sendError('player-1', 'Invalid input');
      expect(result).toBe(true);

      const sent = JSON.parse(conn.sentMessages[0] as string);
      expect(sent.type).toBe(ServerMessageType.ERROR);
      expect(sent.data.error).toBe('Invalid input');
    });
  });

  describe('Message Encoding/Decoding', () => {
    it('should encode message as JSON string', () => {
      const message = {
        type: ServerMessageType.PONG,
        data: { timestamp: 12345 },
      };

      const encoded = server.testEncodeMessage(message);
      expect(typeof encoded).toBe('string');

      const parsed = JSON.parse(encoded);
      expect(parsed.type).toBe(ServerMessageType.PONG);
    });

    it('should decode string message', () => {
      const rawMessage = JSON.stringify({
        type: ClientMessageType.INPUT,
        data: { seq: 1 },
      });

      const decoded = server.testDecodeMessage(rawMessage);
      expect(decoded.type).toBe(ClientMessageType.INPUT);
    });

    it('should decode ArrayBuffer message', () => {
      const rawMessage = JSON.stringify({
        type: ClientMessageType.PING,
        data: { timestamp: 12345 },
      });

      const encoder = new TextEncoder();
      const buffer = encoder.encode(rawMessage).buffer;

      const decoded = server.testDecodeMessage(buffer);
      expect(decoded.type).toBe(ClientMessageType.PING);
    });
  });

  describe('Configuration', () => {
    it('should use default heartbeat interval', () => {
      const defaultServer = new TestWebSocketServer();
      // Access protected property through a workaround
      expect((defaultServer as any).heartbeatInterval).toBe(30000);
    });

    it('should use custom heartbeat interval', () => {
      const customServer = new TestWebSocketServer({ heartbeatInterval: 15000 });
      expect((customServer as any).heartbeatInterval).toBe(15000);
    });

    it('should set handlers via config', () => {
      let connectCalled = false;
      let messageCalled = false;
      let disconnectCalled = false;

      const configuredServer = new TestWebSocketServer({
        onConnect: () => { connectCalled = true; },
        onMessage: () => { messageCalled = true; },
        onDisconnect: () => { disconnectCalled = true; },
      });

      const conn = new MockWebSocketConnection('conn-1');
      configuredServer.simulateConnection(conn);
      configuredServer.simulateMessage(conn, JSON.stringify({ type: 1, data: {} }));
      configuredServer.simulateDisconnect(conn, 1000, 'Normal');

      expect(connectCalled).toBe(true);
      expect(messageCalled).toBe(true);
      expect(disconnectCalled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in message', () => {
      const conn = new MockWebSocketConnection('conn-1');
      server.simulateConnection(conn);

      // Should not throw
      expect(() => {
        server.simulateMessage(conn, 'not valid json {{{');
      }).not.toThrow();
    });

    it('should return false when send fails on closed connection', () => {
      const conn = new MockWebSocketConnection('conn-1');
      server.simulateConnection(conn);
      conn.close();

      const result = server.sendToConnection('conn-1', {
        type: ServerMessageType.PONG,
        data: {},
      });

      expect(result).toBe(false);
    });

    it('should return false for send to unknown player', () => {
      const result = server.sendToPlayer('unknown-player', {
        type: ServerMessageType.PONG,
        data: {},
      });

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid connect/disconnect', () => {
      for (let i = 0; i < 100; i++) {
        const conn = new MockWebSocketConnection(`conn-${i}`);
        server.simulateConnection(conn);
        server.simulateDisconnect(conn, 1000, 'Normal');
      }

      expect(server.getConnectionCount()).toBe(0);
    });

    it('should handle empty game ID filter', () => {
      const conn = new MockWebSocketConnection('conn-1');
      conn.gameId = '';
      server.simulateConnection(conn);

      const conns = server.getConnectionsByGame('');
      expect(conns).toHaveLength(1);
    });

    it('should handle null player ID in search', () => {
      const conn = new MockWebSocketConnection('conn-1');
      conn.playerId = null;
      server.simulateConnection(conn);

      // Should not throw when searching
      const found = server.getConnectionByPlayer('player-1');
      expect(found).toBeUndefined();
    });
  });
});
