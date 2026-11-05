/**
 * Calamitus: a golem of black rock and magma, drawn from generated sprite
 * strips (scripts/generate-sprites.ts) in four directions, on a small canvas
 * with little detail like Urûk's, the biggest of them. His lava is zones
 * (src/gpu/fx/zones.ts). Without the strips he's the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const CALAMITUS_STRIPS = generatedStrips("calamitus", {
  q: "calamitus_q",
  w: "calamitus_w",
  e: "calamitus_e",
  r: "calamitus_r",
}, {
  // The frames where the blow lands: the punch, the slam, the wave, the hardening, the eruption
  attackBlow: 7,
  abilityBlows: { calamitus_q: 4, calamitus_w: 2, calamitus_e: 7, calamitus_r: 7 },
}, ["south", "north"]);

/** World units per sprite pixel: chunky pixels, and the biggest body */
const CALAMITUS_SCALE = 1.5;

const HIDDEN = { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true };

export const calamitusRenderer: ChampionRendererEntry = {
  images: stripImages(CALAMITUS_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(CALAMITUS_STRIPS, CALAMITUS_SCALE, rc),
  projectiles: {},
  markVisuals: {
    calamitus_lavaborn: HIDDEN,
  },
};
