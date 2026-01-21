/**
 * MOBABackground - Background renderer for MOBA maps.
 *
 * Renders:
 * - Water border around the map (acts as virtual wall)
 * - Foam transition between water and grass
 * - Grass terrain using tilemap sprites
 * - Elevated walls with cliff faces
 * - Lane paths and jungle areas
 */

import GameContext from "@/core/gameContext";
import Vector from "@/physics/vector";
import RenderElement from "@/render/renderElement";
import BaseObject from "./baseObject";
import { Rectangle } from "./shapes";
import { MOBAConfig, MOBAMap } from "@/map";
import NavigationGrid from "@/navigation/NavigationGrid";

// Use shared constant from config
const WATER_BORDER_SIZE = MOBAConfig.WATER_BORDER_SIZE;

export const BACKGROUND_ID = "bg";

// =============================================================================
// ASSET PATHS
// =============================================================================
const ASSETS = {
  TILEMAP: "/assets/sprites/Map/Tilemap_Grass.png",
  WATER_BACKGROUND: "/assets/sprites/Map/Water_Background.png",
  WATER_FOAM: "/assets/sprites/Map/Water_Foam.png",
};

const TILE_SIZE = 64;

// =============================================================================
// TILE DEFINITIONS
// =============================================================================
/**
 * Tile positions in the tilemap (576x384, 9 cols x 6 rows at 64x64).
 *
 * TILEMAP LAYOUT:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Cols 0-2 (Rows 0-2)      │ Col 3-4  │ Cols 5-7 (Rows 0-5)              │
 * │ GRASS PLATFORM (3x3)     │ (unused) │ ELEVATED PLATFORM + CLIFF        │
 * │                          │          │                                   │
 * │ Row 0: TL  TC  TR        │          │ Row 0: Elevated grass top         │
 * │ Row 1: ML  MC  MR        │          │ Row 1: Elevated grass middle      │
 * │ Row 2: BL  BC  BR        │          │ Row 2: Grass with cliff edge      │
 * │                          │          │ Row 3: Cliff top                  │
 * │                          │          │ Row 4: Cliff middle               │
 * │                          │          │ Row 5: Cliff bottom               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * TERRAIN TYPES:
 * 1. WATER - Fills the border, uses Water_Background.png (tiled)
 * 2. FOAM  - Transition between water and grass, uses Water_Foam.png
 * 3. GRASS - Main playable area, 3x3 bordered platform with seamless interior
 * 4. ELEVATED WALL - Raised platforms with grass top and cliff face below
 */
const TILES = {
  /**
   * GRASS PLATFORM TILES (cols 0-2, rows 0-2)
   * Forms a complete 3x3 bordered platform for the main terrain.
   *
   * Usage:
   * - Corners (TL, TR, BL, BR): Use at platform corners
   * - Edges (TC, MC, BC, ML, MR): Use along platform edges
   * - Center (MC): Interior grass (also used to create seamless tile)
   *
   * Layout:
   *   TL ─ TC ─ TR
   *   │         │
   *   ML   MC   MR
   *   │         │
   *   BL ─ BC ─ BR
   */
  grass: {
    // Row 0 - top row
    topLeft: { col: 0, row: 0 }, // Corner: water above and left
    topCenter: { col: 1, row: 0 }, // Edge: water above
    topRight: { col: 2, row: 0 }, // Corner: water above and right
    // Row 1 - middle row
    middleLeft: { col: 0, row: 1 }, // Edge: water left
    middleCenter: { col: 1, row: 1 }, // Interior: no water edges
    middleRight: { col: 2, row: 1 }, // Edge: water right
    // Row 2 - bottom row
    bottomLeft: { col: 0, row: 2 }, // Corner: water below and left
    bottomCenter: { col: 1, row: 2 }, // Edge: water below
    bottomRight: { col: 2, row: 2 }, // Corner: water below and right
  },

  /**
   * ELEVATED GRASS TILES (cols 5-7, rows 0-1)
   * Top surface of elevated walls/platforms.
   *
   * Usage:
   * - For the grass surface on top of walls
   * - Combined with cliff tiles below for full wall appearance
   */
  elevatedGrass: {
    topLeft: { col: 5, row: 0 },
    topCenter: { col: 6, row: 0 },
    topRight: { col: 7, row: 0 },
    middleLeft: { col: 5, row: 1 },
    middleCenter: { col: 6, row: 1 },
    middleRight: { col: 7, row: 1 },
  },

  /**
   * GRASS WITH CLIFF EDGE TILES (cols 5-7, row 2)
   * Grass surface with cliff edge visible below.
   *
   * Usage:
   * - For the bottom row of elevated grass (before cliff face)
   * - Shows the transition from grass to cliff
   */
  grassWithCliffEdge: {
    left: { col: 5, row: 2 },
    center: { col: 6, row: 2 },
    right: { col: 7, row: 2 },
  },

  /**
   * CLIFF/WALL FACE TILES (cols 5-7, rows 3-5)
   * The vertical cliff face of elevated terrain.
   *
   * Usage:
   * - For rendering the height/depth of walls
   * - Stack multiple rows for taller cliffs
   *
   * Layout (3x3 cliff face):
   *   TL ─ TC ─ TR  (top of cliff face)
   *   ML   MC   MR  (middle of cliff)
   *   BL ─ BC ─ BR  (bottom/base of cliff)
   */
  cliff: {
    topLeft: { col: 5, row: 3 },
    topCenter: { col: 6, row: 3 },
    topRight: { col: 7, row: 3 },
    middleLeft: { col: 5, row: 4 },
    middleCenter: { col: 6, row: 4 },
    middleRight: { col: 7, row: 4 },
    bottomLeft: { col: 5, row: 5 },
    bottomCenter: { col: 6, row: 5 },
    bottomRight: { col: 7, row: 5 },
  },
};

