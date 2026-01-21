/**
 * @siege/server
 *
 * Siege MOBA game server.
 * Handles authoritative game state, networking, and matchmaking.
 */

// Game management
export { ServerGame, type ServerGameConfig } from './game/ServerGame';
export { ServerGameContext, type GameContextConfig } from './game/ServerGameContext';
export { GameRoom, type GameRoomConfig, type PlayerInfo, type GameRoomState } from './game/GameRoom';

// Simulation
export { ServerEntity, type ServerEntityConfig } from './simulation/ServerEntity';
export { ServerChampion, type ServerChampionConfig } from './simulation/ServerChampion';
export { ServerMinion, type ServerMinionConfig } from './simulation/ServerMinion';
export { ServerTower, type ServerTowerConfig } from './simulation/ServerTower';

// Navigation
export { ServerNavGrid, CELL_SIZE } from './navigation/ServerNavGrid';

// Systems
export { FogOfWarServer, type VisionSource, type VisibilityResult } from './systems/FogOfWarServer';

// Networking
export { InputHandler, type InputValidationResult, type PendingInput } from './network/InputHandler';
export {
  WebSocketServer,
  type WebSocketConnection,
  type WebSocketServerConfig,
  type MessageHandler,
  type ConnectionHandler,
  type DisconnectHandler,
  type ParsedMessage,
  type ServerMessage,
} from './network/WebSocketServer';
export { BunWebSocketServer } from './network/BunWebSocketServer';
export { StateSerializer } from './network/StateSerializer';

// Game Room Management
export { GameRoomManager, type GameRoomManagerConfig } from './game/GameRoomManager';

// Matchmaking
export { Matchmaker, type MatchmakerConfig, type QueuedPlayer, type MatchResult } from './matchmaking/Matchmaker';

// Re-export shared types for convenience
export {
  Vector,
  MOBAConfig,
  GameConfig,
  Side,
  EntityType,
  InputType,
  type ClientInput,
  type StateUpdate,
  type FullStateSnapshot,
  type ChampionDefinition,
  type MinionType,
  type LaneId,
  type TowerTier,
  type TowerLane,
} from '@siege/shared';

console.log('[Siege Server] Module loaded');
