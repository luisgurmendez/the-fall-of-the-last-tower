/**
 * Minimap - Shows a small overhead view of the map with fog of war.
 *
 * Features:
 * - Displays the entire map in a small corner view
 * - Shows fog of war for the player's team
 * - Displays unit positions (champions, wards, structures)
 * - Shows camera viewport rectangle
 * - Click to move camera
 */

import { ScreenEntity } from '@/core/GameObject';
import GameContext from '@/core/gameContext';
import RenderElement from '@/render/renderElement';
import Vector from '@/physics/vector';
import { MOBAConfig } from '@/map/MOBAConfig';
import { Champion } from '@/champions/Champion';
import { Ward } from '@/objects/ward';
import { Tower } from '@/structures';
import { InputManager } from '@/core/input/InputManager';
import type { FogOfWar } from '@/core/FogOfWar';
import ArmyUnit from '@/objects/army/armyUnit';

/**
 * Minimap configuration.
 */
export interface MinimapConfig {
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
  /** Show fog of war */
  showFog: boolean;
  /** Fog colors */
  fogColors: {
    unexplored: string;
    explored: string;
  };
}

const DEFAULT_MINIMAP_CONFIG: MinimapConfig = {
  size: 200,
  margin: 16,
  corner: 'bottom-left',
  borderWidth: 3,
  backgroundColor: '#1a1a2e',
  borderColor: '#3a3a5c',
  showFog: true,
  fogColors: {
    unexplored: 'rgba(0, 0, 0, 1)',
    explored: 'rgba(0, 0, 0, 0.6)',
  },
};

/**
 * Minimap UI component.
 */
export class Minimap extends ScreenEntity {
  private config: MinimapConfig;
  private inputManager: InputManager;

  // Map dimensions (using MOBA map size)
  private readonly mapSize: number = MOBAConfig.MAP_SIZE.width;
  private readonly mapHalfSize: number = MOBAConfig.MAP_SIZE.width / 2;

  // Cached minimap position
  private minimapX: number = 0;
  private minimapY: number = 0;

  // Offscreen canvas for fog rendering
  private fogCanvas: HTMLCanvasElement | null = null;
  private fogCtx: CanvasRenderingContext2D | null = null;
  private fogCellSize: number = 4; // Pixels per fog cell on minimap

  // Click state
  private isHovering: boolean = false;
  private isDragging: boolean = false;

  constructor(config: Partial<MinimapConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MINIMAP_CONFIG, ...config };
    this.inputManager = InputManager.getInstance();

