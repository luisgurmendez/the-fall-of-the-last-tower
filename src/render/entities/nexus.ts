/**
 * Nexus renderer.
 */

import type { EntityRenderContext } from "@/render/entities/types";
import {
  TEAM_COLORS,
  drawBuildingSprite,
  imageCache,
  renderProtectionDome,
} from "@/render/entities/shared";
import {
  HEALTH_BAR_COLORS,
  renderHealthBar,
} from "@/render/overlays/healthBars";

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
    // Check if nexus is hovered for outline highlighting
    const outlineColor = rc.getOutlineColor(snapshot.entityId);

    drawBuildingSprite(
      ctx,
      image,
      SPRITES.NEXUS.WIDTH,
      SPRITES.NEXUS.HEIGHT,
      SPRITES.NEXUS.SCALE,
      20,
      outlineColor,
    );
  } else {
    // Fallback: draw colored rectangle
    const color = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;
    ctx.fillStyle = color;
    ctx.fillRect(-50, -80, 100, 100);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.strokeRect(-50, -80, 100, 100);
  }

  if (snapshot.isProtected) {
    renderProtectionDome(ctx, 90, -30, rc.animationTime);
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
