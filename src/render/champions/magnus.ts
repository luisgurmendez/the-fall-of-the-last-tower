/**
 * Magnus: default circle body and the fireball projectile.
 */

import type { ChampionRendererEntry } from "./types";

/**
 * Magnus Fireball - larger orange/red fireball.
 */
function renderFireballProjectile(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
): void {
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
}

/**
 * Magnus renderer entry.
 */
export const magnusRenderer: ChampionRendererEntry = {
  images: [],
  createBodyRenderer: null,
  projectiles: {
    magnus_fireball: renderFireballProjectile,
  },
  markVisuals: {},
};
