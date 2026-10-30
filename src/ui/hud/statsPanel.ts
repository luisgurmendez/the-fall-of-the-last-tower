/**
 * Stats panel: attack, defense, range and speed stats in two columns, at the
 * left end of the HUD.
 */

import RenderUtils from '@/render/utils';
import { HUD_COLORS, PANEL } from '@/ui/hud/layout';
import type { HUDChampionData } from '@/ui/hud/types';

/** Draw the stats panel (2 columns) */
export function drawStatsPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  champion: HUDChampionData
): void {
  const stats = champion.getStats();
  const width = PANEL.statsWidth;
  const height = PANEL.statsHeight - PANEL.padding;

  // Panel background
  ctx.fillStyle = HUD_COLORS.backgroundLight;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = HUD_COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  // Stats data (2 columns)
  const leftStats = [
    { label: 'AD', value: Math.floor(stats.attackDamage) },
    { label: 'AP', value: Math.floor(stats.abilityPower || 0) },
    { label: 'AS', value: stats.attackSpeed.toFixed(2) },
    { label: 'MS', value: Math.floor(stats.movementSpeed) },
  ];

  const rightStats = [
    { label: 'ARM', value: Math.floor(stats.armor) },
    { label: 'MR', value: Math.floor(stats.magicResist) },
    { label: 'RNG', value: Math.floor(stats.attackRange) },
    { label: 'CDR', value: '0%' },
  ];

  const lineHeight = 18;
  const colWidth = width / 2;
  const startY = y + 8;

  // Left column
  leftStats.forEach((stat, i) => {
    RenderUtils.renderBitmapText(
      ctx,
      `${stat.label}`,
      x + 4,
      startY + i * lineHeight,
      { color: HUD_COLORS.textDim, size: 22, shadow: false }
    );
    RenderUtils.renderBitmapText(
      ctx,
      `${stat.value}`,
      x + colWidth - 4,
      startY + i * lineHeight,
      { color: HUD_COLORS.text, size: 22, shadow: false, rightAlign: true }
    );
  });

  // Right column
  rightStats.forEach((stat, i) => {
    RenderUtils.renderBitmapText(
      ctx,
      `${stat.label}`,
      x + colWidth + 4,
      startY + i * lineHeight,
      { color: HUD_COLORS.textDim, size: 22, shadow: false }
    );
    RenderUtils.renderBitmapText(
      ctx,
      `${stat.value}`,
      x + width - 4,
      startY + i * lineHeight,
      { color: HUD_COLORS.text, size: 22, shadow: false, rightAlign: true }
    );
  });
}
