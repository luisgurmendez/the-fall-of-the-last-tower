/**
 * Projectile renderer. With the GPU layer every projectile is drawn there
 * (src/gpu/fx/projectiles.ts: glowing bolts, fireballs, trails); the siege
 * cannonball also keeps its 2D ball. Without it: minion and tower arrows,
 * the default energy ball, and champion projectiles drawn by their champion
 * (src/render/champions/).
 */

import type { EntityRenderContext } from "@/render/entities/types";
import { TEAM_COLORS, imageCache } from "@/render/entities/shared";
import { getChampionProjectileRenderer } from "@/render/champions";
import { getGPURenderer } from "@/gpu/GPURenderer";
import { emitProjectile } from "@/gpu/fx/projectiles";

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
 * Projectiles of siege minions and jungle creatures, drawn as shapes.
 */
const SPECIAL_PROJECTILES: Record<
  string,
  (ctx: CanvasRenderingContext2D, angle: number, time: number) => void
> = {
  // Siege minion cannonball with a smoke puff behind it
  minion_siege: (ctx, angle) => {
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(180, 180, 180, 0.35)";
    ctx.beginPath();
    ctx.arc(-8, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b6b6b";
    ctx.beginPath();
    ctx.arc(-2, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  // Gromp spit: a wobbling green glob
  jungle_spit: (ctx, angle, time) => {
    const wobble = 1 + Math.sin(time * 20) * 0.15;
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(120, 200, 60, 0.4)";
    ctx.beginPath();
    ctx.ellipse(-6, 0, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7ac943";
    ctx.beginPath();
    ctx.ellipse(0, 0, 6 * wobble, 4 / wobble, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d4f5a8";
    ctx.beginPath();
    ctx.arc(1, -1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  // Dragon fire: a flickering fireball with a flame tail
  dragon_fire: (ctx, angle, time) => {
    const flicker = 1 + Math.sin(time * 30) * 0.1;
    ctx.save();
    ctx.rotate(angle);
    const tail = ctx.createLinearGradient(-24, 0, 0, 0);
    tail.addColorStop(0, "rgba(255, 80, 0, 0)");
    tail.addColorStop(1, "rgba(255, 140, 0, 0.7)");
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();
    const core = ctx.createRadialGradient(0, 0, 1, 0, 0, 9 * flicker);
    core.addColorStop(0, "#fff6c2");
    core.addColorStop(0.4, "#ffb23e");
    core.addColorStop(1, "rgba(255, 70, 0, 0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, 9 * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};

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

  const gpu = getGPURenderer();
  const position = rc.stateManager.getEntity(snapshot.entityId)?.position;
  if (gpu && position) {
    emitProjectile(gpu.topFx, snapshot.entityId, projectileType, position.x, position.y, angle, rc.animationTime, side);
    if (projectileType === "minion_siege") SPECIAL_PROJECTILES.minion_siege(ctx, angle, rc.animationTime);
    return;
  }

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
  } else if (SPECIAL_PROJECTILES[projectileType]) {
    SPECIAL_PROJECTILES[projectileType](ctx, angle, rc.animationTime);
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
