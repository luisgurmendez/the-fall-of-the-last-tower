/**
 * MOBAMap - MOBA-style map with nexuses, lanes, and jungle camps.
 *
 * Manages:
 * - Two nexuses (Blue at bottom-left, Red at top-right)
 * - Three lanes (top, mid, bot) with minion waves
 * - Jungle camps with neutral monsters
 */

import Vector from '@/physics/vector';
import GameContext from '@/core/gameContext';
import { LogicEntity } from '@/core/GameObject';
import { Initializable, isInitializable } from '@/behaviors/initializable';
import { MOBAConfig, MapSide, LaneId } from './MOBAConfig';
import { Nexus, Tower, Wall } from '@/structures';
import { LaneManager, Lane } from '@/lanes';
import { JungleCamp, JungleCampConfig } from '@/jungle';
import NavigationGrid from '@/navigation/NavigationGrid';
import { BushManager, Bush } from '@/vision';
import { MapDecoration } from './MapDecoration';

/**
 * MOBA map orchestrator.
 */
export class MOBAMap extends LogicEntity implements Initializable {
  /** Initializable interface */
  shouldInitialize: boolean = true;

  /** Team nexuses */
  private blueNexus: Nexus;
  private redNexus: Nexus;

  /** Lane manager */
  private laneManager: LaneManager;

  /** Jungle camps */
  private jungleCamps: JungleCamp[] = [];

  /** Towers */
  private towers: Tower[] = [];

  /** Walls */
  private walls: Wall[] = [];

  /** Navigation grid for pathfinding */
  private navigationGrid: NavigationGrid;

  /** Bush manager for vision-blocking bushes */
  private bushManager: BushManager;

  /** Map decorations (non-interactive visuals) */
  private decorations: MapDecoration[] = [];

  /** Whether the map has been initialized */
  private initialized: boolean = false;

  /** Whether this is render-only mode (for online play - no simulation) */
  private renderOnly: boolean = false;

  /**
   * Create a MOBA map.
   * @param options.renderOnly - If true, skip simulation (minions, jungle). Used for online mode.
   */
  constructor(options?: { renderOnly?: boolean }) {
    super('moba-map');
    this.renderOnly = options?.renderOnly ?? false;

    // Create nexuses
    this.blueNexus = new Nexus(0);
    this.redNexus = new Nexus(1);

    // Create lane manager
    this.laneManager = new LaneManager();

    // Create navigation grid
    this.navigationGrid = new NavigationGrid(MOBAConfig.MAP_SIZE.width);

    // Create bush manager and add bushes
    this.bushManager = new BushManager();
    this.createBushes();

    // Create jungle camps
    this.createJungleCamps();

    // Create towers
    this.createTowers();

    // Create walls
    this.createWalls();

    // Create decorations
    this.createDecorations();
  }

  /**
   * Create walls from configuration.
   */
  private createWalls(): void {
    for (const wallConfig of MOBAConfig.WALLS) {
      const wall = new Wall({
        position: wallConfig.position.clone(),
        width: wallConfig.width,
        height: wallConfig.height,
      });
      this.walls.push(wall);
    }
  }

