/**
 * LaneTool - Draw lane waypoint paths.
 *
 * Lanes are paths that minions follow from one nexus to another.
 * Click to add waypoints, double-click or press Enter to finish.
 */

import Vector from '@/physics/vector';
import { BaseTool, ToolMouseEvent, ToolRenderContext, ToolType } from './Tool';
import { MapData, LaneData, generateId } from '../MapData';

export class LaneTool extends BaseTool {
  readonly type: ToolType = 'lane';
  readonly name = 'Lane';
  readonly icon = '🛤️';
  readonly description = 'Draw lane paths for minions';

  /** Current waypoints being drawn */
  private currentWaypoints: Vector[] = [];

  /** Preview position */
  private previewPos: Vector | null = null;

  /** Lane being edited (null if creating new) */
  private editingLaneId: string | null = null;

  /** Lane width */
  private laneWidth = 100;

  /** Lane name */
  private laneName: 'top' | 'mid' | 'bot' = 'mid';

  setLaneName(name: 'top' | 'mid' | 'bot'): void {
    this.laneName = name;
  }

  setLaneWidth(width: number): void {
    this.laneWidth = Math.max(50, Math.min(200, width));
  }

  onActivate(): void {
    this.currentWaypoints = [];
    this.editingLaneId = null;
  }

  onDeactivate(): void {
    this.currentWaypoints = [];
    this.editingLaneId = null;
  }

  onMouseMove(event: ToolMouseEvent, mapData: MapData): void {
    this.previewPos = this.snapToGrid(event.worldPos);
  }

  onMouseDown(event: ToolMouseEvent, mapData: MapData): void {
    if (event.leftButton && this.previewPos) {
      // Add waypoint
      this.currentWaypoints.push(this.previewPos.clone());
    }

    if (event.rightButton) {
      // Cancel current lane
      this.currentWaypoints = [];
      this.editingLaneId = null;
    }
  }

  onKeyDown(key: string, mapData: MapData): void {
    if (key === 'Enter' && this.currentWaypoints.length >= 2) {
      this.finishLane(mapData);
    }

    if (key === 'Escape') {
      this.currentWaypoints = [];
      this.editingLaneId = null;
    }

    if (key === 'Backspace' && this.currentWaypoints.length > 0) {
      this.currentWaypoints.pop();
    }
  }

