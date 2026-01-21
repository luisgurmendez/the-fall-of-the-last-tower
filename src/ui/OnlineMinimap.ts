/**
 * OnlineMinimap - Minimap for online mode that reads from server state.
 *
 * Unlike the regular Minimap which reads from gctx.objects (local entities),
 * this reads from OnlineStateManager to display server entities.
 *
 * Features:
 * - Champions (green=ally, red=enemy)
 * - Minions (small dots)
 * - Towers (squares with borders)
 * - Nexus (circles)
 * - Camera viewport rectangle
 * - Click to move camera
 */

import { ScreenEntity } from '@/core/GameObject';
import GameContext from '@/core/gameContext';
import RenderElement from '@/render/renderElement';
import Vector from '@/physics/vector';
import { MOBAConfig } from '@/map/MOBAConfig';
import { InputManager } from '@/core/input/InputManager';
import { EntityType } from '@siege/shared';
import type { OnlineStateManager, InterpolatedEntity } from '@/core/OnlineStateManager';
import type { EntitySnapshot, ChampionSnapshot, MinionSnapshot, TowerSnapshot, NexusSnapshot } from '@siege/shared';

/**
 * OnlineMinimap configuration.
 */
export interface OnlineMinimapConfig {
  /** Size of the minimap in pixels */
  size: number;
  /** Margin from screen edge */
  margin: number;
  /** Position corner */
  corner: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Border width */
  borderWidth: number;
  /** Background color */
  backgroundColor: string;
  /** Border color */
  borderColor: string;
}

const DEFAULT_CONFIG: OnlineMinimapConfig = {
  size: 200,
  margin: 16,
  corner: 'bottom-left',
  borderWidth: 3,
  backgroundColor: '#1a1a2e',
  borderColor: '#3a3a5c',
};

/**
 * OnlineMinimap UI component for multiplayer.
 */
export class OnlineMinimap extends ScreenEntity {
  private config: OnlineMinimapConfig;
  private stateManager: OnlineStateManager;
  private localSide: number;
  private inputManager: InputManager;

  // Map dimensions
  private readonly mapSize: number = MOBAConfig.MAP_SIZE.width;
  private readonly mapHalfSize: number = MOBAConfig.MAP_SIZE.width / 2;

  // Cached minimap position
  private minimapX: number = 0;
  private minimapY: number = 0;

  // Click state
  private isHovering: boolean = false;
  private isDragging: boolean = false;

  constructor(
    stateManager: OnlineStateManager,
    localSide: number,
    config: Partial<OnlineMinimapConfig> = {}
  ) {
    super();
    this.stateManager = stateManager;
    this.localSide = localSide;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.inputManager = InputManager.getInstance();
  }

  /**
   * Convert world position to minimap position.
   */
  private worldToMinimap(worldX: number, worldY: number): { x: number; y: number } {
    const scale = this.config.size / this.mapSize;
    return {
      x: this.minimapX + (worldX + this.mapHalfSize) * scale,
      y: this.minimapY + (worldY + this.mapHalfSize) * scale,
    };
  }

  /**
   * Convert minimap position to world position.
   */
  private minimapToWorld(minimapX: number, minimapY: number): Vector {
    const scale = this.mapSize / this.config.size;
    return new Vector(
      (minimapX - this.minimapX) * scale - this.mapHalfSize,
      (minimapY - this.minimapY) * scale - this.mapHalfSize
    );
  }

  /**
   * Check if a screen position is within the minimap.
   */
  private isInsideMinimap(screenX: number, screenY: number): boolean {
    return (
      screenX >= this.minimapX &&
      screenX <= this.minimapX + this.config.size &&
      screenY >= this.minimapY &&
      screenY <= this.minimapY + this.config.size
    );
  }

  /**
   * Update minimap position based on canvas size.
   */
  private updateMinimapPosition(canvasWidth: number, canvasHeight: number): void {
    const { size, margin, corner } = this.config;

    switch (corner) {
      case 'bottom-left':
        this.minimapX = margin;
        this.minimapY = canvasHeight - size - margin;
        break;
      case 'bottom-right':
        this.minimapX = canvasWidth - size - margin;
        this.minimapY = canvasHeight - size - margin;
        break;
      case 'top-left':
        this.minimapX = margin;
        this.minimapY = margin;
        break;
      case 'top-right':
        this.minimapX = canvasWidth - size - margin;
        this.minimapY = margin;
        break;
    }
  }

