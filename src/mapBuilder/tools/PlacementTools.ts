/**
 * PlacementTools - Tools for placing objects on the map.
 *
 * Includes: WallTool, BushTool, TowerTool, NexusTool, JungleTool, DecorationTool, SpawnTool
 */

import Vector from '@/physics/vector';
import { BaseTool, ToolMouseEvent, ToolRenderContext, ToolType } from './Tool';
import { MapData, generateId, WallData, BushGroupData, TowerData, NexusData, JungleCampData, DecorationData, JungleCreatureType, JUNGLE_CREATURES } from '../MapData';

/**
 * WallTool - Draw rectangular walls.
 */
export class WallTool extends BaseTool {
  readonly type: ToolType = 'wall';
  readonly name = 'Wall';
  readonly icon = '🧱';
  readonly description = 'Place walls (impassable terrain)';

  private previewPos: Vector | null = null;
  private wallWidth = 100;
  private wallHeight = 100;

  setWallSize(width: number, height: number): void {
    this.wallWidth = Math.max(50, Math.min(500, width));
    this.wallHeight = Math.max(50, Math.min(500, height));
  }

  onMouseDown(event: ToolMouseEvent, mapData: MapData): void {
    if (event.leftButton && this.previewPos) {
      const wall: WallData = {
        id: generateId(),
        x: this.previewPos.x,
        y: this.previewPos.y,
        width: this.wallWidth,
        height: this.wallHeight,
      };
      mapData.walls.push(wall);
    }
  }

  onMouseMove(event: ToolMouseEvent, mapData: MapData): void {
    this.previewPos = this.snapToGrid(event.worldPos);
  }

  onMouseUp(event: ToolMouseEvent, mapData: MapData): void {
    // Click-to-place mode, nothing to do on mouse up
  }

  render(ctx: ToolRenderContext, mapData: MapData): void {
    if (!this.previewPos) return;

    const screenPos = ctx.worldToScreen(this.previewPos);
    const halfW = (this.wallWidth / 2) * ctx.zoom;
    const halfH = (this.wallHeight / 2) * ctx.zoom;

    ctx.ctx.save();
    ctx.ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.ctx.strokeStyle = '#666666';
    ctx.ctx.lineWidth = 2;
    ctx.ctx.fillRect(screenPos.x - halfW, screenPos.y - halfH, this.wallWidth * ctx.zoom, this.wallHeight * ctx.zoom);
    ctx.ctx.strokeRect(screenPos.x - halfW, screenPos.y - halfH, this.wallWidth * ctx.zoom, this.wallHeight * ctx.zoom);
    ctx.ctx.restore();
  }
}

/**
 * BushTool - Place bush groups.
 */
export class BushTool extends BaseTool {
  readonly type: ToolType = 'bush';
  readonly name = 'Bush';
  readonly icon = '🌿';
  readonly description = 'Place bush groups (vision blocking)';

  private previewPos: Vector | null = null;
  private bushCount = 4;
  private spread: 'horizontal' | 'vertical' | 'diagonal' | 'cluster' = 'cluster';

  setBushCount(count: number): void {
    this.bushCount = Math.max(1, Math.min(8, count));
  }

  setSpread(spread: 'horizontal' | 'vertical' | 'diagonal' | 'cluster'): void {
    this.spread = spread;
  }

  onMouseMove(event: ToolMouseEvent, mapData: MapData): void {
    this.previewPos = this.snapToGrid(event.worldPos);
  }

  onMouseDown(event: ToolMouseEvent, mapData: MapData): void {
    if (event.leftButton && this.previewPos) {
      const bush: BushGroupData = {
        id: generateId(),
        x: this.previewPos.x,
        y: this.previewPos.y,
        bushCount: this.bushCount,
        spread: this.spread,
      };

      mapData.bushGroups.push(bush);
    }
  }

  render(ctx: ToolRenderContext, mapData: MapData): void {
    if (!this.previewPos) return;

    const screenPos = ctx.worldToScreen(this.previewPos);

    ctx.ctx.save();
    ctx.ctx.fillStyle = 'rgba(34, 139, 34, 0.5)';
    ctx.ctx.strokeStyle = '#228b22';
    ctx.ctx.lineWidth = 2;
    ctx.ctx.beginPath();
    ctx.ctx.ellipse(screenPos.x, screenPos.y, 60 * ctx.zoom, 40 * ctx.zoom, 0, 0, Math.PI * 2);
    ctx.ctx.fill();
    ctx.ctx.stroke();
    ctx.ctx.restore();
  }
}

/**
 * TowerTool - Place towers.
 */
export class TowerTool extends BaseTool {
  readonly type: ToolType = 'tower';
  readonly name = 'Tower';
  readonly icon = '🗼';
  readonly description = 'Place towers';

