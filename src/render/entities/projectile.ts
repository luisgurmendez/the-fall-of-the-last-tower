/**
 * Projectile renderer: minion and tower arrows and the default energy ball.
 * Champion ability and auto-attack projectiles are drawn by their champion
 * (src/render/champions/).
 */

import type { EntityRenderContext } from "@/render/entities/types";
import { TEAM_COLORS, imageCache } from "@/render/entities/shared";
import { getChampionProjectileRenderer } from "@/render/champions";

/**
 * Sprite configuration.
 */
const SPRITES = {
  ARROW: {
    BLUE: "/assets/sprites/units/Archer_Blue/Arrow.png",
    RED: "/assets/sprites/units/Archer_Red/Arrow.png",
    SCALE: 0.3,
  },
};

/**
 * Projectile sprites to preload.
 */
export const PROJECTILE_IMAGES = [SPRITES.ARROW.BLUE, SPRITES.ARROW.RED];

/**
 * Render a projectile.
 */
export function renderProjectile(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  rc: EntityRenderContext,
): void {
  const side = snapshot.side;
  const projectileType = snapshot.abilityId || "default";
  const teamColor = side === 0 ? TEAM_COLORS.BLUE : TEAM_COLORS.RED;

  // Get direction for rotation
  const dirX = snapshot.directionX || 1;
  const dirY = snapshot.directionY || 0;
  const angle = Math.atan2(dirY, dirX);

  // Champion projectiles are drawn by their champion (src/render/champions/)
  const renderChampionProjectile = getChampionProjectileRenderer(projectileType);

  // Render based on projectile type
  if (projectileType === "minion_caster" || projectileType === "tower") {
    // Use arrow sprite for caster minions and towers
    const arrowSrc = side === 0 ? SPRITES.ARROW.BLUE : SPRITES.ARROW.RED;
    const arrowImg = imageCache.get(arrowSrc);

    if (arrowImg && arrowImg.complete && arrowImg.naturalWidth > 0) {
      ctx.save();
      ctx.rotate(angle);

      // Scale: tower arrows are larger
      const scale =
        projectileType === "tower"
          ? SPRITES.ARROW.SCALE * 1.5
          : SPRITES.ARROW.SCALE;

      const width = arrowImg.naturalWidth * scale;
      const height = arrowImg.naturalHeight * scale;

      // Draw centered on the projectile position
      ctx.drawImage(arrowImg, -width / 2, -height / 2, width, height);

      ctx.restore();
    } else {
      // Fallback: draw simple arrow shape if image not loaded
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = teamColor;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-4, -3);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (renderChampionProjectile) {
    renderChampionProjectile(ctx, snapshot, angle, rc);
  } else {
    // Default projectile - energy ball
    const radius = snapshot.radius || 5;
    ctx.fillStyle = teamColor;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Glow effect
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
