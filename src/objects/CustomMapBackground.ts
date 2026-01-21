/**
 * CustomMapBackground - Renders terrain for custom maps.
 * Also provides the gameMap interface for pathfinding compatibility.
 */

import GameContext from "@/core/gameContext";
import BaseObject from "@/objects/baseObject";
import { Rectangle } from "@/objects/shapes";
import { LoadedMap } from "@/mapBuilder/MapLoader";
import { TERRAIN_COLORS, TerrainType } from "@/mapBuilder/MapData";
import Vector from "@/physics/vector";
import NavigationGrid from "@/navigation/NavigationGrid";
import RenderElement from "@/render/renderElement";

export const BACKGROUND_ID = "bg";

/**
 * Adapter to make custom map compatible with existing pathfinding code.
 */
class CustomGameMapAdapter {
  private loadedMap: LoadedMap;

  constructor(loadedMap: LoadedMap) {
    this.loadedMap = loadedMap;
  }

  get navigationGrid(): NavigationGrid {
    return this.loadedMap.navigationGrid;
  }

  findPath(from: Vector, to: Vector): Vector[] | null {
    return this.loadedMap.navigationGrid.findPath(from, to);
  }

  isWalkable(position: Vector): boolean {
    return this.loadedMap.navigationGrid.isWalkableWorld(position.x, position.y);
  }

  getValidMovementPosition(from: Vector, to: Vector): Vector {
    return this.loadedMap.navigationGrid.getValidMovementPosition(from, to);
  }

  // Dummy methods for compatibility
  isInsideBase(_position: Vector): null {
    return null;
  }

  isInsideLane(_position: Vector): boolean {
    return true;
  }

  isPlayableArea(_position: Vector): boolean {
    return true;
  }

  isTreeArea(_position: Vector): boolean {
    return false;
  }

  getSpawnPoint(team: 0 | 1): Vector {
    return team === 0
      ? this.loadedMap.spawnPoints.blue.clone()
      : this.loadedMap.spawnPoints.red.clone();
  }
}

export class CustomMapBackground extends BaseObject {
  /** Game map adapter for pathfinding */
  gameMap: CustomGameMapAdapter;

  private loadedMap: LoadedMap;
  private terrainGrid: string[][];
  private cellSize: number;
  private cols: number;
  private rows: number;
  private halfWidth: number;
  private halfHeight: number;

  constructor(worldDimensions: Rectangle, loadedMap: LoadedMap) {
    super(new Vector(0, 0), BACKGROUND_ID); // Set ID so GameContext can find this as background
    this.loadedMap = loadedMap;
    this.gameMap = new CustomGameMapAdapter(loadedMap);

    this.terrainGrid = loadedMap.terrainGrid;
    this.cellSize = loadedMap.terrainCellSize;
    this.rows = this.terrainGrid.length;
    this.cols = this.terrainGrid[0]?.length || 0;
    this.halfWidth = loadedMap.size.width / 2;
    this.halfHeight = loadedMap.size.height / 2;
  }

  step(_gctx: GameContext): void {
    // No-op - static background
  }

  render(): RenderElement {
    const renderFn = (gctx: GameContext) => {
      const ctx = gctx.canvasRenderingContext;

      // Render all terrain cells
      for (let row = 0; row < this.rows; row++) {
        for (let col = 0; col < this.cols; col++) {
          const terrain = this.terrainGrid[row]?.[col] as TerrainType || 'grass';
          const color = TERRAIN_COLORS[terrain] || TERRAIN_COLORS.grass;

          const x = col * this.cellSize - this.halfWidth;
          const y = row * this.cellSize - this.halfHeight;

          ctx.fillStyle = color;
          ctx.fillRect(x, y, this.cellSize + 1, this.cellSize + 1);
        }
      }

      // Draw world border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 4;
      ctx.strokeRect(-this.halfWidth, -this.halfHeight, this.halfWidth * 2, this.halfHeight * 2);
    };

    return new RenderElement(renderFn, true);
  }

  // Bloodstain methods (for compatibility with army units - no-op for custom maps)
  drawSwordsmanBloodstain(_position: Vector): void {}
  drawArcherBloodstain(_position: Vector): void {}
  drawCastleExplotion(_position: Vector): void {}
}
