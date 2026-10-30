/**
 * Vile: a hooded archer drawn from generated sprite strips (idle, walk,
 * attack, and Q/E/R animations; scripts/generate-sprites.ts), and the dark
 * soul auto-attack projectile. Without the strips he's the default circle.
 * Vile's traps are synced as wards (src/render/entities/ward.ts).
 */

import type { EntityRenderContext } from "@/render/entities/types";
import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const VILE_STRIPS = generatedStrips("vile", {
  q: "vile_black_arrows",
  e: "vile_roots_of_vilix",
  r: "vile_restoration_of_vilix",
});

/** World units per sprite pixel: about 55 tall, like Vex */
const VILE_SCALE = 0.6;

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
  images: stripImages(VILE_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(VILE_STRIPS, VILE_SCALE, rc),
  projectiles: {
    vile_auto: renderVileAutoProjectile,
  },
  markVisuals: {},
};
