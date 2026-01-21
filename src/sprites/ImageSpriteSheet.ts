/**
 * ImageSpriteSheet - A flexible sprite sheet loaded from image files.
 *
 * Supports multiple configuration types:
 * - Grid-based: Single image divided into rows/cols (for Gromp, Bush)
 * - Frame-list: Single image with explicit frame regions
 * - Animation-based: Multiple images for different animations (for Swordsman, Archer)
 *
 * Compatible with both SpriteAnimator and PixelArtSpriteAnimator.
 */

import Vector from '@/physics/vector';
import { SpriteRenderOptions, ISpriteSheet } from './types';

/**
 * Defines a rectangular region within a sprite sheet.
 */
export interface FrameRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Grid-based sprite sheet configuration.
 * The image is divided into equal-sized cells arranged in a grid.
 */
export interface GridSpriteSheetConfig {
  type: 'grid';
  rows: number;
  cols: number;
  spriteWidth: number;
  spriteHeight: number;
  scale?: number;
}

/**
 * Frame-list sprite sheet configuration.
 * Each frame is explicitly defined with its region.
 */
export interface FrameListSpriteSheetConfig {
  type: 'frameList';
  frames: FrameRegion[];
  scale?: number;
}

/**
 * Configuration for a single animation in the multi-animation sprite sheet.
 */
export interface AnimationImageConfig {
  /** Path to the sprite sheet image */
  src: string;
  /** Number of frames in the animation */
  frameCount: number;
  /** Width of each frame in pixels */
  frameWidth: number;
  /** Height of each frame in pixels */
  frameHeight: number;
}

/**
 * Animation-based sprite sheet configuration.
 * Multiple images, one per animation.
 */
export interface AnimationSpriteSheetConfig {
  type: 'animations';
  animations: Record<string, AnimationImageConfig>;
  scale?: number;
}

/**
 * Union type for all sprite sheet configurations.
 */
export type ImageSpriteSheetConfig =
  | GridSpriteSheetConfig
  | FrameListSpriteSheetConfig
  | AnimationSpriteSheetConfig;

/**
 * Loaded animation data (for animation-based config).
 */
interface LoadedAnimation {
  image: HTMLImageElement;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  loaded: boolean;
}

/**
 * ImageSpriteSheet - Manages image-based sprite animations.
 *
 * Supports three modes:
 * 1. Grid mode: Load a single image and divide into grid cells
 * 2. Frame-list mode: Load a single image with explicit frame regions
 * 3. Animation mode: Load multiple images for different animations
 */
class ImageSpriteSheet implements ISpriteSheet {
  /** Configuration type */
  private configType: 'grid' | 'frameList' | 'animations';

  /** Image for grid/frameList modes */
  private image: HTMLImageElement | null = null;

  /** Loaded animations for animation mode */
  private animations: Map<string, LoadedAnimation> = new Map();

  /** Flat frame map for animation mode */
  private frameMap: Map<number, { animation: string; frameIndex: number }> = new Map();

  /** Frame offset for each animation (for flat frame indexing) */
  private animationFrameOffsets: Map<string, number> = new Map();

  /** Grid config (for grid mode) */
  private rows: number = 1;
  private cols: number = 1;
  private spriteWidth: number = 0;
  private spriteHeight: number = 0;

  /** Frame list (for frameList mode) */
  private frames: FrameRegion[] = [];

  /** Scale factor for rendering */
  private scale: number = 1;

  /** Total frame count */
  frameCount: number = 0;

  /** Whether the sprite sheet is loaded */
  private loaded: boolean = false;

  constructor(config: ImageSpriteSheetConfig) {
    this.configType = config.type;
    this.scale = config.scale ?? 1;

    if (config.type === 'grid') {
      this.rows = config.rows;
      this.cols = config.cols;
      this.spriteWidth = config.spriteWidth;
      this.spriteHeight = config.spriteHeight;
      this.frameCount = config.rows * config.cols;
    } else if (config.type === 'frameList') {
      this.frames = config.frames;
      this.frameCount = config.frames.length;
      // Infer dimensions from first frame
      if (config.frames.length > 0) {
        this.spriteWidth = config.frames[0].width;
        this.spriteHeight = config.frames[0].height;
      }
    } else if (config.type === 'animations') {
      let frameOffset = 0;

      // Load all animation images
      for (const [name, animConfig] of Object.entries(config.animations)) {
        const img = new Image();
        img.src = animConfig.src;

        const loadedAnim: LoadedAnimation = {
          image: img,
          frameCount: animConfig.frameCount,
          frameWidth: animConfig.frameWidth,
          frameHeight: animConfig.frameHeight,
          loaded: false,
        };

        this.animations.set(name, loadedAnim);
        this.animationFrameOffsets.set(name, frameOffset);

        // Build frame map for flat indexing
        for (let i = 0; i < animConfig.frameCount; i++) {
          this.frameMap.set(frameOffset + i, { animation: name, frameIndex: i });
        }

        frameOffset += animConfig.frameCount;

        // Track load state
        img.onload = () => {
          loadedAnim.loaded = true;
          this.checkAllLoaded();
        };
      }

      this.frameCount = frameOffset;

      // Get dimensions from first animation
      const firstAnim = Object.values(config.animations)[0];
      if (firstAnim) {
        this.spriteWidth = firstAnim.frameWidth;
        this.spriteHeight = firstAnim.frameHeight;
      }
    }
  }

