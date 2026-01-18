/**
 * @siege/server
 *
 * Siege MOBA game server.
 * Handles authoritative game state, networking, and matchmaking.
 */

import { GameConfig, MOBAConfig, Vector } from '@siege/shared';

// Placeholder entry point - will be expanded in Phase 2
console.log('Siege Server starting...');
console.log('Server tick rate:', GameConfig.TICK.SERVER_TICK_RATE, 'Hz');
console.log('Map size:', MOBAConfig.MAP_SIZE.width, 'x', MOBAConfig.MAP_SIZE.height);
console.log('Blue spawn:', MOBAConfig.CHAMPION_SPAWN.BLUE.toString());

export { GameConfig, MOBAConfig };