  private previewPos: Vector | null = null;
  private side: 0 | 1 = 0;
  private lane: 'top' | 'mid' | 'bot' = 'mid';

  setSide(side: 0 | 1): void {
    this.side = side;
  }

  setLane(lane: 'top' | 'mid' | 'bot'): void {
    this.lane = lane;
  }

  onMouseMove(event: ToolMouseEvent, mapData: MapData): void {
    this.previewPos = this.snapToGrid(event.worldPos);
  }

  onMouseDown(event: ToolMouseEvent, mapData: MapData): void {
    if (event.leftButton && this.previewPos) {
      const tower: TowerData = {
        id: generateId(),
        x: this.previewPos.x,
        y: this.previewPos.y,
        side: this.side,
        lane: this.lane,
      };

      mapData.towers.push(tower);
    }
  }

  render(ctx: ToolRenderContext, mapData: MapData): void {
    if (!this.previewPos) return;

    const screenPos = ctx.worldToScreen(this.previewPos);
    const color = this.side === 0 ? 'rgba(0, 100, 255, 0.5)' : 'rgba(255, 50, 50, 0.5)';
    const strokeColor = this.side === 0 ? '#0066ff' : '#ff3333';

    ctx.ctx.save();
    ctx.ctx.fillStyle = color;
    ctx.ctx.strokeStyle = strokeColor;
    ctx.ctx.lineWidth = 3;
    ctx.ctx.beginPath();
    ctx.ctx.arc(screenPos.x, screenPos.y, 40 * ctx.zoom, 0, Math.PI * 2);
    ctx.ctx.fill();
    ctx.ctx.stroke();

    // Draw attack range preview
    ctx.ctx.strokeStyle = strokeColor + '44';
    ctx.ctx.setLineDash([10, 5]);
    ctx.ctx.beginPath();
    ctx.ctx.arc(screenPos.x, screenPos.y, 350 * ctx.zoom, 0, Math.PI * 2);
    ctx.ctx.stroke();
    ctx.ctx.restore();
  }
}

/**
 * NexusTool - Place nexuses.
 */
export class NexusTool extends BaseTool {
  readonly type: ToolType = 'nexus';
  readonly name = 'Nexus';
  readonly icon = '🏰';
  readonly description = 'Place nexuses (base structures)';

  private previewPos: Vector | null = null;
  private side: 0 | 1 = 0;

  setSide(side: 0 | 1): void {
    this.side = side;
  }

  onMouseMove(event: ToolMouseEvent, mapData: MapData): void {
    this.previewPos = this.snapToGrid(event.worldPos);
  }

  onMouseDown(event: ToolMouseEvent, mapData: MapData): void {
    if (event.leftButton && this.previewPos) {
      // Check if we already have a nexus for this side
      const existingIndex = mapData.nexuses.findIndex((n) => n.side === this.side);

      const nexus: NexusData = {
        id: generateId(),
        x: this.previewPos.x,
        y: this.previewPos.y,
        side: this.side,
      };

      if (existingIndex >= 0) {
        // Replace existing
        mapData.nexuses[existingIndex] = nexus;
      } else {
        mapData.nexuses.push(nexus);
      }
    }
  }

  render(ctx: ToolRenderContext, mapData: MapData): void {
    if (!this.previewPos) return;

    const screenPos = ctx.worldToScreen(this.previewPos);
    const color = this.side === 0 ? 'rgba(0, 150, 255, 0.5)' : 'rgba(255, 100, 100, 0.5)';
    const strokeColor = this.side === 0 ? '#0099ff' : '#ff6666';

    ctx.ctx.save();
    ctx.ctx.fillStyle = color;
    ctx.ctx.strokeStyle = strokeColor;
    ctx.ctx.lineWidth = 4;
    ctx.ctx.beginPath();
    ctx.ctx.arc(screenPos.x, screenPos.y, 75 * ctx.zoom, 0, Math.PI * 2);
    ctx.ctx.fill();
    ctx.ctx.stroke();
    ctx.ctx.restore();
  }
}

/**
 * JungleTool - Place jungle camps.
 */
export class JungleTool extends BaseTool {
  readonly type: ToolType = 'jungle';
  readonly name = 'Jungle';
  readonly icon = '🐻';
  readonly description = 'Place jungle camps';

  private previewPos: Vector | null = null;
  private creatureType: JungleCreatureType = 'gromp';

  setCreatureType(type: JungleCreatureType): void {
    this.creatureType = type;
  }

  getCreatureType(): JungleCreatureType {
    return this.creatureType;
  }

  onMouseMove(event: ToolMouseEvent, mapData: MapData): void {
    this.previewPos = this.snapToGrid(event.worldPos);
  }

