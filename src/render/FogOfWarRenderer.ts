/**
 * FogOfWarRenderer - Renders the fog of war overlay.
 *
 * Uses ImageData at grid resolution, then scales up. This is O(grid_cells)
 * instead of O(viewport_pixels), making it efficient for any cell size.
 *
 * Visibility states:
 * - Unexplored: Black (fully opaque)
 * - Explored: Dark (semi-transparent)
 * - Visible: Clear (no fog)
 */

import { FogOfWar } from "@/core/FogOfWar";
import { TeamId } from "@/core/Team";
import Vector from "@/physics/vector";
import { ProfileCritical } from "@/debug/PerformanceProfiler";
import { Resolution } from "@/core/canvas";

/**
 * Configuration for fog rendering.
 */
export interface FogRenderConfig {
  /** Opacity for unexplored areas (0-1) */
  unexploredOpacity: number;
  /** Opacity for explored but not visible areas (0-1) */
  exploredOpacity: number;
  /** Fog color for unexplored areas */
  unexploredColor: string;
  /** Fog color for explored areas (darker = more dimmed terrain) */
  exploredColor: string;
  /** Whether to use smooth edges */
  smoothEdges: boolean;
  /** Whether to apply desaturation to explored areas */
  desaturateExplored: boolean;
}

/**
 * Default fog rendering configuration.
 */
export const DEFAULT_FOG_RENDER_CONFIG: FogRenderConfig = {
  unexploredOpacity: 1.0,
  exploredOpacity: 0.5,
  unexploredColor: "#000000",
  exploredColor: "#101020",
  smoothEdges: true,
  desaturateExplored: true,
};

/**
 * Fog pixels per CSS pixel on screen: it's soft, so it's blurred at half
 * the screen's resolution and stretched over it (blurring at a retina
 * screen's full resolution would cost several times more)
 */
const FOG_SCREEN_RESOLUTION = 0.5;

/** Seconds for fog to clear from a cell coming into sight */
const FOG_REVEAL_SECONDS = 0.12;
/** Seconds for fog to cover a cell going out of sight */
const FOG_COVER_SECONDS = 0.3;

/**
 * Parse hex color to RGB values.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Renders fog of war for a team using efficient ImageData rendering.
 */
export class FogOfWarRenderer {
  private config: FogRenderConfig;

  // Offscreen canvas for fog (at grid resolution)
  private fogCanvas: HTMLCanvasElement | null = null;
  private fogCtx: CanvasRenderingContext2D | null = null;
  private imageData: ImageData | null = null;

  // Screen-space canvas the fog is blurred into before covering the screen
  private screenCanvas: HTMLCanvasElement | null = null;
  private screenCtx: CanvasRenderingContext2D | null = null;

  // Cached color values
  private unexploredRgb: { r: number; g: number; b: number };
  private exploredRgb: { r: number; g: number; b: number };

  // Grid dimensions cache
  private lastGridWidth: number = 0;
  private lastGridHeight: number = 0;

  // Fog opacity drawn per cell (0-255). It eases toward the cell's state, so a
  // cell at the edge of sight that flips state frame to frame (sight lines
  // grazing a wall corner) doesn't blink.
  private cellAlphas: Float32Array | null = null;
  private lastRenderTime = 0;

  constructor(config: Partial<FogRenderConfig> = {}) {
    this.config = { ...DEFAULT_FOG_RENDER_CONFIG, ...config };
    this.unexploredRgb = hexToRgb(this.config.unexploredColor);
    this.exploredRgb = hexToRgb(this.config.exploredColor);
  }

