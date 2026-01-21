/**
 * MapBuilder - Main map editor controller.
 *
 * Handles:
 * - Camera controls (pan, zoom)
 * - Tool management
 * - Input handling
 * - Rendering
 * - Save/Load
 */

import Vector from '@/physics/vector';
import {
  MapData,
  createEmptyMap,
  serializeMap,
  deserializeMap,
  TerrainType,
  TERRAIN_COLORS,
  TERRAIN_CELL_SIZE,
  JUNGLE_CREATURES,
} from './MapData';
import {
  Tool,
  ToolType,
  ToolMouseEvent,
  ToolRenderContext,
  SelectTool,
  TerrainTool,
  WallTool,
  BushTool,
  TowerTool,
  NexusTool,
  JungleTool,
  LaneTool,
  DecorationTool,
  SpawnTool,
  EraseTool,
} from './tools';

/**
 * Map Builder configuration.
 */
export interface MapBuilderConfig {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
}

/**
 * MapBuilder class.
 */
export class MapBuilder {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  /** Current map data */
  private mapData: MapData;

  /** Camera state */
  private cameraPos = new Vector(0, 0);
  private zoom = 0.5;
  private minZoom = 0.1;
  private maxZoom = 2;

  /** Input state */
  private mousePos = new Vector(0, 0);
  private mouseWorldPos = new Vector(0, 0);
  private isMouseDown = false;
  private isPanning = false;
  private lastMousePos = new Vector(0, 0);
  private leftMouseDown = false;
  private rightMouseDown = false;
  private leftMouseJustPressed = false;
  private leftMouseJustReleased = false;
  private shiftKey = false;
  private ctrlKey = false;

  /** Tools */
  private tools: Map<ToolType, Tool> = new Map();
  private currentTool: Tool;

  /** Grid settings */
  private showGrid = true;
  private gridSize = 50;

  /** Callback for UI updates */
  private onToolChange?: (tool: Tool) => void;
  private onMapChange?: (mapData: MapData) => void;

  /** Animation frame ID */
  private animationFrameId: number | null = null;

  /** Running state */
  private isRunning = false;

  constructor(config: MapBuilderConfig) {
    this.canvas = config.canvas;
    this.ctx = config.canvas.getContext('2d')!;

    // Create empty map
    this.mapData = createEmptyMap(config.width ?? 3000, config.height ?? 3000);

    // Initialize tools
    this.initTools();
    this.currentTool = this.tools.get('select')!;

    // Setup event listeners
    this.setupEventListeners();
  }

  private initTools(): void {
    this.tools.set('select', new SelectTool());
    this.tools.set('terrain', new TerrainTool());
    this.tools.set('wall', new WallTool());
    this.tools.set('bush', new BushTool());
    this.tools.set('tower', new TowerTool());
    this.tools.set('nexus', new NexusTool());
    this.tools.set('jungle', new JungleTool());
    this.tools.set('lane', new LaneTool());
    this.tools.set('decoration', new DecorationTool());
    this.tools.set('spawn', new SpawnTool());
    this.tools.set('erase', new EraseTool());
  }

  private setupEventListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private onMouseDown(e: MouseEvent): void {
    this.updateMousePos(e);

    if (e.button === 0) {
      this.leftMouseDown = true;
      this.leftMouseJustPressed = true;
    }

    if (e.button === 2) {
      this.rightMouseDown = true;
    }

    // Middle mouse or right mouse for panning
    if (e.button === 1 || (e.button === 2 && !this.currentTool)) {
      this.isPanning = true;
      this.lastMousePos = this.mousePos.clone();
    }

    // Pass to current tool
    if (this.currentTool && e.button === 0) {
      this.currentTool.onMouseDown?.(this.createToolEvent(), this.mapData);
    }
  }

