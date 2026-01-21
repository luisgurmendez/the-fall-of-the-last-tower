/**
 * @siege/shared
 *
 * Shared types, math utilities, and configuration for the Siege MOBA.
 * This package is used by both the client and server.
 */
// Math utilities
export { Vector } from './math/Vector';
export { Rectangle, Circle, Square, NullShape } from './math/shapes';
// Type definitions
export * from './types';
// Configuration
export { MOBAConfig, GameConfig, calculateBushGroupBounds, calculateIndividualBushPositions, isPointInBushGroup } from './config';
// Utility functions
export * from './utils';
// Champion registry
export * from './champions';
// Ability registry
export * from './abilities';
//# sourceMappingURL=index.js.map