  override step(context: GameContext): void {
    const { canvasRenderingContext } = context;
    const canvas = canvasRenderingContext.canvas;

    // Update position
    this.updateMinimapPosition(canvas.width, canvas.height);

    // Get mouse position in screen space
    const mousePos = this.inputManager.getMousePosition();
    this.isHovering = this.isInsideMinimap(mousePos.x, mousePos.y);

    // Handle click to move camera
    if (this.isHovering && this.inputManager.isLeftMouseJustPressed()) {
      this.isDragging = true;
    }

    if (this.isDragging) {
      if (this.inputManager.isLeftMouseDown()) {
        // Move camera to clicked position
        const worldPos = this.minimapToWorld(mousePos.x, mousePos.y);
        context.camera.position.x = worldPos.x;
        context.camera.position.y = worldPos.y;
      } else {
        this.isDragging = false;
      }
    }
  }

  override render(): RenderElement {
    return this.createOverlayRender((gctx: GameContext) => {
      const ctx = gctx.canvasRenderingContext;
      const { size, borderWidth, backgroundColor, borderColor } = this.config;

      ctx.save();

      // Draw background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(this.minimapX, this.minimapY, size, size);

      // Draw terrain (lanes and nexus markers)
      this.renderTerrain(ctx);

      // Draw server entities
      this.renderEntities(ctx);

      // Draw player movement path
      this.renderPlayerPath(ctx);

      // Draw camera viewport
      this.renderCameraViewport(ctx, gctx);

      // Draw border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      ctx.strokeRect(
        this.minimapX - borderWidth / 2,
        this.minimapY - borderWidth / 2,
        size + borderWidth,
        size + borderWidth
      );

      // Highlight on hover
      if (this.isHovering) {
        ctx.strokeStyle = '#00ced1';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.minimapX, this.minimapY, size, size);
      }

      ctx.restore();
    });
  }

  /**
   * Render terrain features (lanes and static nexus indicators).
   */
  private renderTerrain(ctx: CanvasRenderingContext2D): void {
    const { size } = this.config;
    const scale = size / this.mapSize;

    // Draw nexus indicators (static positions from config)
    const nexusRadius = MOBAConfig.NEXUS.RADIUS * scale;

    // Blue nexus
    const blueNexusPos = this.worldToMinimap(MOBAConfig.NEXUS.BLUE.x, MOBAConfig.NEXUS.BLUE.y);
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.arc(blueNexusPos.x, blueNexusPos.y, Math.max(nexusRadius, 6), 0, Math.PI * 2);
    ctx.fill();

    // Red nexus
    const redNexusPos = this.worldToMinimap(MOBAConfig.NEXUS.RED.x, MOBAConfig.NEXUS.RED.y);
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(redNexusPos.x, redNexusPos.y, Math.max(nexusRadius, 6), 0, Math.PI * 2);
    ctx.fill();

    // Draw lanes
    ctx.strokeStyle = '#3d5a3d';
    ctx.lineWidth = MOBAConfig.LANES.TOP.width * scale * 0.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Top lane
    ctx.beginPath();
    const topWaypoints = MOBAConfig.LANES.TOP.waypoints;
    let start = this.worldToMinimap(topWaypoints[0].x, topWaypoints[0].y);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < topWaypoints.length; i++) {
      const pt = this.worldToMinimap(topWaypoints[i].x, topWaypoints[i].y);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Mid lane
    ctx.beginPath();
    const midWaypoints = MOBAConfig.LANES.MID.waypoints;
    start = this.worldToMinimap(midWaypoints[0].x, midWaypoints[0].y);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < midWaypoints.length; i++) {
      const pt = this.worldToMinimap(midWaypoints[i].x, midWaypoints[i].y);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Bot lane
    ctx.beginPath();
    const botWaypoints = MOBAConfig.LANES.BOT.waypoints;
    start = this.worldToMinimap(botWaypoints[0].x, botWaypoints[0].y);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < botWaypoints.length; i++) {
      const pt = this.worldToMinimap(botWaypoints[i].x, botWaypoints[i].y);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  /**
   * Render entities from server state.
   */
  private renderEntities(ctx: CanvasRenderingContext2D): void {
    const entities = this.stateManager.getEntities();

    // Sort by entity type for consistent layering (structures first, then minions, then champions)
    const sortedEntities = [...entities].sort((a, b) => {
      const order = [EntityType.NEXUS, EntityType.TOWER, EntityType.MINION, EntityType.JUNGLE_CAMP, EntityType.CHAMPION];
      return order.indexOf(a.snapshot.entityType) - order.indexOf(b.snapshot.entityType);
    });

    for (const entity of sortedEntities) {
      const snapshot = entity.snapshot;
      const isPlayerTeam = 'side' in snapshot && (snapshot as any).side === this.localSide;

      // Skip dead entities
      if ('isDead' in snapshot && (snapshot as any).isDead) continue;
      if ('isDestroyed' in snapshot && (snapshot as any).isDestroyed) continue;

      const pos = this.worldToMinimap(entity.position.x, entity.position.y);

      switch (snapshot.entityType) {
        case EntityType.CHAMPION:
          this.renderChampion(ctx, pos, isPlayerTeam, entity);
          break;
        case EntityType.MINION:
          this.renderMinion(ctx, pos, isPlayerTeam);
          break;
        case EntityType.TOWER:
          this.renderTower(ctx, pos, isPlayerTeam);
          break;
        case EntityType.NEXUS:
          // Nexus already rendered in terrain
          break;
        case EntityType.JUNGLE_CAMP:
          this.renderJungleCreature(ctx, pos);
          break;
      }
    }
  }

  /**
   * Render a champion on the minimap.
   */
  private renderChampion(
    ctx: CanvasRenderingContext2D,
    pos: { x: number; y: number },
    isPlayerTeam: boolean,
    entity: InterpolatedEntity
  ): void {
    const isLocalPlayer = entity.snapshot.entityId === this.stateManager.getLocalEntityId();
    const radius = isLocalPlayer ? 7 : (isPlayerTeam ? 6 : 5);
    const color = isPlayerTeam ? '#00ff00' : '#ff4444';

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw border for local player champion
    if (isLocalPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  /**
   * Render a minion on the minimap.
   */
  private renderMinion(
    ctx: CanvasRenderingContext2D,
    pos: { x: number; y: number },
    isPlayerTeam: boolean
  ): void {
    const radius = 2;
    const color = isPlayerTeam ? '#88cc88' : '#cc8888';

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render a tower on the minimap.
   */
  private renderTower(
    ctx: CanvasRenderingContext2D,
    pos: { x: number; y: number },
    isPlayerTeam: boolean
  ): void {
    const towerSize = 6;
    const color = isPlayerTeam ? '#4488ff' : '#ff4444';

    ctx.fillStyle = color;
    ctx.fillRect(
      pos.x - towerSize / 2,
      pos.y - towerSize / 2,
      towerSize,
      towerSize
    );

    // Draw border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      pos.x - towerSize / 2,
      pos.y - towerSize / 2,
      towerSize,
      towerSize
    );
  }

  /**
   * Render a jungle creature on the minimap.
   */
  private renderJungleCreature(
    ctx: CanvasRenderingContext2D,
    pos: { x: number; y: number }
  ): void {
    const radius = 3;
    ctx.fillStyle = '#ffaa00'; // Orange for jungle creatures

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Render the local player's movement path on the minimap.
   */
  private renderPlayerPath(ctx: CanvasRenderingContext2D): void {
    // Find the local player's entity
    const localEntityId = this.stateManager.getLocalEntityId();
    if (!localEntityId) return;

    const localEntity = this.stateManager.getEntity(localEntityId);
    if (!localEntity) return;

    const snapshot = localEntity.snapshot;

    // Check if player has a movement target
    const targetX = (snapshot as any).targetX;
    const targetY = (snapshot as any).targetY;

    if (targetX === undefined || targetY === undefined) return;

    // Get positions on minimap
    const startPos = this.worldToMinimap(localEntity.position.x, localEntity.position.y);
    const endPos = this.worldToMinimap(targetX, targetY);

    // Draw dashed line from champion to destination
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();

    // Draw X marker at destination
    ctx.setLineDash([]); // Reset dash
    const markerSize = 4;

    ctx.beginPath();
    ctx.moveTo(endPos.x - markerSize, endPos.y - markerSize);
    ctx.lineTo(endPos.x + markerSize, endPos.y + markerSize);
    ctx.moveTo(endPos.x + markerSize, endPos.y - markerSize);
    ctx.lineTo(endPos.x - markerSize, endPos.y + markerSize);
    ctx.stroke();

    // Reset line dash for other rendering
    ctx.setLineDash([]);
  }

  /**
   * Render camera viewport rectangle.
   */
  private renderCameraViewport(ctx: CanvasRenderingContext2D, gctx: GameContext): void {
    const { camera, canvasRenderingContext } = gctx;
    const canvas = canvasRenderingContext.canvas;

    // Calculate viewport in world space
    const viewWidth = canvas.width / camera.zoom;
    const viewHeight = canvas.height / camera.zoom;

    const topLeft = this.worldToMinimap(
      camera.position.x - viewWidth / 2,
      camera.position.y - viewHeight / 2
    );
    const bottomRight = this.worldToMinimap(
      camera.position.x + viewWidth / 2,
      camera.position.y + viewHeight / 2
    );

    // Clamp to minimap bounds
    const x = Math.max(this.minimapX, topLeft.x);
    const y = Math.max(this.minimapY, topLeft.y);
    const w = Math.min(this.minimapX + this.config.size, bottomRight.x) - x;
    const h = Math.min(this.minimapY + this.config.size, bottomRight.y) - y;

    // Draw viewport rectangle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Fill with semi-transparent
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x, y, w, h);
  }
}

export default OnlineMinimap;
