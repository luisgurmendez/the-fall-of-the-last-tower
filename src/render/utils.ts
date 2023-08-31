import { Circle, Rectangle } from "../objects/shapes";
import Vector from "../physics/vector";

class RenderUtils {
  static renderCircle(
    canvasRenderingContext: CanvasRenderingContext2D,
    position: Vector,
    circle: Circle
  ) {
    canvasRenderingContext.beginPath();
    canvasRenderingContext.arc(
      position.x,
      position.y,
      circle.radius,
      0,
      2 * Math.PI
    );
    canvasRenderingContext.stroke();
  }

  static renderRectangle(
    canvasRenderingContext: CanvasRenderingContext2D,
    position: Vector,
    rectangle: Rectangle
  ) {
    canvasRenderingContext.beginPath();
    canvasRenderingContext.rect(
      position.x - rectangle.w / 2,
      position.y - rectangle.h / 2,
      rectangle.w,
      rectangle.h
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
