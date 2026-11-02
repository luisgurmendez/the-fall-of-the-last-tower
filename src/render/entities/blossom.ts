/**
 * Healing blossom renderer (EntityType.BLOSSOM, The Narrows): in bloom, a
 * big pink flower with a glowing heart, its petals breathing and a soft
 * light around it, motes drifting up; regrowing, a small green bud with a
 * ring that fills up until it blooms again. Drawn in chunky pixels, like
 * the art around it.
 */

import { MOBAConfig, type BlossomSnapshot } from "@siege/shared";
import type { EntityRenderContext } from "@/render/entities/types";

/** World units per art pixel */
const PX = 3;

const PETAL = "#ff8fd0";
const PETAL_LIGHT = "#ffc4ea";
const PETAL_DARK = "#c2479a";
const HEART = "#fff1a8";
const LEAF = "#4f9a3c";
const LEAF_DARK = "#2f6a28";

function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x) * PX - PX / 2, Math.round(y) * PX - PX / 2, PX, PX);
}

/** A disc of art pixels around (cx, cy), radius in art pixels */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string): void {
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= radius * radius + radius * 0.6) pixel(ctx, cx + x, cy + y, color);
    }
  }
}

function drawLeaves(ctx: CanvasRenderingContext2D): void {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) pixel(ctx, side * (3 + i), 2 + Math.floor(i / 2), i < 2 ? LEAF : LEAF_DARK);
    pixel(ctx, side * 4, 1, LEAF);
  }
}

export function renderBlossom(ctx: CanvasRenderingContext2D, snapshot: BlossomSnapshot, rc: EntityRenderContext): void {
  const time = rc.animationTime;
  const regrowsAt = snapshot.regrowsAt;

  ctx.save();
  // A shadow on the ground
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 18, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (regrowsAt !== null) {
    // Regrowing: a bud, and the time until it blooms as a filling ring
    const total = MOBAConfig.BLOSSOMS.REGROW;
    const left = Math.max(0, regrowsAt - rc.stateManager.getGameTime());
    const progress = Math.max(0, Math.min(1, 1 - left / total));
    drawLeaves(ctx);
    pixel(ctx, 0, 1, LEAF);
    pixel(ctx, 0, 0, LEAF);
    disc(ctx, 0, -1, 1, PETAL_DARK);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -2, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 143, 208, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -2, 20, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // In bloom: a soft pink light, then the flower
  const pulse = 0.5 + 0.5 * Math.sin(time * 3);
  const glow = ctx.createRadialGradient(0, -4, 2, 0, -4, 34);
  glow.addColorStop(0, `rgba(255, 170, 225, ${0.35 + 0.2 * pulse})`);
  glow.addColorStop(1, "rgba(255, 170, 225, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -4, 34, 0, Math.PI * 2);
  ctx.fill();

  drawLeaves(ctx);
  const breathe = Math.sin(time * 2.2) > 0.2 ? 1 : 0;
  // Five petals round the heart
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i / 5) * Math.PI * 2 + time * 0.15;
    const reach = 3 + breathe;
    const px = Math.cos(angle) * reach;
    const py = -2 + Math.sin(angle) * reach * 0.8;
    disc(ctx, px, py, 2, PETAL);
    pixel(ctx, px - 1, py - 1, PETAL_LIGHT);
    pixel(ctx, px + Math.cos(angle) * 2, py + Math.sin(angle) * 2, PETAL_DARK);
  }
  disc(ctx, 0, -2, 1, HEART);
  pixel(ctx, 0, -2, "#ffffff");

  // Motes of light drifting up
  for (let i = 0; i < 3; i++) {
    const phase = (time * 0.6 + i / 3) % 1;
    const x = Math.sin(i * 2.4 + time) * 4;
    const y = -4 - phase * 10;
    ctx.globalAlpha = 1 - phase;
    pixel(ctx, x, y, PETAL_LIGHT);
  }
  ctx.restore();
}
