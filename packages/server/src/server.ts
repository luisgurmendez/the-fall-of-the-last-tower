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
  parseSummonerSpells,
  type SummonerSpellId,
} from '@siege/shared';

import { BunWebSocketServer } from './network/BunWebSocketServer';
import { GameRoomManager } from './game/GameRoomManager';
import { Matchmaker, type MatchResult } from './matchmaking/Matchmaker';
import type { PlayerInfo } from './game/GameRoom';
import { buildPracticeMatch, isPracticeTeamSize, type PracticeTeamSize } from './bots/practiceMatch';
import type { BotController } from './bots/BotController';
import type { WebSocketConnection, ParsedMessage } from './network/WebSocketServer';
import { Logger } from './utils/Logger';
import { initializeAbilityHandlers } from './abilities';

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

// Validate champion definitions on startup
if (CHAMPION_DEFINITIONS.size === 0) {
  Logger.server.error('No champion definitions loaded!');
} else {
  Logger.server.info(`Loaded ${CHAMPION_DEFINITIONS.size} champions: ${Array.from(CHAMPION_DEFINITIONS.keys()).join(', ')}`);
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

// Session token issued to each player on their first READY. Player IDs are
// visible to everyone in a match, so resuming a player ID (reconnect) requires
// the token that was issued to its owner.
const playerSessions: Map<string, string> = new Map();

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
      handleReadyMessage(connection, message.data as ReadyMessageData);
      break;

    default:
      Logger.server.warn(`Unknown message type: ${message.type}`);
  }
}

