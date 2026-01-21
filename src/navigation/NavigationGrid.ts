/**
 * Pre-computed navigation grid for efficient pathfinding.
 * Converts the continuous map into a discrete grid where each cell
 * is marked as walkable or blocked.
 */

import Vector from '@/physics/vector';

/** Grid cell size in world units */
export const CELL_SIZE = 25;

/**
 * A node in the A* pathfinding algorithm.
 */
interface PathNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic (estimated cost to end)
  f: number; // Total cost (g + h)
  parent: PathNode | null;
}

/**
 * Navigation grid for efficient collision detection and pathfinding.
 */
class NavigationGrid {
  /** Grid dimensions */
  readonly width: number;
  readonly height: number;

  /** Map size in world units */
  readonly mapSize: number;

  /**
   * Walkability grid.
   * true = walkable, false = blocked.
   * Stored as flat Uint8Array for memory efficiency.
   */
  private readonly grid: Uint8Array;

  /**
   * Version counter that increments when the grid changes.
   * Units can compare this to their cached path version to know
   * when they need to recalculate their path.
   */
  private _version: number = 0;

  /** Get the current grid version */
  get version(): number {
    return this._version;
  }

  constructor(mapSize: number) {
    this.mapSize = mapSize;
    this.width = Math.ceil(mapSize / CELL_SIZE);
    this.height = Math.ceil(mapSize / CELL_SIZE);
    this.grid = new Uint8Array(this.width * this.height);
    // Initialize all cells as walkable
    this.grid.fill(1);
  }

  /**
   * Convert world position to grid coordinates.
   */
  worldToGrid(worldX: number, worldY: number): { x: number; y: number } {
    // World coordinates are centered (0,0 is center)
    // Grid coordinates start at 0,0 (top-left)
    const halfSize = this.mapSize / 2;
    return {
      x: Math.floor((worldX + halfSize) / CELL_SIZE),
      y: Math.floor((worldY + halfSize) / CELL_SIZE),
    };
  }

  /**
   * Convert grid coordinates to world position (center of cell).
   */
  gridToWorld(gridX: number, gridY: number): Vector {
    const halfSize = this.mapSize / 2;
    return new Vector(
      gridX * CELL_SIZE + CELL_SIZE / 2 - halfSize,
      gridY * CELL_SIZE + CELL_SIZE / 2 - halfSize
    );
  }

  /**
   * Get grid index from grid coordinates.
   */
  private getIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  /**
   * Check if grid coordinates are valid.
   */
  private isValidCell(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Check if a cell is walkable.
   */
  isWalkable(gridX: number, gridY: number): boolean {
    if (!this.isValidCell(gridX, gridY)) return false;
    return this.grid[this.getIndex(gridX, gridY)] === 1;
  }

  /**
   * Check if a world position is walkable.
   */
  isWalkableWorld(worldX: number, worldY: number): boolean {
    const { x, y } = this.worldToGrid(worldX, worldY);
    return this.isWalkable(x, y);
  }

  /**
   * Mark a cell as blocked (internal, doesn't increment version).
   */
  private setBlockedInternal(gridX: number, gridY: number): boolean {
    if (this.isValidCell(gridX, gridY)) {
      const idx = this.getIndex(gridX, gridY);
      if (this.grid[idx] !== 0) {
        this.grid[idx] = 0;
        return true; // Changed
      }
    }
    return false;
  }

  /**
   * Mark a cell as walkable (internal, doesn't increment version).
   */
  private setWalkableInternal(gridX: number, gridY: number): boolean {
    if (this.isValidCell(gridX, gridY)) {
      const idx = this.getIndex(gridX, gridY);
      if (this.grid[idx] !== 1) {
        this.grid[idx] = 1;
        return true; // Changed
      }
    }
    return false;
  }

  /**
   * Mark a cell as blocked.
   */
  setBlocked(gridX: number, gridY: number): void {
    if (this.setBlockedInternal(gridX, gridY)) {
      this._version++;
    }
  }

  /**
   * Mark a cell as walkable.
   */
  setWalkable(gridX: number, gridY: number): void {
    if (this.setWalkableInternal(gridX, gridY)) {
      this._version++;
    }
  }

  /**
   * Block a circular area (for trees, obstacles).
   * Returns true if any cells were changed.
   */
  blockCircle(worldX: number, worldY: number, radius: number): boolean {
    const center = this.worldToGrid(worldX, worldY);
    const cellRadius = Math.ceil(radius / CELL_SIZE);
    let changed = false;

    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const gx = center.x + dx;
        const gy = center.y + dy;

        // Check if cell center is within radius
        const cellCenter = this.gridToWorld(gx, gy);
        const dist = Math.sqrt(
          (cellCenter.x - worldX) ** 2 + (cellCenter.y - worldY) ** 2
        );

        if (dist <= radius + CELL_SIZE / 2) {
          if (this.setBlockedInternal(gx, gy)) {
            changed = true;
          }
        }
      }
    }