    // Create offscreen canvas for fog
    this.fogCanvas = document.createElement('canvas');
    this.fogCtx = this.fogCanvas.getContext('2d');
  }

  /**
   * Convert world position to minimap position.
   */
  private worldToMinimap(worldPos: Vector): { x: number; y: number } {
    const scale = this.config.size / this.mapSize;
    return {
      x: this.minimapX + (worldPos.x + this.mapHalfSize) * scale,
      y: this.minimapY + (worldPos.y + this.mapHalfSize) * scale,
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

  /**
   * Render fog of war to the offscreen canvas.
   */
  private renderFogToCanvas(fogOfWar: FogOfWar, localPlayerTeam: number): void {
    if (!this.fogCanvas || !this.fogCtx) return;

    const grid = fogOfWar.getGrid(localPlayerTeam);
    if (!grid) return;

    const dims = grid.getDimensions();
    const cells = grid.getCells();

    // Calculate minimap fog resolution
    const fogWidth = Math.ceil(this.config.size / this.fogCellSize);
    const fogHeight = Math.ceil(this.config.size / this.fogCellSize);

    // Resize canvas if needed
    if (this.fogCanvas.width !== fogWidth || this.fogCanvas.height !== fogHeight) {
      this.fogCanvas.width = fogWidth;
      this.fogCanvas.height = fogHeight;
    }

    const ctx = this.fogCtx;
    const imageData = ctx.createImageData(fogWidth, fogHeight);
    const data = imageData.data;

    // Sample fog grid and write to image data
    const worldToGridScale = dims.width / this.mapSize;
    const minimapToGridScale = this.mapSize / this.config.size * worldToGridScale;

    for (let py = 0; py < fogHeight; py++) {
      for (let px = 0; px < fogWidth; px++) {
        // Convert minimap pixel to grid cell
        const worldX = (px * this.fogCellSize / this.config.size) * this.mapSize - this.mapHalfSize;
        const worldY = (py * this.fogCellSize / this.config.size) * this.mapSize - this.mapHalfSize;

        const gridX = Math.floor((worldX + this.mapHalfSize) / dims.cellSize);
        const gridY = Math.floor((worldY + this.mapHalfSize) / dims.cellSize);

        let alpha = 0;
        if (gridX >= 0 && gridX < dims.width && gridY >= 0 && gridY < dims.height) {
          const state = cells[gridY][gridX];
          if (state === 'unexplored') {
            alpha = 255;
          } else if (state === 'explored') {
            alpha = 150;
          }
          // visible = alpha 0
        } else {
          alpha = 255; // Outside map is unexplored
        }

        const idx = (py * fogWidth + px) * 4;
        data[idx] = 0;     // R
        data[idx + 1] = 0; // G
        data[idx + 2] = 0; // B
        data[idx + 3] = alpha; // A
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  override render(): RenderElement {
    return this.createOverlayRender((gctx: GameContext) => {
      const ctx = gctx.canvasRenderingContext;
      const { size, borderWidth, backgroundColor, borderColor } = this.config;

      ctx.save();

      // Draw background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(this.minimapX, this.minimapY, size, size);

      // Draw terrain representation (simple green for lanes/bases)
      this.renderTerrain(ctx, gctx);

      // Draw fog of war (only if enabled at game level)
      if (this.config.showFog && gctx.fogOfWar && gctx.fogOfWar.isEnabled()) {
        this.renderFogToCanvas(gctx.fogOfWar, gctx.localPlayerTeam);
        if (this.fogCanvas) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            this.fogCanvas,
            this.minimapX,
            this.minimapY,
            size,
            size
          );
          ctx.imageSmoothingEnabled = true;
        }
      }

      // Draw structures (towers)
      this.renderStructures(ctx, gctx);

      // Draw units
      this.renderUnits(ctx, gctx);

      // Draw player path
      this.renderPlayerPath(ctx, gctx);

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
   * Render terrain features on the minimap.
   */
  private renderTerrain(ctx: CanvasRenderingContext2D, gctx: GameContext): void {
    const { size } = this.config;
    const scale = size / this.mapSize;

    // Draw nexus indicators
    const nexusRadius = MOBAConfig.NEXUS.RADIUS * scale;

    // Blue nexus (bottom-left in world coords, which is bottom-left on minimap)
    const blueNexusPos = this.worldToMinimap(new Vector(MOBAConfig.NEXUS.BLUE.x, MOBAConfig.NEXUS.BLUE.y));
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.arc(blueNexusPos.x, blueNexusPos.y, nexusRadius, 0, Math.PI * 2);
    ctx.fill();

    // Red nexus (top-right in world coords)
    const redNexusPos = this.worldToMinimap(new Vector(MOBAConfig.NEXUS.RED.x, MOBAConfig.NEXUS.RED.y));
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(redNexusPos.x, redNexusPos.y, nexusRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw lanes
    ctx.strokeStyle = '#3d5a3d';
    ctx.lineWidth = MOBAConfig.LANES.TOP.width * scale * 0.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Top lane
    ctx.beginPath();
    const topWaypoints = MOBAConfig.LANES.TOP.waypoints;
    let start = this.worldToMinimap(topWaypoints[0]);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < topWaypoints.length; i++) {
      const pt = this.worldToMinimap(topWaypoints[i]);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Mid lane
    ctx.beginPath();
    const midWaypoints = MOBAConfig.LANES.MID.waypoints;
    start = this.worldToMinimap(midWaypoints[0]);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < midWaypoints.length; i++) {
      const pt = this.worldToMinimap(midWaypoints[i]);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Bot lane
    ctx.beginPath();
    const botWaypoints = MOBAConfig.LANES.BOT.waypoints;
    start = this.worldToMinimap(botWaypoints[0]);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < botWaypoints.length; i++) {
      const pt = this.worldToMinimap(botWaypoints[i]);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  /**
   * Render units on the minimap.
   */
  private renderUnits(ctx: CanvasRenderingContext2D, gctx: GameContext): void {
    const { objects, fogOfWar } = gctx;

    for (const obj of objects) {
      // Check visibility for enemy units
      const isChampion = obj instanceof Champion;
      const isWard = obj instanceof Ward;
      const isMinion = obj instanceof ArmyUnit;

      if (!isChampion && !isWard && !isMinion) continue;

      const pos = obj.getPosition();
      const teamId = obj.getTeamId();
      const isPlayerTeam = teamId === gctx.localPlayerTeam;

      // Skip enemy units not in fog
      if (!isPlayerTeam && fogOfWar && this.config.showFog) {
        if (!fogOfWar.isVisibleTo(gctx.localPlayerTeam, pos)) {
          continue;
        }
      }

      const minimapPos = this.worldToMinimap(pos);

      if (isChampion) {
        const champion = obj as Champion;
        if (champion.isDead()) continue;

        // Draw champion dot
        const radius = isPlayerTeam ? 6 : 5;
        const color = isPlayerTeam ? '#00ff00' : '#ff4444';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(minimapPos.x, minimapPos.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw border for player champion
        if (isPlayerTeam) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else if (isWard) {
        const ward = obj as Ward;

        // Only show player team wards or revealed enemy wards
        if (!isPlayerTeam && !ward.isVisibleTo(gctx.localPlayerTeam)) continue;

        // Draw ward as small diamond
        const wardSize = 4;
        const color = isPlayerTeam ? '#00ced1' : '#ff8800';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(minimapPos.x, minimapPos.y - wardSize);
        ctx.lineTo(minimapPos.x + wardSize, minimapPos.y);
        ctx.lineTo(minimapPos.x, minimapPos.y + wardSize);
        ctx.lineTo(minimapPos.x - wardSize, minimapPos.y);
        ctx.closePath();
        ctx.fill();
      } else if (isMinion) {
        const minion = obj as ArmyUnit;
        if (minion.shouldDispose) continue;

        // Draw minion as small dot
        const radius = 2;
        const color = isPlayerTeam ? '#88cc88' : '#cc8888';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(minimapPos.x, minimapPos.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Render structures (towers) on the minimap.
   */
  private renderStructures(ctx: CanvasRenderingContext2D, gctx: GameContext): void {
    const { objects, fogOfWar } = gctx;
    const { size } = this.config;
    const scale = size / this.mapSize;

    for (const obj of objects) {
      if (!(obj instanceof Tower)) continue;

      const tower = obj as Tower;
      if (tower.isDestroyed()) continue;

      const pos = tower.getPosition();
      const side = tower.getSide();
      const isPlayerTeam = side === gctx.localPlayerTeam;

      // Skip enemy towers not visible in fog
      if (!isPlayerTeam && fogOfWar && this.config.showFog) {
        if (!fogOfWar.isVisibleTo(gctx.localPlayerTeam, pos)) {
          continue;
        }
      }

      const minimapPos = this.worldToMinimap(pos);

      // Draw tower as a small square
      const towerSize = 5;
      const color = isPlayerTeam ? '#4488ff' : '#ff4444';

      ctx.fillStyle = color;
      ctx.fillRect(
        minimapPos.x - towerSize / 2,
        minimapPos.y - towerSize / 2,
        towerSize,
        towerSize
      );

      // Draw border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        minimapPos.x - towerSize / 2,
        minimapPos.y - towerSize / 2,
        towerSize,
        towerSize
      );
    }
  }

  /**
   * Render the player's current movement path on the minimap.
   */
  private renderPlayerPath(ctx: CanvasRenderingContext2D, gctx: GameContext): void {
    const { objects } = gctx;

    // Find the player's champion
    let playerChampion: Champion | null = null;
    for (const obj of objects) {
      if (obj instanceof Champion && obj.getTeamId() === gctx.localPlayerTeam && !obj.isDead()) {
        playerChampion = obj;
        break;
      }
    }

    if (!playerChampion) return;

    // Get the current path from the champion
    const { path, pathIndex } = playerChampion.getCurrentPath();

    if (!path || path.length === 0) return;

    // Draw path from current position through remaining waypoints
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    // Start from champion's current position
    const startPos = this.worldToMinimap(playerChampion.getPosition());
    ctx.moveTo(startPos.x, startPos.y);

    // Draw to each remaining waypoint
    for (let i = pathIndex; i < path.length; i++) {
      const waypoint = this.worldToMinimap(path[i]);
      ctx.lineTo(waypoint.x, waypoint.y);
    }

    ctx.stroke();

    // Draw destination marker (final waypoint)
    if (path.length > 0) {
      const destPos = this.worldToMinimap(path[path.length - 1]);

      // Draw X marker at destination
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      const markerSize = 4;
      ctx.beginPath();
      ctx.moveTo(destPos.x - markerSize, destPos.y - markerSize);
      ctx.lineTo(destPos.x + markerSize, destPos.y + markerSize);
      ctx.moveTo(destPos.x + markerSize, destPos.y - markerSize);
      ctx.lineTo(destPos.x - markerSize, destPos.y + markerSize);
      ctx.stroke();
    }

    // Reset line dash
    ctx.setLineDash([]);
  }

  /**
   * Render camera viewport rectangle on minimap.
   */
  private renderCameraViewport(ctx: CanvasRenderingContext2D, gctx: GameContext): void {
    const { camera, canvasRenderingContext } = gctx;
    const canvas = canvasRenderingContext.canvas;

    // Calculate viewport in world space
    const viewWidth = canvas.width / camera.zoom;
    const viewHeight = canvas.height / camera.zoom;

    const topLeft = new Vector(
      camera.position.x - viewWidth / 2,
      camera.position.y - viewHeight / 2
    );
    const bottomRight = new Vector(
      camera.position.x + viewWidth / 2,
      camera.position.y + viewHeight / 2
    );

    // Convert to minimap coordinates
    const mmTopLeft = this.worldToMinimap(topLeft);
    const mmBottomRight = this.worldToMinimap(bottomRight);

    // Clamp to minimap bounds
    const x = Math.max(this.minimapX, mmTopLeft.x);
    const y = Math.max(this.minimapY, mmTopLeft.y);
    const w = Math.min(this.minimapX + this.config.size, mmBottomRight.x) - x;
    const h = Math.min(this.minimapY + this.config.size, mmBottomRight.y) - y;

    // Draw viewport rectangle
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Fill with semi-transparent
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x, y, w, h);
  }
}

export default Minimap;
