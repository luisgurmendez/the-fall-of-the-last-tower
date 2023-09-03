import { Circle, Rectangle } from "@/objects/shapes";
import Vector from "@/physics/vector";

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
    position: Vector
  ) {
    const textWidth = canvasRenderingContext.measureText(text).width;
    const textHeight = canvasRenderingContext.measureText("M").width;
    canvasRenderingContext.fillText(
      text,
      position.x - textWidth / 2,
      position.y + textHeight
    );
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
