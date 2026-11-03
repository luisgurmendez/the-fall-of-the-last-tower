/**
 * Buff and active effect icons shown in rows above the HUD, right to left.
 * Effect icons carry a radial timer sweep, duration and stack count. Caches
 * the icon positions in the HUDContext for hit testing.
 */

import RenderUtils from '@/render/utils';
import { getEffectDisplayInfo } from '@/data/effectDisplayInfo';
import { HUD_COLORS, PANEL } from '@/ui/hud/layout';
import type { HUDActiveEffect, HUDChampionData, HUDContext } from '@/ui/hud/types';

/** Draw active buffs/effects on top of HUD (from right to left) */
export function drawBuffs(
  ctx: CanvasRenderingContext2D,
  rightX: number,
  y: number,
  champion: HUDChampionData,
  hud: HUDContext
): void {
  const buffs = champion.getBuffs();

  // Clear old buff boxes
  hud.buffBoxes.clear();

  if (buffs.length === 0) return;

  const size = PANEL.buffSize;
  const spacing = PANEL.buffSpacing;

  // Draw buffs from right to left
  buffs.forEach((buff, index) => {
    const x = rightX - (index + 1) * (size + spacing) + spacing;
    // Cache position for hit testing
    hud.buffBoxes.set(index, { x, y, size });
    const isHovered = hud.hoverState.buff === index;
    drawBuffIcon(ctx, x, y, size, buff.source, hud.config.accentColor, isHovered);
  });
}

/** Draw a single buff icon */
function drawBuffIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  source: string,
  accentColor: string,
  isHovered: boolean = false
): void {
  // Background (brighter when hovered)
  ctx.fillStyle = isHovered ? HUD_COLORS.borderHighlight : HUD_COLORS.backgroundLight;
  ctx.fillRect(x, y, size, size);

  // Border (highlight when hovered)
  if (isHovered) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
  } else {
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
  }
  ctx.strokeRect(x, y, size, size);

  // Buff indicator (first letter of source or icon)
  const label = source.charAt(0).toUpperCase();
  RenderUtils.renderBitmapText(
    ctx,
    label,
    x + size / 2,
    y + size / 2 - 12,
    { color: HUD_COLORS.text, size: 22, centered: true, shadow: false }
  );
}

/** Draw active effects on top of HUD (from right to left) */
export function drawActiveEffects(
  ctx: CanvasRenderingContext2D,
  rightX: number,
  y: number,
  champion: HUDChampionData,
  hud: HUDContext
): void {
  const effects = champion.getActiveEffects();

  // Clear old effect boxes
  hud.effectBoxes.clear();

  if (effects.length === 0) return;

  const size = PANEL.effectSize;
  const spacing = PANEL.effectSpacing;

  // Draw effects from right to left
  effects.forEach((effect, index) => {
    const x = rightX - (index + 1) * (size + spacing) + spacing;
    // Cache position for hit testing
    hud.effectBoxes.set(index, { x, y, size });
    const isHovered = hud.hoverState.effect === index;
    drawEffectIcon(ctx, x, y, size, effect, isHovered);
  });
}

/** Draw a single effect icon with radial cooldown-style timer */
export function drawEffectIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  effect: HUDActiveEffect,
  isHovered: boolean = false
): void {
  const displayInfo = getEffectDisplayInfo(effect.definitionId);
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 2 - 2;

  // Background based on category
  const bgColor = isHovered
    ? HUD_COLORS.borderHighlight
    : (displayInfo.category === 'buff' ? 'rgba(46, 204, 113, 0.3)' :
       displayInfo.category === 'debuff' ? 'rgba(231, 76, 60, 0.3)' :
       'rgba(155, 89, 182, 0.3)');
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, size, size);

  // Draw radial cooldown sweep (drains clockwise from top as time expires)
  if (effect.timeRemaining > 0 && effect.totalDuration && effect.totalDuration > 0) {
    const progress = effect.timeRemaining / effect.totalDuration; // 1 = full, 0 = expired

    // Draw the "remaining time" arc as a semi-transparent overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    // Arc from top (-π/2) clockwise by the expired portion
    const expiredAngle = (1 - progress) * Math.PI * 2;
    ctx.arc(centerX, centerY, radius + 2, -Math.PI / 2, -Math.PI / 2 + expiredAngle, false);
    ctx.lineTo(centerX, centerY);
    ctx.fill();
    ctx.restore();
  }

  // Border with effect color (highlight when hovered)
  if (isHovered) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
  } else {
    ctx.strokeStyle = displayInfo.color;
    ctx.lineWidth = 2;
  }
  ctx.strokeRect(x, y, size, size);

  // Effect icon
  RenderUtils.renderBitmapText(
    ctx,
    displayInfo.icon,
    centerX,
    centerY - 14,
    { color: displayInfo.color, size: 26, centered: true, shadow: true }
  );

  // Duration timer at bottom (only show text for longer durations)
  if (effect.timeRemaining > 0) {
    const timerText = effect.timeRemaining >= 10
      ? Math.floor(effect.timeRemaining).toString()
      : effect.timeRemaining.toFixed(1);
    RenderUtils.renderBitmapText(
      ctx,
      timerText,
      centerX,
      y + size - 16,
      { color: HUD_COLORS.text, size: 16, centered: true, shadow: false }
    );
  }

  // Stack count at top right if > 1
  if (effect.stacks > 1) {
    RenderUtils.renderBitmapText(
      ctx,
      `x${effect.stacks}`,
      x + size - 4,
      y + 2,
      { color: '#FFD700', size: 14, rightAlign: true, shadow: true }
    );
  }
}
