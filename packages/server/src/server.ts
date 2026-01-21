/**
 * Siege Game Server - Main Entry Point
 *
 * Starts the WebSocket server, matchmaking, and game room management.
 *
 * Usage:
 *   bun run src/server.ts
 *   or
 *   bun run start
 */

import {
  ClientMessageType,
  ServerMessageType,
  type ClientInput,
  type ChampionDefinition,
  type StateUpdate,
  type FullStateSnapshot,
  CHAMPION_DEFINITIONS as CHAMPION_REGISTRY,
} from '@siege/shared';

import { BunWebSocketServer } from './network/BunWebSocketServer';
import { GameRoomManager } from './game/GameRoomManager';
import { Matchmaker, type MatchResult } from './matchmaking/Matchmaker';
import type { WebSocketConnection, ParsedMessage } from './network/WebSocketServer';

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || '8080', 10);
const PLAYERS_PER_TEAM = parseInt(process.env.PLAYERS_PER_TEAM || '1', 10); // 1v1 by default

// ============================================================================
// Champion Definitions (loaded from shared registry)
// ============================================================================

const CHAMPION_DEFINITIONS: Map<string, ChampionDefinition> = new Map(
  Object.entries(CHAMPION_REGISTRY)
);

// DEBUG: Log loaded champion definitions
console.log('[Server] Loaded champion definitions:');
console.log(`[Server] CHAMPION_REGISTRY keys: ${Object.keys(CHAMPION_REGISTRY)}`);
console.log(`[Server] CHAMPION_DEFINITIONS size: ${CHAMPION_DEFINITIONS.size}`);
for (const [id, def] of CHAMPION_DEFINITIONS.entries()) {
  console.log(`  - KEY="${id}" => id="${def.id}", name="${def.name}", class="${def.class}", Q="${def.abilities.Q}"`);
}

// Validate that definitions look correct
if (CHAMPION_DEFINITIONS.size === 0) {
  console.error('[Server] ERROR: No champion definitions loaded!');
}

const warrior = CHAMPION_DEFINITIONS.get('warrior');
if (!warrior) {
  console.error('[Server] ERROR: warrior champion not found!');
} else if (warrior.name !== 'Kael') {
  console.error(`[Server] ERROR: warrior.name is "${warrior.name}" instead of "Kael"!`);
}
if (warrior && warrior.abilities.Q !== 'warrior_slash') {
  console.error(`[Server] ERROR: warrior.abilities.Q is "${warrior.abilities.Q}" instead of "warrior_slash"!`);
}

// ============================================================================
// Server State
// ============================================================================

let wsServer: BunWebSocketServer;
let roomManager: GameRoomManager;
let matchmaker: Matchmaker;

// Track connection to player mapping
const connectionToPlayer: Map<string, string> = new Map();
const playerToConnection: Map<string, WebSocketConnection> = new Map();

// ============================================================================
// Message Handlers
// ============================================================================

function handleMessage(connection: WebSocketConnection, message: ParsedMessage): void {
  switch (message.type) {
    case ClientMessageType.INPUT:
      handleInputMessage(connection, message.data as ClientInput);
      break;

    case ClientMessageType.PING:
      handlePingMessage(connection, message.data as { timestamp: number });
      break;

    case ClientMessageType.READY:
      handleReadyMessage(connection, message.data as { playerId: string; championId?: string });
      break;

    default:
      console.warn(`[Server] Unknown message type: ${message.type}`);
  }
}

function handleInputMessage(connection: WebSocketConnection, input: ClientInput): void {
  const playerId = connectionToPlayer.get(connection.id);
  if (!playerId) {
    console.warn(`[Server] Input from unregistered connection ${connection.id}`);
    return;
  }

  roomManager.handleInput(playerId, input);
}

function handlePingMessage(connection: WebSocketConnection, data: { timestamp: number }): void {
  wsServer.sendToConnection(connection.id, {
    type: ServerMessageType.PONG,
    data: {
      clientTimestamp: data.timestamp,
      serverTimestamp: Date.now(),
    },
  });
}

function handleReadyMessage(connection: WebSocketConnection, data: { playerId: string; championId?: string }): void {
  console.log(`[Server] handleReadyMessage: playerId="${data.playerId}", raw championId="${data.championId}"`);
  const { playerId, championId = 'warrior' } = data;
  console.log(`[Server] After destructuring: playerId="${playerId}", championId="${championId}"`);

  // Register player
  connectionToPlayer.set(connection.id, playerId);
  playerToConnection.set(playerId, connection);
  connection.playerId = playerId;

  console.log(`[Server] Player ${playerId} registered (connection ${connection.id})`);

  // Check if player is reconnecting to an existing game
  if (roomManager.isPlayerInGame(playerId)) {
    const gameId = roomManager.getGameIdByPlayer(playerId);
    connection.gameId = gameId || null;

    console.log(`[Server] Player ${playerId} reconnecting to game ${gameId}`);
    const snapshot = roomManager.handleReconnect(playerId);

    if (snapshot) {
      wsServer.sendToConnection(connection.id, {
        type: ServerMessageType.FULL_STATE,
        data: snapshot,
      });
    }
    return;
  }

  // Add to matchmaking queue
  matchmaker.addToQueue(playerId, championId);

  // Send queue position
  wsServer.sendToConnection(connection.id, {
    type: ServerMessageType.EVENT,
    data: {
      event: 'queue_joined',
      position: matchmaker.getQueuePosition(playerId),
      queueSize: matchmaker.getQueueSize(),
    },
  });
}

