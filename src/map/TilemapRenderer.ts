/**
 * TilemapRenderer - Renders terrain using tilemap sprites.
 *
 * Handles:
 * - Grass ground tiles (seamless interior extraction)
 * - Cliff/wall tiles for elevation
 * - Edge transitions between different heights
 */

const TILEMAP_PATH = '/assets/sprites/Map/Tilemap_Grass.png';
const TILE_SIZE = 64;

/**
 * Tile positions in the tilemap (576x384, 9 cols x 6 rows).
 */
const TILES = {
  // Grass platform tiles (top-left area)
  grass: {
    topLeft: { col: 0, row: 0 },
    topCenter: { col: 1, row: 0 },
    topRight: { col: 2, row: 0 },
    middleLeft: { col: 0, row: 1 },
    middleCenter: { col: 1, row: 1 },
    middleRight: { col: 2, row: 1 },
    // Narrow strips
    narrowLeft: { col: 0, row: 2 },
    narrowCenter: { col: 1, row: 2 },
    narrowRight: { col: 2, row: 2 },
  },

  // Elevated platform with grass top and cliff (right side)
  elevated: {
    topLeft: { col: 5, row: 0 },
    topCenter: { col: 6, row: 0 },
    topRight: { col: 7, row: 0 },
    middleLeft: { col: 5, row: 1 },
    middleCenter: { col: 6, row: 1 },
    middleRight: { col: 7, row: 1 },
    // With cliff edge showing
    cliffLeft: { col: 5, row: 2 },
    cliffCenter: { col: 6, row: 2 },
    cliffRight: { col: 7, row: 2 },
  },

  // Pure cliff/wall tiles (bottom-right)
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

  // Corner/ramp pieces (bottom-left)
  ramp: {
    leftDown: { col: 0, row: 3 },
    rightDown: { col: 1, row: 3 },
    // Additional pieces
    leftUp: { col: 0, row: 4 },
    rightUp: { col: 1, row: 4 },
  },
};

/**
 * Manages tilemap loading and rendering.
 */
export class TilemapRenderer {
  private tilemap: HTMLImageElement | null = null;
  private loaded: boolean = false;
  private loadPromise: Promise<void>;

  // Pre-rendered seamless grass tile (extracted from center, no edges)
  private seamlessGrassTile: HTMLCanvasElement | null = null;

  constructor() {
    this.loadPromise = this.loadTilemap();
  }

  /**
   * Load the tilemap image.
   */
  private async loadTilemap(): Promise<void> {
    try {
      const img = new Image();
      img.src = TILEMAP_PATH;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load tilemap'));
      });

      this.tilemap = img;
      this.loaded = true;

