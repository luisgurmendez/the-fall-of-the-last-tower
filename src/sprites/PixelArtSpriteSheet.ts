/**
 * A sprite sheet built from pixel art data.
 * Stores pre-rendered canvas elements for each frame for efficient drawing.
 */

import Vector from '@/physics/vector';
import PixelArtBuilder from './PixelArtBuilder';
import { PixelArt, SpriteRenderOptions } from './types';

class PixelArtSpriteSheet {
  /** Pre-rendered canvas elements for each frame */
  private canvases: HTMLCanvasElement[];

  /** The original pixel art data */
  private sprites: PixelArt[];

  /** Number of frames in the sprite sheet */
  readonly frameCount: number;

  /**
   * Create a new sprite sheet from pixel art data.
   * @param sprites - Array of pixel art data for each frame
   * @param scale - Scale factor for rendering (default: 1)
   */
  constructor(sprites: PixelArt[], scale = 1) {
    this.sprites = sprites;
    this.canvases = sprites.map((pa) => PixelArtBuilder.buildCanvas(pa, scale));
    this.frameCount = sprites.length;
  }

  /**
   * Get the canvas for a specific frame.
   * @param frame - The frame index
   * @returns The pre-rendered canvas for the frame
   */
  getFrame(frame: number): HTMLCanvasElement | undefined {
    return this.canvases[frame];
  }

  /**
   * Get the dimensions of a frame.
   * @param frame - The frame index (default: 0)
   * @returns Width and height of the frame
   */
  getFrameSize(frame = 0): { width: number; height: number } {
    const canvas = this.canvases[frame];
    if (!canvas) {
      return { width: 0, height: 0 };
    }
    return { width: canvas.width, height: canvas.height };
  }

  /**
   * Draw a sprite frame at the specified position.
   *
   * @param ctx - The canvas rendering context
   * @param frame - The frame index to draw
   * @param position - The center position to draw at
   * @param mirrored - Whether to mirror the sprite horizontally
   */
  drawSprite(
    ctx: CanvasRenderingContext2D,
    frame: number,
    position: Vector,
    mirrored = false
  ): void {
    const canvas = this.canvases[frame];
    if (!canvas) {
      console.warn(`PixelArtSpriteSheet: Invalid frame index ${frame}`);
      return;
    }

    ctx.translate(position.x, position.y);
    if (mirrored) {
      ctx.scale(-1, 1);
    }
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.drawImage(canvas, 0, 0);
  }

  /**
   * Draw a sprite frame with additional options.
   *
   * @param ctx - The canvas rendering context
   * @param frame - The frame index to draw
   * @param position - The center position to draw at
   * @param options - Additional render options
   */
  drawSpriteWithOptions(
    ctx: CanvasRenderingContext2D,
    frame: number,
    position: Vector,
    options: SpriteRenderOptions = {}
  ): void {
    const canvas = this.canvases[frame];
    if (!canvas) {
      console.warn(`PixelArtSpriteSheet: Invalid frame index ${frame}`);
      return;
    }

    const { mirrored = false, scale = 1, rotation = 0, alpha = 1 } = options;

    ctx.save();

    // Apply alpha
    if (alpha < 1) {
      ctx.globalAlpha = alpha;
    }

    // Position and transform
    ctx.translate(position.x, position.y);

    if (rotation !== 0) {
      ctx.rotate(rotation);
    }

    if (mirrored) {
      ctx.scale(-scale, scale);
    } else if (scale !== 1) {
      ctx.scale(scale, scale);
    }

    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.drawImage(canvas, 0, 0);

    ctx.restore();
  }
}

export default PixelArtSpriteSheet;