  /**
   * Check if all animation images are loaded (animation mode).
   */
  private checkAllLoaded(): void {
    for (const anim of this.animations.values()) {
      if (!anim.loaded) return;
    }
    this.loaded = true;
  }

  /**
   * Load the sprite sheet image (for grid and frameList modes).
   * @param url - URL of the image to load
   */
  async load(url: string): Promise<void> {
    if (this.configType === 'animations') {
      // Animation mode loads automatically in constructor
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        this.image = img;
        this.loaded = true;
        resolve();
      };
      img.onerror = () => {
        reject(new Error(`Failed to load sprite sheet image: ${url}`));
      };
    });
  }

  /**
   * Check if the sprite sheet is ready to render.
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get the frame offset for an animation (animation mode).
   */
  getAnimationFrameOffset(animationName: string): number {
    return this.animationFrameOffsets.get(animationName) ?? 0;
  }

  /**
   * Get frame indices for an animation (animation mode).
   */
  getAnimationFrames(animationName: string): number[] {
    const anim = this.animations.get(animationName);
    if (!anim) return [];

    const offset = this.animationFrameOffsets.get(animationName) ?? 0;
    const frames: number[] = [];
    for (let i = 0; i < anim.frameCount; i++) {
      frames.push(offset + i);
    }
    return frames;
  }

  /**
   * Get the dimensions of a frame.
   */
  getFrameSize(frame = 0): { width: number; height: number } {
    if (this.configType === 'animations') {
      const mapping = this.frameMap.get(frame);
      if (!mapping) return { width: 0, height: 0 };

      const anim = this.animations.get(mapping.animation);
      if (!anim) return { width: 0, height: 0 };

      return {
        width: anim.frameWidth * this.scale,
        height: anim.frameHeight * this.scale,
      };
    }

    return {
      width: this.spriteWidth * this.scale,
      height: this.spriteHeight * this.scale,
    };
  }

  /**
   * Draw a sprite frame at the specified position.
   * Compatible with ISpriteSheet interface.
   */
  drawSprite(
    ctx: CanvasRenderingContext2D,
    frame: number,
    position: Vector,
    mirrored = false
  ): void {
    this.drawSpriteWithOptions(ctx, frame, position, { mirrored });
  }

  /**
   * Draw a sprite frame with additional options.
   * Compatible with ISpriteSheet interface.
   */
  drawSpriteWithOptions(
    ctx: CanvasRenderingContext2D,
    frame: number,
    position: Vector,
    options: SpriteRenderOptions = {}
  ): void {
    const { mirrored = false, scale = 1, rotation = 0, alpha = 1 } = options;

    if (this.configType === 'animations') {
      this.drawAnimationFrame(ctx, frame, position, options);
      return;
    }

    if (!this.image || !this.loaded) return;

    let srcX: number, srcY: number, srcWidth: number, srcHeight: number;

    if (this.configType === 'grid') {
      const row = Math.floor(frame / this.cols);
      const col = frame % this.cols;
      srcX = col * this.spriteWidth;
      srcY = row * this.spriteHeight;
      srcWidth = this.spriteWidth;
      srcHeight = this.spriteHeight;
    } else {
      // frameList mode
      const frameRegion = this.frames[frame];
      if (!frameRegion) return;
      srcX = frameRegion.x;
      srcY = frameRegion.y;
      srcWidth = frameRegion.width;
      srcHeight = frameRegion.height;
    }

    const destWidth = srcWidth * this.scale * scale;
    const destHeight = srcHeight * this.scale * scale;

    ctx.save();

    if (alpha < 1) {
      ctx.globalAlpha = alpha;
    }

    ctx.translate(position.x, position.y);

    if (rotation !== 0) {
      ctx.rotate(rotation);
    }

    if (mirrored) {
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      this.image,
      srcX, srcY, srcWidth, srcHeight,
      -destWidth / 2, -destHeight / 2, destWidth, destHeight
    );

    ctx.restore();
  }

  /**
   * Draw a frame from animation mode.
   */
  private drawAnimationFrame(
    ctx: CanvasRenderingContext2D,
    frame: number,
    position: Vector,
    options: SpriteRenderOptions = {}
  ): void {
    const mapping = this.frameMap.get(frame);
    if (!mapping) return;

    const anim = this.animations.get(mapping.animation);
    if (!anim || !anim.loaded) return;

    const { image, frameWidth, frameHeight } = anim;
    const srcX = mapping.frameIndex * frameWidth;
    const srcY = 0;

    const { mirrored = false, scale = 1, rotation = 0, alpha = 1 } = options;

    const destWidth = frameWidth * this.scale * scale;
    const destHeight = frameHeight * this.scale * scale;

    ctx.save();

    if (alpha < 1) {
      ctx.globalAlpha = alpha;
    }

    ctx.translate(position.x, position.y);

    if (rotation !== 0) {
      ctx.rotate(rotation);
    }

    if (mirrored) {
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      image,
      srcX, srcY, frameWidth, frameHeight,
      -destWidth / 2, -destHeight / 2, destWidth, destHeight
    );

    ctx.restore();
  }
}

export default ImageSpriteSheet;
