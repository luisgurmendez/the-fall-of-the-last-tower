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
  isMapId,
  type MapId,
  type LobbyRequest,
} from '@siege/shared';

import { BunWebSocketServer } from './network/BunWebSocketServer';
import { GameRoomManager } from './game/GameRoomManager';
import { Matchmaker, type MatchResult } from './matchmaking/Matchmaker';
import type { PlayerInfo } from './game/GameRoom';
import { buildPracticeMatch, buildLobbyMatch, isPracticeTeamSize, type PracticeTeamSize } from './bots/practiceMatch';
import { LobbyManager, sanitizeName, type Lobby } from './game/LobbyManager';
import type { BotController } from './bots/BotController';
import type { WebSocketConnection, ParsedMessage } from './network/WebSocketServer';
import { Logger } from './utils/Logger';
import { initializeAbilityHandlers } from './abilities';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AccountStore, matchResults, type Account } from './accounts/AccountStore';
import { AccountRoutes } from './accounts/accountRoutes';

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || '8080', 10);
const PLAYERS_PER_TEAM = parseInt(process.env.PLAYERS_PER_TEAM || '1', 10); // 1v1 by default
/** Where accounts are kept (accounts.db; a volume on Fly) */
const DATA_DIR = process.env.DATA_DIR || './data';

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
/** Rooms where friends gather before a match */
const lobbies = new LobbyManager();

// Track connection to player mapping
const connectionToPlayer: Map<string, string> = new Map();
const playerToConnection: Map<string, WebSocketConnection> = new Map();

// Session token issued to each player on their first READY. Player IDs are
// visible to everyone in a match, so resuming a player ID (reconnect) requires
// the token that was issued to its owner.
const playerSessions: Map<string, string> = new Map();

/** Accounts (name, password, wins and losses) */
let accounts: AccountStore;
/** The account each player is signed in with (READY's accountToken); guests have none */
const playerAccounts: Map<string, Account> = new Map();

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

    case ClientMessageType.EVENT_ACK:
      handleEventAckMessage(connection, message.data as { lastEventId?: unknown });
      break;

    case ClientMessageType.DEBUG:
      handleDebugMessage(connection, message.data as { enabled?: unknown });
      break;

    case ClientMessageType.LOBBY:
      handleLobbyMessage(connection, message.data as LobbyRequest);
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

/** The client got reliable events up to this ID: stop resending them */
function handleEventAckMessage(connection: WebSocketConnection, data: { lastEventId?: unknown }): void {
  const playerId = connectionToPlayer.get(connection.id);
  if (!playerId || typeof data?.lastEventId !== 'number') return;
  roomManager.handleEventAck(playerId, data.lastEventId);
}

/**
 * Something about the player's room: a new champion, the other side, the
 * host's settings, starting the match, leaving.
 */
function handleLobbyMessage(connection: WebSocketConnection, request: LobbyRequest): void {
  const playerId = connectionToPlayer.get(connection.id);
  if (!playerId || typeof request !== 'object' || request === null) return;

  switch (request.action) {
    case 'update': {
      if (typeof request.championId !== 'string' || !CHAMPION_DEFINITIONS.has(request.championId)) return;
      const spells = request.summonerSpells ? parseSummonerSpells(request.summonerSpells) : undefined;
      broadcastLobby(lobbies.update(playerId, request.championId, spells));
      break;
    }
    case 'switch_side':
      broadcastLobby(lobbies.switchSide(playerId));
      break;
    case 'settings':
      broadcastLobby(lobbies.settings(playerId, { mapId: request.mapId, teamSize: request.teamSize }));
      break;
    case 'leave': {
      const lobby = lobbies.leave(playerId);
      wsServer.sendToPlayer(playerId, { type: ServerMessageType.LOBBY_STATE, data: { code: null } });
      broadcastLobby(lobby);
      break;
    }
    case 'start':
      startLobbyMatch(playerId);
      break;
  }
}

/** Tell each player in the room its state */
function broadcastLobby(lobby: Lobby | null): void {
  if (!lobby) return;
  const state = LobbyManager.stateOf(lobby);
  for (const member of lobby.members) {
    wsServer.sendToPlayer(member.playerId, { type: ServerMessageType.LOBBY_STATE, data: state });
  }
}

/** The host starts their room's match: its players, and bots in the empty slots */
function startLobbyMatch(hostId: string): void {
  const lobby = lobbies.start(hostId);
  if (!lobby) return;
  const { players, bots } = buildLobbyMatch({
    humans: lobby.members,
    teamSize: lobby.teamSize,
    champions: [...CHAMPION_DEFINITIONS.keys()],
    matchId: lobby.code,
  });
  Logger.server.info(`Room ${lobby.code} starts on ${lobby.mapId}: ${players.map(p => `${p.playerId} (${p.championId})`).join(', ')}`);
  startMatch(players, bots, lobby.mapId);
}

/** Turn the player's debug overlay on or off (practice matches only) */
function handleDebugMessage(connection: WebSocketConnection, data: { enabled?: unknown }): void {
  const playerId = connectionToPlayer.get(connection.id);
  if (!playerId) return;
  const enabled = data?.enabled === true;
  if (!roomManager.setDebug(playerId, enabled) && enabled) {
    wsServer.sendToConnection(connection.id, {
      type: ServerMessageType.DEBUG_STATE,
      data: { tick: 0, gameTime: 0, units: [], unavailable: true },
    });
  }
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
  mode?: 'queue' | 'practice' | 'lobby';
  /** Champion for the practice bot (defaults to the player's champion) */
  botChampionId?: string;
  /** Players per team in practice: 1 (a bot in mid), 3 or 5 (bots in every role) */
  practiceSize?: number;
  /** The map for a practice match (maps.ts; default the main map). The Narrows is always 1v1 */
  mapId?: unknown;
  /** 'lobby' mode: make a room, or join one by its code */
  lobby?: { create?: boolean; code?: string };
  /** The player's name, shown in rooms (an account's name wins) */
  name?: unknown;
  /** The token of the account they're signed in with (POST /api/login) */
  accountToken?: unknown;
  /** Summoner spells picked in champion select (D, F) */
  summonerSpells?: unknown;
}