function handleInputMessage(connection: WebSocketConnection, input: ClientInput): void {
  const playerId = connectionToPlayer.get(connection.id);
  if (!playerId) {
    Logger.server.warn(`Input from unregistered connection: ${connection.id}`);
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

interface ReadyMessageData {
  playerId: string;
  championId?: string;
  sessionToken?: string;
  /** 'practice' starts a match against a bot right away instead of queueing */
  mode?: 'queue' | 'practice';
  /** Champion for the practice bot (defaults to the player's champion) */
  botChampionId?: string;
  /** Players per team in practice: 1 (a bot in mid), 3 or 5 (bots in every role) */
  practiceSize?: number;
  /** Summoner spells picked in champion select (D, F) */
  summonerSpells?: unknown;
}

function handleReadyMessage(connection: WebSocketConnection, data: ReadyMessageData): void {
  const { playerId, championId = 'warrior', sessionToken, mode = 'queue', botChampionId, practiceSize } = data ?? {};
  const summonerSpells = parseSummonerSpells(data?.summonerSpells);
  if (typeof playerId !== 'string' || playerId.length === 0) {
    Logger.server.warn(`READY without a valid playerId from ${connection.id}`);
    return;
  }

  if (typeof championId !== 'string' || !CHAMPION_DEFINITIONS.has(championId)) {
    Logger.server.warn(`READY with unknown champion "${championId}" from ${connection.id}`);
    wsServer.sendToConnection(connection.id, {
      type: ServerMessageType.ERROR,
      data: { error: 'unknown_champion' },
    });
    return;
  }

  const existingToken = playerSessions.get(playerId);
  if (existingToken !== undefined && sessionToken !== existingToken) {
    Logger.server.warn(`Rejected READY for ${playerId} from ${connection.id}: invalid session token`);
    wsServer.sendToConnection(connection.id, {
      type: ServerMessageType.ERROR,
      data: { error: 'invalid_session' },
    });
    return;
  }

  if (existingToken === undefined) {
    const token = crypto.randomUUID();
    playerSessions.set(playerId, token);
    wsServer.sendToConnection(connection.id, {
      type: ServerMessageType.EVENT,
      data: { event: 'session', sessionToken: token },
    });
  }

  // Drop the mapping for a previous connection of this player so it can no
  // longer send inputs, and so its later close doesn't disconnect the player
  const previousConnection = playerToConnection.get(playerId);
  if (previousConnection && previousConnection.id !== connection.id) {
    connectionToPlayer.delete(previousConnection.id);
  }

  // Register player
  connectionToPlayer.set(connection.id, playerId);
  playerToConnection.set(playerId, connection);
  connection.playerId = playerId;

  Logger.server.info(`Player joined: ${playerId} (champion: ${championId})`);

  // Check if player is reconnecting to an existing game
  if (roomManager.isPlayerInGame(playerId)) {
    const gameId = roomManager.getGameIdByPlayer(playerId);
    connection.gameId = gameId || null;

    Logger.server.info(`Player reconnecting: ${playerId} -> game ${gameId}`);

    // A reloaded client is back in the menu and only enters a game on GAME_START
    const room = roomManager.getRoomByPlayer(playerId);
    if (room && gameId) {
      wsServer.sendToConnection(connection.id, {
        type: ServerMessageType.GAME_START,
        data: {
          gameId,
          tick: 0,
          gameTime: room.getGameTime(),
          yourSide: room.getPlayerSide(playerId),
          players: room.getPlayersWithEntityIds(),
        },
      });
    }

    const snapshot = roomManager.handleReconnect(playerId);

    if (snapshot) {
      wsServer.sendToConnection(connection.id, {
        type: ServerMessageType.FULL_STATE,
        data: snapshot,
      });
    }
    return;
  }

  if (mode === 'practice') {
    startPracticeMatch(playerId, championId, summonerSpells, botChampionId, isPracticeTeamSize(practiceSize) ? practiceSize : 1);
    return;
  }

  // Add to matchmaking queue
  matchmaker.addToQueue(playerId, championId, summonerSpells);

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
  Logger.server.debug(`New connection: ${connection.id}`);
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

    // Keep the session only while there's a game to reconnect to
    if (!roomManager.isPlayerInGame(playerId)) {
      playerSessions.delete(playerId);
    }
  }

  Logger.server.info(`Player disconnected: ${playerId || 'unknown'} (code: ${code})`);
}

// ============================================================================
// Match Handler
// ============================================================================

function handleMatchFound(match: MatchResult): void {
  startMatch(match.players);
}

/**
 * Start a practice match: the player in mid on blue, bots in every other
 * role (practiceMatch.ts).
 */
function startPracticeMatch(
  playerId: string,
  championId: string,
  summonerSpells: SummonerSpellId[],
  botChampionId: string | undefined,
  teamSize: PracticeTeamSize,
): void {
  const { players, bots } = buildPracticeMatch({
    playerId,
    championId,
    summonerSpells,
    teamSize,
    champions: [...CHAMPION_DEFINITIONS.keys()],
    botChampionId: typeof botChampionId === 'string' && CHAMPION_DEFINITIONS.has(botChampionId) ? botChampionId : undefined,
  });
  Logger.server.info(`Practice ${teamSize}v${teamSize}: ${players.map(p => `${p.playerId} (${p.championId})`).join(', ')}`);
  startMatch(players, bots);
}

function startMatch(players: PlayerInfo[], bots: BotController[] = []): void {
  // Create the game room
  const room = roomManager.createRoom(players, bots);
  const gameId = room.getState() === 'waiting' ? room.gameId : null;

  if (!gameId) {
    Logger.server.error('Failed to create game room');
    return;
  }

  const humans = players.filter(player => !player.isBot);

  // Update connection game IDs
  for (const player of humans) {
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
  for (const player of humans) {
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

  const playerNames = playersWithEntityIds.map(p => `${p.playerId}(${p.championId})`).join(' vs ');
  Logger.game.info(`Game started: ${gameId} - ${playerNames}`);
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
// Metrics
// ============================================================================

function getServerMetrics() {
  const roomStats = roomManager.getStats();
  const gameMetrics = roomManager.getAllMetrics();

  return {
    server: {
      uptime: process.uptime(),
      connections: wsServer.getConnectionCount(),
      queueSize: matchmaker.getQueueSize(),
    },
    rooms: roomStats,
    games: gameMetrics,
  };
}

function logMetricsSummary() {
  const metrics = getServerMetrics();

  if (metrics.games.length === 0) {
    return; // No active games, skip logging
  }

  for (const game of metrics.games) {
    const m = game.metrics;
    const tickMs = m.tickBudgetMs;

    console.log(`[METRICS] Game ${game.gameId}:`);
    console.log(`  Tick: avg=${m.tickDuration.avg.toFixed(2)}ms, p95=${m.tickDuration.p95.toFixed(2)}ms, max=${m.tickDuration.max.toFixed(2)}ms (budget: ${tickMs.toFixed(2)}ms)`);
    console.log(`  Budget: ${m.budget.utilizationPercent.toFixed(1)}% util, ${m.budget.overruns} overruns (${m.budget.overrunPercent.toFixed(2)}%)`);
    console.log(`  Jitter: avg=${m.jitter.avg.toFixed(2)}ms, max=${m.jitter.max.toFixed(2)}ms`);
    console.log(`  Memory: ${(m.memory.currentHeapBytes / 1024 / 1024).toFixed(1)}MB heap`);
  }
}

// ============================================================================
// Server Startup
// ============================================================================

async function startServer(): Promise<void> {
  console.log('');
  console.log('  ⚔️  SIEGE GAME SERVER');
  console.log('');

  // Initialize ability handlers
  initializeAbilityHandlers();
  Logger.server.info('Ability handlers initialized');

  // Initialize WebSocket server with metrics callback
  wsServer = new BunWebSocketServer({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    getMetrics: getServerMetrics,
  });

  // Initialize game room manager
  roomManager = new GameRoomManager({
    championDefinitions: CHAMPION_DEFINITIONS,
    onStateUpdate: handleStateUpdate,
    onFullState: handleFullState,
    onGameEnd: (gameId, winningSide) => {
      Logger.game.info(`Game ended: ${gameId} - Winner: ${winningSide === 0 ? 'Blue' : 'Red'}`);

      // Notify players
      const room = roomManager.getRoom(gameId);
      if (room) {
        for (const playerId of room.getHumanPlayerIds()) {
          wsServer.sendToPlayer(playerId, {
            type: ServerMessageType.GAME_END,
            data: { winningSide, duration: room.getGameTime(), players: room.getFinalStats() },
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

  // Start periodic metrics logging (every 5 seconds)
  setInterval(() => {
    logMetricsSummary();
  }, 5000);

  // Start the WebSocket server
  await wsServer.start(PORT);

  Logger.server.info(`Server started on port ${PORT} (${PLAYERS_PER_TEAM}v${PLAYERS_PER_TEAM} mode)`);
  console.log(`  WebSocket: ws://localhost:${PORT}/ws`);
  console.log('');
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on('SIGINT', async () => {
  Logger.server.info('Shutting down...');
  roomManager.shutdown();
  await wsServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  Logger.server.info('Received SIGTERM, shutting down...');
  roomManager.shutdown();
  await wsServer.stop();
  process.exit(0);
});

// ============================================================================
// Start
// ============================================================================

startServer().catch(error => {
  Logger.server.error('Failed to start:', error);
  process.exit(1);
});
