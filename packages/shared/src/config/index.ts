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
export type { MapId } from './maps';

export { ITEM_CATALOG, getItemCatalogEntry, CONTROL_WARD_ITEM_ID } from './items';
export type { ItemCatalogEntry, ItemPassiveData } from './items';
export { planItemPurchase, getItemTree, getItemCombineCost, getItemBuildsInto, isItemPartOf } from './itemTrees';
export type { ItemTreeNode, PurchasePlan } from './itemTrees';
