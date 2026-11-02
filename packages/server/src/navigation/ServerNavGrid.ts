/**
 * ServerNavGrid - Pre-computed navigation grid for server-side pathfinding.
 *
 * Converts the continuous map into a discrete grid where each cell
 * is marked as walkable or blocked. Uses A* for pathfinding.
 */

import { Vector } from '@siege/shared';

/** Grid cell size in world units */
export const CELL_SIZE = 25;

/** Neighbor offsets (8-directional movement) */
const NEIGHBORS = [
  { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 1, dy: -1, cost: 1.41 },
  { dx: 1, dy: 1, cost: 1.41 },
  { dx: -1, dy: 1, cost: 1.41 },
  { dx: -1, dy: -1, cost: 1.41 },
];

/**
 * Binary min-heap of cell indices keyed by priority (A* open set).
 * Stale entries are skipped by the caller via the closed set.
 */
class MinHeap {
  private indices: number[] = [];
  private priorities: number[] = [];

  get size(): number {
    return this.indices.length;
  }

  push(index: number, priority: number): void {
    this.indices.push(index);
    this.priorities.push(priority);
    let i = this.indices.length - 1;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (this.priorities[up] <= this.priorities[i]) break;
      this.swap(i, up);
      i = up;
    }
  }

  pop(): number {
    const top = this.indices[0];
    const lastIndex = this.indices.pop()!;
    const lastPriority = this.priorities.pop()!;
    if (this.indices.length > 0) {
      this.indices[0] = lastIndex;
      this.priorities[0] = lastPriority;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.indices.length && this.priorities[left] < this.priorities[smallest]) smallest = left;
        if (right < this.indices.length && this.priorities[right] < this.priorities[smallest]) smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.indices[a], this.indices[b]] = [this.indices[b], this.indices[a]];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b], this.priorities[a]];
  }
}

/**
 * Navigation grid for efficient collision detection and pathfinding.
 */
export class ServerNavGrid {
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
   * @param lineOfSight Whether a straight line between two waypoints is
   *   walkable, to straighten the path (default: across walkable cells)
   */
  findPath(startWorld: Vector, endWorld: Vector, lineOfSight?: (from: Vector, to: Vector) => boolean): Vector[] | null {
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

    // A* over flat typed arrays with a binary heap (open set), so a path across
    // the whole map stays in the low milliseconds
    const cellCount = this.width * this.height;
    const gScore = new Float32Array(cellCount).fill(Infinity);
    const parent = new Int32Array(cellCount).fill(-1);
    const closed = new Uint8Array(cellCount);
    const heap = new MinHeap();

    const heuristic = (x: number, y: number): number => {
      // Octile distance - optimal for 8-directional movement
      const dx = Math.abs(x - end.x);
      const dy = Math.abs(y - end.y);
      return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
    };

    const startIndex = this.getIndex(start.x, start.y);
    const endIndex = this.getIndex(end.x, end.y);
    gScore[startIndex] = 0;
    heap.push(startIndex, heuristic(start.x, start.y));

    while (heap.size > 0) {
      const current = heap.pop();
      if (closed[current]) continue;
      closed[current] = 1;

      if (current === endIndex) {
        return this.reconstructPath(parent, endIndex, lineOfSight);
      }

      const cx = current % this.width;
      const cy = Math.floor(current / this.width);

      for (const { dx, dy, cost } of NEIGHBORS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.isWalkable(nx, ny)) continue;

        // For diagonal movement, both adjacent cells must be walkable (no corner cutting)
        if (dx !== 0 && dy !== 0 && (!this.isWalkable(cx + dx, cy) || !this.isWalkable(cx, cy + dy))) {
          continue;
        }

        const neighbor = this.getIndex(nx, ny);
        if (closed[neighbor]) continue;

        const g = gScore[current] + cost;
        if (g < gScore[neighbor]) {
          gScore[neighbor] = g;
          parent[neighbor] = current;
          heap.push(neighbor, g + heuristic(nx, ny));
        }
      }
    }

    // No path found
    return null;
  }

  /**
   * Reconstruct path from the end cell back to the start.
   */
  private reconstructPath(parent: Int32Array, endIndex: number, lineOfSight?: (from: Vector, to: Vector) => boolean): Vector[] {
    const path: Vector[] = [];
    for (let index = endIndex; index !== -1; index = parent[index]) {
      path.unshift(this.gridToWorld(index % this.width, Math.floor(index / this.width)));
    }

    // Simplify path by removing intermediate points on straight lines
    return this.simplifyPath(path, lineOfSight);
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
  private simplifyPath(path: Vector[], lineOfSight: (from: Vector, to: Vector) => boolean = (a, b) => this.hasLineOfSight(a, b)): Vector[] {
    if (path.length <= 2) return path;

    const simplified: Vector[] = [path[0]];
    let anchor = 0;

    while (anchor < path.length - 1) {
      // Find the furthest point we can reach directly from anchor
      let furthest = anchor + 1;

      for (let i = anchor + 2; i < path.length; i++) {
        if (lineOfSight(path[anchor], path[i])) {
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

  /**
   * Mark every cell whose center fails `walkable` as blocked.
   */
  initializeWalkable(walkable: (worldX: number, worldY: number) => boolean): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const world = this.gridToWorld(x, y);
        if (!walkable(world.x, world.y)) this.setBlockedInternal(x, y);
      }
    }
    this._version++;
  }

  /**
   * Initialize the navigation grid from map configuration.
   * Blocks walls and water border.
   */
  initializeFromConfig(config: {
    MAP_SIZE: { width: number; height: number };
    WATER_BORDER_SIZE: number;
    WALLS: Array<{ position: { x: number; y: number }; width: number; height: number }>;
  }): void {
    // Block water border
    const waterSize = config.WATER_BORDER_SIZE;
    const halfWidth = config.MAP_SIZE.width / 2;
    const halfHeight = config.MAP_SIZE.height / 2;

    // Block edges (water)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const worldPos = this.gridToWorld(x, y);
        if (
          worldPos.x < -halfWidth + waterSize ||
          worldPos.x > halfWidth - waterSize ||
          worldPos.y < -halfHeight + waterSize ||
          worldPos.y > halfHeight - waterSize
        ) {
          this.setBlockedInternal(x, y);
        }
      }
    }

    // Block walls
    for (const wall of config.WALLS) {
      this.blockRectangle(wall.position.x, wall.position.y, wall.width, wall.height);
    }

    this._version++;
  }
}
