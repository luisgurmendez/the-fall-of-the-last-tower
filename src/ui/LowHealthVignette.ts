/**
 * LowHealthVignette - Red edges on the screen while the local champion is
 * low on health, pulsing faster the lower it gets, and a heartbeat getting
 * louder.
 */

import { ScreenEntity } from '@/core/GameObject';
import { Dimensions } from '@/core/canvas';
import RenderElement from '@/render/renderElement';
import type { OnlineStateManager } from '@/core/OnlineStateManager';
import { getAudio } from '@/audio/AudioManager';

/** Health ratio below which the vignette shows */
const THRESHOLD = 0.3;

export class LowHealthVignette extends ScreenEntity {
  private stateManager: OnlineStateManager;

  constructor(stateManager: OnlineStateManager) {
    super();
    this.stateManager = stateManager;
  }

  override render(): RenderElement {
    return this.createOverlayRender((gctx) => {
      const snapshot = this.stateManager.getLocalPlayerEntity()?.snapshot as
        | { health?: number; maxHealth?: number; isDead?: boolean }
        | undefined;
      // Over once the match is
      const ratio = snapshot?.maxHealth && !snapshot.isDead && snapshot.health !== undefined && !this.stateManager.getMatchResult()
        ? snapshot.health / snapshot.maxHealth
        : 1;
      // 0 at the threshold, 1 at zero health
      const severity = ratio < THRESHOLD ? 1 - ratio / THRESHOLD : 0;
      getAudio().setLoopLevel('low_health', severity > 0 ? 0.4 + 0.6 * severity : 0);
      if (severity <= 0) return;

      const pulse = 0.5 + 0.5 * Math.sin((performance.now() / 1000) * (3 + severity * 5));
      const alpha = 0.18 + severity * 0.25 + pulse * 0.1;

      const ctx = gctx.canvasRenderingContext;
      const { w, h } = Dimensions;
      const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
      gradient.addColorStop(0, 'rgba(180, 0, 0, 0)');
      gradient.addColorStop(1, `rgba(180, 0, 0, ${alpha})`);

      ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    });
  }
}