  onMouseDown(event: ToolMouseEvent, mapData: MapData): void {
    if (event.leftButton && this.previewPos) {
      const creatureInfo = JUNGLE_CREATURES[this.creatureType];
      const camp: JungleCampData = {
        id: generateId(),
        x: this.previewPos.x,
        y: this.previewPos.y,
        creatureType: this.creatureType,
        count: creatureInfo.count,
        respawnTime: creatureInfo.respawnTime,
      };

      mapData.jungleCamps.push(camp);
    }
  }

  render(ctx: ToolRenderContext, mapData: MapData): void {
    if (!this.previewPos) return;

    const screenPos = ctx.worldToScreen(this.previewPos);
    const creatureInfo = JUNGLE_CREATURES[this.creatureType];

    ctx.ctx.save();
    ctx.ctx.fillStyle = 'rgba(139, 90, 43, 0.5)';
    ctx.ctx.strokeStyle = '#8b5a2b';
    ctx.ctx.lineWidth = 2;
    ctx.ctx.beginPath();
    ctx.ctx.arc(screenPos.x, screenPos.y, 50 * ctx.zoom, 0, Math.PI * 2);
    ctx.ctx.fill();
    ctx.ctx.stroke();

    // Draw creature icon
    ctx.ctx.font = `${24 * ctx.zoom}px Arial`;
    ctx.ctx.textAlign = 'center';
    ctx.ctx.textBaseline = 'middle';
    ctx.ctx.fillText(creatureInfo.icon, screenPos.x, screenPos.y);

    // Draw leash range
    ctx.ctx.strokeStyle = 'rgba(139, 90, 43, 0.3)';
    ctx.ctx.setLineDash([5, 5]);
    ctx.ctx.beginPath();
    ctx.ctx.arc(screenPos.x, screenPos.y, 400 * ctx.zoom, 0, Math.PI * 2);
    ctx.ctx.stroke();
    ctx.ctx.restore();
  }
}

/**
 * DecorationTool - Place decorative elements.
 */
export class DecorationTool extends BaseTool {
  readonly type: ToolType = 'decoration';
  readonly name = 'Decor';
  readonly icon = '🌳';
  readonly description = 'Place decorative elements';

  private previewPos: Vector | null = null;
  private decorationType: DecorationData['type'] = 'tree';

  setDecorationType(type: DecorationData['type']): void {
    this.decorationType = type;
  }

  onMouseMove(event: ToolMouseEvent, mapData: MapData): void {
    this.previewPos = this.snapToGrid(event.worldPos);
  }

  onMouseDown(event: ToolMouseEvent, mapData: MapData): void {
    if (event.leftButton && this.previewPos) {
      const decoration: DecorationData = {
        id: generateId(),
        x: this.previewPos.x,
        y: this.previewPos.y,
        type: this.decorationType,
        scale: 1,
        rotation: 0,
      };

      mapData.decorations.push(decoration);
    }
  }

  render(ctx: ToolRenderContext, mapData: MapData): void {
    if (!this.previewPos) return;

    const screenPos = ctx.worldToScreen(this.previewPos);
    const icons: Record<DecorationData['type'], string> = {
      tree: '🌳',
      rock: '🪨',
      flower: '🌸',
      mushroom: '🍄',
      stump: '🪵',
    };

    ctx.ctx.save();
    ctx.ctx.font = `${30 * ctx.zoom}px Arial`;
    ctx.ctx.textAlign = 'center';
    ctx.ctx.textBaseline = 'middle';
    ctx.ctx.fillText(icons[this.decorationType], screenPos.x, screenPos.y);
    ctx.ctx.restore();
  }
}

/**
 * SpawnTool - Set spawn points.
 */
export class SpawnTool extends BaseTool {
  readonly type: ToolType = 'spawn';
  readonly name = 'Spawn';
  readonly icon = '📍';
  readonly description = 'Set champion spawn points';

  private previewPos: Vector | null = null;
  private side: 0 | 1 = 0;

  setSide(side: 0 | 1): void {
    this.side = side;
  }

  onMouseMove(event: ToolMouseEvent, mapData: MapData): void {
    this.previewPos = this.snapToGrid(event.worldPos);
  }

  onMouseDown(event: ToolMouseEvent, mapData: MapData): void {
    if (event.leftButton && this.previewPos) {
      // Update or add spawn point
      const existingIndex = mapData.spawnPoints.findIndex((sp) => sp.side === this.side);

      const spawn = {
        side: this.side,
        x: this.previewPos.x,
        y: this.previewPos.y,
      };

      if (existingIndex >= 0) {
        mapData.spawnPoints[existingIndex] = spawn;
      } else {
        mapData.spawnPoints.push(spawn);
      }
    }
  }

