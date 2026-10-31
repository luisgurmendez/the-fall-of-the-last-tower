/**
 * Inhibitor renderer (EntityType.INHIBITOR): a crystal ring floating over a
 * carved pedestal (scripts/generate-props.ts, drawn in blue and recolored
 * for red), glowing in its team's color. Destroyed, it stays as its pedestal
 * with crystal shards and the time left until it rebuilds.
 */

import type { InhibitorSnapshot } from "@siege/shared";
import type { EntityRenderContext } from "@/render/entities/types";
import { drawBuildingSprite, imageCache, renderProtectionDome } from "@/render/entities/shared";
import { getRedVariant } from "@/render/entities/teamColors";
import { renderHealthBar, HEALTH_BAR_COLORS } from "@/render/overlays/healthBars";
import { getTrailHealth } from "@/render/overlays/damageTrail";
import RenderUtils from "@/render/utils";

const SPRITE = {
  SRC: "/assets/props/inhibitor.png",
  SIZE: 64,
  /** World units per sprite pixel: about 80 across, a bit wider than a champion */
  SCALE: 1.6,
  /** Sprite rows: where the art starts, and the pedestal's top and middle */
  ART_TOP: 4,
  PEDESTAL_TOP: 44,
  PEDESTAL_Y: 52,
};

/** Inhibitor sprites to preload */
export const INHIBITOR_IMAGES = [SPRITE.SRC];

/** Each team's crystal glow */
const GLOW = { blue: "110, 190, 255", red: "255, 110, 90" };

/** Where the shards of a destroyed crystal lie, around the pedestal's middle (sprite pixels) */
const SHARDS = [
  { x: -14, y: -2, size: 3 },
  { x: -6, y: 3, size: 2 },
  { x: 4, y: -4, size: 3 },
  { x: 12, y: 2, size: 2 },
  { x: 17, y: -3, size: 2 },
  { x: -19, y: 1, size: 2 },
];

/**
 * Render an inhibitor.
 */
export function renderInhibitor(
  ctx: CanvasRenderingContext2D,
  snapshot: InhibitorSnapshot,
  side: number,
  rc: EntityRenderContext,
): void {
  const blue = imageCache.get(SPRITE.SRC);
  if (!blue || !blue.complete || blue.naturalWidth === 0) return;
  const image = side === 0 ? blue : getRedVariant(blue);
  if (!image) return;
  const glow = side === 0 ? GLOW.blue : GLOW.red;
  // The pedestal's middle sits on the position
  const baseOffset = (SPRITE.SIZE - SPRITE.PEDESTAL_Y) * SPRITE.SCALE;

  if (snapshot.isDestroyed) {
    renderRubble(ctx, image, glow, baseOffset);
    renderRebuildTime(ctx, snapshot, rc);
    return;
  }

  // The crystal's light on the ground, breathing slowly
  const pulse = 0.5 + Math.sin(rc.animationTime * 2.2) * 0.15;
  const light = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
  light.addColorStop(0, `rgba(${glow}, ${0.35 * pulse})`);
  light.addColorStop(1, `rgba(${glow}, 0)`);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(0, 0, 60, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The ring bobs a little over the pedestal
  ctx.save();
  ctx.translate(0, Math.sin(rc.animationTime * 1.6) * 1.5);
  drawBuildingSprite(ctx, image, SPRITE.SIZE, SPRITE.SIZE, SPRITE.SCALE, baseOffset, rc.getOutlineColor(snapshot.entityId));
  ctx.restore();

  if (snapshot.isProtected) {
    renderProtectionDome(ctx, 58, -30, rc.animationTime);
  }

  const barY = baseOffset - (SPRITE.SIZE - SPRITE.ART_TOP) * SPRITE.SCALE - 12;
  renderHealthBar(
    ctx,
    snapshot.health,
    snapshot.maxHealth,
    56,
    barY,
    side === rc.localSide ? HEALTH_BAR_COLORS.ALLY : HEALTH_BAR_COLORS.ENEMY,
    undefined,
    { trailHealth: getTrailHealth(snapshot.entityId, snapshot.health) },
  );
}

/** The pedestal alone, darkened, with the crystal's shards on it */
function renderRubble(ctx: CanvasRenderingContext2D, image: HTMLImageElement, glow: string, baseOffset: number): void {
  const { SIZE, SCALE, PEDESTAL_TOP } = SPRITE;
  const rows = SIZE - PEDESTAL_TOP;
  ctx.save();
  ctx.filter = "brightness(0.55) saturate(0.4)";
  ctx.drawImage(image, 0, PEDESTAL_TOP, SIZE, rows, (-SIZE / 2) * SCALE, baseOffset - rows * SCALE, SIZE * SCALE, rows * SCALE);
  ctx.filter = "none";
  for (const shard of SHARDS) {
    const x = shard.x * SCALE;
    const y = shard.y * SCALE - 4;
    const r = shard.size * SCALE;
    ctx.fillStyle = `rgba(${glow}, 0.75)`;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.6, y);
    ctx.lineTo(x, y + r * 0.7);
    ctx.lineTo(x - r * 0.6, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Seconds until a destroyed inhibitor rebuilds, as m:ss over its pedestal */
function renderRebuildTime(ctx: CanvasRenderingContext2D, snapshot: InhibitorSnapshot, rc: EntityRenderContext): void {
  if (snapshot.respawnAt == null) return;
  const left = Math.max(0, Math.ceil(snapshot.respawnAt - rc.stateManager.getGameTime()));
  const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  RenderUtils.renderBitmapText(ctx, text, 0, -46, { color: "#d8d8e8", size: 18, centered: true, shadow: true });
}
