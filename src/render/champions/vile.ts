/**
 * Vile: a hooded archer drawn from generated sprite strips (idle, walk,
 * attack, and Q/E/R animations; scripts/generate-sprites.ts) in four
 * directions, and the dark soul auto-attack projectile. Without the strips
 * he's the default circle. Vile's traps are synced as wards
 * (src/render/entities/ward.ts).
 */

import type { EntityRenderContext } from "@/render/entities/types";
import type { ChampionBodyRenderer, ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const VILE_STRIPS = generatedStrips("vile", {
  q: "vile_black_arrows",
  w: "vile_veil_of_darkness",
  e: "vile_roots_of_vilix",
  r: "vile_restoration_of_vilix",
}, {
  // The frames where the blow lands: the arrow leaves the bow, the charged arrow, wrapped in his cloak, the rune set,
  // the transformation (arms widest)
  attackBlow: 7,
  abilityBlows: { vile_black_arrows: 6, vile_veil_of_darkness: 4, vile_roots_of_vilix: 4, vile_restoration_of_vilix: 4 },
  // Facing up the screen (drawn 2026-11-04): the shot ends on the full draw
  facing: { north: { attackBlow: 6 } },
}, ["south", "north"]);

/** World units per sprite pixel: about 55 tall, like Vex */
const VILE_SCALE = 0.84;
/** During his R (the vile_transformed marker) he's drawn this much bigger, glowing violet */
const TRANSFORMED_SCALE = 1.3;

/**
 * Vile's body: his strips, swelling and glowing violet while transformed.
 */
function createVileBody(rc: EntityRenderContext): ChampionBodyRenderer {
  const strips = createStripBodyRenderer(VILE_STRIPS, VILE_SCALE, rc);
  return {
    getFeet: () => strips.getFeet?.() ?? null,
    render(ctx, snapshot, state) {
      const transformed = (snapshot.activeEffects as Array<{ definitionId: string }> | undefined)
        ?.some((effect) => effect.definitionId === "vile_transformed");
      if (!transformed) return strips.render(ctx, snapshot, state);

      ctx.save();
      ctx.scale(TRANSFORMED_SCALE, TRANSFORMED_SCALE);
      const pulse = 0.5 + 0.5 * Math.sin(rc.animationTime * 5);
      ctx.filter = `saturate(1.3) drop-shadow(0 0 ${3 + pulse * 3}px #a855f7)`;
      const drawn = strips.render(ctx, snapshot, state);
      ctx.restore();
      return drawn;
    },
  };
}

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
  createBodyRenderer: createVileBody,
  projectiles: {
    vile_auto: renderVileAutoProjectile,
  },
  markVisuals: {
    // Just a rule (no second trap for a while), nothing to show
    vile_trap_caught: { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true },
    vile_transformed: {
      icon: "V",
      bgColor: "rgba(126, 34, 206, 0.85)",
      borderColor: "#a855f7",
      iconColor: "#ffffff",
      showTimer: true,
      isBuff: true,
    },
  },
};
