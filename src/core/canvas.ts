import { Rectangle } from "@/objects/shapes";

export const Dimensions = new Rectangle(
  document.body.scrollWidth,
  document.body.scrollHeight
);

export interface CanvasResult {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}

// TODO(lg): opt is this really needed?
class CanvasGenerator {
  static generateCanvas(): CanvasResult {
    let canvasRenderingContext: CanvasRenderingContext2D;
    const canvas = document.createElement("canvas");
    const containerEl = document.getElementById("c");
    if (containerEl) {
      const onContainerResize = () => {
        canvas.width = document.body.scrollWidth;
        canvas.height = document.body.scrollHeight;
        canvasRenderingContext.imageSmoothingEnabled = false;
        canvasRenderingContext.translate(0.5, 0.5);
        Dimensions.w = canvas.width;
        Dimensions.h = canvas.height;
      };

      const possibleNullCanvasContext = canvas.getContext("2d");

      if (possibleNullCanvasContext === undefined) {
        throw ""; //Error('Browser doesnt support canvas!');
      }

      canvasRenderingContext = possibleNullCanvasContext!;
      onContainerResize();
      containerEl.appendChild(canvas);
      window.addEventListener("resize", onContainerResize);
    } else {
      throw ""; //Error('No canvas container');
    }

    return { canvas, context: canvasRenderingContext };
  }
}

export default CanvasGenerator;
