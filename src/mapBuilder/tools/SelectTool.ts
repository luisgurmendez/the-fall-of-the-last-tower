/**
 * SelectTool - Select and move objects on the map.
 */

import Vector from '@/physics/vector';
import { BaseTool, ToolMouseEvent, ToolRenderContext, ToolType } from './Tool';
import { MapData, WallData, BushGroupData, TowerData, NexusData, JungleCampData } from '../MapData';

type SelectableObject = WallData | BushGroupData | TowerData | NexusData | JungleCampData;
type ObjectType = 'wall' | 'bush' | 'tower' | 'nexus' | 'jungle';

interface Selection {
  type: ObjectType;
  object: SelectableObject;
}

export class SelectTool extends BaseTool {
  readonly type: ToolType = 'select';
  readonly name = 'Select';
  readonly icon = '↖';
  readonly description = 'Select and move objects';

  private selection: Selection | null = null;
  private isDragging = false;
  private dragOffset = new Vector(0, 0);

  onActivate(): void {
    this.selection = null;
    this.isDragging = false;
  }

  onMouseDown(event: ToolMouseEvent, mapData: MapData): void {
    if (!event.leftButton) return;

    const hitObject = this.findObjectAt(event.worldPos, mapData);

    if (hitObject) {
      this.selection = hitObject;
      this.isDragging = true;
      this.dragOffset = new Vector(
        event.worldPos.x - this.getObjectPosition(hitObject.object).x,
        event.worldPos.y - this.getObjectPosition(hitObject.object).y
      );
    } else {
      this.selection = null;
    }
  }

  onMouseMove(event: ToolMouseEvent, mapData: MapData): void {
    if (this.isDragging && this.selection && event.leftButton) {
      const newPos = this.snapToGrid(new Vector(
        event.worldPos.x - this.dragOffset.x,
        event.worldPos.y - this.dragOffset.y
      ));

      this.setObjectPosition(this.selection.object, newPos);
    }
  }

  onMouseUp(event: ToolMouseEvent, mapData: MapData): void {
    this.isDragging = false;
  }

  onKeyDown(key: string, mapData: MapData): void {
    if (key === 'Delete' || key === 'Backspace') {
      if (this.selection) {
        this.deleteSelectedObject(mapData);
      }
    }
    if (key === 'Escape') {
      this.selection = null;
    }
  }

  render(ctx: ToolRenderContext, mapData: MapData): void {
    if (!this.selection) return;

    const pos = this.getObjectPosition(this.selection.object);
    const screenPos = ctx.worldToScreen(pos);
    const size = this.getObjectSize(this.selection);

    ctx.ctx.save();
    ctx.ctx.strokeStyle = '#00ffff';
    ctx.ctx.lineWidth = 2;
    ctx.ctx.setLineDash([5, 5]);

    ctx.ctx.strokeRect(
      screenPos.x - (size.width / 2) * ctx.zoom,
      screenPos.y - (size.height / 2) * ctx.zoom,
      size.width * ctx.zoom,
      size.height * ctx.zoom
    );

    ctx.ctx.restore();
  }

  getSelectedObject(): Selection | null {
    return this.selection;
  }

  clearSelection(): void {
    this.selection = null;
  }

  private findObjectAt(pos: Vector, mapData: MapData): Selection | null {
    // Check walls
    for (const wall of mapData.walls) {
      if (this.isPointInRect(pos, wall.x, wall.y, wall.width, wall.height)) {
        return { type: 'wall', object: wall };
      }
    }

    // Check towers
    for (const tower of mapData.towers) {
      if (this.isPointInCircle(pos, tower.x, tower.y, 40)) {
        return { type: 'tower', object: tower };
      }
    }

    // Check nexuses
    for (const nexus of mapData.nexuses) {
      if (this.isPointInCircle(pos, nexus.x, nexus.y, 75)) {
        return { type: 'nexus', object: nexus };
      }
    }

    // Check bush groups
    for (const bush of mapData.bushGroups) {
      if (this.isPointInCircle(pos, bush.x, bush.y, 60)) {
        return { type: 'bush', object: bush };
      }
    }

    // Check jungle camps
    for (const camp of mapData.jungleCamps) {
      if (this.isPointInCircle(pos, camp.x, camp.y, 50)) {
        return { type: 'jungle', object: camp };
      }
    }

    return null;
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

  private getObjectPosition(obj: SelectableObject): Vector {
    return new Vector((obj as any).x, (obj as any).y);
  }

  private setObjectPosition(obj: SelectableObject, pos: Vector): void {
    (obj as any).x = pos.x;
    (obj as any).y = pos.y;
  }

  private getObjectSize(selection: Selection): { width: number; height: number } {
    switch (selection.type) {
      case 'wall':
        const wall = selection.object as WallData;
        return { width: wall.width, height: wall.height };
      case 'tower':
        return { width: 80, height: 80 };
      case 'nexus':
        return { width: 150, height: 150 };
      case 'bush':
        return { width: 120, height: 80 };
      case 'jungle':
        return { width: 100, height: 100 };
      default:
        return { width: 50, height: 50 };
    }
  }

  private deleteSelectedObject(mapData: MapData): void {
    if (!this.selection) return;

    const obj = this.selection.object;
    const id = (obj as any).id;

    switch (this.selection.type) {
      case 'wall':
        mapData.walls = mapData.walls.filter((w) => w.id !== id);
        break;
      case 'tower':
        mapData.towers = mapData.towers.filter((t) => t.id !== id);
        break;
      case 'nexus':
        mapData.nexuses = mapData.nexuses.filter((n) => n.id !== id);
        break;
      case 'bush':
        mapData.bushGroups = mapData.bushGroups.filter((b) => b.id !== id);
        break;
      case 'jungle':
        mapData.jungleCamps = mapData.jungleCamps.filter((c) => c.id !== id);
        break;
    }

    this.selection = null;
  }
}
