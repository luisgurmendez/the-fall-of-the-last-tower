/**
 * Builds canvas elements from BigInt-encoded pixel art data.
 *
 * The pixel art format stores each pixel as an index into a color palette.
 * All pixel indices are packed into a single BigInt value, which is decoded
 * by repeatedly dividing by the cardinality (palette size).
 *
 * This format was originally designed for the js13kb game contest to minimize
 * file size. While not the most efficient for runtime, it allows storing
 * complete sprites in very compact code.
 */

import { PixelArt, ColorPalette } from './types';

// Re-export types for backward compatibility
export type { PixelArt, ColorPalette };

/**
 * Utility class for building canvas elements from pixel art data.
 */
class PixelArtBuilder {
  /**
   * Build a canvas element from pixel art data.
   *
   * @param pixelart - The pixel art tuple [value, width, height, cardinality, palette]
   * @param scale - Scale factor for the output canvas (default: 1)
   * @returns A canvas element with the rendered pixel art
   *
   * @example
   * ```typescript
   * const sprite: PixelArt = [0x123n, 8, 8, 4, [0xFF0000, 0x00FF00, 0x0000FF, undefined]];
   * const canvas = PixelArtBuilder.buildCanvas(sprite, 2); // 2x scale
   * ```
   */
  static buildCanvas(pixelart: PixelArt, scale = 1): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const [value, width, height, cardinality, palette] = pixelart;
    let currentValue = value;

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('PixelArtBuilder: Failed to get canvas context');
      return canvas;
    }

    const cardinalityBigInt = BigInt(cardinality);

    // Decode and render pixels from top-left to bottom-right
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const colorIndex = Number(currentValue % cardinalityBigInt);
        const color = palette[colorIndex];

        if (color !== undefined) {
          ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
        // Transparent pixels (undefined) are skipped

        currentValue /= cardinalityBigInt;
      }
    }

    return canvas;
  }

  /**
   * Create a modified copy of pixel art with a different palette.
   *
   * @param pixelart - The original pixel art
   * @param newPalette - The new color palette
   * @returns A new pixel art tuple with the modified palette
   */
  static withPalette(pixelart: PixelArt, newPalette: ColorPalette): PixelArt {
    const [value, width, height, cardinality] = pixelart;
    return [value, width, height, cardinality, newPalette];
  }

  /**
   * Replace a specific color in the palette.
   *
   * @param pixelart - The original pixel art
   * @param sourceColor - The color to replace
   * @param targetColor - The replacement color
   * @returns A new pixel art tuple with the color replaced
   */
  static replaceColor(
    pixelart: PixelArt,
    sourceColor: number,
    targetColor: number
  ): PixelArt {
    const [value, width, height, cardinality, palette] = pixelart;
    const newPalette = palette.map((color) =>
      color === sourceColor ? targetColor : color
    );
    return [value, width, height, cardinality, newPalette];
  }
}

export default PixelArtBuilder;