// ============================================================================
// Connection Handlers
// ============================================================================

function handleConnect(connection: WebSocketConnection): void {
  console.log(`[Server] New connection: ${connection.id}`);
}

function handleDisconnect(connection: WebSocketConnection, code: number, reason: string): void {
  const playerId = connectionToPlayer.get(connection.id);

  if (playerId) {
    // Remove from matchmaking if queued
    matchmaker.removeFromQueue(playerId);

    // Notify game room of disconnect (but keep player in game for reconnect)
    roomManager.handleDisconnect(playerId);

    // Clean up mappings
    connectionToPlayer.delete(connection.id);
    playerToConnection.delete(playerId);
  }

  console.log(`[Server] Connection ${connection.id} disconnected (${code}: ${reason})`);
}

// ============================================================================
// Match Handler
// ============================================================================

function handleMatchFound(match: MatchResult): void {
  // Create the game room
  const room = roomManager.createRoom(match.players);
  const gameId = room.getState() === 'waiting' ? room.gameId : null;

  if (!gameId) {
    console.error('[Server] Failed to create game room');
    return;
  }

  // Update connection game IDs
  for (const player of match.players) {
    const connection = playerToConnection.get(player.playerId);
    if (connection) {
      connection.gameId = gameId;
    }
  }

  // Start the game first to spawn champions and get entity IDs
  room.start();

  // Get players with their entity IDs
  const playersWithEntityIds = room.getPlayersWithEntityIds();

  // Send game start to all players, followed immediately by full state
  for (const player of match.players) {
    // Send game start notification
    wsServer.sendToPlayer(player.playerId, {
      type: ServerMessageType.GAME_START,
      data: {
        gameId,
        tick: 0,
        gameTime: 0,
        yourSide: player.side,
        players: playersWithEntityIds,
      },
    });

    // Send initial full state so entities appear immediately
    const initialState = room.getInitialState(player.playerId);
    wsServer.sendToPlayer(player.playerId, {
      type: ServerMessageType.FULL_STATE,
      data: initialState,
    });
  }

  console.log(`[Server] Game ${gameId} started with players:`, playersWithEntityIds);
}

// ============================================================================
// State Update Handler
// ============================================================================

function handleStateUpdate(playerId: string, update: StateUpdate): void {
  wsServer.sendToPlayer(playerId, {
    type: ServerMessageType.STATE_UPDATE,
    data: update,
  });
}

function handleFullState(playerId: string, snapshot: FullStateSnapshot): void {
  wsServer.sendToPlayer(playerId, {
    type: ServerMessageType.FULL_STATE,
    data: snapshot,
  });
}

// ============================================================================
// Server Startup
// ============================================================================

async function startServer(): Promise<void> {
  console.log('========================================');
  console.log('       SIEGE GAME SERVER - MVP');
  console.log('========================================');
  console.log('');

  // Initialize WebSocket server
  wsServer = new BunWebSocketServer({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
  });

  // Initialize game room manager
  roomManager = new GameRoomManager({
    championDefinitions: CHAMPION_DEFINITIONS,
    onStateUpdate: handleStateUpdate,
    onFullState: handleFullState,
    onGameEnd: (gameId, winningSide) => {
      console.log(`[Server] Game ${gameId} ended. Winner: ${winningSide === 0 ? 'Blue' : 'Red'}`);

      // Notify players
      const room = roomManager.getRoom(gameId);
      if (room) {
        for (const playerId of room.getPlayerIds()) {
          wsServer.sendToPlayer(playerId, {
            type: ServerMessageType.GAME_END,
            data: { winningSide, duration: room.getGameTime() },
          });
        }
      }
    },
  });

  // Initialize matchmaker
  matchmaker = new Matchmaker({
    playersPerTeam: PLAYERS_PER_TEAM,
    onMatchFound: handleMatchFound,
  });

  // Start periodic cleanup
  setInterval(() => {
    matchmaker.cleanupTimedOut();
  }, 60000); // Every minute

  // Start the WebSocket server
  await wsServer.start(PORT);

  console.log('');
  console.log(`Server running on port ${PORT}`);
  console.log(`Match mode: ${PLAYERS_PER_TEAM}v${PLAYERS_PER_TEAM}`);
  console.log('');
  console.log('To connect:');
  console.log(`  WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`  Health:    http://localhost:${PORT}/health`);
  console.log('');
  console.log('Waiting for players...');
  console.log('');
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down...');

  roomManager.shutdown();
  await wsServer.stop();

  console.log('[Server] Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Server] Received SIGTERM, shutting down...');

  roomManager.shutdown();
  await wsServer.stop();

  process.exit(0);
});

// ============================================================================
// Start
// ============================================================================

startServer().catch(error => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
