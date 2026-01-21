/**
 * TerrainTool - Paint terrain tiles on the map.
 */

import Vector from '@/physics/vector';
import { BaseTool, ToolMouseEvent, ToolRenderContext, ToolType } from './Tool';
import { MapData, TerrainType, TERRAIN_CELL_SIZE, TERRAIN_COLORS } from '../MapData';

export class TerrainTool extends BaseTool {
  readonly type: ToolType = 'terrain';
  readonly name = 'Terrain';
  readonly icon = '🎨';
  readonly description = 'Paint terrain tiles';

  /** Currently selected terrain type */
  private selectedTerrain: TerrainType = 'grass';

  /** Brush size (in cells) */
  private brushSize = 1;

  /** Is painting */
  private isPainting = false;

  /** Preview position */
  private previewPos: Vector | null = null;

  setTerrainType(type: TerrainType): void {
    this.selectedTerrain = type;
  }

  getTerrainType(): TerrainType {
    return this.selectedTerrain;
  }

  setBrushSize(size: number): void {
    this.brushSize = Math.max(1, Math.min(5, size));
  }

  getBrushSize(): number {
    return this.brushSize;
  }

  onMouseDown(event: ToolMouseEvent, mapData: MapData): void {
    if (event.leftButton) {
      this.isPainting = true;
      this.paintAt(event.worldPos, mapData);
    }
  }

  onMouseMove(event: ToolMouseEvent, mapData: MapData): void {
    this.previewPos = event.worldPos;

    if (this.isPainting && event.leftButton) {
      this.paintAt(event.worldPos, mapData);
    }
  }

  onMouseUp(event: ToolMouseEvent, mapData: MapData): void {
    this.isPainting = false;
  }

  onKeyDown(key: string, mapData: MapData): void {
    // Number keys to change brush size
    const num = parseInt(key);
    if (num >= 1 && num <= 5) {
      this.brushSize = num;
    }
  }

  render(ctx: ToolRenderContext, mapData: MapData): void {
    if (!this.previewPos) return;

    const halfWidth = mapData.size.width / 2;
    const halfHeight = mapData.size.height / 2;

    // Get cell coordinates
    const cellX = Math.floor((this.previewPos.x + halfWidth) / TERRAIN_CELL_SIZE);
    const cellY = Math.floor((this.previewPos.y + halfHeight) / TERRAIN_CELL_SIZE);

    ctx.ctx.save();
    ctx.ctx.strokeStyle = '#ffffff';
    ctx.ctx.lineWidth = 2;
    ctx.ctx.fillStyle = TERRAIN_COLORS[this.selectedTerrain] + '88';

    // Draw brush preview
    const halfBrush = Math.floor(this.brushSize / 2);

    for (let dy = -halfBrush; dy <= halfBrush; dy++) {
      for (let dx = -halfBrush; dx <= halfBrush; dx++) {
        const cx = cellX + dx;
        const cy = cellY + dy;

        if (cx < 0 || cy < 0) continue;
        if (cy >= mapData.terrainGrid.length) continue;
        if (cx >= mapData.terrainGrid[0].length) continue;

        const worldX = cx * TERRAIN_CELL_SIZE - halfWidth;
        const worldY = cy * TERRAIN_CELL_SIZE - halfHeight;

        const screenPos = ctx.worldToScreen(new Vector(worldX, worldY));
        const cellSize = TERRAIN_CELL_SIZE * ctx.zoom;

        ctx.ctx.fillRect(screenPos.x, screenPos.y, cellSize, cellSize);
        ctx.ctx.strokeRect(screenPos.x, screenPos.y, cellSize, cellSize);
      }
    }

    ctx.ctx.restore();
  }

  private paintAt(worldPos: Vector, mapData: MapData): void {
    const halfWidth = mapData.size.width / 2;
    const halfHeight = mapData.size.height / 2;

    const cellX = Math.floor((worldPos.x + halfWidth) / TERRAIN_CELL_SIZE);
    const cellY = Math.floor((worldPos.y + halfHeight) / TERRAIN_CELL_SIZE);

    const halfBrush = Math.floor(this.brushSize / 2);

    for (let dy = -halfBrush; dy <= halfBrush; dy++) {
      for (let dx = -halfBrush; dx <= halfBrush; dx++) {
        const cx = cellX + dx;
        const cy = cellY + dy;

        if (cx < 0 || cy < 0) continue;
        if (cy >= mapData.terrainGrid.length) continue;
        if (cx >= mapData.terrainGrid[0].length) continue;

        mapData.terrainGrid[cy][cx] = this.selectedTerrain;
      }
    }
  }
}
