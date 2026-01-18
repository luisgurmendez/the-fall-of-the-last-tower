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
export { InputHandler, type InputValidationResult, type PendingInput } from './network/InputHandler';
export { Vector, MOBAConfig, GameConfig, Side, EntityType, InputType, type ClientInput, type StateUpdate, type FullStateSnapshot, type ChampionDefinition, } from '@siege/shared';
//# sourceMappingURL=index.d.ts.map