/**
 * Configuration exports shared between client and server.
 */

export {
  MOBAConfig,
  calculateBushGroupBounds,
  calculateIndividualBushPositions,
  isPointInBushGroup,
  mapLanes,
  getLane,
  default as default
} from './MOBAConfig';
export type { MapSide, LaneId, LaneConfig, JungleCreatureType, BushSpread, BushGroupBounds, BushPosition } from './MOBAConfig';

export { GameConfig } from './GameConfig';

export { WallGrid } from './WallGrid';

export { jungleTrails } from './siegeMap';
export { WallField } from './wallField';
export { MAPS, useMap, activeMapId, isMapId } from './maps';
export { TIERS, TIER_SPAN, tierFor, tierProgress } from './ranks';
export type { Tier, TierId, TierProgress } from './ranks';
export type { MapId } from './maps';

export { ITEM_CATALOG, getItemCatalogEntry, CONTROL_WARD_ITEM_ID } from './items';
export type { ItemCatalogEntry, ItemPassiveData, ItemPassiveEffect, ItemActiveData, ItemActiveEffect, ConsumableData } from './items';
export {
  planItemPurchase, getItemTree, getItemCombineCost, getItemBuildsInto, isItemPartOf,
  purchaseBlockReason, consumableStackSlot,
} from './itemTrees';
export type { ItemTreeNode, PurchasePlan, InventoryEntry, PurchaseBlock } from './itemTrees';
export { recommendedBuild, withStarter, isBuildItemDone } from './builds';
