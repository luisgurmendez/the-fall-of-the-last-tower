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
 * Effects come in two layers, each an FXBatch filled during the frame and
 * drawn with bloom (./fx/FXPass.ts): `groundFx` under the units (magic
 * circles, scorch marks, zones) and `topFx` over them (everything else).
 *
 * Without WebGL2 (or after the GPU context is lost) getGPURenderer() gives
 * null and the 2D fallbacks draw instead.
 */

import { GroundPass } from "./ground/GroundPass";
import { FXBatch } from "./fx/FXBatch";
import { FXPass } from "./fx/FXPass";
import { viewFromContext, type GPUView } from "./view";

export class GPURenderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  /** Effects under the units, drawn and emptied by drawFX(ctx, "ground") */
  readonly groundFx = new FXBatch();
  /** Effects over the units, drawn and emptied by drawFX(ctx, "top") */
  readonly topFx = new FXBatch();
  private ground: GroundPass | null = null;
  private fx: FXPass | null = null;
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
      renderer.fx = new FXPass(gl, !!gl.getExtension("EXT_color_buffer_float"));
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

  /**
   * Draw a layer of effects over what the 2D canvas has so far, and empty
   * it. `ctx` has the world transform applied.
   */
  drawFX(ctx: CanvasRenderingContext2D, layer: "ground" | "top"): void {
    const batch = layer === "ground" ? this.groundFx : this.topFx;
    if (batch.count > 0 && this.available && this.fx) {
      const view = this.prepare(ctx);
      this.fx.draw(batch, view);
      this.composite(ctx);
    }
    batch.clear();
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