/**
 * Helper type for tile position
 */
type TilePos = { col: number; row: number };

/**
 * Adapter for pathfinding compatibility.
 */
class MOBAGameMapAdapter {
  private mobaMap: MOBAMap;

  constructor(mobaMap: MOBAMap) {
    this.mobaMap = mobaMap;
  }

  get navigationGrid(): NavigationGrid {
    return this.mobaMap.getNavigationGrid();
  }

  findPath(from: Vector, to: Vector): Vector[] | null {
    return this.mobaMap.findPath(from, to);
  }

  isWalkable(position: Vector): boolean {
    return this.mobaMap.isWalkable(position);
  }

  getValidMovementPosition(from: Vector, to: Vector): Vector {
    return this.mobaMap.getValidMovementPosition(from, to);
  }

  isInsideBase(_position: Vector): null {
    return null;
  }

  isInsideLane(_position: Vector): boolean {
    return true;
  }

  isPlayableArea(_position: Vector): boolean {
    return true;
  }

  isTreeArea(_position: Vector): boolean {
    return false;
  }

  getSpawnPoint(team: 0 | 1): Vector {
    return this.mobaMap.getChampionSpawnPosition(team);
  }
}

/**
 * MOBA-style background with water border and terrain.
 */
class MOBABackground extends BaseObject {
  backgroundCanvas: HTMLCanvasElement;
  canvasRenderingContext: CanvasRenderingContext2D | null;
  gameMap: MOBAGameMapAdapter;

  private mobaMap: MOBAMap;
  private worldDimensions: Rectangle;

  // Loaded assets
  private tilemap: HTMLImageElement | null = null;
  private waterBackground: HTMLImageElement | null = null;
  private waterFoam: HTMLImageElement | null = null;
  private assetsLoaded: boolean = false;

  // Pre-rendered tiles for performance
  private seamlessGrassTile: HTMLCanvasElement | null = null;
  private seamlessWaterTile: HTMLCanvasElement | null = null;

  constructor(worldDimensions: Rectangle, mobaMap: MOBAMap) {
    super(new Vector(), BACKGROUND_ID);

    this.mobaMap = mobaMap;
    this.gameMap = new MOBAGameMapAdapter(mobaMap);
    this.worldDimensions = worldDimensions;

    const canvas = document.createElement("canvas");
    canvas.width = worldDimensions.w;
    canvas.height = worldDimensions.h;
    const ctx = canvas.getContext("2d");
    this.canvasRenderingContext = ctx;

    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      this.renderFallbackBackground(ctx, worldDimensions);
    }

