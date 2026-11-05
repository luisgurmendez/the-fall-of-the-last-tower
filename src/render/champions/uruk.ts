/**
 * Urûk: a silver dragonborn with a spear, drawn from generated sprite strips
 * (scripts/generate-sprites.ts) in four directions. His art is made on a
 * smaller canvas with less detail, so it's drawn bigger: chunkier pixels,
 * closer to the ground's. Without the strips he's the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const URUK_STRIPS = generatedStrips("uruk", {
  q: "uruk_q",
  w: "uruk_w",
  e: "uruk_e",
  r: "uruk_r",
}, {
  // The frames where the blow lands: the jab, the lunge, the tip lighting up, the scales, the spear driven down
  attackBlow: 7,
  abilityBlows: { uruk_q: 6, uruk_w: 6, uruk_e: 4, uruk_r: 5 },
}, ["south", "north"]);

/** World units per sprite pixel: his 88-pixel frames as tall as the others' 132 at 0.84 */
const URUK_SCALE = 1.26;

export const urukRenderer: ChampionRendererEntry = {
  images: stripImages(URUK_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(URUK_STRIPS, URUK_SCALE, rc),
  projectiles: {},
  markVisuals: {},
};
