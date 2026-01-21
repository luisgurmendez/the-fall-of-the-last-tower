import Vector from "@/physics/vector";
import { BitmapFont } from "./BitmapFont";

class RenderUtils {
  static renderCircle(
    canvasRenderingContext: CanvasRenderingContext2D,
    position: Vector,
    radius: number,
  ) {
    canvasRenderingContext.beginPath();
    canvasRenderingContext.arc(
      position.x,
      position.y,
      radius,
      0,
      2 * Math.PI
    );
    canvasRenderingContext.stroke();
  }

  static renderRectangle(
    canvasRenderingContext: CanvasRenderingContext2D,
    position: Vector,
    w: number,
    h: number
  ) {
    canvasRenderingContext.beginPath();
    canvasRenderingContext.rect(
      position.x - w / 2,
      position.y - h / 2,
      w,
      h
    );
    canvasRenderingContext.stroke();
  }

  static renderText(
    canvasRenderingContext: CanvasRenderingContext2D,
    text: string,
    position: Vector,
    centered = true
  ) {
    const textWidth = centered ? canvasRenderingContext.measureText(text).width : 0;
    const textHeight = centered ? canvasRenderingContext.measureText("M").width : 0;
    canvasRenderingContext.fillText(
      text,
      position.x - textWidth / 2,
      position.y + textHeight
    );
  }

  /**
   * Render text using the pixel art font (m5x7).
   * Falls back to monospace if font not loaded.
   *
   * @param size - Font size in pixels (default: 16, recommended: 16, 32, 48)
   */
  static renderBitmapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    options: {
      size?: number;
      color?: string;
      centered?: boolean;
      rightAlign?: boolean;
      shadow?: boolean;
      shadowColor?: string;
      scale?: number;  // Legacy - converted to size
      mini?: boolean;  // Legacy - uses smaller size
    } = {}
  ) {
    const { shadow = true, scale, mini, ...fontOptions } = options;

    // Handle legacy scale/mini options
    let size = options.size ?? 22;
    if (scale !== undefined) {
      size = Math.round(22 * scale);
    }
    if (mini) {
      size = Math.round(size * 0.7);
    }

    if (shadow) {
      BitmapFont.drawTextWithShadow(ctx, text, x, y, {
        ...fontOptions,
        size,
        shadowColor: options.shadowColor ?? '#000000',
      });
    } else {
      BitmapFont.drawText(ctx, text, x, y, { ...fontOptions, size });
    }
  }

  /**
   * Measure bitmap text width.
   */
  static measureBitmapText(ctx: CanvasRenderingContext2D, text: string, size = 22): number {
    return BitmapFont.measureText(ctx, text, size);
  }

  static rotateSelf(
    canvasRenderingContext: CanvasRenderingContext2D,
    position: Vector,
    angle: number
  ) {
    canvasRenderingContext.translate(position.x, position.y);
    canvasRenderingContext.rotate(angle);
    canvasRenderingContext.translate(-position.x, -position.y);
  }
}

export default RenderUtils;
