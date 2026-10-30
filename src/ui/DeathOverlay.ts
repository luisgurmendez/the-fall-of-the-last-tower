/**
 * DeathOverlay - While the local champion is dead: a dimmed screen and a
 * respawn countdown.
 */

import { ScreenEntity } from '@/core/GameObject';
import { Dimensions } from '@/core/canvas';
import RenderElement from '@/render/renderElement';
import type { OnlineStateManager } from '@/core/OnlineStateManager';

export class DeathOverlay extends ScreenEntity {
  private stateManager: OnlineStateManager;

  constructor(stateManager: OnlineStateManager) {
    super();
    this.stateManager = stateManager;
  }

  override render(): RenderElement {
    return this.createOverlayRender((gctx) => {
      const respawnIn = this.stateManager.getLocalRespawnIn();
      if (respawnIn === null) return;

      const ctx = gctx.canvasRenderingContext;
      const { w, h } = Dimensions;

      ctx.save();
      ctx.fillStyle = 'rgba(20, 20, 30, 0.45)';
      ctx.fillRect(0, 0, w, h);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 26px monospace';
      ctx.fillStyle = '#d5d8dc';
      ctx.fillText('You are dead', w / 2, h * 0.32);
      ctx.font = '18px monospace';
      ctx.fillStyle = '#aab7b8';
      ctx.fillText(`Respawning in ${Math.ceil(respawnIn)}s`, w / 2, h * 0.32 + 32);
      ctx.restore();
    });
  }
}
