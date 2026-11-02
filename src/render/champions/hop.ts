/**
 * Hop-To-Eat: a fluffy white rabbit sitting up on its hind legs, drawn from
 * generated sprite strips (scripts/generate-sprites.ts) in four directions,
 * on a small canvas with little detail like Urûk's; small, but not so small
 * it's hard to click. Without the strips it's the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const HOP_STRIPS = generatedStrips("hop", {
  q: "hop_q",
  w: "hop_w",
  e: "hop_e",
  r: "hop_r",
}, {
  // The frames where the blow lands: the kick, the bite, the munch, the top of
  // the hop (it plays while the dash flies), the flying kick
  attackBlow: 5,
  abilityBlows: { hop_q: 5, hop_w: 4, hop_e: 4, hop_r: 4 },
}, ["south", "north"]);

/** World units per sprite pixel: chunky pixels, and a small body */
const HOP_SCALE = 1.2;

const HIDDEN = { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true };

export const hopRenderer: ChampionRendererEntry = {
  images: stripImages(HOP_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(HOP_STRIPS, HOP_SCALE, rc),
  projectiles: {},
  markVisuals: {
    hop_sugar_rush: HIDDEN,
  },
};
