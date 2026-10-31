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
import { Resolution } from "@/core/canvas";

/**
 * The GPU layer's pixels per canvas pixel: one per CSS pixel. The ground's
 * pixels are bigger than that and the effects are soft glows, so a retina
 * screen's extra pixels would cost 4x for nothing. (Both passes share the
 * WebGL canvas: they must use the same size, or it's reallocated twice a frame.)
 */
function gpuResolution(): number {
  return 1 / Resolution.pixelRatio;
}

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

  /**
   * Size the WebGL canvas for a pass at `resolution` (1 = one pixel per
   * canvas pixel, 1 / pixelRatio = one per CSS pixel) and give its view.
   */
  private prepare(ctx: CanvasRenderingContext2D, resolution: number): GPUView {
    const full = viewFromContext(ctx, performance.now());
    const width = Math.max(1, Math.round(full.width * resolution));
    const height = Math.max(1, Math.round(full.height * resolution));
    const view = { ...full, width, height, worldPerPixel: (full.worldPerPixel * full.width) / width };
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, width, height);
    return view;
  }

  /** Stretch the WebGL canvas over the whole 2D one */
  private composite(ctx: CanvasRenderingContext2D, smooth: boolean): void {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = smooth;
    ctx.drawImage(this.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  /**
   * Draw the ground over the whole canvas. `ctx` has the world transform
   * applied. False if the GPU can't, so the caller draws its fallback.
   */
  drawGround(ctx: CanvasRenderingContext2D): boolean {
    if (!this.available || !this.ground) return false;
    const view = this.prepare(ctx, gpuResolution());
    this.ground.draw(view);
    this.composite(ctx, false);
    return true;
  }

  /**
   * Draw a layer of effects over what the 2D canvas has so far, and empty
   * it. `ctx` has the world transform applied.
   */
  drawFX(ctx: CanvasRenderingContext2D, layer: "ground" | "top"): void {
    const batch = layer === "ground" ? this.groundFx : this.topFx;
    if (batch.count > 0 && this.available && this.fx) {
      const view = this.prepare(ctx, gpuResolution());
      this.fx.draw(batch, view);
      this.composite(ctx, false);
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
