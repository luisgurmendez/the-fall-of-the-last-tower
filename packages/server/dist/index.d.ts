/**
 * @siege/server
 *
 * Siege MOBA game server.
 * Handles authoritative game state, networking, and matchmaking.
 */
export { ServerGame, type ServerGameConfig } from './game/ServerGame';
export { ServerGameContext, type GameContextConfig } from './game/ServerGameContext';
export { GameRoom, type GameRoomConfig, type PlayerInfo, type GameRoomState } from './game/GameRoom';
export { ServerEntity, type ServerEntityConfig } from './simulation/ServerEntity';
export { ServerChampion, type ServerChampionConfig } from './simulation/ServerChampion';
export { ServerMinion, type ServerMinionConfig } from './simulation/ServerMinion';
export { ServerTower, type ServerTowerConfig } from './simulation/ServerTower';
export { ServerNavGrid, CELL_SIZE } from './navigation/ServerNavGrid';
export { FogOfWarServer, type VisionSource, type VisibilityResult } from './systems/FogOfWarServer';
export { InputHandler, type InputValidationResult, type PendingInput } from './network/InputHandler';
export { WebSocketServer, type WebSocketConnection, type WebSocketServerConfig, type MessageHandler, type ConnectionHandler, type DisconnectHandler, type ParsedMessage, type ServerMessage, } from './network/WebSocketServer';
export { BunWebSocketServer } from './network/BunWebSocketServer';
export { StateSerializer } from './network/StateSerializer';
export { GameRoomManager, type GameRoomManagerConfig } from './game/GameRoomManager';
export { Matchmaker, type MatchmakerConfig, type QueuedPlayer, type MatchResult } from './matchmaking/Matchmaker';
export { Vector, MOBAConfig, GameConfig, Side, EntityType, InputType, type ClientInput, type StateUpdate, type FullStateSnapshot, type ChampionDefinition, type MinionType, type LaneId, type TowerTier, type TowerLane, } from '@siege/shared';
//# sourceMappingURL=index.d.ts.map