      // Create seamless grass tile by extracting center portion
      this.createSeamlessGrassTile();
    } catch (error) {
      console.error('Failed to load tilemap:', error);
    }
  }

  /**
   * Wait for tilemap to be loaded.
   */
  async waitForLoad(): Promise<void> {
    return this.loadPromise;
  }

  /**
   * Check if tilemap is loaded.
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Create a seamless grass tile by extracting the interior portion
   * from the grass tiles (avoiding the decorative edges).
   */
  private createSeamlessGrassTile(): void {
    if (!this.tilemap) return;

    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Extract from the center of the grass area
    // The interior grass texture is in the middle of tiles (1,0) and (1,1)
    // We'll sample from the middle portion to avoid edges
    const tile = TILES.grass.middleCenter;
    const srcX = tile.col * TILE_SIZE;
    const srcY = tile.row * TILE_SIZE;

    // Extract the center 48x48 portion and scale to 64x64
    // This removes the decorative edges
    const margin = 8; // pixels to crop from each edge
    const innerSize = TILE_SIZE - margin * 2;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.tilemap,
      srcX + margin,      // Source X (skip left edge)
      srcY + margin,      // Source Y (skip top edge)
      innerSize,          // Source width
      innerSize,          // Source height
      0,                  // Dest X
      0,                  // Dest Y
      TILE_SIZE,          // Dest width (scale up)
      TILE_SIZE           // Dest height (scale up)
    );

    this.seamlessGrassTile = canvas;
  }

  /**
   * Draw seamless grass across an area.
   */
  drawGrassArea(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (!this.seamlessGrassTile) return;

    const tilesX = Math.ceil(width / TILE_SIZE) + 1;
    const tilesY = Math.ceil(height / TILE_SIZE) + 1;

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        ctx.drawImage(
          this.seamlessGrassTile,
          x + tx * TILE_SIZE,
          y + ty * TILE_SIZE
        );
      }
    }
  }

  /**
   * Draw a single tile from the tilemap.
   */
  drawTile(
    ctx: CanvasRenderingContext2D,
    tilePos: { col: number; row: number },
    destX: number,
    destY: number,
    scale: number = 1
  ): void {
    if (!this.tilemap) return;

    const srcX = tilePos.col * TILE_SIZE;
    const srcY = tilePos.row * TILE_SIZE;
    const destSize = TILE_SIZE * scale;

    ctx.drawImage(
      this.tilemap,
      srcX, srcY, TILE_SIZE, TILE_SIZE,
      destX, destY, destSize, destSize
    );
  }

  /**
   * Draw a wall/cliff using the elevation tiles.
   * Creates a wall with grass top and cliff face.
   */
  drawWall(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (!this.tilemap) return;

    const tilesWide = Math.ceil(width / TILE_SIZE);
    const tilesHigh = Math.ceil(height / TILE_SIZE);

    for (let ty = 0; ty < tilesHigh; ty++) {
      for (let tx = 0; tx < tilesWide; tx++) {
        const destX = x + tx * TILE_SIZE;
        const destY = y + ty * TILE_SIZE;

        // Determine which tile to use based on position
        let tile: { col: number; row: number };

        const isLeft = tx === 0;
        const isRight = tx === tilesWide - 1;
        const isTop = ty === 0;
        const isBottom = ty === tilesHigh - 1;

        if (isTop) {
          // Top row - grass with cliff edge
          if (isLeft) {
            tile = TILES.elevated.cliffLeft;
          } else if (isRight) {
            tile = TILES.elevated.cliffRight;
          } else {
            tile = TILES.elevated.cliffCenter;
          }
        } else {
          // Lower rows - cliff face
          if (isLeft) {
            tile = TILES.cliff.middleLeft;
          } else if (isRight) {
            tile = TILES.cliff.middleRight;
          } else {
            tile = TILES.cliff.middleCenter;
          }
        }

        this.drawTile(ctx, tile, destX, destY);
      }
    }
  }

  /**
   * Draw an elevated platform (grass top with cliff sides).
   */
  drawElevatedPlatform(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    cliffHeight: number = TILE_SIZE
  ): void {
    if (!this.tilemap) return;

    const tilesWide = Math.ceil(width / TILE_SIZE);
    const grassHeight = height - cliffHeight;
    const grassTilesHigh = Math.max(1, Math.ceil(grassHeight / TILE_SIZE));
    const cliffTilesHigh = Math.ceil(cliffHeight / TILE_SIZE);

    // Draw grass top
    for (let ty = 0; ty < grassTilesHigh; ty++) {
      for (let tx = 0; tx < tilesWide; tx++) {
        const destX = x + tx * TILE_SIZE;
        const destY = y + ty * TILE_SIZE;

        const isLeft = tx === 0;
        const isRight = tx === tilesWide - 1;
        const isTop = ty === 0;
        const isBottom = ty === grassTilesHigh - 1;

        let tile: { col: number; row: number };

        if (isTop) {
          if (isLeft) tile = TILES.elevated.topLeft;
          else if (isRight) tile = TILES.elevated.topRight;
          else tile = TILES.elevated.topCenter;
        } else if (isBottom) {
          // Bottom of grass area - shows cliff edge
          if (isLeft) tile = TILES.elevated.cliffLeft;
          else if (isRight) tile = TILES.elevated.cliffRight;
          else tile = TILES.elevated.cliffCenter;
        } else {
          if (isLeft) tile = TILES.elevated.middleLeft;
          else if (isRight) tile = TILES.elevated.middleRight;
          else tile = TILES.elevated.middleCenter;
        }

        this.drawTile(ctx, tile, destX, destY);
      }
    }

    // Draw cliff face below
    for (let ty = 0; ty < cliffTilesHigh; ty++) {
      for (let tx = 0; tx < tilesWide; tx++) {
        const destX = x + tx * TILE_SIZE;
        const destY = y + grassTilesHigh * TILE_SIZE + ty * TILE_SIZE;

        const isLeft = tx === 0;
        const isRight = tx === tilesWide - 1;

        let tile: { col: number; row: number };

        if (isLeft) tile = TILES.cliff.middleLeft;
        else if (isRight) tile = TILES.cliff.middleRight;
        else tile = TILES.cliff.middleCenter;

        this.drawTile(ctx, tile, destX, destY);
      }
    }
  }

  /**
   * Get tile size.
   */
  getTileSize(): number {
    return TILE_SIZE;
  }
}

// Singleton instance
let tilemapRendererInstance: TilemapRenderer | null = null;

export function getTilemapRenderer(): TilemapRenderer {
  if (!tilemapRendererInstance) {
    tilemapRendererInstance = new TilemapRenderer();
  }
  return tilemapRendererInstance;
}

export { TILES, TILE_SIZE };