  render(ctx: ToolRenderContext, mapData: MapData): void {
    if (!this.previewPos) return;

    const screenPos = ctx.worldToScreen(this.previewPos);
    const color = this.side === 0 ? '#00ff00' : '#ff0000';

    ctx.ctx.save();
    ctx.ctx.fillStyle = color + '88';
    ctx.ctx.strokeStyle = color;
    ctx.ctx.lineWidth = 3;

    // Draw spawn marker (star shape)
    ctx.ctx.beginPath();
    const spikes = 5;
    const outerRadius = 25 * ctx.zoom;
    const innerRadius = 12 * ctx.zoom;

    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = screenPos.x + Math.cos(angle) * radius;
      const y = screenPos.y + Math.sin(angle) * radius;

      if (i === 0) {
        ctx.ctx.moveTo(x, y);
      } else {
        ctx.ctx.lineTo(x, y);
      }
    }

    ctx.ctx.closePath();
    ctx.ctx.fill();
    ctx.ctx.stroke();
    ctx.ctx.restore();
  }
}

/**
 * EraseTool - Delete objects.
 */
export class EraseTool extends BaseTool {
  readonly type: ToolType = 'erase';
  readonly name = 'Erase';
  readonly icon = '🗑️';
  readonly description = 'Delete objects';

  private previewPos: Vector | null = null;

  onMouseMove(event: ToolMouseEvent, mapData: MapData): void {
    this.previewPos = event.worldPos;
  }

  onMouseDown(event: ToolMouseEvent, mapData: MapData): void {
    if (event.leftButton) {
      this.eraseAt(event.worldPos, mapData);
    }
  }

  render(ctx: ToolRenderContext, mapData: MapData): void {
    if (!this.previewPos) return;

    const screenPos = ctx.worldToScreen(this.previewPos);

    ctx.ctx.save();
    ctx.ctx.strokeStyle = '#ff0000';
    ctx.ctx.lineWidth = 2;
    ctx.ctx.beginPath();
    ctx.ctx.arc(screenPos.x, screenPos.y, 30 * ctx.zoom, 0, Math.PI * 2);
    ctx.ctx.stroke();

    // Draw X
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(screenPos.x - 15 * ctx.zoom, screenPos.y - 15 * ctx.zoom);
    ctx.ctx.lineTo(screenPos.x + 15 * ctx.zoom, screenPos.y + 15 * ctx.zoom);
    ctx.ctx.moveTo(screenPos.x + 15 * ctx.zoom, screenPos.y - 15 * ctx.zoom);
    ctx.ctx.lineTo(screenPos.x - 15 * ctx.zoom, screenPos.y + 15 * ctx.zoom);
    ctx.ctx.stroke();
    ctx.ctx.restore();
  }

  private eraseAt(pos: Vector, mapData: MapData): void {
    // Check all object types and remove first hit

    // Walls
    for (let i = mapData.walls.length - 1; i >= 0; i--) {
      const wall = mapData.walls[i];
      if (this.isPointInRect(pos, wall.x, wall.y, wall.width, wall.height)) {
        mapData.walls.splice(i, 1);
        return;
      }
    }

    // Towers
    for (let i = mapData.towers.length - 1; i >= 0; i--) {
      const tower = mapData.towers[i];
      if (this.isPointInCircle(pos, tower.x, tower.y, 40)) {
        mapData.towers.splice(i, 1);
        return;
      }
    }

    // Bush groups
    for (let i = mapData.bushGroups.length - 1; i >= 0; i--) {
      const bush = mapData.bushGroups[i];
      if (this.isPointInCircle(pos, bush.x, bush.y, 60)) {
        mapData.bushGroups.splice(i, 1);
        return;
      }
    }

    // Jungle camps
    for (let i = mapData.jungleCamps.length - 1; i >= 0; i--) {
      const camp = mapData.jungleCamps[i];
      if (this.isPointInCircle(pos, camp.x, camp.y, 50)) {
        mapData.jungleCamps.splice(i, 1);
        return;
      }
    }

    // Decorations
    for (let i = mapData.decorations.length - 1; i >= 0; i--) {
      const decor = mapData.decorations[i];
      if (this.isPointInCircle(pos, decor.x, decor.y, 25)) {
        mapData.decorations.splice(i, 1);
        return;
      }
    }
  }

  private isPointInRect(pos: Vector, x: number, y: number, width: number, height: number): boolean {
    return (
      pos.x >= x - width / 2 &&
      pos.x <= x + width / 2 &&
      pos.y >= y - height / 2 &&
      pos.y <= y + height / 2
    );
  }

  private isPointInCircle(pos: Vector, x: number, y: number, radius: number): boolean {
    const dx = pos.x - x;
    const dy = pos.y - y;
    return dx * dx + dy * dy <= radius * radius;
  }
}