  private onMouseMove(e: MouseEvent): void {
    this.updateMousePos(e);

    // Handle panning
    if (this.isPanning) {
      const delta = new Vector(
        e.clientX - this.lastMousePos.x,
        e.clientY - this.lastMousePos.y
      );
      this.cameraPos.x -= delta.x / this.zoom;
      this.cameraPos.y -= delta.y / this.zoom;
      this.lastMousePos = new Vector(e.clientX, e.clientY);
    }

    // Pass to current tool
    if (this.currentTool) {
      this.currentTool.onMouseMove?.(this.createToolEvent(), this.mapData);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.leftMouseDown = false;
      this.leftMouseJustReleased = true;
    }

    if (e.button === 2) {
      this.rightMouseDown = false;
    }

    if (e.button === 1 || e.button === 2) {
      this.isPanning = false;
    }

    // Pass to current tool
    if (this.currentTool && e.button === 0) {
      this.currentTool.onMouseUp?.(this.createToolEvent(), this.mapData);
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

    // Zoom toward mouse position
    const mouseWorldBefore = this.screenToWorld(this.mousePos);
    this.zoom = newZoom;
    const mouseWorldAfter = this.screenToWorld(this.mousePos);

    this.cameraPos.x += mouseWorldBefore.x - mouseWorldAfter.x;
    this.cameraPos.y += mouseWorldBefore.y - mouseWorldAfter.y;
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.shiftKey = e.shiftKey;
    this.ctrlKey = e.ctrlKey || e.metaKey;

    // Tool shortcuts
    const toolShortcuts: Record<string, ToolType> = {
      'v': 'select',
      'b': 'terrain',
      'w': 'wall',
      'g': 'bush',
      't': 'tower',
      'n': 'nexus',
      'j': 'jungle',
      'l': 'lane',
      'd': 'decoration',
      'p': 'spawn',
      'x': 'erase',
    };

    if (!this.ctrlKey && toolShortcuts[e.key.toLowerCase()]) {
      this.setTool(toolShortcuts[e.key.toLowerCase()]);
      return;
    }

    // Save/Load shortcuts
    if (this.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      this.saveToFile();
      return;
    }

    if (this.ctrlKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      this.loadFromFile();
      return;
    }

    // Grid toggle
    if (e.key.toLowerCase() === 'h') {
      this.showGrid = !this.showGrid;
      return;
    }

    // Pass to current tool
    if (this.currentTool) {
      this.currentTool.onKeyDown?.(e.key, this.mapData);
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.shiftKey = e.shiftKey;
    this.ctrlKey = e.ctrlKey || e.metaKey;
  }

  private updateMousePos(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePos = new Vector(e.clientX - rect.left, e.clientY - rect.top);
    this.mouseWorldPos = this.screenToWorld(this.mousePos);
  }

  private createToolEvent(): ToolMouseEvent {
    return {
      worldPos: this.mouseWorldPos.clone(),
      screenPos: this.mousePos.clone(),
      leftButton: this.leftMouseDown,
      rightButton: this.rightMouseDown,
      justPressed: this.leftMouseJustPressed,
      justReleased: this.leftMouseJustReleased,
      shiftKey: this.shiftKey,
      ctrlKey: this.ctrlKey,
    };
  }

  private screenToWorld(screen: Vector): Vector {
    return new Vector(
      (screen.x - this.canvas.width / 2) / this.zoom + this.cameraPos.x,
      (screen.y - this.canvas.height / 2) / this.zoom + this.cameraPos.y
    );
  }

  private worldToScreen(world: Vector): Vector {
    return new Vector(
      (world.x - this.cameraPos.x) * this.zoom + this.canvas.width / 2,
      (world.y - this.cameraPos.y) * this.zoom + this.canvas.height / 2
    );
  }

  /**
   * Start the editor loop.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  /**
   * Stop the editor loop.
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    this.render();

    // Clear just-pressed states
    this.leftMouseJustPressed = false;
    this.leftMouseJustReleased = false;

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private render(): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    ctx.save();

    // Apply camera transform
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cameraPos.x, -this.cameraPos.y);

    // Render terrain
    this.renderTerrain(ctx);

    // Render grid
    if (this.showGrid) {
      this.renderGrid(ctx);
    }

    // Render map objects
    this.renderObjects(ctx);

    ctx.restore();

    // Render tool overlay (in screen space)
    const toolCtx: ToolRenderContext = {
      ctx,
      worldToScreen: this.worldToScreen.bind(this),
      screenToWorld: this.screenToWorld.bind(this),
      zoom: this.zoom,
    };

    if (this.currentTool) {
      this.currentTool.render?.(toolCtx, this.mapData);
    }

    // Render UI overlay
    this.renderUIOverlay(ctx);
  }

  private renderTerrain(ctx: CanvasRenderingContext2D): void {
    const { terrainGrid, size } = this.mapData;
    const halfWidth = size.width / 2;
    const halfHeight = size.height / 2;

    for (let y = 0; y < terrainGrid.length; y++) {
      for (let x = 0; x < terrainGrid[y].length; x++) {
        const terrainType = terrainGrid[y][x] as TerrainType;
        const worldX = x * TERRAIN_CELL_SIZE - halfWidth;
        const worldY = y * TERRAIN_CELL_SIZE - halfHeight;

        ctx.fillStyle = TERRAIN_COLORS[terrainType];
        ctx.fillRect(worldX, worldY, TERRAIN_CELL_SIZE, TERRAIN_CELL_SIZE);
      }
    }
  }

  private renderGrid(ctx: CanvasRenderingContext2D): void {
    const { size } = this.mapData;
    const halfWidth = size.width / 2;
    const halfHeight = size.height / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1 / this.zoom;

    // Draw vertical lines
    for (let x = -halfWidth; x <= halfWidth; x += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, -halfHeight);
      ctx.lineTo(x, halfHeight);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = -halfHeight; y <= halfHeight; y += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(-halfWidth, y);
      ctx.lineTo(halfWidth, y);
      ctx.stroke();
    }

    // Draw center lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, -halfHeight);
    ctx.lineTo(0, halfHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-halfWidth, 0);
    ctx.lineTo(halfWidth, 0);
    ctx.stroke();
  }

  private renderObjects(ctx: CanvasRenderingContext2D): void {
    // Render walls
    ctx.fillStyle = '#666666';
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 2;
    for (const wall of this.mapData.walls) {
      ctx.fillRect(
        wall.x - wall.width / 2,
        wall.y - wall.height / 2,
        wall.width,
        wall.height
      );
      ctx.strokeRect(
        wall.x - wall.width / 2,
        wall.y - wall.height / 2,
        wall.width,
        wall.height
      );
    }

    // Render bush groups
    ctx.fillStyle = 'rgba(34, 139, 34, 0.6)';
    ctx.strokeStyle = '#228b22';
    for (const bush of this.mapData.bushGroups) {
      ctx.beginPath();
      ctx.ellipse(bush.x, bush.y, 60, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Render lanes
    for (const lane of this.mapData.lanes) {
      if (lane.waypoints.length < 2) continue;

      ctx.strokeStyle = 'rgba(255, 170, 0, 0.3)';
      ctx.lineWidth = lane.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(lane.waypoints[0].x, lane.waypoints[0].y);
      for (let i = 1; i < lane.waypoints.length; i++) {
        ctx.lineTo(lane.waypoints[i].x, lane.waypoints[i].y);
      }
      ctx.stroke();

      // Draw lane center line
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Render jungle camps
    ctx.fillStyle = 'rgba(139, 90, 43, 0.6)';
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 2;
    for (const camp of this.mapData.jungleCamps) {
      ctx.beginPath();
      ctx.arc(camp.x, camp.y, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw creature icon from JUNGLE_CREATURES
      const creatureInfo = JUNGLE_CREATURES[camp.creatureType];
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(creatureInfo?.icon || '🐻', camp.x, camp.y);
    }

    // Render towers
    for (const tower of this.mapData.towers) {
      const color = tower.side === 0 ? '#0066ff' : '#ff3333';
      ctx.fillStyle = color + '88';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw tower icon
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🗼', tower.x, tower.y);
    }

    // Render nexuses
    for (const nexus of this.mapData.nexuses) {
      const color = nexus.side === 0 ? '#0099ff' : '#ff6666';
      ctx.fillStyle = color + '66';
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.arc(nexus.x, nexus.y, 75, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw nexus icon
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('🏰', nexus.x, nexus.y);
    }

    // Render spawn points
    for (const spawn of this.mapData.spawnPoints) {
      const color = spawn.side === 0 ? '#00ff00' : '#ff0000';
      ctx.fillStyle = color + '88';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Draw star shape
      ctx.beginPath();
      const spikes = 5;
      const outerRadius = 20;
      const innerRadius = 10;

      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const x = spawn.x + Math.cos(angle) * radius;
        const y = spawn.y + Math.sin(angle) * radius;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Render decorations
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const decorIcons: Record<string, string> = {
      tree: '🌳',
      rock: '🪨',
      flower: '🌸',
      mushroom: '🍄',
      stump: '🪵',
    };
    for (const decor of this.mapData.decorations) {
      ctx.fillText(decorIcons[decor.type] || '?', decor.x, decor.y);
    }
  }

  private renderUIOverlay(ctx: CanvasRenderingContext2D): void {
    // Map info
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, 10, 200, 80);

    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Map: ${this.mapData.name}`, 20, 30);
    ctx.fillText(`Size: ${this.mapData.size.width}x${this.mapData.size.height}`, 20, 50);
    ctx.fillText(`Tool: ${this.currentTool.name}`, 20, 70);

    // Controls help
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(this.canvas.width - 210, 10, 200, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Controls:', this.canvas.width - 200, 28);
    ctx.fillText('Middle/Right drag: Pan', this.canvas.width - 200, 45);
    ctx.fillText('Scroll: Zoom', this.canvas.width - 200, 60);
    ctx.fillText('H: Toggle grid', this.canvas.width - 200, 75);
    ctx.fillText('Ctrl+S: Save | Ctrl+O: Load', this.canvas.width - 200, 90);

    // Coordinates
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(10, this.canvas.height - 40, 150, 30);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      `X: ${Math.round(this.mouseWorldPos.x)} Y: ${Math.round(this.mouseWorldPos.y)}`,
      20,
      this.canvas.height - 20
    );
  }

  // ==================
  // Public API
  // ==================

  /**
   * Set the current tool.
   */
  setTool(type: ToolType): void {
    const tool = this.tools.get(type);
    if (!tool) return;

    this.currentTool.onDeactivate?.();
    this.currentTool = tool;
    this.currentTool.onActivate?.();

    this.onToolChange?.(tool);
  }

  /**
   * Get the current tool.
   */
  getCurrentTool(): Tool {
    return this.currentTool;
  }

  /**
   * Get all available tools.
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get the current map data.
   */
  getMapData(): MapData {
    return this.mapData;
  }

  /**
   * Set map data.
   */
  setMapData(data: MapData): void {
    this.mapData = data;
    this.onMapChange?.(data);
  }

  /**
   * Create a new empty map.
   */
  newMap(width = 3000, height = 3000): void {
    this.mapData = createEmptyMap(width, height);
    this.cameraPos = new Vector(0, 0);
    this.zoom = 0.5;
    this.onMapChange?.(this.mapData);
  }

  /**
   * Save map to a JSON file.
   */
  saveToFile(): void {
    const json = serializeMap(this.mapData);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.mapData.name.replace(/\s+/g, '_')}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Load map from a JSON file.
   */
  loadFromFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const json = event.target?.result as string;
        const data = deserializeMap(json);
        if (data) {
          this.mapData = data;
          this.cameraPos = new Vector(0, 0);
          this.onMapChange?.(data);
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  /**
   * Save map to localStorage.
   */
  saveToLocalStorage(key = 'mapBuilder_autosave'): void {
    const json = serializeMap(this.mapData);
    localStorage.setItem(key, json);
  }

  /**
   * Load map from localStorage.
   */
  loadFromLocalStorage(key = 'mapBuilder_autosave'): boolean {
    const json = localStorage.getItem(key);
    if (!json) return false;

    const data = deserializeMap(json);
    if (data) {
      this.mapData = data;
      this.onMapChange?.(data);
      return true;
    }
    return false;
  }

  /**
   * Set callback for tool changes.
   */
  setOnToolChange(callback: (tool: Tool) => void): void {
    this.onToolChange = callback;
  }

  /**
   * Set callback for map changes.
   */
  setOnMapChange(callback: (mapData: MapData) => void): void {
    this.onMapChange = callback;
  }

  /**
   * Get a specific tool.
   */
  getTool<T extends Tool>(type: ToolType): T | undefined {
    return this.tools.get(type) as T | undefined;
  }

  /**
   * Set map name.
   */
  setMapName(name: string): void {
    this.mapData.name = name;
  }

  /**
   * Cleanup.
   */
  destroy(): void {
    this.stop();
  }
}
