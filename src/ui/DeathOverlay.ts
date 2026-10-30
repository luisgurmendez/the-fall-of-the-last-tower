/**
 * DeathOverlay - While the local champion is dead: a dimmed screen, a
 * respawn countdown, and a recap of what killed it (damage over its last
 * 10 seconds, by source).
 */

import { ScreenEntity } from '@/core/GameObject';
import { Dimensions } from '@/core/canvas';
import RenderElement from '@/render/renderElement';
import type { DeathRecap, OnlineStateManager } from '@/core/OnlineStateManager';

/** Sources listed in the recap */
const RECAP_LINES = 4;
const DAMAGE_TYPE_COLORS: Record<string, string> = {
  physical: '#e67e22',
  magic: '#5dade2',
  true: '#ecf0f1',
  pure: '#ecf0f1',
};

export class DeathOverlay extends ScreenEntity {
  private stateManager: OnlineStateManager;
  /** The recap taken when the champion died, until it respawns */
  private recap: DeathRecap | null = null;

  constructor(stateManager: OnlineStateManager) {
    super();
    this.stateManager = stateManager;
  }

  override render(): RenderElement {
    return this.createOverlayRender((gctx) => {
      const respawnIn = this.stateManager.getLocalRespawnIn();
      if (respawnIn === null) {
        this.recap = null;
        return;
      }
      this.recap ??= this.stateManager.getDeathRecap();

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
      this.renderRecap(ctx, w / 2, h * 0.32 + 72);
      ctx.restore();
    });
  }

  /**
   * "Slain by X", then each source's damage, split by damage type.
   */
  private renderRecap(ctx: CanvasRenderingContext2D, centerX: number, top: number): void {
    const recap = this.recap;
    if (!recap || recap.lines.length === 0) return;

    ctx.textAlign = 'center';
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#e74c3c';
    ctx.fillText(recap.killer && recap.killer !== 'Unknown' ? `Slain by ${recap.killer}` : 'You were slain', centerX, top);

    ctx.font = '15px monospace';
    recap.lines.slice(0, RECAP_LINES).forEach((line, index) => {
      // "Vile  412  (300 physical, 112 magic)", the types in their colors
      const pieces = [{ text: `${line.source}  ${Math.round(line.total)}  (`, color: '#d5d8dc' }];
      Object.entries(line.byType).forEach(([type, amount], typeIndex) => {
        if (typeIndex > 0) pieces.push({ text: ', ', color: '#aab7b8' });
        pieces.push({ text: `${Math.round(amount ?? 0)} ${type}`, color: DAMAGE_TYPE_COLORS[type] ?? '#ecf0f1' });
      });
      pieces.push({ text: ')', color: '#d5d8dc' });

      const width = pieces.reduce((total, piece) => total + ctx.measureText(piece.text).width, 0);
      let x = centerX - width / 2;
      const y = top + 28 + index * 22;
      ctx.textAlign = 'left';
      for (const piece of pieces) {
        ctx.fillStyle = piece.color;
        ctx.fillText(piece.text, x, y);
        x += ctx.measureText(piece.text).width;
      }
    });
  }
}
