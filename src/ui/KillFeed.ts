/**
 * KillFeed - The latest champion kills in the top right, under the stats
 * panel: the killer's portrait (or what got it: a tower, minions, a
 * monster), a blade, the victim's portrait, on the killer's team color.
 * Each stays 8 seconds, fading out in the last one.
 */

import { EntityType } from '@siege/shared';
import { ScreenEntity } from '@/core/GameObject';
import { Dimensions } from '@/core/canvas';
import RenderElement from '@/render/renderElement';
import type { OnlineStateManager } from '@/core/OnlineStateManager';
import { KILL_FEED_DURATION, type KillRecord } from '@/core/state/killFeed';
import { getPortraitCanvas } from '@/ui/matchmaking/portraits';
import { drawPixelArt } from '@/render/pixelArt';

/** Under the stats panel and the fullscreen button */
const TOP = 100;
const MARGIN = 10;
const ROW_HEIGHT = 30;
const PORTRAIT = 24;
const GAP = 6;
/** Fade out over the last this long (ms) */
const FADE = 1000;

const ALLY = { fill: 'rgba(41, 98, 160, 0.78)', edge: '#5dade2' };
const ENEMY = { fill: 'rgba(150, 40, 40, 0.78)', edge: '#ec7063' };
const NEUTRAL = { fill: 'rgba(40, 40, 50, 0.78)', edge: '#a0a0a8' };

/** What a kill that no champion got is credited to */
const NON_CHAMPION_KILLERS: Partial<Record<EntityType, string>> = {
  [EntityType.TOWER]: 'T',
  [EntityType.MINION]: 'M',
  [EntityType.JUNGLE_CAMP]: 'J',
};

export class KillFeed extends ScreenEntity {
  private stateManager: OnlineStateManager;

  constructor(stateManager: OnlineStateManager) {
    super();
    this.stateManager = stateManager;
  }

  override render(): RenderElement {
    return this.createOverlayRender((gctx) => {
      const kills = this.stateManager.getKillFeed();
      if (kills.length === 0) return;
      const ctx = gctx.canvasRenderingContext;
      const now = Date.now();
      const localSide = this.stateManager.getLocalSide();
      // Newest on top
      [...kills].reverse().forEach((kill, row) => {
        const alpha = Math.min(1, (KILL_FEED_DURATION - (now - kill.time)) / FADE);
        this.drawKill(ctx, kill, TOP + row * (ROW_HEIGHT + 4), localSide, Math.max(0, alpha));
      });
    });
  }

  private drawKill(ctx: CanvasRenderingContext2D, kill: KillRecord, y: number, localSide: number, alpha: number): void {
    const width = PORTRAIT * 2 + GAP * 4 + 14;
    const x = Dimensions.w - MARGIN - width;
    const colors = kill.killerSide === null || kill.killerSide > 1 ? NEUTRAL : kill.killerSide === localSide ? ALLY : ENEMY;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.fill;
    ctx.fillRect(x, y, width, ROW_HEIGHT);
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, ROW_HEIGHT - 1);

    const portraitY = y + (ROW_HEIGHT - PORTRAIT) / 2;
    const killerX = x + GAP;
    const victimX = x + width - GAP - PORTRAIT;
    if (kill.killerChampionId) {
      this.drawPortrait(ctx, kill.killerChampionId, killerX, portraitY);
    } else {
      this.drawBadge(ctx, (kill.killerType !== null && NON_CHAMPION_KILLERS[kill.killerType]) || '?', killerX, portraitY);
    }

    // A blade between them, pointing at the victim
    const bladeX = killerX + PORTRAIT + GAP;
    const bladeY = y + ROW_HEIGHT / 2;
    ctx.fillStyle = '#e8eef5';
    ctx.fillRect(bladeX, bladeY - 1, 11, 2);
    ctx.fillRect(bladeX + 11, bladeY - 2, 3, 4);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(bladeX + 2, bladeY - 4, 2, 8);

    this.drawPortrait(ctx, kill.victimChampionId, victimX, portraitY);
    // The fallen one is greyed and crossed out
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(victimX, portraitY, PORTRAIT, PORTRAIT);
    ctx.strokeStyle = '#ec7063';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(victimX + 4, portraitY + 4);
    ctx.lineTo(victimX + PORTRAIT - 4, portraitY + PORTRAIT - 4);
    ctx.stroke();
    ctx.restore();
  }

  private drawPortrait(ctx: CanvasRenderingContext2D, championId: string, x: number, y: number): void {
    const portrait = getPortraitCanvas(championId);
    if (portrait) {
      drawPixelArt(ctx, portrait, x, y, PORTRAIT, PORTRAIT);
    } else {
      this.drawBadge(ctx, championId.charAt(0).toUpperCase() || '?', x, y);
    }
  }

  private drawBadge(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): void {
    ctx.fillStyle = 'rgba(20, 20, 28, 0.9)';
    ctx.fillRect(x, y, PORTRAIT, PORTRAIT);
    ctx.fillStyle = '#d5d8dc';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + PORTRAIT / 2, y + PORTRAIT / 2 + 1);
  }
}