function handleReadyMessage(connection: WebSocketConnection, data: ReadyMessageData): void {
  const { playerId, championId = 'warrior', sessionToken, mode = 'queue', botChampionId, practiceSize, mapId } = data ?? {};
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

  // Signed in: their account's name, and their results count
  const account = accounts.accountForToken(data.accountToken);
  if (account) playerAccounts.set(playerId, account);
  else playerAccounts.delete(playerId);
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
          yourPlayerId: playerId,
          players: room.getPlayersWithEntityIds(),
          mapId: room.mapId,
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

  if (mode === 'lobby') {
    const player = { playerId, name: account?.name ?? sanitizeName(data.name), championId, summonerSpells };
    const lobby = typeof data.lobby?.code === 'string' && !data.lobby.create
      ? lobbies.join(data.lobby.code, player)
      : lobbies.create(player);
    if (typeof lobby === 'string') {
      wsServer.sendToConnection(connection.id, { type: ServerMessageType.ERROR, data: { error: lobby } });
      return;
    }
    broadcastLobby(lobby);
    return;
  }

  // Any other mode leaves the room the player was in
  broadcastLobby(lobbies.leave(playerId));

  if (mode === 'practice') {
    const map = isMapId(mapId) ? mapId : 'vale';
    // The Narrows has a single lane: always a duel
    const teamSize = map === 'narrows' ? 1 : isPracticeTeamSize(practiceSize) ? practiceSize : 1;
    startPracticeMatch(playerId, championId, summonerSpells, botChampionId, teamSize, map);
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
    // Remove from matchmaking if queued, and from their room
    matchmaker.removeFromQueue(playerId);
    broadcastLobby(lobbies.leave(playerId));

    // Notify game room of disconnect (but keep player in game for reconnect)
    roomManager.handleDisconnect(playerId);

    // Clean up mappings
    connectionToPlayer.delete(connection.id);
    playerToConnection.delete(playerId);

    // Keep the session (and the account it played with) only while there's a game to reconnect to
    if (!roomManager.isPlayerInGame(playerId)) {
      playerSessions.delete(playerId);
      playerAccounts.delete(playerId);
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
  mapId: MapId,
): void {
  const { players, bots } = buildPracticeMatch({
    playerId,
    championId,
    summonerSpells,
    teamSize,
    champions: [...CHAMPION_DEFINITIONS.keys()],
    botChampionId: typeof botChampionId === 'string' && CHAMPION_DEFINITIONS.has(botChampionId) ? botChampionId : undefined,
  });
  Logger.server.info(`Practice ${teamSize}v${teamSize} on ${mapId}: ${players.map(p => `${p.playerId} (${p.championId})`).join(', ')}`);
  startMatch(players, bots, mapId, { allowDebug: true, practice: true });
}

function startMatch(
  players: PlayerInfo[],
  bots: BotController[] = [],
  mapId: MapId = 'vale',
  options: { allowDebug?: boolean; practice?: boolean } = {},
): void {
  // Signed-in players play under their account's name (rooms already named everyone)
  players = players.map(player => {
    const name = player.name ?? (player.isBot ? undefined : playerAccounts.get(player.playerId)?.name);
    return name === undefined ? player : { ...player, name };
  });

  // Create the game room
  const room = roomManager.createRoom(players, bots, mapId, options);
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
        yourPlayerId: player.playerId,
        players: playersWithEntityIds,
        mapId,
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
  // Accounts, kept in DATA_DIR
  mkdirSync(DATA_DIR, { recursive: true });
  accounts = new AccountStore(join(DATA_DIR, 'accounts.db'));
  const accountRoutes = new AccountRoutes(accounts);
  Logger.server.info(`Accounts kept in ${join(DATA_DIR, 'accounts.db')}`);

  wsServer = new BunWebSocketServer({
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
    getMetrics: getServerMetrics,
    // The built client (vite build's dist/), served from the same address in production
    staticDir: process.env.STATIC_DIR,
    // POST /api/register, /api/login, /api/logout; GET /api/me
    httpHandler: (request, clientIp) => accountRoutes.handle(request, clientIp),
  });

  // Initialize game room manager
  roomManager = new GameRoomManager({
    championDefinitions: CHAMPION_DEFINITIONS,
    onStateUpdate: handleStateUpdate,
    onFullState: handleFullState,
    onDebugState: (playerId, data) => {
      wsServer.sendToPlayer(playerId, { type: ServerMessageType.DEBUG_STATE, data });
    },
    onGameEnd: (gameId, winningSide) => {
      Logger.game.info(`Game ended: ${gameId} - Winner: ${winningSide === 0 ? 'Blue' : 'Red'}`);

      // Notify players
      const room = roomManager.getRoom(gameId);
      // Wins and losses for the accounts in it (not against bots in practice)
      if (room && !room.isPractice()) {
        for (const { accountId, won } of matchResults(room.getPlayersWithEntityIds(), id => playerAccounts.get(id)?.id, winningSide)) {
          accounts.recordResult(accountId, won);
        }
      }
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
