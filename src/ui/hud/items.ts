/**
 * Item slots (2 rows x 3 cols) with the gold count below them, and the ward
 * trinket box next to them. Caches the item slot positions in the HUDContext
 * for hit testing.
 */

import RenderUtils from '@/render/utils';
import type { ItemSlot } from '@siege/shared';
import { HUD_COLORS, PANEL } from '@/ui/hud/layout';
import { drawItemIcon, ITEM_ICON_SIZE } from '@/ui/itemIcons';
import type { HUDChampionData, HUDContext } from '@/ui/hud/types';
import { drawPixelArt } from '@/render/pixelArt';

/** Draw the items panel (2 rows x 3 cols) with gold display */
export function drawItemsPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gold: number,
  champion: HUDChampionData,
  hud: HUDContext
): void {
  const boxSize = PANEL.itemBoxSize;
  const spacing = PANEL.itemSpacing;
  const innerPadding = 6;

  // Calculate container size
  const containerWidth = 3 * boxSize + 2 * spacing + innerPadding * 2;
  const containerHeight = 2 * boxSize + spacing + innerPadding * 2;

  // Draw container background
  ctx.fillStyle = HUD_COLORS.backgroundLight;
  ctx.fillRect(x, y, containerWidth, containerHeight);
  ctx.strokeStyle = HUD_COLORS.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, containerWidth, containerHeight);

  // Draw 6 item slots (2 rows x 3 cols) with inner padding
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const slotIndex = (row * 3 + col) as ItemSlot;
      const boxX = x + innerPadding + col * (boxSize + spacing);
      const boxY = y + innerPadding + row * (boxSize + spacing);
      // Cache position for hit testing
      hud.itemBoxes.set(slotIndex, { x: boxX, y: boxY, size: boxSize });
      drawItemSlot(ctx, boxX, boxY, boxSize, slotIndex, champion, hud);
    }
  }

  // Draw gold count below items
  const goldY = y + containerHeight + 4;
  RenderUtils.renderBitmapText(
    ctx,
    `${Math.floor(gold)}`,
    x + containerWidth / 2,
    goldY,
    { color: '#FFD700', size: 22, centered: true }
  );
}

/** Draw a single item slot */
function drawItemSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  slotIndex: ItemSlot,
  champion: HUDChampionData,
  hud: HUDContext
): void {
  const isHovered = hud.hoverState.item === slotIndex;
  const inventory = champion.getInventory();
  const equipped = inventory.items.get(slotIndex);

  // Background (brighter when hovered or has item)
  if (equipped) {
    ctx.fillStyle = isHovered ? HUD_COLORS.borderHighlight : HUD_COLORS.border;
  } else {
    ctx.fillStyle = isHovered ? HUD_COLORS.borderHighlight : HUD_COLORS.backgroundLight;
  }
  ctx.fillRect(x, y, size, size);

  // Border (highlight when hovered)
  if (isHovered) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
  } else if (equipped) {
    ctx.strokeStyle = getItemCategoryColor(equipped.definition.category);
    ctx.lineWidth = 2;
  } else {
    ctx.strokeStyle = HUD_COLORS.border;
    ctx.lineWidth = 1;
  }
  ctx.strokeRect(x, y, size, size);

  if (equipped) {
    const iconOffset = (size - ITEM_ICON_SIZE) / 2;
    drawItemIcon(ctx, equipped.definition, x + iconOffset, y + iconOffset, 1, (symbol) => {
      RenderUtils.renderBitmapText(
        ctx,
        symbol,
        x + size / 2,
        y + size / 2 - 14,
        { color: getItemCategoryColor(equipped.definition.category), size: 28, centered: true, shadow: true }
      );
    });
  } else {
    // Show empty slot with number
    RenderUtils.renderBitmapText(
      ctx,
      `${slotIndex + 1}`,
      x + size / 2,
      y + size / 2 - 12,
      { color: isHovered ? HUD_COLORS.text : HUD_COLORS.textDim, size: 22, centered: true, shadow: false }
    );
  }
}

/** Get color for an item category */
export function getItemCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    attack_damage: '#ff6b6b',
    ability_power: '#a855f7',
    attack_speed: '#f1c40f',
    armor: '#f59e0b',
    magic_resist: '#8b5cf6',
    health: '#2ecc71',
    movement: '#06b6d4',
    utility: '#95a5a6',
  };
  return colors[category] || '#ffffff';
}

/** The stealth ward's sprite (scripts/generate-props.ts), shown in the trinket box */
const wardIcon = new Image();
wardIcon.src = '/assets/props/ward_stealth.png';

/** Draw ward count panel */
export function drawWardPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  champion: HUDChampionData
): void {
  const size = PANEL.wardBoxSize;
  const trinket = champion.getTrinket();
  const charges = trinket?.getCharges() ?? 0;
  const maxCharges = trinket?.getDefinition().maxCharges ?? 2;

  // Background
  ctx.fillStyle = HUD_COLORS.backgroundLight;
  ctx.fillRect(x, y, size, size);

  // Border
  ctx.strokeStyle = charges > 0 ? '#44FF44' : HUD_COLORS.border;
  ctx.lineWidth = charges > 0 ? 2 : 1;
  ctx.strokeRect(x, y, size, size);

  // The ward itself, dimmed while there's no charge
  if (wardIcon.complete && wardIcon.naturalWidth > 0) {
    ctx.globalAlpha = charges > 0 ? 1 : 0.4;
    drawPixelArt(ctx, wardIcon, x + 4, y - 2, size - 8, size - 8);
    ctx.globalAlpha = 1;
  }

  // Charge count
  RenderUtils.renderBitmapText(
    ctx,
    `${charges}/${maxCharges}`,
    x + size / 2,
    y + size - 22,
    { color: charges > 0 ? '#44FF44' : HUD_COLORS.textDim, size: 20, centered: true, shadow: false }
  );
}
