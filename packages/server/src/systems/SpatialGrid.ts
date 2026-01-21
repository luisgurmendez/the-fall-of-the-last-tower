/**
 * SpatialGrid - Grid-based spatial partitioning for efficient nearby queries.
 *
 * Divides the game world into cells. When querying for nearby entities,
 * only entities in the same or adjacent cells are checked.
 *
 * This reduces collision checks from O(n²) to approximately O(n).
 *
 * @see docs/architecture/collision.md
 */

import { Vector } from '@siege/shared';
import type { ServerEntity } from '../simulation/ServerEntity';

/**
 * Spatial grid for efficient nearby entity queries.
 */
export class SpatialGrid {
  private cellSize: number;
  private cells: Map<string, ServerEntity[]> = new Map();

  /**
   * Create a new spatial grid.
   * @param cellSize Size of each grid cell in game units. Default: 100
   */
  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  /**
   * Clear all entities from the grid.
   * Call this at the start of each tick before re-inserting entities.
   */
  clear(): void {
    this.cells.clear();
  }

  /**
   * Get the cell key for a position.
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Get the cell coordinates for a position.
   */
  private getCellCoords(x: number, y: number): [number, number] {
    return [
      Math.floor(x / this.cellSize),
      Math.floor(y / this.cellSize),
    ];
  }

  /**
   * Insert an entity into the grid.
   */
  insert(entity: ServerEntity): void {
    const key = this.getCellKey(entity.position.x, entity.position.y);
    let cell = this.cells.get(key);

    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }

    cell.push(entity);
  }

  /**
   * Insert an entity into the grid, also adding to adjacent cells if
   * the entity's radius extends beyond the current cell.
   * This is more accurate but slightly slower.
   */
  insertWithRadius(entity: ServerEntity, radius: number): void {
    const x = entity.position.x;
    const y = entity.position.y;

    // Calculate cell range that the entity's bounding box covers
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellY = Math.floor((y - radius) / this.cellSize);
    const maxCellY = Math.floor((y + radius) / this.cellSize);

    // Insert into all cells the entity overlaps
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const key = `${cx},${cy}`;
        let cell = this.cells.get(key);

        if (!cell) {
          cell = [];
          this.cells.set(key, cell);
        }

        // Avoid duplicates
        if (!cell.includes(entity)) {
          cell.push(entity);
        }
      }
    }
  }

  /**
   * Get all entities within a radius of a position.
   * This queries the appropriate cells and returns entities within range.
   */
  getNearby(position: Vector, radius: number): ServerEntity[] {
    const results: ServerEntity[] = [];
    const radiusSq = radius * radius;

    // Calculate cell range to check
    const minCellX = Math.floor((position.x - radius) / this.cellSize);
    const maxCellX = Math.floor((position.x + radius) / this.cellSize);
    const minCellY = Math.floor((position.y - radius) / this.cellSize);
    const maxCellY = Math.floor((position.y + radius) / this.cellSize);

    // Check all cells in range
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const cell = this.cells.get(`${cx},${cy}`);
        if (!cell) continue;

        for (const entity of cell) {
          // Check actual distance (use squared distance for performance)
          const dx = entity.position.x - position.x;
          const dy = entity.position.y - position.y;
          const distSq = dx * dx + dy * dy;

          if (distSq <= radiusSq) {
            results.push(entity);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get all entities in a cell and its adjacent cells (3x3 grid).
   * Useful for collision detection where you want all potential colliders.
   */
  getInCellAndAdjacent(position: Vector): ServerEntity[] {
    const [cx, cy] = this.getCellCoords(position.x, position.y);
    const results: ServerEntity[] = [];
    const seen = new Set<string>();

    // Check 3x3 grid of cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = this.cells.get(`${cx + dx},${cy + dy}`);
        if (!cell) continue;

        for (const entity of cell) {
          if (!seen.has(entity.id)) {
            seen.add(entity.id);
            results.push(entity);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get all entities in a specific cell.
   */
  getInCell(cellX: number, cellY: number): ServerEntity[] {
    return this.cells.get(`${cellX},${cellY}`) || [];
  }

  /**
   * Get the number of occupied cells.
   */
  getCellCount(): number {
    return this.cells.size;
  }

  /**
   * Get total entity count across all cells.
   */
  getEntityCount(): number {
    let count = 0;
    for (const cell of this.cells.values()) {
      count += cell.length;
    }
    return count;
  }

  /**
   * Get statistics about the grid (for debugging/optimization).
   */
  getStats(): {
    cellCount: number;
    entityCount: number;
    avgEntitiesPerCell: number;
    maxEntitiesInCell: number;
    cellSize: number;
  } {
    let maxEntities = 0;
    let totalEntities = 0;

    for (const cell of this.cells.values()) {
      totalEntities += cell.length;
      maxEntities = Math.max(maxEntities, cell.length);
    }

    return {
      cellCount: this.cells.size,
      entityCount: totalEntities,
      avgEntitiesPerCell: this.cells.size > 0 ? totalEntities / this.cells.size : 0,
      maxEntitiesInCell: maxEntities,
      cellSize: this.cellSize,
    };
  }
}
