/**
 * MOBAMap - MOBA-style map for online play.
 *
 * In online mode, this handles:
 * - Bush visibility (for fog of war)
 * - Navigation grid (for client-side pathfinding display)
 * - Map decorations (visual elements)
 *
 * Actual game entities (towers, nexuses, minions) are rendered
 * from server state by EntityRenderer.
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { LogicEntity } from '@/core/GameObject';
import { Initializable } from '@/behaviors/initializable';
import { MOBAConfig, MapSide, LaneId } from './MOBAConfig';
import NavigationGrid from '@/navigation/NavigationGrid';
import { BushManager, Bush } from '@/vision';
import { MapDecoration } from './MapDecoration';

/**
 * MOBA map for online play.
 * Handles bushes, navigation grid, and decorations.
 * Actual entities are rendered from server state.
 */
export class MOBAMap extends LogicEntity implements Initializable {
  /** Initializable interface */
  shouldInitialize: boolean = true;

  /** Navigation grid for pathfinding */
  private navigationGrid: NavigationGrid;

  /** Bush manager for vision-blocking bushes */
  private bushManager: BushManager;

  /** Map decorations (non-interactive visuals) */
  private decorations: MapDecoration[] = [];

  /** Whether the map has been initialized */
  private initialized: boolean = false;

  /**
   * Create a MOBA map.
   * @param options.renderOnly - Ignored (always render-only for online mode)
   */
  constructor(options?: { renderOnly?: boolean }) {
    super('moba-map');

    // Create navigation grid
    this.navigationGrid = new NavigationGrid(MOBAConfig.MAP_SIZE.width);

    // Create bush manager and add bushes
    this.bushManager = new BushManager();
    this.createBushes();

    // Create decorations
    this.createDecorations();

    // Block navigation areas
    this.blockNavigationAreas();
  }

  /**
   * Block areas in the navigation grid (nexuses, water border).
   */
  private blockNavigationAreas(): void {
    // Block nexus areas
    const nexusRadius = MOBAConfig.NEXUS.RADIUS;
    this.navigationGrid.blockCircle(
      MOBAConfig.NEXUS.BLUE.x,
      MOBAConfig.NEXUS.BLUE.y,
      nexusRadius
    );
    this.navigationGrid.blockCircle(
      MOBAConfig.NEXUS.RED.x,
      MOBAConfig.NEXUS.RED.y,
      nexusRadius
    );

    // Block water border
    this.blockWaterBorder();

    // Block wall areas
    for (const wallConfig of MOBAConfig.WALLS) {
      this.navigationGrid.blockRectangle(
        wallConfig.position.x,
        wallConfig.position.y,
        wallConfig.width,
        wallConfig.height
      );
    }
  }

  /**
   * Block the water border area in the navigation grid.
   */
  private blockWaterBorder(): void {
    const { width, height } = MOBAConfig.MAP_SIZE;
    const waterSize = MOBAConfig.WATER_BORDER_SIZE;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Block top water strip
    this.navigationGrid.blockRectangle(
      0,
      -halfHeight + waterSize / 2,
      width,
      waterSize
    );

    // Block bottom water strip
    this.navigationGrid.blockRectangle(
      0,
      halfHeight - waterSize / 2,
      width,
      waterSize
    );

    // Block left water strip
    this.navigationGrid.blockRectangle(
      -halfWidth + waterSize / 2,
      0,
      waterSize,
      height
    );

    // Block right water strip
    this.navigationGrid.blockRectangle(
      halfWidth - waterSize / 2,
      0,
      waterSize,
      height
    );
  }

  /**
   * Create decorations from configuration.
   */
  private createDecorations(): void {
    for (const decorConfig of MOBAConfig.DECORATIONS) {
      const decoration = new MapDecoration({
        position: new Vector(decorConfig.position.x, decorConfig.position.y),
        type: decorConfig.type,
        scale: decorConfig.scale,
        flipX: 'flipX' in decorConfig ? decorConfig.flipX : false,
      });
      this.decorations.push(decoration);
    }
  }

