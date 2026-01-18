/**
 * Type definitions shared between client and server.
 */
export { TEAM_BLUE, TEAM_RED, isSided, isTargetable, isDamageable, oppositeSide, } from './units';
export { LEVEL_EXPERIENCE, calculateStat, calculateAttackSpeed, calculateStatsAtLevel, } from './champions';
export { computeCCStatus, defaultCCStatus, } from './effects';
export { calculateAbilityValue, } from './abilities';
export { calculateItemStats, findEmptySlot, hasItem, } from './items';
export { InputType, EntityType, EntityChangeMask, GameEventType, ServerMessageType, ClientMessageType, } from './network';
//# sourceMappingURL=index.js.map