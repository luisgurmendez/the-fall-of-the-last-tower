/**
 * Projectile renderer: minion and tower arrows, champion ability and
 * auto-attack projectiles, and a default energy ball.
 */

import type { EntityRenderContext } from "@/render/entities/types";
import { TEAM_COLORS, imageCache } from "@/render/entities/shared";

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
  } else if (projectileType === "magnus_fireball") {
    // Magnus Fireball - larger orange/red fireball
    const radius = snapshot.radius || 15;

    // Outer glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#ff4400";
    ctx.beginPath();
    ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
    ctx.fill();

    // Main fireball body
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ff6600";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = "#ffaa00";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Hot center
    ctx.fillStyle = "#ffdd44";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (projectileType === "vex_shuriken") {
    // Vex Shuriken - purple/dark star shape
    const radius = snapshot.radius || 10;

    ctx.save();
    ctx.rotate(angle);

    // Draw star/shuriken shape
    ctx.fillStyle = "#8844cc";
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const starAngle = (i * Math.PI) / 2;
      const outerX = Math.cos(starAngle) * radius;
      const outerY = Math.sin(starAngle) * radius;
      const innerAngle = starAngle + Math.PI / 4;
      const innerX = Math.cos(innerAngle) * (radius * 0.4);
      const innerY = Math.sin(innerAngle) * (radius * 0.4);
      if (i === 0) {
        ctx.moveTo(outerX, outerY);
      } else {
        ctx.lineTo(outerX, outerY);
      }
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();

    // Dark center
    ctx.fillStyle = "#442266";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  } else if (projectileType === "lume_auto") {
    // Lume's light photon auto-attack - small glowing light pulse
    const radius = 4; // Small, compact light pulse

    // Outer soft glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#ffffcc";
    ctx.beginPath();
    ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
    ctx.fill();

    // Middle glow ring
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#ffee88";
    ctx.beginPath();
    ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
    ctx.fill();

    // Main body - bright gold/yellow
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffd700";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Hot white center
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (projectileType === "vile_auto") {
    // Vile's dark soul auto-attack - eerie purple/black orb
    const radius = snapshot.radius || 10;

    // Outer dark aura
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#220033";
    ctx.beginPath();
    ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
    ctx.fill();

    // Middle purple glow
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#6622aa";
    ctx.beginPath();
    ctx.arc(0, 0, radius + 3, 0, Math.PI * 2);
    ctx.fill();

    // Main body - dark purple
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#8844cc";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner dark core
    ctx.fillStyle = "#442266";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Dark center
    ctx.fillStyle = "#220033";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Wispy tendrils effect (rotating slowly)
    const wispAngle = rc.animationTime * 3;
    ctx.save();
    ctx.rotate(wispAngle);
    ctx.strokeStyle = "rgba(136, 68, 204, 0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.moveTo(radius * 0.5, 0);
      ctx.quadraticCurveTo(radius * 1.2, radius * 0.3, radius * 1.5, 0);
      ctx.stroke();
    }
    ctx.restore();
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
