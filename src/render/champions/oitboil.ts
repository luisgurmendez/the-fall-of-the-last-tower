/**
 * Oitboil: a goblin pyromancer with a flamethrower on each arm, drawn from
 * generated sprite strips (scripts/generate-sprites.ts), on a small canvas
 * with little detail like Urûk's. His overheat and the flamethrower's
 * stream are GPU effects (src/gpu/fx/championAuras.ts, his VFX). Without
 * the strips he's the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const OITBOIL_STRIPS = generatedStrips("oitboil", {
  q: "oitboil_q",
  w: "oitboil_w",
  e: "oitboil_e",
  r: "oitboil_r",
}, {
  // The frames where the blow lands: the puff of flame, the sparks, the blue fire, the launch, the stream
  attackBlow: 6,
  abilityBlows: { oitboil_q: 4, oitboil_w: 5, oitboil_e: 6, oitboil_r: 3 },
});

/** World units per sprite pixel, as Urûk's: chunky pixels, and a goblin a head shorter */
const OITBOIL_SCALE = 1.26;

const HIDDEN = { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true };

export const oitboilRenderer: ChampionRendererEntry = {
  images: stripImages(OITBOIL_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(OITBOIL_STRIPS, OITBOIL_SCALE, rc),
  projectiles: {},
  markVisuals: {
    // Enemies should see both: he hits harder, then he's open
    oitboil_overheated: {
      icon: "!",
      bgColor: "rgba(255, 112, 32, 0.85)",
      borderColor: "#ffc04a",
      iconColor: "#ffffff",
      showTimer: true,
      isBuff: true,
    },
    oitboil_exhausted: {
      icon: "Z",
      bgColor: "rgba(110, 110, 120, 0.85)",
      borderColor: "#b0b0b8",
      iconColor: "#ffffff",
      showTimer: true,
      isDebuff: true,
    },
    oitboil_exhausted_disarm: HIDDEN,
    oitboil_flamethrower: HIDDEN,
  },
};
