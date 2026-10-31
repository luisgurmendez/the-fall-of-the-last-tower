/**
 * GPURenderer - the WebGL2 layer under and over the 2D canvas.
 *
 * The game draws with Canvas 2D; the parts that need a GPU (the animated
 * ground, effects with glow) are rendered here into an offscreen WebGL2
 * canvas the size of the screen, which is then drawn into the 2D canvas
 * where it belongs in the draw order. The WebGL canvas is premultiplied:
 * a pixel with color and no alpha adds light to what's under it (glows),
 * one with alpha covers it (smoke).
 *
 * Without WebGL2 (or after the GPU context is lost) getGPURenderer() gives
 * null and the 2D fallbacks draw instead.
 */

import { GroundPass } from "./ground/GroundPass";
import { viewFromContext, type GPUView } from "./view";

export class GPURenderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  private ground: GroundPass | null = null;
  private lost = false;

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.lost = true;
    });
  }

  static create(): GPURenderer | null {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      });
      if (!gl) return null;
      const renderer = new GPURenderer(canvas, gl);
      renderer.ground = new GroundPass(gl);
      return renderer;
    } catch (error) {
      console.warn("[GPU] WebGL2 layer unavailable, drawing in 2D:", error);
      return null;
    }
  }

  get available(): boolean {
    return !this.lost && !this.gl.isContextLost();
  }

  private prepare(ctx: CanvasRenderingContext2D): GPUView {
    const view = viewFromContext(ctx, performance.now());
    if (this.canvas.width !== view.width || this.canvas.height !== view.height) {
      this.canvas.width = view.width;
      this.canvas.height = view.height;
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, view.width, view.height);
    return view;
  }

  /** Copy the WebGL canvas onto the 2D one, pixel for pixel */
  private composite(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, 0, 0);
    ctx.restore();
  }

  /**
   * Draw the ground over the whole canvas. `ctx` has the world transform
   * applied. False if the GPU can't, so the caller draws its fallback.
   */
  drawGround(ctx: CanvasRenderingContext2D): boolean {
    if (!this.available || !this.ground) return false;
    const view = this.prepare(ctx);
    this.ground.draw(view);
    this.composite(ctx);
    return true;
  }
}

let instance: GPURenderer | null | undefined;

/**
 * The GPU layer, created on first use; null where WebGL2 isn't available.
 */
export function getGPURenderer(): GPURenderer | null {
  if (instance === undefined) instance = GPURenderer.create();
  return instance && instance.available ? instance : null;
}
