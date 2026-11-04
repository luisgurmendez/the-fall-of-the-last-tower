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
export { MOBAConfig, GameConfig, calculateBushGroupBounds, calculateIndividualBushPositions, isPointInBushGroup, mapLanes, getLane, WallGrid, WallField, MAPS, useMap, activeMapId, isMapId, ITEM_CATALOG, getItemCatalogEntry, CONTROL_WARD_ITEM_ID, jungleTrails, planItemPurchase, getItemTree, getItemCombineCost, getItemBuildsInto, isItemPartOf, purchaseBlockReason, consumableStackSlot, recommendedBuild, withStarter, isBuildItemDone, TIERS, TIER_SPAN, tierFor, tierProgress } from './config';
export type { MapSide, MapId, LaneConfig, LaneId, JungleCreatureType, BushSpread, BushGroupBounds, BushPosition, ItemCatalogEntry, ItemPassiveData, ItemPassiveEffect, ItemActiveData, ItemActiveEffect, ConsumableData, ItemTreeNode, PurchasePlan, InventoryEntry, PurchaseBlock, Tier, TierId, TierProgress } from './config';

// Utility functions
export * from './utils';

// Champion registry
export * from './champions';

// Ability registry
export * from './abilities';

// Summoner spells
export * from './summoners';
