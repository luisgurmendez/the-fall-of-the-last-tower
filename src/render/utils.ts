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

  static generatePixelArt(canvasRenderingContext: CanvasRenderingContext2D, colors: string, pixelArt: string, size = 16) {
    const canvas = document.createElement("canvas");
    // canvas.width = size;
    // canvas.height = size;
    // const canvasRenderingContext = canvas.getContext("2d");

    if (canvasRenderingContext !== null) {
      const points: number[] = [];
      pixelArt.replace(/./g, (a) => {
        const charCode = a.charCodeAt(0);
        points.push(charCode & 7);
        points.push((charCode >> 3) & 7);
        return "";
      });
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          if (points[j * size + i]) {
            canvasRenderingContext.fillStyle =
              "#" + colors.substr(3 * (points[j * size + i] - 1), 3);
            canvasRenderingContext.fillRect(i, j, 1, 1);
          }
        }
      }
    }
    return canvas;
  }

  static drawPixelArt(canvasRenderingContext: CanvasRenderingContext2D, colors: string, pixelArt: string, size = 16,) {
    // Create ImageData
    // const imageData = canvasRenderingContext.createImageData(size, size);
    // const data = imageData.data;

    // const points: number[] = [];
    // pixelArt.replace(/./g, (a) => {
    //   const charCode = a.charCodeAt(0);
    //   points.push(charCode & 7);
    //   points.push((charCode >> 3) & 7);
    //   return "";
    // });

    // for (let j = 0; j < size; j++) {
    //   for (let i = 0; i < size; i++) {
    //     const point = points[j * size + i];
    //     if (point) {
    //       const color = colors.substr(3 * (point - 1), 3);
    //       const red = parseInt(color.substr(0, 1), 16);
    //       const green = parseInt(color.substr(1, 1), 16);
    //       const blue = parseInt(color.substr(2, 1), 16);
    //       const index = 4 * (j * size + i);
    //       data[index] = red;
    //       data[index + 1] = green;
    //       data[index + 2] = blue;
    //       data[index + 3] = 255; // Alpha channel
    //     }
    //   }
    // }

    // Precompute colorMap for quick look-up
    const colorMap: any = {};
    for (let i = 0; i < colors.length / 3; i++) {
      const colorHex = colors.substr(i * 3, 3);
      const red = parseInt(colorHex.substr(0, 1), 16) * 17;  // Scale 0-F to 0-255
      const green = parseInt(colorHex.substr(1, 1), 16) * 17;
      const blue = parseInt(colorHex.substr(2, 1), 16) * 17;
      const fullHex = `${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
      colorMap[String.fromCharCode(i + 65)] = "#" + fullHex;  // ASCII A=65, B=66, ...
    }

    // Batch drawing commands by color to minimize fillStyle changes
    const batches: any = {};

    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const point = pixelArt[j * size + i];

        if (point !== '@') {  // If it's not a transparency marker
          const color = colorMap[point];
          if (color) {
            if (!batches[color]) batches[color] = [];
            batches[color].push([i, j, 1, 1]);
          }
        }
      }
    }

    // Execute drawing commands
    for (const [color, rects] of Object.entries(batches)) {
      canvasRenderingContext.fillStyle = color;
      for (const [x, y, w, h] of rects as any) {
        canvasRenderingContext.fillRect(x, y, w, h);
      }
    }

    // canvasRenderingContext.putImageData(imageData, 0, 0);

    // Update canvas
    // canvasRenderingContext.putImageData(imageData, position.x, position.y);
  };

  static rotateSelf(
    canvasRenderingContext: CanvasRenderingContext2D,
    position: Vector,
    angle: number
  ) {
    canvasRenderingContext.translate(position.x, position.y);
    canvasRenderingContext.rotate(angle);
    canvasRenderingContext.translate(-position.x, -position.y);
  }

  // static renderSprite(asset:string, position: Vector, index: number, singleSpriteDimsension: number){

  // }
}

export default RenderUtils;
