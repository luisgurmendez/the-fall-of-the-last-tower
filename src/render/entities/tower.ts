/**
 * Tower renderer.
 */

import type { EntityRenderContext } from "@/render/entities/types";
import {
  TEAM_COLORS,
  drawBuildingSprite,
  imageCache,
} from "@/render/entities/shared";
import {
  HEALTH_BAR_COLORS,
  renderHealthBar,
} from "@/render/overlays/healthBars";

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
    // Check if tower is hovered for outline highlighting
    const outlineColor = rc.getOutlineColor(snapshot.entityId);

    drawBuildingSprite(
      ctx,
      image,
      SPRITES.TOWER.WIDTH,
      SPRITES.TOWER.HEIGHT,
      SPRITES.TOWER.SCALE,
      30,
      outlineColor,
    );
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
