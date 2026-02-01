/**
 * Map module exports.
 */

export { NavigationGrid, CELL_SIZE } from '@/navigation';

// MOBA map exports - re-export from shared package
export { MOBAConfig } from '@siege/shared';
export type { MapSide, LaneId, JungleCreatureType } from '@siege/shared';
export { MOBAMap } from './MOBAMap';
export { MapDecoration } from './MapDecoration';
export type { DecorationType, MapDecorationConfig } from './MapDecoration';
