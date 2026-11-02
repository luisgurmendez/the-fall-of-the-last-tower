/**
 * @siege/shared
 *
 * Shared types, math utilities, and configuration for the Siege MOBA.
 * This package is used by both the client and server.
 */

// Math utilities
export { Vector } from './math/Vector';
export { Rectangle, Circle, Square, NullShape } from './math/shapes';
export type { Shape } from './math/shapes';

// Type definitions
export * from './types';

// Configuration
export { MOBAConfig, GameConfig, calculateBushGroupBounds, calculateIndividualBushPositions, isPointInBushGroup, WallGrid, WallField, ITEM_CATALOG, getItemCatalogEntry, CONTROL_WARD_ITEM_ID, inJungle, planItemPurchase, getItemTree, getItemCombineCost, getItemBuildsInto, isItemPartOf } from './config';
export type { MapSide, LaneId, JungleCreatureType, BushSpread, BushGroupBounds, BushPosition, ItemCatalogEntry, ItemPassiveData, ItemTreeNode, PurchasePlan } from './config';

// Utility functions
export * from './utils';

// Champion registry
export * from './champions';

// Ability registry
export * from './abilities';

// Summoner spells
export * from './summoners';
