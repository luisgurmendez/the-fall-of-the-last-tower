/**
 * Type definitions shared between client and server.
 */
export { TEAM_BLUE, TEAM_RED, isSided, isTargetable, isDamageable, oppositeSide, } from './units';
export { LEVEL_EXPERIENCE, calculateStat, calculateAttackSpeed, calculateStatsAtLevel, } from './champions';
export { computeCCStatus, defaultCCStatus, } from './effects';
export { calculateAbilityValue, } from './abilities';
export { calculateItemStats, findEmptySlot, hasItem, } from './items';
export { InputType, EntityType, EntityChangeMask, GameEventType, ServerMessageType, ClientMessageType, } from './network';
export { DEFAULT_MINION_STATS, DEFAULT_MINION_WAVE_CONFIG, } from './minions';
export { DEFAULT_TOWER_STATS, DEFAULT_TOWER_REWARDS, DEFAULT_INHIBITOR_STATS, DEFAULT_NEXUS_STATS, TowerTargetPriority, } from './structures';
//# sourceMappingURL=index.js.map