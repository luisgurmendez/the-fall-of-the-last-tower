/**
 * Helpers shared by the entity renderers: team colors, the sprite image
 * cache, sprite drawing with the hover outline, and color math.
 */

import {
  getOutlinedSprite,
  getOutlinePadding,
} from "@/render/OutlinedSpriteCache";

/**
 * Colors for different teams.
 */
export const TEAM_COLORS = {
  BLUE: "#3498db",
  RED: "#e74c3c",
  NEUTRAL: "#95a5a6",
};

/**
 * Image cache for loaded sprites.
 */
export const imageCache: Map<string, HTMLImageElement> = new Map();
let imagesLoaded = false;

/**
 * Load all sprite images. Only the first call loads; the cache lives for
 * the whole page, across matches.
 */
export function loadImages(imagesToLoad: readonly string[]): void {
  if (imagesLoaded) return;

  for (const src of imagesToLoad) {
    const img = new Image();
    img.onerror = () => {
      console.error(`[EntityRenderer] Failed to load image: ${src}`);
    };
    img.src = src;
    imageCache.set(src, img);
  }

  imagesLoaded = true;
}

/**
 * Draw one frame of a sprite sheet, scaled and centered on the origin. When
 * outlineColor is set (the entity is hovered), draws the outlined copy of the
 * frame instead, falling back to the plain frame if no outline could be made.
 */
export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  srcX: number,
  frameWidth: number,
  frameHeight: number,
  scale: number,
  outlineColor: string | null,
): void {
  const scaledWidth = frameWidth * scale;
  const scaledHeight = frameHeight * scale;

  if (outlineColor) {
    // Draw outlined sprite when hovered
    const outlinedSprite = getOutlinedSprite(
      image,
      srcX,
      0,
      frameWidth,
      frameHeight,
      outlineColor,
    );

    if (outlinedSprite) {
      // Outlined sprite has padding, so adjust dimensions
      const padding = getOutlinePadding();
      const outlinedWidth = (frameWidth + padding * 2) * scale;
      const outlinedHeight = (frameHeight + padding * 2) * scale;

      ctx.drawImage(
        outlinedSprite,
        0,
        0,
        outlinedSprite.width,
        outlinedSprite.height,
        -outlinedWidth / 2,
        -outlinedHeight / 2,
        outlinedWidth,
        outlinedHeight,
      );
    } else {
      // Fallback to normal sprite if outline generation failed
      ctx.drawImage(
        image,
        srcX,
        0,
        frameWidth,
        frameHeight,
        -scaledWidth / 2,
        -scaledHeight / 2,
        scaledWidth,
        scaledHeight,
      );
    }
  } else {
    // Draw normal sprite when not hovered
    ctx.drawImage(
      image,
      srcX,
      0,
      frameWidth,
      frameHeight,
      -scaledWidth / 2,
      -scaledHeight / 2,
      scaledWidth,
      scaledHeight,
    );
  }
}

/**
 * Draw a building sprite (the whole image), scaled, horizontally centered and
 * with its bottom edge baseOffsetY below the origin. Uses the outlined copy
 * when outlineColor is set, like drawSpriteFrame.
 */
export function drawBuildingSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  scale: number,
  baseOffsetY: number,
  outlineColor: string | null,
): void {
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  if (outlineColor) {
    // Draw outlined sprite when hovered
    const outlinedSprite = getOutlinedSprite(
      image,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
      outlineColor,
    );

    if (outlinedSprite) {
      const padding = getOutlinePadding();
      const outlinedWidth = (width + padding * 2) * scale;
      const outlinedHeight = (height + padding * 2) * scale;

      ctx.drawImage(
        outlinedSprite,
        0,
        0,
        outlinedSprite.width,
        outlinedSprite.height,
        -outlinedWidth / 2,
        -outlinedHeight + baseOffsetY + padding * scale,
        outlinedWidth,
        outlinedHeight,
      );
    } else {
      // Fallback to normal sprite
      ctx.drawImage(
        image,
        -scaledWidth / 2,
        -scaledHeight + baseOffsetY,
        scaledWidth,
        scaledHeight,
      );
    }
  } else {
    // Draw normal sprite when not hovered
    ctx.drawImage(
      image,
      -scaledWidth / 2,
      -scaledHeight + baseOffsetY, // Offset so base is near position
      scaledWidth,
      scaledHeight,
    );
  }
}

/**
 * Lighten a color by a percentage.
 */
export function lightenColor(color: string, percent: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}

/**
 * Faint shimmering dome over a structure that can't be damaged yet.
 */
export function renderProtectionDome(
  ctx: CanvasRenderingContext2D,
  radius: number,
  centerY: number,
  time: number,
): void {
  const shimmer = 0.5 + Math.sin(time * 2) * 0.15;
  ctx.save();
  const glow = ctx.createRadialGradient(0, centerY, radius * 0.3, 0, centerY, radius);
  glow.addColorStop(0, "rgba(180, 220, 255, 0)");
  glow.addColorStop(1, `rgba(180, 220, 255, ${0.35 * shimmer})`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(200, 235, 255, ${0.7 * shimmer})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
