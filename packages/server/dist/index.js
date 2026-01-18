/**
 * @siege/server
 *
 * Siege MOBA game server.
 * Handles authoritative game state, networking, and matchmaking.
 */
// Game management
export { ServerGame } from './game/ServerGame';
export { ServerGameContext } from './game/ServerGameContext';
export { GameRoom } from './game/GameRoom';
// Simulation
export { ServerEntity } from './simulation/ServerEntity';
export { ServerChampion } from './simulation/ServerChampion';
// Networking
export { InputHandler } from './network/InputHandler';
// Re-export shared types for convenience
export { Vector, MOBAConfig, GameConfig, EntityType, InputType, } from '@siege/shared';
console.log('[Siege Server] Module loaded');
//# sourceMappingURL=index.js.map