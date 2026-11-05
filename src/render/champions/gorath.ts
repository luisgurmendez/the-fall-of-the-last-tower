/**
 * Gorath: a stone guardian drawn from generated sprite strips (idle, walk,
 * attack and an animation per ability; scripts/generate-sprites.ts) in four
 * directions, and the icons for Fortify's buffs. Without the strips he's the
 * default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const GORATH_STRIPS = generatedStrips("gorath", {
  q: "gorath_slam",
  w: "gorath_fortify",
  e: "gorath_taunt",
  r: "gorath_earthquake",
}, {
  // The frames where the blow lands: the hammer hits the ground (slam and quake: the strips
  // of 2026-11-04), the roar's head thrown back
  attackBlow: 7,
  abilityBlows: { gorath_slam: 7, gorath_taunt: 3, gorath_earthquake: 7 },
  // Facing down and up the screen (drawn 2026-11-04): the hammer lands a frame or two sooner
  facing: {
    south: { attackBlow: 6, abilityBlows: { gorath_slam: 6 } },
    north: { attackBlow: 8, abilityBlows: { gorath_slam: 5, gorath_earthquake: 5 } },
  },
}, ["south", "north"]);

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
