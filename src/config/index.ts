/**
 * Central export for all configuration files.
 */

export { GameConfig } from './gameConfig';
export { UnitConfig } from './unitConfig';
export { WaveConfig } from './waveConfig';

// Re-export types
export type { GameConfigType } from './gameConfig';
export type { UnitConfigType, SwordsmanConfig, ArcherConfig, ArrowConfig, CastleConfig } from './unitConfig';
export type { WaveConfigType } from './waveConfig';
