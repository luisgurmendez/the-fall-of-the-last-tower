/**
 * What part of the world the canvas shows, as the GPU passes need it. It's
 * read from the 2D context's transform, so it always matches what the 2D
 * renderers draw (camera, zoom and screen shake included).
 */

export interface GPUView {
  /** World point at the canvas's top-left corner */
  originX: number;
  originY: number;
  /** World units per canvas pixel */
  worldPerPixel: number;
  /** Canvas size in pixels */
  width: number;
  height: number;
  /** Seconds, wrapped every hour so shader math keeps its precision */
  time: number;
}

/**
 * The view of a 2D context whose transform maps world units to canvas
 * pixels (scale and translation only).
 */
export function viewFromContext(ctx: CanvasRenderingContext2D, timeMs: number): GPUView {
  const m = ctx.getTransform();
  return {
    originX: -m.e / m.a,
    originY: -m.f / m.d,
    worldPerPixel: 1 / m.a,
    width: ctx.canvas.width,
    height: ctx.canvas.height,
    time: (timeMs / 1000) % 3600,
  };
}
