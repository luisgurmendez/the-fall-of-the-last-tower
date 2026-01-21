/**
 * Utility functions for army unit sprites.
 */

import { PixelArt, ColorPalette } from '@/sprites/types';
import { Side } from '@/types';

/** Default ally team color (blue) */
export const ALLY_COLOR = 0x213ded;

/** Default enemy team color (red) */
export const ENEMY_COLOR = 0xed2121;

/**
 * Create a copy of sprites with team-specific colors.
 *
 * @param sprites - Array of pixel art data
 * @param side - The team side (0 = ally, 1 = enemy)
 * @param sourceColor - The color to replace (default: ally blue)
 * @param allyColor - Color for allies (default: blue)
 * @param enemyColor - Color for enemies (default: red)
 * @returns New array of sprites with modified palette
 */
export function buildArmySpritesWithSideColor(
  sprites: PixelArt[],
  side: Side,
  sourceColor = ALLY_COLOR,
  allyColor = ALLY_COLOR,
  enemyColor = ENEMY_COLOR
): PixelArt[] {
  const targetColor = side === 1 ? enemyColor : allyColor;

  return sprites.map((sprite) => {
    const [value, width, height, cardinality, palette] = sprite;
    const newPalette: ColorPalette = palette.map((color) =>
      color === sourceColor ? targetColor : color
    );
    return [value, width, height, cardinality, newPalette] as PixelArt;
  });
}