    if (changed) {
      this._version++;
    }
    return changed;
  }

  /**
   * Unblock a circular area (remove an obstacle).
   * Returns true if any cells were changed.
   */
  unblockCircle(worldX: number, worldY: number, radius: number): boolean {
    const center = this.worldToGrid(worldX, worldY);
    const cellRadius = Math.ceil(radius / CELL_SIZE);
    let changed = false;

    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const gx = center.x + dx;
        const gy = center.y + dy;

        const cellCenter = this.gridToWorld(gx, gy);
        const dist = Math.sqrt(
          (cellCenter.x - worldX) ** 2 + (cellCenter.y - worldY) ** 2
        );

        if (dist <= radius + CELL_SIZE / 2) {
          if (this.setWalkableInternal(gx, gy)) {
            changed = true;
          }
        }
      }
    }

    if (changed) {
      this._version++;
    }
    return changed;
  }

  /**
   * Block a rectangular area.
   * Returns true if any cells were changed.
   */
  blockRectangle(worldX: number, worldY: number, width: number, height: number): boolean {
    const topLeft = this.worldToGrid(worldX - width / 2, worldY - height / 2);
    const bottomRight = this.worldToGrid(worldX + width / 2, worldY + height / 2);
    let changed = false;

    for (let gy = topLeft.y; gy <= bottomRight.y; gy++) {
      for (let gx = topLeft.x; gx <= bottomRight.x; gx++) {
        if (this.setBlockedInternal(gx, gy)) {
          changed = true;
        }
      }
    }

    if (changed) {
      this._version++;
    }
    return changed;
  }

  /**
   * Unblock a rectangular area.
   * Returns true if any cells were changed.
   */
  unblockRectangle(worldX: number, worldY: number, width: number, height: number): boolean {
    const topLeft = this.worldToGrid(worldX - width / 2, worldY - height / 2);
    const bottomRight = this.worldToGrid(worldX + width / 2, worldY + height / 2);
    let changed = false;

    for (let gy = topLeft.y; gy <= bottomRight.y; gy++) {
      for (let gx = topLeft.x; gx <= bottomRight.x; gx++) {
        if (this.setWalkableInternal(gx, gy)) {
          changed = true;
        }
      }
    }

    if (changed) {
      this._version++;
    }
    return changed;
  }

  /**
   * Check if a path is still valid (all waypoints are walkable).
   */
  isPathValid(path: Vector[]): boolean {
    for (const point of path) {
      if (!this.isWalkableWorld(point.x, point.y)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Find a path from start to end using A*.
   * Returns array of world positions, or null if no path found.
   */
  findPath(startWorld: Vector, endWorld: Vector): Vector[] | null {
    const start = this.worldToGrid(startWorld.x, startWorld.y);
    const end = this.worldToGrid(endWorld.x, endWorld.y);

    // If start or end is blocked, try to find nearest walkable cell
    if (!this.isWalkable(start.x, start.y)) {
      const nearest = this.findNearestWalkable(start.x, start.y);
      if (!nearest) return null;
      start.x = nearest.x;
      start.y = nearest.y;
    }

    if (!this.isWalkable(end.x, end.y)) {
      const nearest = this.findNearestWalkable(end.x, end.y);
      if (!nearest) return null;
      end.x = nearest.x;
      end.y = nearest.y;
    }

    // A* implementation
    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();

    const heuristic = (x: number, y: number): number => {
      // Octile distance - optimal for 8-directional movement
      // Accounts for diagonal movement costing ~1.41
      const dx = Math.abs(x - end.x);
      const dy = Math.abs(y - end.y);
      return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
    };

    const startNode: PathNode = {
      x: start.x,
      y: start.y,
      g: 0,
      h: heuristic(start.x, start.y),
      f: heuristic(start.x, start.y),
      parent: null,
    };

    openSet.push(startNode);

    // Neighbor offsets (8-directional movement)
    const neighbors = [
      { dx: 0, dy: -1, cost: 1 },    // Up
      { dx: 1, dy: 0, cost: 1 },     // Right
      { dx: 0, dy: 1, cost: 1 },     // Down
      { dx: -1, dy: 0, cost: 1 },    // Left
      { dx: 1, dy: -1, cost: 1.41 }, // Up-Right
      { dx: 1, dy: 1, cost: 1.41 },  // Down-Right
      { dx: -1, dy: 1, cost: 1.41 }, // Down-Left
      { dx: -1, dy: -1, cost: 1.41 }, // Up-Left
    ];

    const maxIterations = 15000; // Prevent infinite loops (increased for finer grid)
    let iterations = 0;

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Find node with lowest f score
      let lowestIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIndex].f) {
          lowestIndex = i;
        }
      }

      const current = openSet[lowestIndex];

      // Reached the goal
      if (current.x === end.x && current.y === end.y) {
        return this.reconstructPath(current);
      }

      // Move current from open to closed
      openSet.splice(lowestIndex, 1);
      closedSet.add(`${current.x},${current.y}`);

      // Check neighbors
      for (const { dx, dy, cost } of neighbors) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const key = `${nx},${ny}`;

        // Skip if not walkable or already evaluated
        if (!this.isWalkable(nx, ny) || closedSet.has(key)) {
          continue;
        }

        // For diagonal movement, check that adjacent cells are also walkable
        // (prevents cutting corners)
        if (dx !== 0 && dy !== 0) {
          if (!this.isWalkable(current.x + dx, current.y) ||
              !this.isWalkable(current.x, current.y + dy)) {
            continue;
          }
        }

        const g = current.g + cost;
        const h = heuristic(nx, ny);
        const f = g + h;

        // Check if this path to neighbor is better
        const existingIndex = openSet.findIndex(n => n.x === nx && n.y === ny);
        if (existingIndex !== -1) {
          if (g < openSet[existingIndex].g) {
            openSet[existingIndex].g = g;
            openSet[existingIndex].f = f;
            openSet[existingIndex].parent = current;
          }
        } else {
          openSet.push({ x: nx, y: ny, g, h, f, parent: current });
        }
      }
    }

    // No path found
    return null;
  }

  /**
   * Reconstruct path from end node to start.
   */
  private reconstructPath(endNode: PathNode): Vector[] {
    const path: Vector[] = [];
    let current: PathNode | null = endNode;

    while (current !== null) {
      path.unshift(this.gridToWorld(current.x, current.y));
      current = current.parent;
    }

    // Simplify path by removing intermediate points on straight lines
    return this.simplifyPath(path);
  }

  /**
   * Check if there's a clear line of sight between two world positions.
   * Uses Bresenham's line algorithm on the grid.
   */
  hasLineOfSight(fromWorld: Vector, toWorld: Vector): boolean {
    const from = this.worldToGrid(fromWorld.x, fromWorld.y);
    const to = this.worldToGrid(toWorld.x, toWorld.y);

    // Bresenham's line algorithm
    let x0 = from.x;
    let y0 = from.y;
    const x1 = to.x;
    const y1 = to.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      // Check if current cell is walkable
      if (!this.isWalkable(x0, y0)) {
        return false;
      }

      // Also check adjacent cells for diagonal movement to prevent corner cutting
      if (x0 !== x1 && y0 !== y1) {
        // We're moving diagonally, check both adjacent cells
        const nextX = x0 + sx;
        const nextY = y0 + sy;
        if (!this.isWalkable(x0, nextY) || !this.isWalkable(nextX, y0)) {
          return false;
        }
      }

      if (x0 === x1 && y0 === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }

    return true;
  }

  /**
   * Simplify path using line-of-sight optimization (string pulling).
   * Removes unnecessary waypoints where direct paths exist.
   */
  private simplifyPath(path: Vector[]): Vector[] {
    if (path.length <= 2) return path;

    const simplified: Vector[] = [path[0]];
    let anchor = 0;

    while (anchor < path.length - 1) {
      // Find the furthest point we can reach directly from anchor
      let furthest = anchor + 1;

      for (let i = anchor + 2; i < path.length; i++) {
        if (this.hasLineOfSight(path[anchor], path[i])) {
          furthest = i;
        } else {
          // Can't see past this point, stop looking
          break;
        }
      }

      // Add the furthest visible point
      simplified.push(path[furthest]);
      anchor = furthest;
    }

    return simplified;
  }

  /**
   * Find the nearest walkable cell to a given position.
   */
  private findNearestWalkable(x: number, y: number): { x: number; y: number } | null {
    const maxRadius = 10;

    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === r || Math.abs(dy) === r) {
            const nx = x + dx;
            const ny = y + dy;
            if (this.isWalkable(nx, ny)) {
              return { x: nx, y: ny };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Get valid movement position (for direct movement without full pathfinding).
   * Returns the furthest walkable position along the line from -> to.
   */
  getValidMovementPosition(from: Vector, to: Vector): Vector {
    const fromGrid = this.worldToGrid(from.x, from.y);
    const toGrid = this.worldToGrid(to.x, to.y);

    // If destination is walkable, allow it
    if (this.isWalkable(toGrid.x, toGrid.y)) {
      return to;
    }

    // Otherwise, find the last walkable position along the path
    // Use Bresenham's line algorithm
    const dx = Math.abs(toGrid.x - fromGrid.x);
    const dy = Math.abs(toGrid.y - fromGrid.y);
    const sx = fromGrid.x < toGrid.x ? 1 : -1;
    const sy = fromGrid.y < toGrid.y ? 1 : -1;
    let err = dx - dy;

    let x = fromGrid.x;
    let y = fromGrid.y;
    let lastValidX = x;
    let lastValidY = y;

    while (x !== toGrid.x || y !== toGrid.y) {
      if (this.isWalkable(x, y)) {
        lastValidX = x;
        lastValidY = y;
      } else {
        break;
      }

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return this.gridToWorld(lastValidX, lastValidY);
  }
}

export default NavigationGrid;
