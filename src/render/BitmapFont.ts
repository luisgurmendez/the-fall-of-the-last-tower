/**
 * BitmapFont - Renders text using a pixel art TTF font.
 *
 * Uses the m5x7 font by Daniel Linssen (CC0 - Public Domain).
 * The font is loaded via CSS @font-face and rendered with canvas.
 */

export class BitmapFont {
  private static _isLoaded = false;
  private static _fontFamily = 'm5x7';

  /**
   * Check if the font is loaded.
   */
  static get isLoaded(): boolean {
    return BitmapFont._isLoaded;
  }

  /**
   * Get the font family name.
   */
  static get fontFamily(): string {
    return BitmapFont._fontFamily;
  }

  /**
   * Load the pixel art font.
   * Call this during game initialization.
   */
  static async loadFonts(): Promise<void> {
    // Create @font-face rule dynamically
    const fontFace = new FontFace(BitmapFont._fontFamily, 'url(/assets/fonts/m5x7.ttf)');

    try {
      const loadedFont = await fontFace.load();
      document.fonts.add(loadedFont);
      BitmapFont._isLoaded = true;
      console.log('Pixel font loaded:', BitmapFont._fontFamily);
    } catch (error) {
      console.warn('Failed to load pixel font, falling back to monospace:', error);
    }
  }

  /**
   * Get the CSS font string for a given size.
   * @param size - Font size in pixels (recommended: 16, 32, 48)
   */
  static getFont(size: number): string {
    if (BitmapFont._isLoaded) {
      return `${size}px "${BitmapFont._fontFamily}"`;
    }
    return `${size}px monospace`;
  }

  /**
   * Draw text at the specified position.
   * @param ctx - Canvas rendering context
   * @param text - Text to draw
   * @param x - X position
   * @param y - Y position
   * @param options - Rendering options
   */
  static drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    options: {
      size?: number;
      color?: string;
      alpha?: number;
      centered?: boolean;
      rightAlign?: boolean;
    } = {}
  ): void {
    const {
      size = 22,
      color = '#FFFFFF',
      alpha = 1,
      centered = false,
      rightAlign = false,
    } = options;

    ctx.save();

    // Set font
    ctx.font = BitmapFont.getFont(size);
    ctx.fillStyle = color;

    if (alpha < 1) {
      ctx.globalAlpha = alpha;
    }

    // Set alignment
    if (centered) {
      ctx.textAlign = 'center';
    } else if (rightAlign) {
      ctx.textAlign = 'right';
    } else {
      ctx.textAlign = 'left';
    }
    ctx.textBaseline = 'top';

    // Disable anti-aliasing for crisp pixel art
    ctx.imageSmoothingEnabled = false;

    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /**
   * Draw text with shadow for better visibility.
   */
  static drawTextWithShadow(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    options: {
      size?: number;
      color?: string;
      shadowColor?: string;
      shadowOffset?: number;
      alpha?: number;
      centered?: boolean;
      rightAlign?: boolean;
    } = {}
  ): void {
    const {
      shadowColor = '#000000',
      shadowOffset = 1,
      ...textOptions
    } = options;

    // Draw shadow
    BitmapFont.drawText(ctx, text, x + shadowOffset, y + shadowOffset, {
      ...textOptions,
      color: shadowColor,
    });

    // Draw main text
    BitmapFont.drawText(ctx, text, x, y, textOptions);
  }

  /**
   * Measure text width.
   * @param ctx - Canvas context to measure with
   * @param text - Text to measure
   * @param size - Font size
   */
  static measureText(ctx: CanvasRenderingContext2D, text: string, size = 22): number {
    ctx.save();
    ctx.font = BitmapFont.getFont(size);
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
  }
}

export default BitmapFont;
