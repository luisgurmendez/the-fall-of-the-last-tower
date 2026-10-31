/**
 * Vex: a ninja drawn from generated sprite strips (idle, walk, attack and an
 * animation per ability; scripts/generate-sprites.ts), see-through while
 * stealthed, with violet sparks in Ninja Mode and afterimages along a
 * Shadow Step; the shuriken projectile; and the icons for Vex's marks.
 */

import type { EntityRenderContext } from "@/render/entities/types";
import type { ChampionBodyRenderer, ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const VEX_STRIPS = generatedStrips(
  "vex",
  { q: "vex_shuriken", w: "vex_shroud", e: "vex_dash", r: "vex_ninja_mode" },
  // The Shadow Step strip's blur is near its end
  { vex_dash: 0.8 },
);

/** World units per sprite pixel: about 55 tall, like the others */
const VEX_SCALE = 0.75;
/** How see-through Vex is while stealthed (only allies see Vex then) */
const STEALTH_ALPHA = 0.45;
/** A Shadow Step leaves an afterimage this often (ms), fading by this much per frame */
const AFTERIMAGE_INTERVAL = 50;
const AFTERIMAGE_FADE = 0.04;

interface Afterimage {
  x: number;
  y: number;
  alpha: number;
}

/**
 * Vex's body: the strips, plus stealth, Ninja Mode and Shadow Step effects.
 */
function createVexBody(rc: EntityRenderContext): ChampionBodyRenderer {
  const strips = createStripBodyRenderer(VEX_STRIPS, VEX_SCALE, rc);
  const afterimages = new Map<string, Afterimage[]>();
  const lastAfterimageAt = new Map<string, number>();

  return {
    getFeet: () => strips.getFeet?.() ?? null,
    render(ctx, snapshot, state) {
      const entityId = snapshot.entityId;
      const effects = (snapshot.activeEffects ?? []) as Array<{ definitionId: string }>;
      const stealthed = effects.some((effect) => effect.definitionId === "vex_stealth");
      const ninjaMode = effects.some((effect) => effect.definitionId === "vex_ninja_mode");

      // Shadow Step: leave afterimages along the way, drawn behind Vex
      const trail = afterimages.get(entityId) ?? [];
      if (snapshot.isDashing && snapshot.dashAbilityId === "vex_dash") {
        const now = performance.now();
        if (now - (lastAfterimageAt.get(entityId) ?? 0) > AFTERIMAGE_INTERVAL) {
          trail.push({ x: snapshot.x, y: snapshot.y, alpha: 0.6 });
          lastAfterimageAt.set(entityId, now);
        }
      }
      for (const afterimage of trail) {
        ctx.save();
        ctx.translate(afterimage.x - snapshot.x, afterimage.y - snapshot.y);
        ctx.globalAlpha *= afterimage.alpha;
        ctx.filter = "brightness(0.7) sepia(1) hue-rotate(220deg) saturate(2.5)";
        strips.render(ctx, snapshot, state);
        ctx.restore();
        afterimage.alpha -= AFTERIMAGE_FADE;
      }
      afterimages.set(entityId, trail.filter((afterimage) => afterimage.alpha > 0));

      if (ninjaMode) drawNinjaModeAura(ctx, rc.animationTime);

      ctx.save();
      if (stealthed) ctx.globalAlpha *= STEALTH_ALPHA;
      const drawn = strips.render(ctx, snapshot, state);
      ctx.restore();
      return drawn;
    },
  };
}

/**
 * Violet sparks orbiting Vex in Ninja Mode, over a faint glow.
 */
function drawNinjaModeAura(ctx: CanvasRenderingContext2D, time: number): void {
  const particleCount = 6;
  const orbitRadius = 26;

  ctx.save();
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2 + time * 3;
    const x = Math.cos(angle) * orbitRadius;
    const y = Math.sin(angle) * orbitRadius * 0.5; // Elliptical orbit

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 4);
    gradient.addColorStop(0, "rgba(153, 51, 255, 0.9)");
    gradient.addColorStop(0.5, "rgba(136, 68, 204, 0.6)");
    gradient.addColorStop(1, "rgba(68, 34, 102, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, orbitRadius);
  glow.addColorStop(0, "rgba(153, 51, 255, 0.15)");
  glow.addColorStop(0.7, "rgba(136, 68, 204, 0.05)");
  glow.addColorStop(1, "rgba(68, 34, 102, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, orbitRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Vex Shuriken - purple/dark star shape.
 */
function renderShurikenProjectile(
  ctx: CanvasRenderingContext2D,
  snapshot: any,
  angle: number,
): void {
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
}

/**
 * Vex renderer entry.
 */
export const vexRenderer: ChampionRendererEntry = {
  images: stripImages(VEX_STRIPS),
  createBodyRenderer: createVexBody,
  projectiles: {
    vex_shuriken: renderShurikenProjectile,
  },
  markVisuals: {
    vex_mark: {
      icon: "X",
      bgColor: "rgba(155, 89, 182, 0.8)", // Purple
      borderColor: "#9b59b6",
      iconColor: "#ffffff",
      showTimer: true,
      isDebuff: true,
    },
    vex_death_mark: {
      icon: "!",
      bgColor: "rgba(44, 62, 80, 0.9)", // Dark
      borderColor: "#e74c3c", // Red border (danger)
      iconColor: "#e74c3c",
      showTimer: true,
      isDebuff: true,
    },
    vex_stealth: {
      icon: "?",
      bgColor: "rgba(44, 62, 80, 0.8)",
      borderColor: "#2c3e50",
      iconColor: "#ffffff",
      showTimer: true,
      isBuff: true,
    },
  },
};
