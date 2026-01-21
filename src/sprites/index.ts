/**
 * Sprites module exports.
 * Provides all sprite-related functionality including pixel art rendering,
 * sprite sheets, animation, and sprite management.
 */

// Pixel art (BigInt encoded) sprites
export { default as PixelArtBuilder } from './PixelArtBuilder';
export { default as PixelArtSpriteSheet } from './PixelArtSpriteSheet';
export { default as PixelArtSpriteAnimator } from './PixelArtSpriteAnimator';

// Image-based (PNG) sprites
export { default as ImageSpriteSheet } from './ImageSpriteSheet';
export type {
  FrameRegion,
  GridSpriteSheetConfig,
  FrameListSpriteSheetConfig,
  ImageSpriteSheetConfig,
} from './ImageSpriteSheet';

// Generic animator (works with any ISpriteSheet)
export { default as SpriteAnimator } from './SpriteAnimator';

// Sprite management
export { default as SpriteManager, getSpriteManager } from './SpriteManager';

// Types
export type {
  PixelArt,
  PixelArtValue,
  PaletteColor,
  ColorPalette,
  AnimationDefinition,
  AnimationMap,
  SpriteSheetConfig,
  SpriteRenderOptions,
  ISpriteSheet,
} from './types';
