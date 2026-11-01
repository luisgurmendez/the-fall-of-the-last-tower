/**
 * Protobot 45: a hulking blue war robot, drawn from generated sprite strips
 * (scripts/generate-sprites.ts), on a small canvas with little detail like
 * Urûk's, a little bigger than Calamitus. His claw is a projectile
 * (src/gpu/fx/projectiles.ts). Without the strips he's the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const PROTOBOT_STRIPS = generatedStrips("protobot", {
  q: "protobot_q",
  w: "protobot_w",
  e: "protobot_e",
  r: "protobot_r",
}, {
  // The frames where the blow lands: the punch, the claw, the charge, the rocket fist, the pulse
  attackBlow: 4,
  abilityBlows: { protobot_q: 4, protobot_w: 3, protobot_e: 6, protobot_r: 4 },
});

/** World units per sprite pixel: chunky pixels, and a big machine */
const PROTOBOT_SCALE = 1.6;

const HIDDEN = { icon: "", bgColor: "", borderColor: "", iconColor: "", showTimer: false, hidden: true };

export const protobotRenderer: ChampionRendererEntry = {
  images: stripImages(PROTOBOT_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(PROTOBOT_STRIPS, PROTOBOT_SCALE, rc),
  projectiles: {},
  markVisuals: {
    protobot_learning: HIDDEN,
    protobot_learning_mr: HIDDEN,
  },
};
