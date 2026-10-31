/**
 * Configuration exports shared between client and server.
 */

export {
  MOBAConfig,
  calculateBushGroupBounds,
  calculateIndividualBushPositions,
  isPointInBushGroup,
  default as default
} from './MOBAConfig';
export type { MapSide, LaneId, JungleCreatureType, BushSpread, BushGroupBounds, BushPosition } from './MOBAConfig';

export { GameConfig } from './GameConfig';

export { WallGrid } from './WallGrid';

export { inJungle } from './siegeMap';

export { ITEM_CATALOG, getItemCatalogEntry, CONTROL_WARD_ITEM_ID } from './items';
export type { ItemCatalogEntry, ItemPassiveData } from './items';
export { planItemPurchase, getItemTree, getItemCombineCost, getItemBuildsInto, isItemPartOf } from './itemTrees';
export type { ItemTreeNode, PurchasePlan } from './itemTrees';