  /**
   * Create bushes from configuration.
   */
  private createBushes(): void {
    const spacing = MOBAConfig.BUSH_SETTINGS.SPACING;
    const variance = MOBAConfig.BUSH_SETTINGS.OFFSET_VARIANCE;

    for (let groupIndex = 0; groupIndex < MOBAConfig.BUSH_GROUPS.length; groupIndex++) {
      const groupConfig = MOBAConfig.BUSH_GROUPS[groupIndex];

      // Create the bush group
      const group = this.bushManager.createGroup(
        `bush_group_${groupIndex}`,
        groupConfig.center
      );

      // Calculate positions for bushes in this group
      const positions = this.calculateBushPositions(
        groupConfig.center,
        groupConfig.bushCount,
        groupConfig.spread,
        spacing,
        variance
      );

      // Add bushes to the group
      for (let i = 0; i < positions.length; i++) {
        const type = i % 3 === 0 ? 'small' : 'large';
        this.bushManager.addBushToGroup({
          position: positions[i],
          type,
          scale: type === 'large' ? 0.9 : 0.7,
        }, group);
      }
    }
  }

  /**
   * Calculate positions for bushes in a group based on spread type.
   */
  private calculateBushPositions(
    center: Vector,
    count: number,
    spread: 'horizontal' | 'vertical' | 'diagonal' | 'cluster',
    spacing: number,
    variance: number
  ): Vector[] {
    const positions: Vector[] = [];
    const halfCount = (count - 1) / 2;

    for (let i = 0; i < count; i++) {
      const offset = (i - halfCount) * spacing;
      const randX = (Math.random() - 0.5) * variance * 2;
      const randY = (Math.random() - 0.5) * variance * 2;

      let x = center.x;
      let y = center.y;

      switch (spread) {
        case 'horizontal':
          x += offset + randX;
          y += randY;
          break;
        case 'vertical':
          x += randX;
          y += offset + randY;
          break;
        case 'diagonal':
          x += offset * 0.7 + randX;
          y += offset * 0.7 + randY;
          break;
        case 'cluster':
          const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
          const radius = spacing * 0.8 + Math.random() * spacing * 0.4;
          x += Math.cos(angle) * radius + randX;
          y += Math.sin(angle) * radius + randY;
          break;
      }

      positions.push(new Vector(x, y));
    }

    return positions;
  }

  /**
   * Initialize the MOBA map.
   */
  init(gctx: GameContext): void {
    if (this.initialized) return;
    this.shouldInitialize = false;

    // Add bushes to game objects for rendering
    for (const bush of this.bushManager.getBushes()) {
      gctx.objects.push(bush);
    }

    // Add decorations to game objects for rendering
    for (const decoration of this.decorations) {
      gctx.objects.push(decoration);
    }

    this.initialized = true;
  }

  override step(_gctx: GameContext): void {
    // Online mode: no simulation needed
    // Server handles all game logic, client just renders
  }

  // ===================
  // Accessors
  // ===================

  /**
   * Get the navigation grid.
   */
  getNavigationGrid(): NavigationGrid {
    return this.navigationGrid;
  }

  /**
   * Get the bush manager.
   */
  getBushManager(): BushManager {
    return this.bushManager;
  }

  /**
   * Get all bushes.
   */
  getBushes(): Bush[] {
    return this.bushManager.getBushes();
  }

  /**
   * Get champion spawn position for a side.
   */
  getChampionSpawnPosition(side: MapSide): Vector {
    return side === 0
      ? MOBAConfig.CHAMPION_SPAWN.BLUE.clone()
      : MOBAConfig.CHAMPION_SPAWN.RED.clone();
  }

  /**
   * Get map size.
   */
  getMapSize(): { width: number; height: number } {
    return { ...MOBAConfig.MAP_SIZE };
  }

  /**
   * Check if a position is walkable.
   */
  isWalkable(position: Vector): boolean {
    return this.navigationGrid.isWalkableWorld(position.x, position.y);
  }

  /**
   * Find a path from start to end.
   */
  findPath(from: Vector, to: Vector): Vector[] | null {
    return this.navigationGrid.findPath(from, to);
  }

  /**
   * Get valid movement position.
   */
  getValidMovementPosition(from: Vector, to: Vector): Vector {
    return this.navigationGrid.getValidMovementPosition(from, to);
  }
}

export default MOBAMap;
