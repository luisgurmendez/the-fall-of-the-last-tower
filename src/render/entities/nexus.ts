/**
 * Nexus renderer.
 */

import type { EntityRenderContext } from "@/render/entities/types";
import { TEAM_COLORS, imageCache } from "@/render/entities/shared";
import {
  HEALTH_BAR_COLORS,
  renderHealthBar,
} from "@/render/overlays/healthBars";
import {
  getOutlinedSprite,
  getOutlinePadding,
} from "@/render/OutlinedSpriteCache";

/**
 * Sprite configuration.
 */
const SPRITES = {
  NEXUS: {
    BLUE: "/assets/sprites/Buildings/Barracks_Blue.png",
    RED: "/assets/sprites/Buildings/Barracks_Red.png",
    WIDTH: 192,
    HEIGHT: 256,
    SCALE: 1.0,
  },
};

/**
 * Nexus sprites to preload.
 */
export const NEXUS_IMAGES = [SPRITES.NEXUS.BLUE, SPRITES.NEXUS.RED];

/**
 * Render a nexus using sprite images.
 */
export function renderNexus(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  side: number,
  rc: EntityRenderContext,
): void {
  const spriteSrc = side === 0 ? SPRITES.NEXUS.BLUE : SPRITES.NEXUS.RED;
  const image = imageCache.get(spriteSrc);

  if (image && image.complete && image.naturalWidth > 0) {
    const scaledWidth = SPRITES.NEXUS.WIDTH * SPRITES.NEXUS.SCALE;
    const scaledHeight = SPRITES.NEXUS.HEIGHT * SPRITES.NEXUS.SCALE;

    // Check if nexus is hovered for outline highlighting
    const outlineColor = rc.getOutlineColor(snapshot.entityId);

    if (outlineColor) {
      // Draw outlined sprite when hovered
      const outlinedSprite = getOutlinedSprite(
        image,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight,
        outlineColor
      );

      if (outlinedSprite) {
        const padding = getOutlinePadding();
        const outlinedWidth = (SPRITES.NEXUS.WIDTH + padding * 2) * SPRITES.NEXUS.SCALE;
        const outlinedHeight = (SPRITES.NEXUS.HEIGHT + padding * 2) * SPRITES.NEXUS.SCALE;

        ctx.drawImage(
          outlinedSprite,
          0,
          0,
          outlinedSprite.width,
          outlinedSprite.height,
          -outlinedWidth / 2,
          -outlinedHeight + 20 + padding * SPRITES.NEXUS.SCALE,
          outlinedWidth,
          outlinedHeight,
        );
      } else {
        // Fallback to normal sprite
        ctx.drawImage(
          image,
          -scaledWidth / 2,
          -scaledHeight + 20,
          scaledWidth,
          scaledHeight,
        );
      }
    } else {
      // Draw normal sprite when not hovered
      ctx.drawImage(
        image,
        -scaledWidth / 2,
        -scaledHeight + 20, // Offset so base is near position
        scaledWidth,
        scaledHeight,
      );
    }
  } else {
    // Fallback: draw colored rectangle
    const color = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;
    ctx.fillStyle = color;
    ctx.fillRect(-50, -80, 100, 100);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(-50, -80, 100, 100);
  }

  // Draw health bar - blue for ally nexus, red for enemy nexus
  if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
    const radius = 75;
    const barY = -radius - 30;
    const healthBarColor =
      side === rc.localSide
        ? HEALTH_BAR_COLORS.ALLY // Blue for allied nexus
        : HEALTH_BAR_COLORS.ENEMY; // Red for enemy nexus
    renderHealthBar(
      ctx,
      snapshot.health,
      snapshot.maxHealth,
      radius * 2,
      barY,
      healthBarColor,
    );

    // Health text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      `${Math.ceil(snapshot.health)} / ${snapshot.maxHealth}`,
      0,
      barY + 6,
    );
  }
}
