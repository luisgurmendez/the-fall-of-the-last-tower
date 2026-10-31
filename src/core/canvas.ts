import { Rectangle } from "@/objects/shapes";

/** The screen's size in CSS pixels: everything is laid out and drawn in these */
export const Dimensions = new Rectangle(window.innerWidth, window.innerHeight);

/**
 * The canvas is backed at the screen's own resolution (2 canvas pixels per
 * CSS pixel on a retina screen, so art and text keep their detail), with a
 * base transform that maps CSS pixels onto it. Read canvas.width/height only
 * for the backing store; layout uses Dimensions.
 */
export const Resolution = { pixelRatio: 1 };

/** Past this, the extra pixels cost more than they show */
const MAX_PIXEL_RATIO = 2;

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
        // The viewport, not the page: the page's scroll size includes the
        // canvas itself, so it grew a little on every resize and pushed the
        // bottom of the HUD off screen
        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        Resolution.pixelRatio = ratio;
        canvas.width = Math.round(window.innerWidth * ratio);
        canvas.height = Math.round(window.innerHeight * ratio);
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        canvasRenderingContext.imageSmoothingEnabled = false;
        canvasRenderingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
        canvasRenderingContext.translate(0.5, 0.5);
        Dimensions.w = window.innerWidth;
        Dimensions.h = window.innerHeight;
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
