/**
 * Elora: a huntress with a longbow, drawn from generated sprite strips
 * (scripts/generate-sprites.ts) in four directions, on a small canvas with
 * little detail like Urûk's. Her arrows (plain, poisoned, the weak point's)
 * are GPU projectiles (src/gpu/fx/projectiles.ts). Without the strips she's
 * the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const ELORA_STRIPS = generatedStrips("elora", {
  q: "elora_q",
  w: "elora_w",
  e: "elora_e",
  r: "elora_r",
}, {
  // The frames where the blow lands: the arrow loosed, the vial, the heavy arrow loosed, the roll, the volley
  attackBlow: 8,
  abilityBlows: { elora_q: 6, elora_w: 8, elora_e: 5, elora_r: 6 },
  // Facing down the screen (drawn 2026-11-04): the arrow is loosed a frame sooner
  facing: { south: { attackBlow: 7 } },
}, ["south", "north"]);

/** World units per sprite pixel, as Urûk's: chunky pixels */
const ELORA_SCALE = 1.32;

const HIDDEN = { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true };

export const eloraRenderer: ChampionRendererEntry = {
  images: stripImages(ELORA_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(ELORA_STRIPS, ELORA_SCALE, rc),
  projectiles: {},
  markVisuals: {
    // On whoever her poisoned arrow hit
    elora_venom: {
      icon: "☠",
      bgColor: "rgba(70, 150, 60, 0.85)",
      borderColor: "#a8e070",
      iconColor: "#ffffff",
      showTimer: true,
      isDebuff: true,
    },
    elora_poison_arrow: HIDDEN,
    elora_dexterity: HIDDEN,
  },
};
