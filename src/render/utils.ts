import { Circle, Rectangle } from "../objects/shapes";
import Vector from "../physics/vector";

class RenderUtils {

  static renderCircle(
    canvasRenderingContext: CanvasRenderingContext2D,
    position: Vector,
    circle: Circle,
  ) {
    canvasRenderingContext.beginPath();
    canvasRenderingContext.arc(position.x, position.y, circle.radius, 0, 2 * Math.PI);
    canvasRenderingContext.stroke();
  }

  static renderRectangle(
    canvasRenderingContext: CanvasRenderingContext2D,
    position: Vector,
    rectangle: Rectangle,

  ) {
    canvasRenderingContext.beginPath();
    canvasRenderingContext.rect(position.x - rectangle.w / 2, position.y - rectangle.h / 2, rectangle.w, rectangle.h);
    canvasRenderingContext.stroke();
  }

  static renderText(canvasRenderingContext: CanvasRenderingContext2D, text: string, position: Vector) {
    const textWidth = canvasRenderingContext.measureText(text).width;
    const textHeight = canvasRenderingContext.measureText('M').width;
    canvasRenderingContext.fillText(text, position.x - textWidth / 2, position.y + textHeight);
  }

  static generatePixelArt(colors: string, pixelArt: string, size: number = 16) {

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const canvasRenderingContext = canvas.getContext('2d');


    if (canvasRenderingContext !== null) {
      const points: number[] = [];
      pixelArt.replace(/./g, a => {
        const charCode = a.charCodeAt(0)
        points.push(charCode & 7);
        points.push((charCode >> 3) & 7);
        return '';
      })
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          if (points[j * size + i]) {
            canvasRenderingContext.fillStyle = "#" + colors.substr(3 * (points[j * size + i] - 1), 3);
            canvasRenderingContext.fillRect(i, j, 1, 1);
          }
        }
      }
    }
    return canvas;
  }

  static rotateSelf(canvasRenderingContext: CanvasRenderingContext2D, position: Vector, angle: number) {
    canvasRenderingContext.translate(position.x, position.y);
    canvasRenderingContext.rotate(angle)
    canvasRenderingContext.translate(-position.x, -position.y);
  }

}

export default RenderUtils;