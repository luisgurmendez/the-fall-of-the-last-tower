/**
 * Type definitions for the sprite system.
 *
 * The sprite system uses BigInt encoding to store pixel art in a compact format.
 * Each pixel's color is stored as an index into a color palette, and all pixels
 * are packed into a single BigInt value.
 */

/**
 * A BigInt value encoding pixel data.
 * Each pixel is encoded as an index into the palette, packed from top-left to bottom-right.
 */
export type PixelArtValue = bigint;

/**
 * A color in the palette, represented as a hex number (e.g., 0xFF0000 for red).
 * Undefined represents transparency.
 */
export type PaletteColor = number | undefined;

/**
 * A color palette - an array of hex colors where the index corresponds to the
 * encoded pixel value.
 */
export type ColorPalette = PaletteColor[];

/**
 * Pixel art data tuple.
 * [0] - BigInt value encoding all pixel indices
 * [1] - Width in pixels
 * [2] - Height in pixels
 * [3] - Cardinality (number of colors in palette, used for decoding)
 * [4] - Color palette array
 */
export type PixelArt = [PixelArtValue, number, number, number, ColorPalette];

/**
 * Animation definition for sprite animations.
 */
export interface AnimationDefinition {
  /** Array of frame indices in the sprite sheet */
  frames: number[];
  /** Duration of each frame in seconds */
  frameDuration: number;
  /** Whether the animation should loop */
  loop?: boolean;
}

/**
 * A map of animation names to their definitions.
 */
export interface AnimationMap {
  [animationName: string]: AnimationDefinition;
}

/**
 * Configuration for a sprite sheet.
 */
export interface SpriteSheetConfig {
  /** Array of pixel art data for each frame */
  sprites: PixelArt[];
  /** Scale factor for rendering (default: 1) */
  scale?: number;
  /** Animations defined for this sprite sheet */
  animations?: AnimationMap;
}

/**
 * Sprite render options.
 */
export interface SpriteRenderOptions {
  /** Whether to mirror the sprite horizontally */
  mirrored?: boolean;
  /** Optional scale override */
  scale?: number;
  /** Optional rotation in radians */
  rotation?: number;
  /** Optional alpha/opacity (0-1) */
  alpha?: number;
}

/**
 * Common interface for sprite sheets (both PixelArt and Image-based).
 * Allows interchangeable use of different sprite sheet implementations.
 */
export interface ISpriteSheet {
  /** Number of frames in the sprite sheet */
  readonly frameCount: number;

  /**
   * Get the dimensions of a frame.
   * @param frame - The frame index (default: 0)
   */
  getFrameSize(frame?: number): { width: number; height: number };

  /**
   * Draw a sprite frame at the specified position.
   * @param ctx - The canvas rendering context
   * @param frame - The frame index to draw
   * @param position - The center position to draw at
   * @param mirrored - Whether to mirror the sprite horizontally
   */
  drawSprite(
    ctx: CanvasRenderingContext2D,
    frame: number,
    position: { x: number; y: number },
    mirrored?: boolean
  ): void;

  /**
   * Draw a sprite frame with additional options.
   * @param ctx - The canvas rendering context
   * @param frame - The frame index to draw
   * @param position - The center position to draw at
   * @param options - Additional render options
   */
  drawSpriteWithOptions(
    ctx: CanvasRenderingContext2D,
    frame: number,
    position: { x: number; y: number },
    options?: SpriteRenderOptions
  ): void;
}
