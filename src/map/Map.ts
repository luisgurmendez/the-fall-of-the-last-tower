/**
 * Map class with Age of Empires-style terrain generation.
 * Creates two base clearings connected by lanes through a forest.
 */

import Vector from '@/physics/vector';
import RandomUtils from '@/utils/random';
import { MapConfig } from './MapConfig';
import NavigationGrid from '@/navigation/NavigationGrid';

/**
 * Represents a team's base position.
 */
export interface BaseArea {
  center: Vector;
  radius: number;
  team: 0 | 1;
}

/**
 * Represents a lane connecting the two bases.
 * Uses a quadratic bezier curve for smooth paths.
 */
export interface Lane {
  start: Vector;
  end: Vector;
  controlPoint: Vector;
  width: number;
}

/**
 * Tree data for rendering.
 */
export interface TreeData {
  position: Vector;
  variant: number;
}

/**
 * Map with AoE-style terrain: two bases connected by lanes through forest.
 */
class GameMap {
  readonly size: number;
  readonly halfSize: number;

  readonly bases: [BaseArea, BaseArea];
  readonly lanes: Lane[];

  /** Pre-computed navigation grid for pathfinding */
  readonly navigationGrid: NavigationGrid;

  private _trees: TreeData[] | null = null;
  private _seed: number;

  constructor(seed?: number) {
    this._seed = seed ?? Date.now();
    this.size = MapConfig.SIZE;
    this.halfSize = this.size / 2;

    this.bases = this.generateBases();
    this.lanes = this.generateLanes();

    // Generate navigation grid (must be after trees are generated)
    this.navigationGrid = this.generateNavigationGrid();
  }

  /**
   * Generate the two team base positions.
   * Bases are placed on opposite sides with some Y variance.
   */
  private generateBases(): [BaseArea, BaseArea] {
    const { RADIUS, EDGE_OFFSET, Y_VARIANCE } = MapConfig.BASE;

    // Use seeded random for reproducibility
    const yVariance1 = this.seededRandom() * Y_VARIANCE * 2 - Y_VARIANCE;
    const yVariance2 = this.seededRandom() * Y_VARIANCE * 2 - Y_VARIANCE;

    const base0: BaseArea = {
      center: new Vector(-this.halfSize + EDGE_OFFSET, yVariance1),
      radius: RADIUS,
      team: 0,
    };

    const base1: BaseArea = {
      center: new Vector(this.halfSize - EDGE_OFFSET, yVariance2),
      radius: RADIUS,
      team: 1,
    };

    return [base0, base1];
  }

  /**
   * Generate lanes connecting the two bases.
   * Uses bezier curves for natural-looking paths.
   */
  private generateLanes(): Lane[] {
    const laneCount = MapConfig.LANES.COUNT as number;
    const { WIDTH, CURVE_VARIANCE } = MapConfig.LANES;
    const lanes: Lane[] = [];

    const [base0, base1] = this.bases;

    for (let i = 0; i < laneCount; i++) {
      // Distribute lanes vertically
      const t = laneCount === 1 ? 0.5 : i / (laneCount - 1);
      const yOffset = (t - 0.5) * this.size * 0.4; // Spread lanes across 40% of map height

      const start = new Vector(
        base0.center.x + base0.radius * 0.8,
        base0.center.y + yOffset * 0.3
      );

      const end = new Vector(
        base1.center.x - base1.radius * 0.8,
        base1.center.y + yOffset * 0.3
      );

      // Control point for bezier curve
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const curveOffset = (this.seededRandom() - 0.5) * CURVE_VARIANCE * 2;

      const controlPoint = new Vector(midX, midY + curveOffset);

      lanes.push({
        start,
        end,
        controlPoint,
        width: WIDTH,
      });
    }

    return lanes;
  }

  /**
   * Simple seeded random number generator.
   */
  private seededRandom(): number {
    this._seed = (this._seed * 9301 + 49297) % 233280;
    return this._seed / 233280;
  }

