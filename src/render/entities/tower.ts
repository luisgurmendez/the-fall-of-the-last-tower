/**
 * Tower renderer.
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
  TOWER: {
    BLUE: "/assets/sprites/Buildings/Tower_Blue.png",
    RED: "/assets/sprites/Buildings/Tower_Red.png",
    WIDTH: 128,
    HEIGHT: 256,
    SCALE: 0.8,
  },
};

/**
 * Tower sprites to preload.
 */
export const TOWER_IMAGES = [SPRITES.TOWER.BLUE, SPRITES.TOWER.RED];

/**
 * Render a tower using sprite images.
 */
export function renderTower(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  side: number,
  rc: EntityRenderContext,
): void {
  const spriteSrc = side === 0 ? SPRITES.TOWER.BLUE : SPRITES.TOWER.RED;
  const image = imageCache.get(spriteSrc);

  if (image && image.complete && image.naturalWidth > 0) {
    const scaledWidth = SPRITES.TOWER.WIDTH * SPRITES.TOWER.SCALE;
    const scaledHeight = SPRITES.TOWER.HEIGHT * SPRITES.TOWER.SCALE;

    // Check if tower is hovered for outline highlighting
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
        const outlinedWidth = (SPRITES.TOWER.WIDTH + padding * 2) * SPRITES.TOWER.SCALE;
        const outlinedHeight = (SPRITES.TOWER.HEIGHT + padding * 2) * SPRITES.TOWER.SCALE;

        ctx.drawImage(
          outlinedSprite,
          0,
          0,
          outlinedSprite.width,
          outlinedSprite.height,
          -outlinedWidth / 2,
          -outlinedHeight + 30 + padding * SPRITES.TOWER.SCALE,
          outlinedWidth,
          outlinedHeight,
        );
      } else {
        // Fallback to normal sprite
        ctx.drawImage(
          image,
          -scaledWidth / 2,
          -scaledHeight + 30,
          scaledWidth,
          scaledHeight,
        );
      }
    } else {
      // Draw normal sprite when not hovered
      ctx.drawImage(
        image,
        -scaledWidth / 2,
        -scaledHeight + 30, // Offset so base is near position
        scaledWidth,
        scaledHeight,
      );
    }
  } else {
    // Fallback: draw colored rectangle
    const color = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;
    ctx.fillStyle = color;
    ctx.fillRect(-25, -60, 50, 80);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(-25, -60, 50, 80);
  }

  // Draw health bar - blue for ally towers, red for enemy towers
  if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
    const barY = -SPRITES.TOWER.HEIGHT * SPRITES.TOWER.SCALE + 10;
    const healthBarColor =
      side === rc.localSide
        ? HEALTH_BAR_COLORS.ALLY // Blue for allied towers
        : HEALTH_BAR_COLORS.ENEMY; // Red for enemy towers
    renderHealthBar(
      ctx,
      snapshot.health,
      snapshot.maxHealth,
      60,
      barY,
      healthBarColor,
    );
  }
}
