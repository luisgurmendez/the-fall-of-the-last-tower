/**
 * AnnouncementBanner - Big moments (dragon slain, ...) shown in the middle
 * of the top of the screen for a few seconds.
 */

import { ScreenEntity } from '@/core/GameObject';
import { Dimensions } from '@/core/canvas';
import RenderElement from '@/render/renderElement';
import type { OnlineStateManager } from '@/core/OnlineStateManager';

/** Fade in/out time in ms */
const FADE = 300;

export class AnnouncementBanner extends ScreenEntity {
  private stateManager: OnlineStateManager;

  constructor(stateManager: OnlineStateManager) {
    super();
    this.stateManager = stateManager;
  }

  override render(): RenderElement {
    return this.createOverlayRender((gctx) => {
      const announcements = this.stateManager.getAnnouncements();
      const announcement = announcements[announcements.length - 1];
      if (!announcement) return;

      const ctx = gctx.canvasRenderingContext;
      const elapsed = Date.now() - announcement.startTime;
      const remaining = announcement.duration - elapsed;
      const alpha = Math.min(1, elapsed / FADE, remaining / FADE);

      const x = Dimensions.w / 2;
      const y = 90;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = 'bold 22px monospace';
      const width = Math.max(ctx.measureText(announcement.text).width, 360) + 40;
      ctx.fillStyle = 'rgba(15, 15, 30, 0.75)';
      ctx.fillRect(x - width / 2, y - 26, width, announcement.detail ? 58 : 44);
      ctx.strokeStyle = announcement.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - width / 2, y - 26, width, announcement.detail ? 58 : 44);

      ctx.fillStyle = announcement.color;
      ctx.fillText(announcement.text, x, y - 4);

      if (announcement.detail) {
        ctx.font = '12px monospace';
        ctx.fillStyle = '#d5d8dc';
        ctx.fillText(announcement.detail, x, y + 18);
      }
      ctx.restore();
    });
  }
}
