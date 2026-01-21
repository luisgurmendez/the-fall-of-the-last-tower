/**
 * GameStatsHUD - Displays game time, FPS, and ping in the top right corner.
 */

import { ScreenEntity } from '@/core/GameObject';
import { Dimensions } from '@/core/canvas';
import RenderElement from '@/render/renderElement';
import RenderUtils from '@/render/utils';
import GameContext from '@/core/gameContext';

/** Stats display colors */
const STATS_COLORS = {
  background: 'rgba(26, 26, 46, 0.8)',
  border: '#3a3a5c',
  text: '#ffffff',
  textDim: '#aaaaaa',
  fpsGood: '#2ecc71',
  fpsOk: '#f39c12',
  fpsBad: '#e74c3c',
  pingGood: '#2ecc71',
  pingOk: '#f39c12',
  pingBad: '#e74c3c',
};

/** Configuration for GameStatsHUD */
export interface GameStatsHUDConfig {
  /** Optional function to get current latency in ms (for online mode) */
  getLatency?: () => number;
}

export class GameStatsHUD extends ScreenEntity {
  private elapsedTime = 0;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fps = 0;
  private fpsUpdateInterval = 0.5; // Update FPS every 0.5 seconds
  private fpsAccumulator = 0;
  private getLatency?: () => number;

  constructor(config?: GameStatsHUDConfig) {
    super();
    this.lastFrameTime = performance.now();
    this.getLatency = config?.getLatency;
  }

  override step(context: GameContext): void {
    // Accumulate elapsed time
    this.elapsedTime += context.dt;

    // Calculate FPS using performance.now() for accuracy
    const now = performance.now();
    const frameDelta = (now - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = now;

    this.frameCount++;
    this.fpsAccumulator += frameDelta;

    // Update FPS display every fpsUpdateInterval seconds
    if (this.fpsAccumulator >= this.fpsUpdateInterval) {
      this.fps = Math.round(this.frameCount / this.fpsAccumulator);
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }
  }

  /** Get current FPS value */
  private getCurrentFps(): number {
    return this.fps;
  }

  /** Format time as MM:SS */
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /** Get FPS color based on value */
  private getFpsColor(fps: number): string {
    if (fps >= 55) return STATS_COLORS.fpsGood;
    if (fps >= 30) return STATS_COLORS.fpsOk;
    return STATS_COLORS.fpsBad;
  }

  /** Get ping color based on latency value */
  private getPingColor(ping: number): string {
    if (ping <= 50) return STATS_COLORS.pingGood;
    if (ping <= 100) return STATS_COLORS.pingOk;
    return STATS_COLORS.pingBad;
  }

  override render(): RenderElement {
    return this.createOverlayRender((gctx) => {
      const ctx = gctx.canvasRenderingContext;

      // Check if we have ping to display (online mode)
      const hasPing = this.getLatency !== undefined;

      // Panel dimensions - wider if showing ping
      const panelWidth = hasPing ? 160 : 100;
      const panelHeight = 50;
      const padding = 8;
      const margin = 10;

      // Position in top right corner
      const x = Dimensions.w - panelWidth - margin;
      const y = margin;

      // Draw background
      ctx.fillStyle = STATS_COLORS.background;
      ctx.fillRect(x, y, panelWidth, panelHeight);

      // Draw border
      ctx.strokeStyle = STATS_COLORS.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, panelWidth, panelHeight);

      // Draw time
      const timeStr = this.formatTime(this.elapsedTime);
      RenderUtils.renderBitmapText(
        ctx,
        timeStr,
        x + padding,
        y + padding,
        { color: STATS_COLORS.text, size: 22, shadow: false }
      );

      // Draw FPS
      const fps = this.getCurrentFps();
      const fpsColor = this.getFpsColor(fps);
      RenderUtils.renderBitmapText(
        ctx,
        `${fps} FPS`,
        x + padding,
        y + padding + 20,
        { color: fpsColor, size: 22, shadow: false }
      );

      // Draw ping if available (online mode)
      if (hasPing) {
        const ping = this.getLatency!();
        const pingColor = this.getPingColor(ping);
        RenderUtils.renderBitmapText(
          ctx,
          `${ping}ms`,
          x + padding + 70,
          y + padding + 20,
          { color: pingColor, size: 22, shadow: false }
        );
      }
    });
  }
}

export default GameStatsHUD;
