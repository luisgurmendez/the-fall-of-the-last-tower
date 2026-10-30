/**
 * Health and resource (mana/energy/rage) bars under the ability boxes, with
 * current/max values and regen.
 */

import RenderUtils from '@/render/utils';
import { HUD_COLORS, PANEL } from '@/ui/hud/layout';
import type { HUDChampionData } from '@/ui/hud/types';

/** Draw the health bar */
export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  champion: HUDChampionData
): void {
  const stats = champion.getStats();
  const currentHealth = champion.getCurrentHealth();
  const maxHealth = stats.maxHealth;
  const healthPercent = currentHealth / maxHealth;
  const healthRegen = stats.healthRegen || 0;

  // Background
  ctx.fillStyle = HUD_COLORS.healthBarBg;
  ctx.fillRect(x, y, width, PANEL.barHeight);

  // Health fill
  ctx.fillStyle = HUD_COLORS.healthBar;
  ctx.fillRect(x, y, width * healthPercent, PANEL.barHeight);

  // Border
  ctx.strokeStyle = HUD_COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, PANEL.barHeight);

  // Health text (centered)
  RenderUtils.renderBitmapText(
    ctx,
    `${Math.floor(currentHealth)}/${Math.floor(maxHealth)}`,
    x + width / 2,
    y + 1,
    { color: HUD_COLORS.text, size: 22, centered: true }
  );

  // Health regen text (right aligned inside bar)
  if (healthRegen > 0) {
    RenderUtils.renderBitmapText(
      ctx,
      `+${healthRegen.toFixed(1)}`,
      x + width - 4,
      y + 3,
      { color: '#90EE90', size: 18, rightAlign: true, shadow: false }
    );
  }
}

/** Draw the resource bar (mana/energy/rage) */
export function drawResourceBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  champion: HUDChampionData,
  resourceColor: string
): void {
  const stats = champion.getStats();
  const currentResource = champion.getCurrentResource();
  const maxResource = stats.maxResource;
  const resourcePercent = currentResource / maxResource;
  const resourceRegen = stats.resourceRegen || 0;

  // Background
  ctx.fillStyle = HUD_COLORS.manaBarBg;
  ctx.fillRect(x, y, width, PANEL.barHeight);

  // Resource fill
  ctx.fillStyle = resourceColor;
  ctx.fillRect(x, y, width * resourcePercent, PANEL.barHeight);

  // Border
  ctx.strokeStyle = HUD_COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, PANEL.barHeight);

  // Resource text (centered)
  RenderUtils.renderBitmapText(
    ctx,
    `${Math.floor(currentResource)}/${Math.floor(maxResource)}`,
    x + width / 2,
    y + 1,
    { color: HUD_COLORS.text, size: 22, centered: true }
  );

  // Resource regen text (right aligned inside bar)
  if (resourceRegen > 0) {
    RenderUtils.renderBitmapText(
      ctx,
      `+${resourceRegen.toFixed(1)}`,
      x + width - 4,
      y + 3,
      { color: '#87CEEB', size: 18, rightAlign: true, shadow: false }
    );
  }
}
