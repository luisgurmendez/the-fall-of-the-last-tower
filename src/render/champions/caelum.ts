/**
 * Caelum: an old druid with a staff, drawn from generated sprite strips
 * (scripts/generate-sprites.ts) in four directions, on a small canvas with
 * little detail like Urûk's. His light is GPU effects (his VFX,
 * src/gpu/fx/projectiles.ts). Without the strips he's the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const CAELUM_STRIPS = generatedStrips("caelum", {
  q: "caelum_q",
  w: "caelum_w",
  e: "caelum_e",
  r: "caelum_r",
}, {
  // The frames where the blow lands: the bolt, the ray (the staff thrust forward), the blessing, the staff slammed down, the light given
  attackBlow: 5,
  abilityBlows: { caelum_q: 2, caelum_w: 4, caelum_e: 6, caelum_r: 6 },
}, ["south", "north"]);

/** World units per sprite pixel, as Urûk's: chunky pixels */
const CAELUM_SCALE = 1.32;

const HIDDEN = { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true };

export const caelumRenderer: ChampionRendererEntry = {
  images: stripImages(CAELUM_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(CAELUM_STRIPS, CAELUM_SCALE, rc),
  projectiles: {},
  markVisuals: {
    // His blessing shows on the ally as a glow (championAuras), not a mark
    caelum_embolden: HIDDEN,
    caelum_embolden_power: HIDDEN,
  },
};
