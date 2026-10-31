/**
 * Ward renderer (EntityType.WARD): the ward's pixel-art totem
 * (scripts/generate-props.ts) on its shadow, its eye glowing in the ward's
 * color, a bar of the time it has left for its team and pips for the hits
 * it can take once damaged or seen by enemies. Vile's traps are synced as
 * wards too (with a triggerRadius and no wardType); they get their own look.
 */

import type { EntityRenderContext } from "@/render/entities/types";
import { imageCache } from "@/render/entities/shared";

/** Each ward type's sprite */
const WARD_SPRITES: Record<string, string> = {
  stealth: "/assets/props/ward_stealth.png",
  control: "/assets/props/ward_control.png",
  farsight: "/assets/props/ward_stealth.png",
};

/** Ward sprites to preload */
export const WARD_IMAGES = [...new Set(Object.values(WARD_SPRITES))];

/** World units per sprite pixel (a 48-pixel sprite stands about 34 tall, knee-high to a champion) */
const WARD_SCALE = 0.7;

/** Each ward type's eye glow, and how far down the sprite the eye is (0 top, 1 bottom) */
const WARD_GLOW: Record<string, { color: string; eye: number }> = {
  stealth: { color: "212, 255, 122", eye: 0.32 },
  control: { color: "255, 95, 162", eye: 0.22 },
  farsight: { color: "122, 200, 255", eye: 0.32 },
};

/**
 * Render a ward.
 */
export function renderWard(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  side: number,
  rc: EntityRenderContext,
): void {
  if (snapshot.triggerRadius !== undefined && !snapshot.wardType) {
    renderTrap(ctx, snapshot, side, rc);
    return;
  }

  const wardType: string = snapshot.wardType || "stealth";
  const isOwn = side === rc.localSide;
  const glow = WARD_GLOW[wardType] ?? WARD_GLOW.stealth;
  const image = imageCache.get(WARD_SPRITES[wardType] ?? WARD_SPRITES.stealth);
  const width = (image?.naturalWidth || 48) * WARD_SCALE;
  const height = (image?.naturalHeight || 48) * WARD_SCALE;
  const top = 4 - height;

  ctx.save();

  // Shadow, and for an enemy ward a red ring at its feet
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 2, width * 0.32, width * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!isOwn) {
    ctx.strokeStyle = "rgba(231, 76, 60, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 2, width * 0.42, width * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (image?.complete && image.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, -width / 2, top, width, height);
  }

  // The eye glows, pulsing slowly
  const pulse = 0.75 + Math.sin(rc.animationTime * 3 + (snapshot.placedAt ?? 0)) * 0.25;
  const eyeY = top + height * glow.eye;
  const light = ctx.createRadialGradient(0, eyeY, 0, 0, eyeY, 16);
  light.addColorStop(0, `rgba(${glow.color}, ${0.55 * pulse})`);
  light.addColorStop(1, `rgba(${glow.color}, 0)`);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = light;
  ctx.fillRect(-16, eyeY - 16, 32, 32);
  ctx.globalCompositeOperation = "source-over";

  // Time left, for its team
  const barWidth = 20;
  let barY = 6;
  if (isOwn && snapshot.duration > 0 && snapshot.remainingDuration > 0) {
    const left = Math.min(1, snapshot.remainingDuration / snapshot.duration);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(-barWidth / 2 - 0.5, barY - 0.5, barWidth + 1, 3);
    ctx.fillStyle = `rgb(${glow.color})`;
    ctx.fillRect(-barWidth / 2, barY, barWidth * left, 2);
    barY += 4;
  }

  // Hits it can take: once damaged, or always for enemies
  const maxHealth: number = snapshot.maxHealth ?? 0;
  if (maxHealth > 0 && (!isOwn || snapshot.health < maxHealth)) {
    const pip = 4;
    const gap = 1.5;
    const total = maxHealth * pip + (maxHealth - 1) * gap;
    for (let i = 0; i < maxHealth; i++) {
      ctx.fillStyle = i < snapshot.health ? (isOwn ? "#5dade2" : "#e74c3c") : "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(-total / 2 + i * (pip + gap), barY, pip, 2);
    }
  }

  ctx.restore();
}

/**
 * Where a ward about to be placed would go (world coordinates): the area it
 * will see, dashed, and the ward dimmed; all of it grey when there's no ward
 * charge to place it with.
 */
export function renderWardPreview(
  ctx: CanvasRenderingContext2D,
  wardType: string,
  x: number,
  y: number,
  sightRange: number,
  canPlace: boolean,
): void {
  const color = canPlace ? (WARD_GLOW[wardType] ?? WARD_GLOW.stealth).color : "160, 160, 160";
  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.arc(0, 0, sightRange, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${color}, 0.06)`;
  ctx.fill();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = `rgba(${color}, 0.5)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  const image = imageCache.get(WARD_SPRITES[wardType] ?? WARD_SPRITES.stealth);
  if (image?.complete && image.naturalWidth > 0) {
    const width = image.naturalWidth * WARD_SCALE;
    const height = image.naturalHeight * WARD_SCALE;
    ctx.globalAlpha = canPlace ? 0.6 : 0.3;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, -width / 2, 4 - height, width, height);
  }
  ctx.restore();
}

/**
 * Render a trap: a dark bramble of thorns. Its team sees the trigger radius;
 * a stealthed trap is drawn faint for its team (enemies don't receive it).
 */
function renderTrap(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  side: number,
  rc: EntityRenderContext,
): void {
  const isOwn = side === rc.localSide;
  const pulse = 0.85 + Math.sin(rc.animationTime * 4) * 0.15;

  ctx.save();
  ctx.globalAlpha = snapshot.isStealthed ? 0.55 : 1;

  if (isOwn && snapshot.triggerRadius > 0) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(155, 89, 182, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, snapshot.triggerRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Thorns
  ctx.strokeStyle = "#4a235a";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.2;
    const length = (i % 2 === 0 ? 11 : 8) * pulse;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 3, Math.sin(angle) * 3);
    ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
    ctx.stroke();
  }

  // Core
  const core = ctx.createRadialGradient(0, 0, 1, 0, 0, 7);
  core.addColorStop(0, "#c39bd3");
  core.addColorStop(1, "#5b2c6f");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
