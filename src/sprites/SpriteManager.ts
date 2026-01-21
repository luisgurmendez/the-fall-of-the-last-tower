/**
 * Centralized sprite management with caching.
 * Handles sprite loading, caching, and provides a single point of access for all sprites.
 */

import { PixelArt, ColorPalette } from './types';
import PixelArtSpriteSheet from './PixelArtSpriteSheet';
import PixelArtSpriteAnimator from './PixelArtSpriteAnimator';

/**
 * Cache entry for a sprite sheet.
 */
interface SpriteSheetCacheEntry {
  spriteSheet: PixelArtSpriteSheet;
  sprites: PixelArt[];
}

/**
 * Singleton manager for sprite resources.
 * Provides caching and centralized access to sprite sheets and animators.
 */
class SpriteManager {
  private static instance: SpriteManager | null = null;

  /** Cache of sprite sheets by key */
  private spriteSheetCache = new Map<string, SpriteSheetCacheEntry>();

  /** Cache of individual canvas renders */
  private canvasCache = new Map<string, HTMLCanvasElement>();

  private constructor() {}

  /**
   * Get the singleton instance.
   */
  static getInstance(): SpriteManager {
    if (!SpriteManager.instance) {
      SpriteManager.instance = new SpriteManager();
    }
    return SpriteManager.instance;
  }

  /**
   * Register a sprite sheet with a unique key.
   * @param key - Unique identifier for the sprite sheet
   * @param sprites - Array of pixel art data
   * @returns The created sprite sheet
   */
  registerSpriteSheet(key: string, sprites: PixelArt[]): PixelArtSpriteSheet {
    // Check cache first
    const cached = this.spriteSheetCache.get(key);
    if (cached) {
      return cached.spriteSheet;
    }

    // Create new sprite sheet
    const spriteSheet = new PixelArtSpriteSheet(sprites);
    this.spriteSheetCache.set(key, { spriteSheet, sprites });

    return spriteSheet;
  }

  /**
   * Get a registered sprite sheet.
   * @param key - The sprite sheet key
   * @returns The sprite sheet or undefined if not found
   */
  getSpriteSheet(key: string): PixelArtSpriteSheet | undefined {
    return this.spriteSheetCache.get(key)?.spriteSheet;
  }

  /**
   * Create an animator for a registered sprite sheet.
   * @param key - The sprite sheet key
   * @param idleFrame - The frame index to use when no animation is playing
   * @returns A new animator instance or null if sprite sheet not found
   */
  createAnimator(key: string, idleFrame = 0): PixelArtSpriteAnimator | null {
    const spriteSheet = this.getSpriteSheet(key);
    if (!spriteSheet) {
      console.warn(`SpriteManager: Sprite sheet '${key}' not found`);
      return null;
    }

    return new PixelArtSpriteAnimator(spriteSheet, idleFrame);
  }

  /**
   * Register sprites with team color modification.
   * Creates variants of sprites with team-specific colors.
   * @param baseKey - Base key for the sprite set
   * @param sprites - Original sprite data
   * @param side - Team side (0 = ally, 1 = enemy)
   * @param sourceColor - Color to replace (hex)
   * @param allyColor - Color for allies (hex)
   * @param enemyColor - Color for enemies (hex)
   */
  registerTeamSprites(
    baseKey: string,
    sprites: PixelArt[],
    side: 0 | 1,
    sourceColor = 0x213ded,
    allyColor = 0x213ded,
    enemyColor = 0xed2121
  ): PixelArtSpriteSheet {
    const key = `${baseKey}_side${side}`;

    // Check cache
    const cached = this.spriteSheetCache.get(key);
    if (cached) {
      return cached.spriteSheet;
    }

    // Create color-modified sprites
    const targetColor = side === 1 ? enemyColor : allyColor;
    const modifiedSprites = sprites.map((sprite) => {
      const [value, width, height, cardinality, palette] = sprite;
      const newPalette: ColorPalette = palette.map((color) =>
        color === sourceColor ? targetColor : color
      );
      return [value, width, height, cardinality, newPalette] as PixelArt;
    });

    return this.registerSpriteSheet(key, modifiedSprites);
  }

  /**
   * Clear all cached sprites.
   * Call this when cleaning up or when sprites need to be reloaded.
   */
  clearCache(): void {
    this.spriteSheetCache.clear();
    this.canvasCache.clear();
  }

  /**
   * Get cache statistics for debugging.
   */
  getCacheStats(): { spriteSheets: number; canvases: number } {
    return {
      spriteSheets: this.spriteSheetCache.size,
      canvases: this.canvasCache.size,
    };
  }

  /**
   * Reset the singleton instance.
   * Useful for testing or full cleanup.
   */
  static reset(): void {
    if (SpriteManager.instance) {
      SpriteManager.instance.clearCache();
      SpriteManager.instance = null;
    }
  }
}

// Convenience export
export const getSpriteManager = SpriteManager.getInstance;

export default SpriteManager;
