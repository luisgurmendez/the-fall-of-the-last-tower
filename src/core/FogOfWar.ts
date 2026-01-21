/**
 * Fog of War System
 *
 * Tracks visibility for each team. Areas are revealed by units with sight range.
 * Uses a grid-based system for performance.
 *
 * Visibility states:
 * - Unexplored: Never seen (black)
 * - Explored: Previously seen but not currently visible (dark)
 * - Visible: Currently visible by a friendly unit (clear)
 */

import Vector from '@/physics/vector';
import { TeamId, TEAM } from './Team';

/**
 * Visibility state for a cell.
 */
export type VisibilityState = 'unexplored' | 'explored' | 'visible';

/**
 * Configuration for fog of war.
 */
export interface FogOfWarConfig {
  /** Size of each visibility cell in world units */
  cellSize: number;
  /** World width */
  worldWidth: number;
  /** World height */
  worldHeight: number;
  /** Whether fog of war is enabled */
  enabled: boolean;
  /** Initial state for all cells (default: 'unexplored') */
  initialState?: VisibilityState;
}

/**
 * Default fog of war configuration.
 * Using smaller cell size (20) for smoother fog edges.
 */
export const DEFAULT_FOG_CONFIG: FogOfWarConfig = {
  cellSize: 20,
  worldWidth: 4000,
  worldHeight: 4000,
  enabled: true,
};

/**
 * Represents a visible entity that reveals fog.
 */
export interface FogRevealer {
  getPosition(): Vector;
  getTeamId(): TeamId;
  getSightRange(): number;
}

/**
 * Grid storing visibility data for a single team.
 */
class VisibilityGrid {
  private cells: VisibilityState[][];
  private readonly width: number;
  private readonly height: number;
  private readonly cellSize: number;
  private readonly offsetX: number;
  private readonly offsetY: number;

  constructor(config: FogOfWarConfig) {
    this.cellSize = config.cellSize;
    this.width = Math.ceil(config.worldWidth / config.cellSize);
    this.height = Math.ceil(config.worldHeight / config.cellSize);
    this.offsetX = config.worldWidth / 2;
    this.offsetY = config.worldHeight / 2;

    // Initialize all cells to the specified initial state (default: unexplored)
    const initialState = config.initialState ?? 'unexplored';
    this.cells = [];
    for (let y = 0; y < this.height; y++) {
      this.cells[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.cells[y][x] = initialState;
      }
    }
  }

  /**
   * Convert world position to grid coordinates.
   */
  worldToGrid(worldPos: Vector): { x: number; y: number } {
    return {
      x: Math.floor((worldPos.x + this.offsetX) / this.cellSize),
      y: Math.floor((worldPos.y + this.offsetY) / this.cellSize),
    };
  }

  /**
   * Convert grid coordinates to world position (center of cell).
   */
  gridToWorld(gridX: number, gridY: number): Vector {
    return new Vector(
      gridX * this.cellSize - this.offsetX + this.cellSize / 2,
      gridY * this.cellSize - this.offsetY + this.cellSize / 2
    );
  }

  /**
   * Clear all "visible" cells to "explored" (start of frame).
   */
  resetVisibility(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.cells[y][x] === 'visible') {
          this.cells[y][x] = 'explored';
        }
      }
    }
  }

  /**
   * Reveal cells around a position with given sight range.
   */
  reveal(worldPos: Vector, sightRange: number): void {
    const center = this.worldToGrid(worldPos);
    const cellRadius = Math.ceil(sightRange / this.cellSize);

    // Reveal cells in a circle
    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const gx = center.x + dx;
        const gy = center.y + dy;

        // Check bounds
        if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height) {
          continue;
        }

        // Check if within sight range (circular)
        const cellCenter = this.gridToWorld(gx, gy);
        const distance = worldPos.distanceTo(cellCenter);
        if (distance <= sightRange) {
          this.cells[gy][gx] = 'visible';
        }
      }
    }
  }

  /**
   * Get visibility state at a world position.
   */
  getVisibility(worldPos: Vector): VisibilityState {
    const grid = this.worldToGrid(worldPos);
    if (grid.x < 0 || grid.x >= this.width || grid.y < 0 || grid.y >= this.height) {
      return 'unexplored';
    }
    return this.cells[grid.y][grid.x];
  }

  /**
   * Check if a world position is currently visible.
   */
  isVisible(worldPos: Vector): boolean {
    return this.getVisibility(worldPos) === 'visible';
  }

  /**
   * Check if a world position has been explored.
   */
  isExplored(worldPos: Vector): boolean {
    const vis = this.getVisibility(worldPos);
    return vis === 'visible' || vis === 'explored';
  }

  /**
   * Get the grid dimensions.
   */
  getDimensions(): { width: number; height: number; cellSize: number } {
    return {
      width: this.width,
      height: this.height,
      cellSize: this.cellSize,
    };
  }

  /**
   * Get all cells for rendering.
   */
  getCells(): VisibilityState[][] {
    return this.cells;
  }

  /**
   * Get offset for converting to world coords.
   */
  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }
}

