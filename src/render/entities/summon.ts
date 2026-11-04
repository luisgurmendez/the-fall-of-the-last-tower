/**
 * Summons (docs/architecture/summons.md): Nocthar's Hollows and colossus,
 * drawn from their generated strips (scripts/generate-sprites.ts, in
 * /assets/sprites/summons/<type>/) like a champion's body: idle, walk,
 * attack, the colossus's Bone Volley and Trample, facing south and north
 * too. A summon is drawn at its snapshot's scale (a big Hollow, a colossus
 * that absorbed many), climbs out of the ground while it's rising (the
 * sprite cut off at its feet), and shows a ghost over its head while feared.
 * Without the art, a plain silhouette.
 */

import type { EntityRenderContext, EntityRenderState } from "@/render/entities/types";
import { drawGroundShadow } from "@/render/entities/shared";
import { createStripBodyRenderer, stripImages, type ChampionStrips } from "@/render/champions/stripBody";
import type { ChampionBodyRenderer } from "@/render/champions/types";
import { HEALTH_BAR_COLORS, renderHealthBar } from "@/render/overlays/healthBars";
import { getTrailHealth } from "@/render/overlays/damageTrail";
import { drawFear } from "@/render/overlays/crowdControl";
import { NOCTHAR_KIT, type SummonType } from "@siege/shared";

interface SummonLook {
  strips: ChampionStrips;
  /** World units per sprite pixel at scale 1 */
  scale: number;
  /** Its health bar at scale 1: width, and how far above its position */
  bar: { width: number; y: number; height: number };
  /** Seconds it takes to climb out of the ground */
  riseTime: number;
  /** The silhouette without art */
  fallback: { radius: number; color: string };
}

function summonStrips(type: SummonType, abilities: Record<string, string> = {}): ChampionStrips {
  const dir = `/assets/sprites/summons/${type}`;
  return {
    idle: `${dir}/idle.png`,
    walk: `${dir}/walk.png`,
    attack: `${dir}/attack.png`,
    abilities: Object.fromEntries(Object.entries(abilities).map(([abilityId, strip]) => [abilityId, `${dir}/${strip}.png`])),
    timing: {},
    directions: ["south", "north"],
  };
}

const LOOKS: Record<SummonType, SummonLook> = {
  hollow: {
    strips: summonStrips("hollow"),
    scale: 0.69,
    bar: { width: 22, y: -26, height: 3 },
    riseTime: NOCTHAR_KIT.riseTime,
    fallback: { radius: 10, color: "#d9d2bf" },
  },
  colossus: {
    // Bone Volley and Trample: its events (ABILITY_CAST from it) play its strips
    strips: summonStrips("colossus", { nocthar_colossus_w_throw: "w", nocthar_colossus_e_trample: "e" }),
    scale: 1.05,
    bar: { width: 48, y: -70, height: 5 },
    riseTime: 0.4,
    fallback: { radius: 24, color: "#b9b29c" },
  },
};

/** Every summon strip, in every direction, to preload */
export const SUMMON_IMAGES = Object.values(LOOKS).flatMap((look) => stripImages(look.strips));

export function isSummonType(minionType: string | undefined): minionType is SummonType {
  return minionType === "hollow" || minionType === "colossus";
}

/** Body renderers by type and drawn scale (a big Hollow or a grown colossus draws bigger) */
const bodies = new Map<string, ChampionBodyRenderer>();

function bodyFor(type: SummonType, scale: number, rc: EntityRenderContext): ChampionBodyRenderer {
  const key = `${type}:${scale.toFixed(2)}`;
  let body = bodies.get(key);
  if (!body) {
    body = createStripBodyRenderer(LOOKS[type].strips, LOOKS[type].scale * scale, rc);
    bodies.set(key, body);
  }
  return body;
}

/**
 * Draw a summon at the canvas origin (its position), with its health bar.
 */
export function renderSummon(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  side: number,
  state: EntityRenderState,
  rc: EntityRenderContext,
): void {
  const type = snapshot.minionType as SummonType;
  const look = LOOKS[type];
  const scale = snapshot.scale ?? 1;
  const body = bodyFor(type, scale, rc);
  const feet = body.getFeet?.() ?? null;

  // Climbing out of the ground: the sprite rises through its feet line
  const rising = typeof snapshot.rising === "number" ? Math.min(1, snapshot.rising / look.riseTime) : 0;
  const top = body.getTop?.() ?? -look.fallback.radius * 2 * scale;
  const feetY = feet?.y ?? look.fallback.radius * scale;
  const height = feetY - top;

  ctx.save();
  if (rising > 0) {
    ctx.beginPath();
    ctx.rect(-200, -400, 400, 400 + feetY);
    ctx.clip();
    ctx.translate(0, rising * height);
  } else if (feet) {
    drawGroundShadow(ctx, feet.y, feet.halfWidth);
  }
  if (!body.render(ctx, snapshot, state)) drawSilhouette(ctx, look, scale, state);
  ctx.restore();

  if (rising > 0) return;

  if (snapshot.isFeared) drawFear(ctx, top, rc.animationTime);

  if (snapshot.health !== undefined && snapshot.maxHealth !== undefined) {
    renderHealthBar(
      ctx,
      snapshot.health,
      snapshot.maxHealth,
      look.bar.width * Math.sqrt(scale),
      Math.min(look.bar.y * scale, top - 6),
      side === rc.localSide ? HEALTH_BAR_COLORS.ALLY : HEALTH_BAR_COLORS.ENEMY,
      undefined,
      { trailHealth: getTrailHealth(snapshot.entityId, snapshot.health), height: look.bar.height },
    );
  }
}

/** Without its art: a hunched bony shape, eyes toward where it faces */
function drawSilhouette(ctx: CanvasRenderingContext2D, look: SummonLook, scale: number, state: EntityRenderState): void {
  const r = look.fallback.radius * scale;
  ctx.fillStyle = look.fallback.color;
  ctx.strokeStyle = "#1b1712";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.6, r * 0.8, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const eye = state.facingRight ? 1 : -1;
  ctx.fillStyle = "#bfe3d6";
  ctx.fillRect(eye * r * 0.15 - r * 0.25, -r * 0.95, r * 0.2, r * 0.2);
  ctx.fillRect(eye * r * 0.15 + r * 0.1, -r * 0.95, r * 0.2, r * 0.2);
}