  /**
   * Render fog of war overlay.
   *
   * Optimized approach:
   * 1. Create ImageData at grid resolution (e.g., 400x400 cells)
   * 2. Write fog state for each cell (one pixel per cell)
   * 3. Draw scaled to world space with imageSmoothingEnabled for soft edges
   */
  @ProfileCritical(5)  // Warn if > 5ms - this is a known bottleneck
  render(
    ctx: CanvasRenderingContext2D,
    fogOfWar: FogOfWar,
    teamId: TeamId,
    _cameraPosition: Vector,
    _cameraZoom: number,
    _viewportWidth: number,
    _viewportHeight: number
  ): void {
    if (!fogOfWar.isEnabled()) return;

    const grid = fogOfWar.getGrid(teamId);
    if (!grid) return;

    const dims = grid.getDimensions();
    const offset = grid.getOffset();
    const cells = grid.getCells();

    // Ensure offscreen canvas matches grid size (1 pixel per cell)
    if (
      !this.fogCanvas ||
      this.lastGridWidth !== dims.width ||
      this.lastGridHeight !== dims.height
    ) {
      this.fogCanvas = document.createElement("canvas");
      this.fogCanvas.width = dims.width;
      this.fogCanvas.height = dims.height;
      this.fogCtx = this.fogCanvas.getContext("2d", { willReadFrequently: true });
      this.imageData = null;
      this.cellAlphas = null;
      this.lastGridWidth = dims.width;
      this.lastGridHeight = dims.height;
    }

    if (!this.fogCtx) return;

    // Create or reuse ImageData
    if (!this.imageData) {
      this.imageData = this.fogCtx.createImageData(dims.width, dims.height);
    }

    const data = this.imageData.data;

    // Pre-calculate alpha values
    const unexploredAlpha = Math.floor(this.config.unexploredOpacity * 255);
    const exploredAlpha = Math.floor(this.config.exploredOpacity * 255);

    const now = performance.now();
    const dt = this.lastRenderTime === 0 ? 0 : Math.min((now - this.lastRenderTime) / 1000, 0.1);
    this.lastRenderTime = now;
    const firstFrame = !this.cellAlphas;
    const alphas = (this.cellAlphas ??= new Float32Array(dims.width * dims.height));
    const revealStep = 255 * dt / FOG_REVEAL_SECONDS;
    const coverStep = 255 * dt / FOG_COVER_SECONDS;

    // Write one pixel per grid cell
    for (let gy = 0; gy < dims.height; gy++) {
      const row = cells[gy];
      for (let gx = 0; gx < dims.width; gx++) {
        const state = row?.[gx] ?? "unexplored";
        const cell = gy * dims.width + gx;
        const idx = cell * 4;
        const target = state === "visible" ? 0 : state === "explored" ? exploredAlpha : unexploredAlpha;

        const alpha = alphas[cell];
        alphas[cell] = firstFrame ? target
          : alpha > target ? Math.max(target, alpha - revealStep)
          : Math.min(target, alpha + coverStep);

        // Explored color while fading in or out of sight, black where never seen
        const rgb = state === "unexplored" ? this.unexploredRgb : this.exploredRgb;
        data[idx] = rgb.r;
        data[idx + 1] = rgb.g;
        data[idx + 2] = rgb.b;
        data[idx + 3] = alphas[cell];
      }
    }

    // Put ImageData to offscreen canvas
    this.fogCtx.putImageData(this.imageData, 0, 0);

    // Draw the fog into the screen-space canvas, with ctx's world transform
    // scaled down to its resolution
    const screen = this.getScreenContext(ctx);
    const scale = screen.canvas.width / ctx.canvas.width;
    const m = ctx.getTransform();
    screen.setTransform(1, 0, 0, 1, 0, 0);
    screen.clearRect(0, 0, screen.canvas.width, screen.canvas.height);
    screen.setTransform(m.a * scale, m.b * scale, m.c * scale, m.d * scale, m.e * scale, m.f * scale);

    // Enable image smoothing for soft fog edges when scaled up
    screen.imageSmoothingEnabled = this.config.smoothEdges;
    screen.imageSmoothingQuality = "high";

    // Apply blur filter for smoother fog edges (blur amount scales with cell
    // size; it's in CSS pixels, and the filter counts this canvas's pixels)
    if (this.config.smoothEdges) {
      const blurAmount = Math.max(dims.cellSize / 3, 2);
      screen.filter = `blur(${blurAmount * FOG_SCREEN_RESOLUTION}px)`;
    }

    // Draw the fog texture, scaling from grid coords to world coords
    // Each pixel in fogCanvas represents one cell, so:
    // - fogCanvas pixel (0,0) = world position (-offset.x, -offset.y)
    // - fogCanvas size = (dims.width, dims.height)
    // - world size = (dims.width * cellSize, dims.height * cellSize)
    screen.drawImage(
      this.fogCanvas,
      -offset.x,
      -offset.y,
      dims.width * dims.cellSize,
      dims.height * dims.cellSize
    );
    screen.filter = "none";

    // Stretch it over the screen
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(screen.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  /** The screen-space fog canvas, sized for ctx's canvas at FOG_SCREEN_RESOLUTION */
  private getScreenContext(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
    const scale = FOG_SCREEN_RESOLUTION / Resolution.pixelRatio;
    const width = Math.max(1, Math.round(ctx.canvas.width * scale));
    const height = Math.max(1, Math.round(ctx.canvas.height * scale));
    if (!this.screenCanvas || !this.screenCtx) {
      this.screenCanvas = document.createElement("canvas");
      this.screenCtx = this.screenCanvas.getContext("2d")!;
    }
    if (this.screenCanvas.width !== width || this.screenCanvas.height !== height) {
      this.screenCanvas.width = width;
      this.screenCanvas.height = height;
    }
    return this.screenCtx;
  }

  /**
   * Update render configuration.
   */
  setConfig(config: Partial<FogRenderConfig>): void {
    this.config = { ...this.config, ...config };
    this.unexploredRgb = hexToRgb(this.config.unexploredColor);
    this.exploredRgb = hexToRgb(this.config.exploredColor);
  }
}

export default FogOfWarRenderer;