/**
 * Main Fog of War manager.
 * Maintains visibility grids for all teams.
 */
export class FogOfWar {
  private grids: Map<TeamId, VisibilityGrid> = new Map();
  private config: FogOfWarConfig;
  private enabled: boolean;

  constructor(config: Partial<FogOfWarConfig> = {}) {
    this.config = { ...DEFAULT_FOG_CONFIG, ...config };
    this.enabled = this.config.enabled;

    // Initialize grid for player team by default
    this.getOrCreateGrid(TEAM.PLAYER);
  }

  /**
   * Get or create visibility grid for a team.
   */
  private getOrCreateGrid(teamId: TeamId): VisibilityGrid {
    let grid = this.grids.get(teamId);
    if (!grid) {
      grid = new VisibilityGrid(this.config);
      this.grids.set(teamId, grid);
    }
    return grid;
  }

  /**
   * Update visibility based on all revealers.
   * Call this once per frame with all units that reveal fog.
   */
  update(revealers: FogRevealer[]): void {
    if (!this.enabled) return;

    // Reset visibility for all grids
    for (const grid of this.grids.values()) {
      grid.resetVisibility();
    }

    // Each revealer reveals fog for their team
    for (const revealer of revealers) {
      const grid = this.getOrCreateGrid(revealer.getTeamId());
      grid.reveal(revealer.getPosition(), revealer.getSightRange());
    }
  }

  /**
   * Check if a position is visible to a specific team.
   */
  isVisibleTo(teamId: TeamId, worldPos: Vector): boolean {
    if (!this.enabled) return true;
    const grid = this.grids.get(teamId);
    return grid ? grid.isVisible(worldPos) : false;
  }

  /**
   * Check if a position has been explored by a team.
   */
  isExploredBy(teamId: TeamId, worldPos: Vector): boolean {
    if (!this.enabled) return true;
    const grid = this.grids.get(teamId);
    return grid ? grid.isExplored(worldPos) : false;
  }

  /**
   * Get visibility state at a position for a team.
   */
  getVisibility(teamId: TeamId, worldPos: Vector): VisibilityState {
    if (!this.enabled) return 'visible';
    const grid = this.grids.get(teamId);
    return grid ? grid.getVisibility(worldPos) : 'unexplored';
  }

  /**
   * Check if an entity is visible to a team.
   */
  isEntityVisibleTo(teamId: TeamId, entity: { getPosition(): Vector }): boolean {
    return this.isVisibleTo(teamId, entity.getPosition());
  }

  /**
   * Enable or disable fog of war.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if fog of war is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the grid for a team (for rendering).
   */
  getGrid(teamId: TeamId): VisibilityGrid | undefined {
    return this.grids.get(teamId);
  }

  /**
   * Get config.
   */
  getConfig(): FogOfWarConfig {
    return this.config;
  }

  /**
   * Reveal entire map for a team (cheat/debug).
   */
  revealAll(teamId: TeamId): void {
    const grid = this.getOrCreateGrid(teamId);
    const dims = grid.getDimensions();
    const offset = grid.getOffset();

    // Reveal every cell by revealing from center with huge range
    for (let y = 0; y < dims.height; y++) {
      for (let x = 0; x < dims.width; x++) {
        const worldPos = new Vector(
          x * dims.cellSize - offset.x + dims.cellSize / 2,
          y * dims.cellSize - offset.y + dims.cellSize / 2
        );
        grid.reveal(worldPos, dims.cellSize);
      }
    }
  }
}

export default FogOfWar;
