/**
 * Zhak'rul: a giant crimson-black scorpion with a glowing green stinger,
 * drawn from generated sprite strips (scripts/generate-sprites.ts), wide
 * and low like Fenris. While he travels underground (Burrowed Ambush) he's
 * a mound of earth moving under the ground, and when he bursts out
 * (zhakrul_e_burst) his E strip plays. Without the strips he's the default
 * circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const ZHAKRUL_STRIPS = generatedStrips("zhakrul", {
  q: "zhakrul_q",
  w: "zhakrul_w",
  e: "zhakrul_e_burst",
  r: "zhakrul_r",
}, {
  // The frames where the blow lands: the pincer, the scissors snap, the gas,
  // the burst out of the sand, the sting
  attackBlow: 4,
  abilityBlows: { zhakrul_q: 6, zhakrul_w: 4, zhakrul_e_burst: 4, zhakrul_r: 3 },
});

/** World units per sprite pixel: chunky pixels, and a wide body */
const ZHAKRUL_SCALE = 1.35;

const EARTH = "#6a4a2a";
const EARTH_DARK = "#3e2a16";
const EARTH_LIGHT = "#a07a4a";

/** A mound of earth heaving as he moves under it, pebbles tossed off it */
function drawBurrow(ctx: CanvasRenderingContext2D, time: number): void {
  const heave = 1 + 0.12 * Math.sin(time * 22);
  ctx.save();
  ctx.translate(0, 14);
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 34, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = EARTH_DARK;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 12 * heave, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = EARTH;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 9 * heave, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = EARTH_LIGHT;
  for (let i = 0; i < 5; i++) {
    const phase = (time * 3 + i / 5) % 1;
    const x = Math.sin(i * 2.3) * 22 * (0.4 + phase);
    const y = -6 - Math.sin(phase * Math.PI) * 16;
    ctx.fillRect(Math.round(x), Math.round(y), 3, 3);
  }
  ctx.restore();
}

const HIDDEN = { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true };

export const zhakrulRenderer: ChampionRendererEntry = {
  images: stripImages(ZHAKRUL_STRIPS),
  createBodyRenderer: (rc) => {
    const body = createStripBodyRenderer(ZHAKRUL_STRIPS, ZHAKRUL_SCALE, rc);
    return {
      getFeet: body.getFeet,
      render(ctx, snapshot, state) {
        if (snapshot.isDashing && snapshot.dashAbilityId === "zhakrul_e") {
          drawBurrow(ctx, rc.animationTime);
          return true;
        }
        return body.render(ctx, snapshot, state);
      },
    };
  },
  projectiles: {},
  markVisuals: {
    // On whoever he poisoned, with its doses (ancient shows as the aura, src/gpu/fx/championAuras.ts)
    zhakrul_venom: {
      icon: "☠",
      bgColor: "rgba(60, 130, 40, 0.85)",
      borderColor: "#8be04a",
      iconColor: "#ffffff",
      showTimer: true,
      showStacks: true,
      isDebuff: true,
    },
    zhakrul_ancient_venom: HIDDEN,
  },
};
