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

  // Cached color values
  private unexploredRgb: { r: number; g: number; b: number };
  private exploredRgb: { r: number; g: number; b: number };

  // Grid dimensions cache
  private lastGridWidth: number = 0;
  private lastGridHeight: number = 0;

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
    cameraPosition: Vector,
    cameraZoom: number,
    viewportWidth: number,
    viewportHeight: number
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

    // Write one pixel per grid cell
    for (let gy = 0; gy < dims.height; gy++) {
      const row = cells[gy];
      for (let gx = 0; gx < dims.width; gx++) {
        const state = row?.[gx] ?? "unexplored";
        const idx = (gy * dims.width + gx) * 4;

        if (state === "visible") {
          // Fully transparent
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        } else if (state === "explored") {
          // Semi-transparent explored fog
          data[idx] = this.exploredRgb.r;
          data[idx + 1] = this.exploredRgb.g;
          data[idx + 2] = this.exploredRgb.b;
          data[idx + 3] = exploredAlpha;
        } else {
          // Fully opaque unexplored fog
          data[idx] = this.unexploredRgb.r;
          data[idx + 1] = this.unexploredRgb.g;
          data[idx + 2] = this.unexploredRgb.b;
          data[idx + 3] = unexploredAlpha;
        }
      }
    }

    // Put ImageData to offscreen canvas
    this.fogCtx.putImageData(this.imageData, 0, 0);

    // Draw fog canvas scaled to world space
    // The fog canvas is 1 pixel per cell, so we need to scale by cellSize
    ctx.save();

    // Enable image smoothing for soft fog edges when scaled up
    ctx.imageSmoothingEnabled = this.config.smoothEdges;
    ctx.imageSmoothingQuality = "high";

    // Apply blur filter for smoother fog edges (blur amount scales with cell size)
    if (this.config.smoothEdges) {
      const blurAmount = Math.max(dims.cellSize / 3, 2);
      ctx.filter = `blur(${blurAmount}px)`;
    }

    // Draw the fog texture, scaling from grid coords to world coords
    // Each pixel in fogCanvas represents one cell, so:
    // - fogCanvas pixel (0,0) = world position (-offset.x, -offset.y)
    // - fogCanvas size = (dims.width, dims.height)
    // - world size = (dims.width * cellSize, dims.height * cellSize)
    ctx.drawImage(
      this.fogCanvas,
      -offset.x,
      -offset.y,
      dims.width * dims.cellSize,
      dims.height * dims.cellSize
    );

    ctx.restore();
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