  render(ctx: ToolRenderContext, mapData: MapData): void {
    // Draw all existing lanes
    for (const lane of mapData.lanes) {
      this.renderLane(ctx, lane.waypoints.map((wp) => new Vector(wp.x, wp.y)), '#ffaa00', lane.width, false);
    }

    // Draw current lane being created
    if (this.currentWaypoints.length > 0) {
      const waypointsWithPreview = [...this.currentWaypoints];
      if (this.previewPos) {
        waypointsWithPreview.push(this.previewPos);
      }

      this.renderLane(ctx, waypointsWithPreview, '#00ff00', this.laneWidth, true);
    }

    // Draw preview point
    if (this.previewPos && this.currentWaypoints.length === 0) {
      const screenPos = ctx.worldToScreen(this.previewPos);
      ctx.ctx.save();
      ctx.ctx.fillStyle = '#00ff00';
      ctx.ctx.beginPath();
      ctx.ctx.arc(screenPos.x, screenPos.y, 8, 0, Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.restore();
    }

    // Draw instruction text
    if (this.currentWaypoints.length > 0) {
      ctx.ctx.save();
      ctx.ctx.fillStyle = '#ffffff';
      ctx.ctx.font = '14px Arial';
      ctx.ctx.fillText(
        `Waypoints: ${this.currentWaypoints.length} | Enter to finish | Backspace to undo | Esc to cancel`,
        10,
        ctx.ctx.canvas.height - 10
      );
      ctx.ctx.restore();
    }
  }

  private renderLane(
    ctx: ToolRenderContext,
    waypoints: Vector[],
    color: string,
    width: number,
    isPreview: boolean
  ): void {
    if (waypoints.length < 2) {
      // Just draw the first point
      if (waypoints.length === 1) {
        const screenPos = ctx.worldToScreen(waypoints[0]);
        ctx.ctx.save();
        ctx.ctx.fillStyle = color;
        ctx.ctx.beginPath();
        ctx.ctx.arc(screenPos.x, screenPos.y, 8, 0, Math.PI * 2);
        ctx.ctx.fill();
        ctx.ctx.restore();
      }
      return;
    }

    ctx.ctx.save();

    // Draw lane path
    ctx.ctx.strokeStyle = color;
    ctx.ctx.lineWidth = width * ctx.zoom;
    ctx.ctx.lineCap = 'round';
    ctx.ctx.lineJoin = 'round';
    ctx.ctx.globalAlpha = isPreview ? 0.5 : 0.3;

    ctx.ctx.beginPath();
    const startScreen = ctx.worldToScreen(waypoints[0]);
    ctx.ctx.moveTo(startScreen.x, startScreen.y);

    for (let i = 1; i < waypoints.length; i++) {
      const screenPos = ctx.worldToScreen(waypoints[i]);
      ctx.ctx.lineTo(screenPos.x, screenPos.y);
    }

    ctx.ctx.stroke();

    // Draw center line
    ctx.ctx.globalAlpha = 1;
    ctx.ctx.strokeStyle = color;
    ctx.ctx.lineWidth = 2;
    ctx.ctx.setLineDash([10, 5]);

    ctx.ctx.beginPath();
    ctx.ctx.moveTo(startScreen.x, startScreen.y);

    for (let i = 1; i < waypoints.length; i++) {
      const screenPos = ctx.worldToScreen(waypoints[i]);
      ctx.ctx.lineTo(screenPos.x, screenPos.y);
    }

    ctx.ctx.stroke();

    // Draw waypoint markers
    ctx.ctx.setLineDash([]);
    for (let i = 0; i < waypoints.length; i++) {
      const screenPos = ctx.worldToScreen(waypoints[i]);
      const isEnd = i === 0 || i === waypoints.length - 1;

      ctx.ctx.fillStyle = isEnd ? '#ffffff' : color;
      ctx.ctx.strokeStyle = color;
      ctx.ctx.lineWidth = 2;

      ctx.ctx.beginPath();
      ctx.ctx.arc(screenPos.x, screenPos.y, isEnd ? 10 : 6, 0, Math.PI * 2);
      ctx.ctx.fill();
      ctx.ctx.stroke();

      // Draw waypoint number
      ctx.ctx.fillStyle = '#000000';
      ctx.ctx.font = '10px Arial';
      ctx.ctx.textAlign = 'center';
      ctx.ctx.textBaseline = 'middle';
      ctx.ctx.fillText(`${i + 1}`, screenPos.x, screenPos.y);
    }

    ctx.ctx.restore();
  }

  private finishLane(mapData: MapData): void {
    if (this.currentWaypoints.length < 2) return;

    const lane: LaneData = {
      id: this.laneName,
      name: `${this.laneName.charAt(0).toUpperCase() + this.laneName.slice(1)} Lane`,
      waypoints: this.currentWaypoints.map((wp) => ({ x: wp.x, y: wp.y })),
      width: this.laneWidth,
    };

    // Check if lane with this ID already exists
    const existingIndex = mapData.lanes.findIndex((l) => l.id === this.laneName);
    if (existingIndex >= 0) {
      mapData.lanes[existingIndex] = lane;
    } else {
      mapData.lanes.push(lane);
    }

    this.currentWaypoints = [];
    this.editingLaneId = null;
  }

  /**
   * Start editing an existing lane.
   */
  editLane(laneId: string, mapData: MapData): void {
    const lane = mapData.lanes.find((l) => l.id === laneId);
    if (lane) {
      this.editingLaneId = laneId;
      this.currentWaypoints = lane.waypoints.map((wp) => new Vector(wp.x, wp.y));
      this.laneWidth = lane.width;
      this.laneName = laneId as 'top' | 'mid' | 'bot';

      // Remove the lane (will be re-added when finished)
      mapData.lanes = mapData.lanes.filter((l) => l.id !== laneId);
    }
  }
}