  /**
   * Block the water border area in the navigation grid.
   * This prevents units from walking into the water surrounding the map.
   */
  private blockWaterBorder(): void {
    const { width, height } = MOBAConfig.MAP_SIZE;
    const waterSize = MOBAConfig.WATER_BORDER_SIZE;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Block top water strip
    this.navigationGrid.blockRectangle(
      0, // center x
      -halfHeight + waterSize / 2, // center y
      width, // full width
      waterSize // water border height
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
   * Create towers from configuration.
   */
  private createTowers(): void {
    const stats = MOBAConfig.TOWERS.STATS;

    for (const towerConfig of MOBAConfig.TOWERS.POSITIONS) {
      const tower = new Tower({
        position: towerConfig.position.clone(),
        side: towerConfig.side,
        health: stats.health,
        attackDamage: stats.attackDamage,
        attackRange: stats.attackRange,
        attackCooldown: stats.attackCooldown,
        armor: stats.armor,
        magicResist: stats.magicResist,
      });
      this.towers.push(tower);
    }
  }

  /**
   * Create bushes from configuration.
   * Each bush group spawns multiple bushes placed together that share visibility.
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
        // Alternate between large and small bushes for variety
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
          // Arrange in a rough circle/cluster
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
   * Create jungle camps from configuration.
   */
  private createJungleCamps(): void {
    for (const campConfig of MOBAConfig.JUNGLE.CAMPS) {
      const camp = new JungleCamp(campConfig as JungleCampConfig);
      this.jungleCamps.push(camp);
    }
  }

  /**
   * Initialize the MOBA map.
   */
  init(gctx: GameContext): void {
    if (this.initialized) return;
    this.shouldInitialize = false;

    // In render-only mode (online), skip all simulation objects
    // Minions, champions, jungle camps are rendered from server state
    if (!this.renderOnly) {
      // Add nexuses to game
      gctx.objects.push(this.blueNexus);
      gctx.objects.push(this.redNexus);

      // Add towers to game
      for (const tower of this.towers) {
        gctx.objects.push(tower);
      }

      // Add walls to game
      for (const wall of this.walls) {
        gctx.objects.push(wall);
      }

      // Initialize lane manager (adds minion controllers)
      this.laneManager.initialize(gctx);
      gctx.objects.push(this.laneManager);

      // Initialize and add jungle camps
      for (const camp of this.jungleCamps) {
        camp.initialize(gctx);
        gctx.objects.push(camp);
      }
    } else {
      // Render-only mode: just add walls for navigation blocking
      for (const wall of this.walls) {
        gctx.objects.push(wall);
      }
    }

    // Add bushes to game objects for rendering
    for (const bush of this.bushManager.getBushes()) {
      gctx.objects.push(bush);
    }

    // Add decorations to game objects for rendering
    for (const decoration of this.decorations) {
      gctx.objects.push(decoration);
    }

    // Block nexus areas in navigation grid
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

    // Block wall areas in navigation grid
    for (const wall of this.walls) {
      this.navigationGrid.blockRectangle(
        wall.getPosition().x,
        wall.getPosition().y,
        wall.width,
        wall.height
      );
    }

    // Block water border (acts as virtual wall around the map)
    this.blockWaterBorder();

    this.initialized = true;
  }

  override step(gctx: GameContext): void {
    // In render-only mode (online), skip expensive bush/nexus checks
    // Server handles all game logic, client just renders
    if (this.renderOnly) {
      return;
    }

    // Update bush manager (tracks which units are in bushes)
    this.bushManager.update(gctx);

    // Check for game over conditions
    if (this.blueNexus.isDestroyed()) {
      // Red team wins
      console.log('[GAME] Red team wins!');
    } else if (this.redNexus.isDestroyed()) {
      // Blue team wins
      console.log('[GAME] Blue team wins!');
    }
  }

  // ===================
  // Accessors
  // ===================

  /**
   * Get a nexus by side.
   */
  getNexus(side: MapSide): Nexus {
    return side === 0 ? this.blueNexus : this.redNexus;
  }

  /**
   * Get both nexuses.
   */
  getNexuses(): { blue: Nexus; red: Nexus } {
    return {
      blue: this.blueNexus,
      red: this.redNexus,
    };
  }

  /**
   * Get the lane manager.
   */
  getLaneManager(): LaneManager {
    return this.laneManager;
  }

  /**
   * Get a specific lane.
   */
  getLane(id: LaneId): Lane | undefined {
    return this.laneManager.getLane(id);
  }

  /**
   * Get all lanes.
   */
  getAllLanes(): Lane[] {
    return this.laneManager.getAllLanes();
  }

  /**
   * Get all jungle camps.
   */
  getJungleCamps(): JungleCamp[] {
    return this.jungleCamps;
  }

  /**
   * Get all towers.
   */
  getTowers(): Tower[] {
    return this.towers;
  }

  /**
   * Get towers for a specific side.
   */
  getTowersForSide(side: MapSide): Tower[] {
    return this.towers.filter(t => t.getSide() === side);
  }

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
   * Check if a position is inside a nexus.
   */
  isInsideNexus(position: Vector): Nexus | null {
    const bluePos = this.blueNexus.getPosition();
    const redPos = this.redNexus.getPosition();
    const radius = MOBAConfig.NEXUS.RADIUS;

    if (position.distanceTo(bluePos) <= radius) {
      return this.blueNexus;
    }
    if (position.distanceTo(redPos) <= radius) {
      return this.redNexus;
    }
    return null;
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
