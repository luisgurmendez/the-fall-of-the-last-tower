/**
 * Kip: a scrappy kid with a headband, an orange cape and a longbow taller
 * than him, drawn from generated sprite strips (scripts/generate-sprites.ts)
 * in four directions, on a small canvas with little detail like Hop's. His
 * arrows (plain, the one that pops a mark, Target Practice's, Show Them
 * All's) are GPU projectiles (src/gpu/fx/projectiles.ts). On an enemy he
 * marked, a bullseye over its health bar. Without the strips he's the
 * default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const KIP_STRIPS = generatedStrips("kip", {
  q: "kip_q",
  w: "kip_w",
  e: "kip_e",
  r: "kip_r",
}, {
  // The frames where the blow lands: the arrow loosed, the practice arrow
  // loosed, the fist pumped, the landing crouch, the first shot of the volleys
  // (the strips made 2026-11-04 with his bow in every frame)
  attackBlow: 5,
  abilityBlows: { kip_q: 5, kip_w: 3, kip_e: 8, kip_r: 5 },
}, ["south", "north"]);

/** World units per sprite pixel: chunky pixels like Urûk's, a small body under a big bow */
export const KIP_SCALE = 1.26;

const HIDDEN = { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true };

export const kipRenderer: ChampionRendererEntry = {
  images: stripImages(KIP_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(KIP_STRIPS, KIP_SCALE, rc),
  projectiles: {},
  markVisuals: {
    // On an enemy he marked: his team sees it, and his arrow will pop it
    kip_mark: {
      icon: "O",
      bgColor: "rgba(220, 60, 45, 0.85)",
      borderColor: "#fff4e6",
      iconColor: "#ffffff",
      showTimer: true,
      isDebuff: true,
    },
    kip_hunt_speed: HIDDEN,
  },
};