  /**
   * Check if a position is inside either team's base.
   */
  isInsideBase(position: Vector): BaseArea | null {
    for (const base of this.bases) {
      const dx = position.x - base.center.x;
      const dy = position.y - base.center.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= base.radius * base.radius) {
        return base;
      }
    }
    return null;
  }

  /**
   * Check if a position is inside any lane.
   * Uses distance to bezier curve.
   */
  isInsideLane(position: Vector): boolean {
    for (const lane of this.lanes) {
      if (this.distanceToLane(position, lane) <= lane.width / 2) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate distance from a point to a bezier curve lane.
   * Uses sampling for efficiency.
   */
  private distanceToLane(position: Vector, lane: Lane): number {
    const samples = 20;
    let minDist = Infinity;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = this.bezierPoint(lane.start, lane.controlPoint, lane.end, t);
      const dx = position.x - point.x;
      const dy = position.y - point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist) {
        minDist = dist;
      }
    }

    return minDist;
  }

  /**
   * Calculate a point on a quadratic bezier curve.
   */
  private bezierPoint(p0: Vector, p1: Vector, p2: Vector, t: number): Vector {
    const mt = 1 - t;
    return new Vector(
      mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
    );
  }

  /**
   * Check if a position is in a playable area (base or lane).
   */
  isPlayableArea(position: Vector): boolean {
    return this.isInsideBase(position) !== null || this.isInsideLane(position);
  }

  /**
   * Check if a position is NOT in a playable area (where trees should be).
   * Used for tree generation and collision.
   */
  isTreeArea(position: Vector): boolean {
    // Also check map bounds
    if (Math.abs(position.x) > this.halfSize || Math.abs(position.y) > this.halfSize) {
      return false;
    }
    return !this.isPlayableArea(position);
  }

  /**
   * Get the spawn point for a team.
   */
  getSpawnPoint(team: 0 | 1): Vector {
    return this.bases[team].center.clone();
  }

  /**
   * Generate tree positions for rendering.
   * Uses Poisson disk-like distribution for natural spacing.
   */
  generateTrees(): TreeData[] {
    if (this._trees) {
      return this._trees;
    }

    const { COUNT, MIN_SPACING } = MapConfig.TREES;
    const trees: TreeData[] = [];

    let attempts = 0;
    const maxAttempts = COUNT * 10;

    while (trees.length < COUNT && attempts < maxAttempts) {
      attempts++;

      const x = RandomUtils.getIntegerInRange(-this.halfSize, this.halfSize);
      const y = RandomUtils.getIntegerInRange(-this.halfSize, this.halfSize);
      const position = new Vector(x, y);

      // Skip if in playable area
      if (this.isPlayableArea(position)) {
        continue;
      }

      // Check minimum spacing from other trees (only check last N trees for performance)
      const recentTrees = trees.slice(-100);
      let tooClose = false;

      for (const tree of recentTrees) {
        const dx = position.x - tree.position.x;
        const dy = position.y - tree.position.y;
        if (dx * dx + dy * dy < MIN_SPACING * MIN_SPACING) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        trees.push({
          position,
          variant: Math.floor(this.seededRandom() * 5),
        });
      }
    }

    // Sort by Y for proper draw order (back to front)
    trees.sort((a, b) => a.position.y - b.position.y);

    this._trees = trees;
    return trees;
  }

  /**
   * Get lane waypoints for pathfinding/AI.
   * Returns points along each lane from start to end.
   */
  getLaneWaypoints(laneIndex: number, pointCount: number = 10): Vector[] {
    if (laneIndex < 0 || laneIndex >= this.lanes.length) {
      return [];
    }

    const lane = this.lanes[laneIndex];
    const points: Vector[] = [];

    for (let i = 0; i <= pointCount; i++) {
      const t = i / pointCount;
      points.push(this.bezierPoint(lane.start, lane.controlPoint, lane.end, t));
    }

    return points;
  }

  /**
   * Get the closest lane to a position.
   */
  getClosestLane(position: Vector): { lane: Lane; index: number; distance: number } | null {
    if (this.lanes.length === 0) {
      return null;
    }

    let closestIndex = 0;
    let closestDistance = this.distanceToLane(position, this.lanes[0]);

    for (let i = 1; i < this.lanes.length; i++) {
      const dist = this.distanceToLane(position, this.lanes[i]);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestIndex = i;
      }
    }

    return {
      lane: this.lanes[closestIndex],
      index: closestIndex,
      distance: closestDistance,
    };
  }

  /**
   * Generate the navigation grid with blocked cells for trees.
   * This is pre-computed once at map creation for efficient pathfinding.
   */
  private generateNavigationGrid(): NavigationGrid {
    const grid = new NavigationGrid(this.size);
    const trees = this.generateTrees();
    const treeRadius = MapConfig.TREES.COLLISION_RADIUS;

    // Block cells where trees are located
    for (const tree of trees) {
      grid.blockCircle(tree.position.x, tree.position.y, treeRadius);
    }

    return grid;
  }

  /**
   * Check if a world position is walkable (not blocked by trees).
   * Uses the pre-computed navigation grid for O(1) lookup.
   */
  isWalkable(position: Vector): boolean {
    return this.navigationGrid.isWalkableWorld(position.x, position.y);
  }

  /**
   * Get a valid movement position using the navigation grid.
   * Returns the furthest walkable position along the path.
   */
  getValidMovementPosition(from: Vector, to: Vector): Vector {
    return this.navigationGrid.getValidMovementPosition(from, to);
  }

  /**
   * Find a path from start to end using A* on the navigation grid.
   * Returns array of waypoints, or null if no path exists.
   */
  findPath(from: Vector, to: Vector): Vector[] | null {
    return this.navigationGrid.findPath(from, to);
  }
}

export default GameMap;
