/**
 * Warrior (Kael): a knight drawn from generated sprite strips (idle, walk,
 * attack and an animation per ability; scripts/generate-sprites.ts).
 * Without the strips he's the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const WARRIOR_STRIPS = generatedStrips("warrior", {
  q: "warrior_slash",
  w: "warrior_shield",
  e: "warrior_charge",
  r: "warrior_ultimate",
}, {
  // The frames where the blow lands: the sword sweeps, the shield comes up, the leap's slash
  attackBlow: 3,
  abilityBlows: { warrior_slash: 7, warrior_shield: 5, warrior_ultimate: 7 },
});

/** World units per sprite pixel */
const WARRIOR_SCALE = 0.84;

/**
 * Warrior renderer entry.
 */
export const warriorRenderer: ChampionRendererEntry = {
  images: stripImages(WARRIOR_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(WARRIOR_STRIPS, WARRIOR_SCALE, rc),
  projectiles: {},
  markVisuals: {},
};
