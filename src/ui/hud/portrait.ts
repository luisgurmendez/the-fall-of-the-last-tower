/**
 * Champion portrait: the champion's face (as in champion select), name,
 * level badge (pulsing while skill points are unspent) and the XP bar below
 * it.
 */

import RenderUtils from '@/render/utils';
import { getPortraitCanvas } from '@/ui/matchmaking/portraits';
import { HUD_COLORS, PANEL } from '@/ui/hud/layout';
import type { HUDChampionData, HUDContext } from '@/ui/hud/types';

/** Draw the champion portrait panel with XP bar */
export function drawPortraitPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  champion: HUDChampionData,
  hud: HUDContext
): void {
  const size = PANEL.portraitSize;
  const level = champion.getLevel();
  const experience = champion.getExperience();
  const expToNext = champion.getExperienceToNextLevel();
  const skillPoints = champion.getSkillPoints();
  const xpPercent = expToNext > 0 ? experience / expToNext : 0;

  // Portrait background, then the champion's art (black until it loads)
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, size, size);
  const portrait = getPortraitCanvas(hud.config.championId);
  if (portrait) {
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    // The face fills the frame (the name is drawn over its bottom)
    const scale = size / Math.max(portrait.width, portrait.height);
    const width = portrait.width * scale;
    const height = portrait.height * scale;
    ctx.drawImage(portrait, x + (size - width) / 2, y + (size - height) / 2, width, height);
    ctx.imageSmoothingEnabled = smoothing;
  }

  // Border
  ctx.strokeStyle = hud.config.accentColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, size, size);

  // Champion name
  RenderUtils.renderBitmapText(
    ctx,
    hud.config.championName,
    x + size / 2,
    y + size - 26,
    { color: HUD_COLORS.text, size: 22, centered: true, shadow: true }
  );

  // Level badge with pulse effect when skill points available
  const pulseScale = skillPoints > 0 ? 1 + Math.sin(hud.levelUpPulseTime * 4) * 0.1 : 1;
  const badgeRadius = 14 * pulseScale;
  const badgeColor = skillPoints > 0 ? HUD_COLORS.levelUpButton : hud.config.accentColor;

  ctx.fillStyle = badgeColor;
  ctx.beginPath();
  ctx.arc(x + size - 10, y + size - 10, badgeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = HUD_COLORS.background;
  ctx.lineWidth = 2;
  ctx.stroke();

  RenderUtils.renderBitmapText(
    ctx,
    `${level}`,
    x + size - 10,
    y + size - 21,
    { color: HUD_COLORS.text, size: 22, centered: true, shadow: false }
  );

  // XP Bar below portrait
  const xpBarY = y + size + PANEL.xpBarSpacing;
  const xpBarWidth = size;
  const xpBarHeight = PANEL.xpBarHeight;

  // XP bar background
  ctx.fillStyle = HUD_COLORS.xpBarBg;
  ctx.fillRect(x, xpBarY, xpBarWidth, xpBarHeight);

  // XP bar fill
  ctx.fillStyle = HUD_COLORS.xpBar;
  ctx.fillRect(x, xpBarY, xpBarWidth * xpPercent, xpBarHeight);

  // XP bar border
  ctx.strokeStyle = HUD_COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, xpBarY, xpBarWidth, xpBarHeight);
}
