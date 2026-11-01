/**
 * Elara: a priestess drawn from generated sprite strips (idle, walk, attack
 * and an animation per ability; scripts/generate-sprites.ts). Without the
 * strips she's the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const ELARA_STRIPS = generatedStrips("elara", {
  q: "elara_heal",
  w: "elara_barrier",
  e: "elara_speed",
  r: "elara_resurrection",
}, {
  // The frames where the blow lands: the staff flashes, the beam, the shield, the swirl, the pillar
  attackBlow: 4,
  abilityBlows: { elara_heal: 3, elara_barrier: 4, elara_speed: 3, elara_resurrection: 2 },
});

/** World units per sprite pixel */
const ELARA_SCALE = 0.84;

/**
 * Elara renderer entry.
 */
export const elaraRenderer: ChampionRendererEntry = {
  images: stripImages(ELARA_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(ELARA_STRIPS, ELARA_SCALE, rc),
  projectiles: {},
  markVisuals: {},
};
