/**
 * Map module exports.
 */

export { default as GameMap } from './Map';
export type { BaseArea, Lane, TreeData } from './Map';
export { MapConfig } from './MapConfig';
export { NavigationGrid, CELL_SIZE } from '@/navigation';

// MOBA map exports
export { MOBAConfig } from './MOBAConfig';
export type { MapSide, LaneId, JungleCreatureType } from './MOBAConfig';
export { MOBAMap } from './MOBAMap';
export { MapDecoration } from './MapDecoration';
export type { DecorationType, MapDecorationConfig } from './MapDecoration';
export { TilemapRenderer, getTilemapRenderer, TILES, TILE_SIZE } from './TilemapRenderer';