    this.backgroundCanvas = canvas;
    this.loadAssets();
  }

  // ===========================================================================
  // ASSET LOADING
  // ===========================================================================

  private async loadAssets(): Promise<void> {
    try {
      // Load all assets in parallel
      const [tilemap, waterBg, waterFoam] = await Promise.all([
        this.loadImage(ASSETS.TILEMAP),
        this.loadImage(ASSETS.WATER_BACKGROUND),
        this.loadImage(ASSETS.WATER_FOAM),
      ]);

      this.tilemap = tilemap;
      this.waterBackground = waterBg;
      this.waterFoam = waterFoam;
      this.assetsLoaded = true;

      // Create pre-rendered tiles
      this.createSeamlessGrassTile();
      this.createSeamlessWaterTile();

      // Render the full background
      if (this.canvasRenderingContext) {
        this.renderBackground(
          this.canvasRenderingContext,
          this.worldDimensions
        );
      }
    } catch (error) {
      console.error("Failed to load background assets:", error);
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${src}`));
      img.src = src;
    });
  }

  // ===========================================================================
  // PRE-RENDERED TILE CREATION
  // ===========================================================================

  /**
   * Create a seamless grass tile by extracting the interior portion
   * of the grass middle-center tile (avoiding decorative edges).
   */
  private createSeamlessGrassTile(): void {
    if (!this.tilemap) return;

    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Extract inner portion of grass tile (avoiding decorative edges)
    const tile = TILES.grass.middleCenter;
    const srcX = tile.col * TILE_SIZE;
    const srcY = tile.row * TILE_SIZE;
    const margin = 12; // Crop 12px from each edge to remove decorative borders
    const innerSize = TILE_SIZE - margin * 2;

    ctx.drawImage(
      this.tilemap,
      srcX + margin,
      srcY + margin,
      innerSize,
      innerSize,
      0,
      0,
      TILE_SIZE,
      TILE_SIZE
    );

    this.seamlessGrassTile = canvas;
  }

  /**
   * Create a seamless water tile from the water background image.
   * The water background is designed to tile seamlessly.
   */
  private createSeamlessWaterTile(): void {
    if (!this.waterBackground) return;

    // Water_Background.png is already designed to tile, so we use it directly
    // We create a TILE_SIZE canvas to maintain consistent sizing
    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Draw the water background scaled to tile size
    ctx.drawImage(
      this.waterBackground,
      0,
      0,
      this.waterBackground.width,
      this.waterBackground.height,
      0,
      0,
      TILE_SIZE,
      TILE_SIZE
    );

    this.seamlessWaterTile = canvas;
  }

  // ===========================================================================
  // BACKGROUND RENDERING
  // ===========================================================================

  /**
   * Fallback background when assets aren't loaded yet.
   */
  private renderFallbackBackground(
    ctx: CanvasRenderingContext2D,
    dimensions: Rectangle
  ): void {
    ctx.fillStyle = "#4ba3a3"; // Water color fallback
    ctx.fillRect(0, 0, dimensions.w, dimensions.h);
  }

  /**
   * Main background rendering method.
   * Draws in order: Water → Grass Platform → Walls → Lanes → Jungle
   */
  private renderBackground(
    ctx: CanvasRenderingContext2D,
    dimensions: Rectangle
  ): void {
    const { width, height } = MOBAConfig.MAP_SIZE;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // 1. Fill entire canvas with water
    this.drawWaterArea(ctx, 0, 0, dimensions.w, dimensions.h);

    ctx.save();
    ctx.translate(halfWidth, halfHeight);

    // Calculate playable grass area (inset from water border)
    const playableWidth = width - WATER_BORDER_SIZE * 2;
    const playableHeight = height - WATER_BORDER_SIZE * 2;
    const playableX = -halfWidth + WATER_BORDER_SIZE;
    const playableY = -halfHeight + WATER_BORDER_SIZE;

    // Align to tile grid
    const tilesWide = Math.floor(playableWidth / TILE_SIZE);
    const tilesHigh = Math.floor(playableHeight / TILE_SIZE);

    // 2. Draw the grass platform with proper edges
    this.drawGrassPlatform(ctx, playableX, playableY, tilesWide, tilesHigh);

    // 3. Draw interior walls with cliff faces
    this.drawInteriorWalls(ctx);

    // 4. Draw lane paths (subtle overlay)
    this.drawLanes(ctx);

    // 5. Draw jungle area indicators
    this.drawJungleAreas(ctx);

    ctx.restore();
  }

  // ===========================================================================
  // WATER RENDERING
  // ===========================================================================

  /**
   * Fill an area with tiled water background.
   */
  private drawWaterArea(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (this.seamlessWaterTile) {
      // Tile the water background
      const tilesX = Math.ceil(width / TILE_SIZE) + 1;
      const tilesY = Math.ceil(height / TILE_SIZE) + 1;

      for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
          ctx.drawImage(
            this.seamlessWaterTile,
            x + tx * TILE_SIZE,
            y + ty * TILE_SIZE
          );
        }
      }
    } else {
      // Fallback to solid color
      ctx.fillStyle = "#4ba3a3";
      ctx.fillRect(x, y, width, height);
    }
  }

  // ===========================================================================
  // GRASS PLATFORM RENDERING
  // ===========================================================================

  /**
   * Draw the main grass platform with proper edge tiles on all sides.
   *
   * Uses a 3x3 tile system:
   * - Corners: topLeft, topRight, bottomLeft, bottomRight
   * - Edges: topCenter, bottomCenter, middleLeft, middleRight
   * - Interior: seamless grass tile (extracted from middleCenter)
   */
  private drawGrassPlatform(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    tilesWide: number,
    tilesHigh: number
  ): void {
    if (!this.tilemap || !this.seamlessGrassTile) return;

    for (let ty = 0; ty < tilesHigh; ty++) {
      for (let tx = 0; tx < tilesWide; tx++) {
        const destX = startX + tx * TILE_SIZE;
        const destY = startY + ty * TILE_SIZE;

        const isTop = ty === 0;
        const isBottom = ty === tilesHigh - 1;
        const isLeft = tx === 0;
        const isRight = tx === tilesWide - 1;
        const isEdge = isTop || isBottom || isLeft || isRight;

        if (isEdge) {
          // Select appropriate edge/corner tile
          const tile = this.selectGrassTile(isTop, isBottom, isLeft, isRight);
          this.drawTile(ctx, tile, destX, destY);
        } else {
          // Interior uses seamless grass
          ctx.drawImage(this.seamlessGrassTile, destX, destY);
        }
      }
    }
  }

  /**
   * Select the appropriate grass tile based on edge position.
   */
  private selectGrassTile(
    isTop: boolean,
    isBottom: boolean,
    isLeft: boolean,
    isRight: boolean
  ): TilePos {
    // Corners (check first as they satisfy two conditions)
    if (isTop && isLeft) return TILES.grass.topLeft;
    if (isTop && isRight) return TILES.grass.topRight;
    if (isBottom && isLeft) return TILES.grass.bottomLeft;
    if (isBottom && isRight) return TILES.grass.bottomRight;

    // Edges
    if (isTop) return TILES.grass.topCenter;
    if (isBottom) return TILES.grass.bottomCenter;
    if (isLeft) return TILES.grass.middleLeft;
    if (isRight) return TILES.grass.middleRight;

    // Fallback to center (shouldn't reach here for edges)
    return TILES.grass.middleCenter;
  }

  // ===========================================================================
  // TILE DRAWING HELPERS
  // ===========================================================================

  /**
   * Draw a single tile from the tilemap at the specified position.
   */
  private drawTile(
    ctx: CanvasRenderingContext2D,
    tile: TilePos,
    destX: number,
    destY: number
  ): void {
    if (!this.tilemap) return;

    ctx.drawImage(
      this.tilemap,
      tile.col * TILE_SIZE,
      tile.row * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      destX,
      destY,
      TILE_SIZE,
      TILE_SIZE
    );
  }

  // ===========================================================================
  // WALL/CLIFF RENDERING
  // ===========================================================================

  /**
   * Draw all interior walls (elevated terrain inside the grass area).
   */
  private drawInteriorWalls(ctx: CanvasRenderingContext2D): void {
    if (!this.tilemap) return;

    for (const wallConfig of MOBAConfig.WALLS) {
      const x = wallConfig.position.x - wallConfig.width / 2;
      const y = wallConfig.position.y - wallConfig.height / 2;
      this.drawElevatedWall(ctx, x, y, wallConfig.width, wallConfig.height);
    }
  }

  /**
   * Draw an elevated wall with grass surface on top and cliff face below.
   *
   * Wall structure (from top to bottom):
   * ┌─────────────────────────────┐
   * │  Elevated Grass (top row)  │  ← elevatedGrass tiles
   * │  Elevated Grass (middle)   │  ← elevatedGrass tiles
   * │  Grass with Cliff Edge     │  ← grassWithCliffEdge tiles
   * │  Cliff Face                │  ← cliff tiles
   * └─────────────────────────────┘
   *
   * For single-row walls: Use grassWithCliffEdge only
   * For 2-row walls: grassWithCliffEdge on top, cliff below
   * For 3+ row walls: elevatedGrass top, grassWithCliffEdge, cliff bottom
   */
  private drawElevatedWall(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const tilesWide = Math.max(1, Math.ceil(width / TILE_SIZE));
    const tilesHigh = Math.max(1, Math.ceil(height / TILE_SIZE));

    for (let ty = 0; ty < tilesHigh; ty++) {
      for (let tx = 0; tx < tilesWide; tx++) {
        const destX = x + tx * TILE_SIZE;
        const destY = y + ty * TILE_SIZE;

        const tile = this.selectWallTile(tx, ty, tilesWide, tilesHigh);
        this.drawTile(ctx, tile, destX, destY);
      }
    }
  }

  /**
   * Select the appropriate wall tile based on position within the wall.
   *
   * Wall structure (from top to bottom):
   * - Elevated Grass Top     (only if tilesHigh >= 5)
   * - Elevated Grass Middle  (only if tilesHigh >= 6, can repeat)
   * - Grass with Cliff Edge  (ALWAYS present - the transition row)
   * - Cliff Top              (cliff face starts here)
   * - Cliff Middle           (only if tilesHigh >= 4)
   * - Cliff Bottom           (only if tilesHigh >= 3)
   *
   * Minimum wall height: 2 tiles (grassWithCliffEdge + cliff.top)
   *
   * Height breakdown:
   * - 2 tiles: grassWithCliffEdge, cliff.top
   * - 3 tiles: grassWithCliffEdge, cliff.top, cliff.bottom
   * - 4 tiles: grassWithCliffEdge, cliff.top, cliff.middle, cliff.bottom
   * - 5 tiles: elevatedGrass.top, grassWithCliffEdge, cliff.top/mid/bottom
   * - 6+ tiles: elevatedGrass.top, elevatedGrass.middle(s), grassWithCliffEdge, cliff
   */
  private selectWallTile(
    tx: number,
    ty: number,
    tilesWide: number,
    tilesHigh: number
  ): TilePos {
    const isLeft = tx === 0;
    const isRight = tx === tilesWide - 1;

    // Helper to get left/center/right variant of a tile row
    const getHorizontalVariant = (
      left: TilePos,
      center: TilePos,
      right: TilePos
    ): TilePos => {
      if (tilesWide === 1) return center; // Single column uses center
      if (isLeft) return left;
      if (isRight) return right;
      return center;
    };

    // Calculate structure dimensions:
    // - Cliff takes 1-3 rows at bottom (top, middle, bottom)
    // - grassWithCliffEdge is always 1 row above cliff
    // - Remaining rows above are elevated grass
    const cliffRows = Math.min(3, tilesHigh - 1); // Reserve at least 1 row for grassWithCliffEdge
    const grassWithCliffEdgeRow = tilesHigh - cliffRows - 1; // Row index for the transition
    const elevatedGrassRows = grassWithCliffEdgeRow; // Number of elevated grass rows (0 if none)

    // Elevated grass region (top rows, if wall is tall enough)
    if (ty < elevatedGrassRows) {
      if (ty === 0) {
        // Top edge of elevated grass
        return getHorizontalVariant(
          TILES.elevatedGrass.topLeft,
          TILES.elevatedGrass.topCenter,
          TILES.elevatedGrass.topRight
        );
      }
      // Middle rows of elevated grass
      return getHorizontalVariant(
        TILES.elevatedGrass.middleLeft,
        TILES.elevatedGrass.middleCenter,
        TILES.elevatedGrass.middleRight
      );
    }

    // Grass with cliff edge (the transition from grass to cliff face)
    if (ty === grassWithCliffEdgeRow) {
      return getHorizontalVariant(
        TILES.grassWithCliffEdge.left,
        TILES.grassWithCliffEdge.center,
        TILES.grassWithCliffEdge.right
      );
    }

    // Cliff region (below grassWithCliffEdge)
    const cliffRowIndex = ty - grassWithCliffEdgeRow - 1; // 0 = first cliff row from top

    // Map to cliff tiles based on how many cliff rows we have
    if (cliffRows === 1) {
      // Only 1 cliff row - use cliff.top
      return getHorizontalVariant(
        TILES.cliff.topLeft,
        TILES.cliff.topCenter,
        TILES.cliff.topRight
      );
    }

    if (cliffRows === 2) {
      // 2 cliff rows: cliff.top + cliff.bottom (skip middle)
      if (cliffRowIndex === 0) {
        return getHorizontalVariant(
          TILES.cliff.topLeft,
          TILES.cliff.topCenter,
          TILES.cliff.topRight
        );
      }
      return getHorizontalVariant(
        TILES.cliff.bottomLeft,
        TILES.cliff.bottomCenter,
        TILES.cliff.bottomRight
      );
    }

    // 3 cliff rows: cliff.top + cliff.middle + cliff.bottom
    if (cliffRowIndex === 0) {
      return getHorizontalVariant(
        TILES.cliff.topLeft,
        TILES.cliff.topCenter,
        TILES.cliff.topRight
      );
    }
    if (cliffRowIndex === 1) {
      return getHorizontalVariant(
        TILES.cliff.middleLeft,
        TILES.cliff.middleCenter,
        TILES.cliff.middleRight
      );
    }
    return getHorizontalVariant(
      TILES.cliff.bottomLeft,
      TILES.cliff.bottomCenter,
      TILES.cliff.bottomRight
    );
  }

  // ===========================================================================
  // LANE & JUNGLE RENDERING (Overlays)
  // ===========================================================================

  /**
   * Draw subtle lane path indicators on the grass.
   * NOTE: Lane rendering removed - server entities are rendered by EntityRenderer.
   */
  private drawLanes(_ctx: CanvasRenderingContext2D): void {
    // Lane paths are no longer drawn - minions are rendered from server state
  }

  /**
   * Draw subtle jungle camp area indicators.
   * NOTE: Currently disabled - camps are visible through creatures only
   */
  private drawJungleAreas(_ctx: CanvasRenderingContext2D): void {
    // Shadow/overlay removed - jungle camps are now indicated by creatures only
    // This makes the map cleaner and relies on visual creature presence
  }

  // ===========================================================================
  // DYNAMIC EFFECTS (drawn on the pre-rendered canvas)
  // ===========================================================================

  /**
   * Draw a bloodstain on the background at the given position.
   */
  drawSwordsmanBloodstain(position: Vector): void {
    if (!this.canvasRenderingContext) return;
    const ctx = this.canvasRenderingContext;
    const halfWidth = this.backgroundCanvas.width / 2;
    const halfHeight = this.backgroundCanvas.height / 2;

    const canvasX = position.x + halfWidth;
    const canvasY = position.y + halfHeight;

    ctx.fillStyle = "rgba(139, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 5 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawArcherBloodstain(position: Vector): void {
    this.drawSwordsmanBloodstain(position);
  }

  drawCastleExplotion(_position: Vector): void {
    // Not used in MOBA mode
  }

  // ===========================================================================
  // GAME LOOP METHODS
  // ===========================================================================

  step(): void {
    // Background is static, no per-frame updates needed
  }

  render(): RenderElement {
    const renderFn = (gameContext: GameContext) => {
      const { canvasRenderingContext } = gameContext;

      // Draw the pre-rendered background canvas
      canvasRenderingContext.drawImage(
        this.backgroundCanvas,
        -this.backgroundCanvas.width / 2,
        -this.backgroundCanvas.height / 2
      );
    };

    const element = new RenderElement(renderFn, true);
    element.zIndex = -1000; // Render behind everything
    return element;
  }
}

export default MOBABackground;
