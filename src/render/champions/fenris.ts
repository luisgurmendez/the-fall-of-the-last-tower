/**
 * Fenris: a hulking werewolf, drawn from generated sprite strips
 * (scripts/generate-sprites.ts) in four directions, on a small canvas with
 * little detail like Urûk's, a head taller than most. Feral and in his
 * bloodthirst he burns red (src/gpu/fx/championAuras.ts). Without the strips
 * he's the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const FENRIS_STRIPS = generatedStrips("fenris", {
  q: "fenris_q",
  w: "fenris_w",
  e: "fenris_e",
  r: "fenris_r",
}, {
  // The frames where the blow lands: the claw, the bite, the rake, the pounce, the howl
  attackBlow: 7,
  abilityBlows: { fenris_q: 6, fenris_w: 5, fenris_e: 7, fenris_r: 4 },
}, ["south", "north"]);

/** World units per sprite pixel: chunky pixels, and a big wolf */
const FENRIS_SCALE = 1.45;

const HIDDEN = { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true };

export const fenrisRenderer: ChampionRendererEntry = {
  images: stripImages(FENRIS_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(FENRIS_STRIPS, FENRIS_SCALE, rc),
  projectiles: {},
  markVisuals: {
    // Enemies should know he's at his most dangerous
    fenris_feral: {
      icon: "!",
      bgColor: "rgba(200, 30, 30, 0.85)",
      borderColor: "#ff7070",
      iconColor: "#ffffff",
      showTimer: false,
      isBuff: true,
    },
    fenris_bloodthirst: HIDDEN,
  },
};
