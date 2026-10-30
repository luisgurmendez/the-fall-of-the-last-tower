/**
 * Vile: default circle body and the dark soul auto-attack projectile.
 * Vile's traps are synced as wards (src/render/entities/ward.ts).
 */

import type { EntityRenderContext } from "@/render/entities/types";
import type { ChampionRendererEntry } from "./types";

/**
 * Vile's dark soul auto-attack - eerie purple/black orb.
 */
function renderVileAutoProjectile(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  _angle: number,
  rc: EntityRenderContext,
): void {
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
}

/**
 * Vile renderer entry.
 */
export const vileRenderer: ChampionRendererEntry = {
  images: [],
  createBodyRenderer: null,
  projectiles: {
    vile_auto: renderVileAutoProjectile,
  },
  markVisuals: {},
};
