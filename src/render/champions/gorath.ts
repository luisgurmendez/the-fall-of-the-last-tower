/**
 * Gorath: a stone guardian drawn from generated sprite strips (idle, walk,
 * attack and an animation per ability; scripts/generate-sprites.ts), and the
 * icons for Fortify's buffs. Without the strips he's the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const GORATH_STRIPS = generatedStrips("gorath", {
  q: "gorath_slam",
  w: "gorath_fortify",
  e: "gorath_taunt",
  r: "gorath_earthquake",
});

/** World units per sprite pixel: a little bigger than the others, he's the tank */
const GORATH_SCALE = 0.88;

/**
 * Gorath renderer entry.
 */
export const gorathRenderer: ChampionRendererEntry = {
  images: stripImages(GORATH_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(GORATH_STRIPS, GORATH_SCALE, rc),
  projectiles: {},
  markVisuals: {
    gorath_fortify_buff: {
      icon: "S",
      bgColor: "rgba(139, 115, 85, 0.8)",
      borderColor: "#8b7355",
      iconColor: "#ffffff",
      showTimer: true,
      isBuff: true,
    },
    gorath_fortify_mr_buff: {
      icon: "S",
      bgColor: "rgba(139, 92, 246, 0.8)",
      borderColor: "#8b5cf6",
      iconColor: "#ffffff",
      showTimer: true,
      isBuff: true,
    },
  },
};
