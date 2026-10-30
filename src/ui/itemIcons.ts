/**
 * Item icons for the shop (DOM) and the HUD (canvas).
 *
 * The art is 32x32 pixel art in public/assets/items/<itemId>.png, made with
 * scripts/generate-item-icons.ts. Draw it at whole multiples of 32 so pixels
 * stay square. An item without art shows its category's symbol instead.
 */

import type { ItemDefinition } from '@siege/shared';

/** Size of the icon art, in pixels */
export const ITEM_ICON_SIZE = 32;

/** Loaded (or loading) icon images, by item id; null when the item has no art */
const images = new Map<string, HTMLImageElement | null>();

/**
 * URL of an item's icon art.
 */
export function getItemIconUrl(itemId: string): string {
  return `/assets/items/${itemId}.png`;
}

/**
 * The item's icon image once it has loaded, for drawing on a canvas. The first
 * call starts loading it; until then (or if the item has no art) it's null.
 */
export function getItemIconImage(itemId: string): HTMLImageElement | null {
  if (!images.has(itemId)) {
    const image = new Image();
    image.onerror = () => images.set(itemId, null);
    image.src = getItemIconUrl(itemId);
    images.set(itemId, image);
  }
  const image = images.get(itemId);
  return image && image.complete && image.naturalWidth > 0 ? image : null;
}

/**
 * Draw an item's icon on a canvas, or its category symbol until the art loads.
 * (x, y) is the top-left corner; scale should be a whole number.
 */
export function drawItemIcon(
  ctx: CanvasRenderingContext2D,
  item: ItemDefinition,
  x: number,
  y: number,
  scale = 1,
  drawFallback: (symbol: string) => void = () => {},
): void {
  const image = getItemIconImage(item.id);
  if (!image) {
    drawFallback(getItemCategorySymbol(item));
    return;
  }
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, Math.round(x), Math.round(y), ITEM_ICON_SIZE * scale, ITEM_ICON_SIZE * scale);
  ctx.imageSmoothingEnabled = smoothing;
}

/**
 * An element showing the item's icon (an <img>, or the category symbol if the
 * art is missing). Size it with CSS.
 */
export function createItemIconElement(item: ItemDefinition): HTMLElement {
  const img = document.createElement('img');
  img.className = 'item-icon-art';
  img.src = getItemIconUrl(item.id);
  img.alt = item.name;
  img.draggable = false;
  img.onerror = () => {
    const symbol = document.createElement('span');
    symbol.textContent = getItemCategorySymbol(item);
    img.replaceWith(symbol);
  };
  return img;
}

/**
 * Symbol for an item's category, shown when the item has no icon art.
 */
export function getItemCategorySymbol(item: ItemDefinition): string {
  const symbols: Record<string, string> = {
    attack_damage: '⚔',
    ability_power: '✦',
    attack_speed: '⚡',
    armor: '🛡',
    magic_resist: '✧',
    health: '♥',
    movement: '👢',
    utility: '⚙',
  };
  return symbols[item.category] || '?';
}
