/**
 * Summoner spells in the HUD: a column of two boxes (D over F, or the keys
 * bound to them) beside the abilities, with each spell's icon, a cooldown
 * overlay and seconds left, and the key; hovering one shows its tooltip.
 */

import { SUMMONER_SPELLS, type SummonerSpellId } from '@siege/shared';
import RenderUtils from '@/render/utils';
import { Dimensions } from '@/core/canvas';
import { getSummonerIcon } from '@/ui/summonerIcons';
import { HUD_COLORS, PANEL } from '@/ui/hud/layout';
import { wrapText } from '@/ui/hud/tooltipText';
import type { HUDChampionData, HUDContext } from '@/ui/hud/types';
import { drawPixelArt } from '@/render/pixelArt';
import { getControls } from '@/core/input/controls';
import { keyLabel, summonerAction } from '@/core/input/keyBindings';

const SLOTS = [0, 1] as const;

/** The key that casts the summoner spell in a slot, as shown */
function summonerKey(slot: 0 | 1): string {
  return keyLabel(getControls().keyFor(summonerAction(slot)));
}

/** Draw the summoner spell column; its top-left corner is (x, y) */
export function drawSummonersPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  champion: HUDChampionData,
  hud: HUDContext
): void {
  const size = PANEL.summonerBoxSize;
  const spells = champion.getSummoners();

  SLOTS.forEach((slot) => {
    const key = summonerKey(slot);
    const boxY = y + slot * (size + PANEL.summonerSpacing);
    const spell = spells[slot];
    hud.summonerBoxes.set(slot, { x, y: boxY, size });

    ctx.fillStyle = HUD_COLORS.backgroundLight;
    ctx.fillRect(x, boxY, size, size);

    const icon = spell ? getSummonerIcon(spell.id) : null;
    if (icon) drawPixelArt(ctx, icon, x, boxY, size, size);

    const cooling = !!spell && spell.cooldownRemaining > 0;
    if (cooling) {
      ctx.fillStyle = HUD_COLORS.cooldownOverlay;
      ctx.fillRect(x, boxY, size, size * Math.min(1, spell.cooldownRemaining / Math.max(1, spell.cooldown)));
      RenderUtils.renderBitmapText(ctx, `${Math.ceil(spell.cooldownRemaining)}`, x + size / 2, boxY + size / 2 - 9, {
        color: HUD_COLORS.text,
        size: 18,
        centered: true,
        shadow: true,
      });
    }

    ctx.strokeStyle = hud.hoverState.summoner === slot ? HUD_COLORS.abilityReady : HUD_COLORS.border;
    ctx.lineWidth = hud.hoverState.summoner === slot ? 2 : 1;
    ctx.strokeRect(x, boxY, size, size);

    RenderUtils.renderBitmapText(ctx, key, x + size - 6, boxY + size - 13, {
      color: cooling ? HUD_COLORS.textDim : HUD_COLORS.text,
      size: 14,
      centered: true,
      shadow: true,
    });
  });
}

/** Tooltip for a summoner spell, above its box */
export function drawSummonerTooltip(
  ctx: CanvasRenderingContext2D,
  boxX: number,
  boxY: number,
  slot: number,
  spellId: string
): void {
  const definition = SUMMONER_SPELLS[spellId as SummonerSpellId];
  if (!definition) return;
  const padding = PANEL.tooltipPadding;
  const lineHeight = 18;
  const width = PANEL.tooltipWidth;
  const lines = wrapText(definition.description, width - padding * 2, 14);
  const height = padding * 2 + lineHeight + 6 + lines.length * lineHeight + lineHeight;

  const tooltipX = Math.max(10, Math.min(boxX + PANEL.summonerBoxSize / 2 - width / 2, Dimensions.w - width - 10));
  const tooltipY = Math.max(10, boxY - height - 10);

  ctx.save();
  ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
  ctx.fillRect(tooltipX, tooltipY, width, height);
  ctx.strokeStyle = definition.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(tooltipX, tooltipY, width, height);

  let lineY = tooltipY + padding;
  RenderUtils.renderBitmapText(ctx, `${summonerKey(slot as 0 | 1)} - ${definition.name}`, tooltipX + padding, lineY, {
    color: definition.color,
    size: 26,
    shadow: false,
  });
  lineY += lineHeight + 6;
  for (const line of lines) {
    RenderUtils.renderBitmapText(ctx, line, tooltipX + padding, lineY, { color: HUD_COLORS.text, size: 20, shadow: false });
    lineY += lineHeight;
  }
  RenderUtils.renderBitmapText(ctx, `Cooldown: ${definition.cooldown}s`, tooltipX + padding, lineY, {
    color: HUD_COLORS.textDim,
    size: 20,
    shadow: false,
  });
  ctx.restore();
}
