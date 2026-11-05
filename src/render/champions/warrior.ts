/**
 * Warrior (Kael): a knight drawn from generated sprite strips (idle, walk,
 * attack and an animation per ability; scripts/generate-sprites.ts) in four
 * directions. Without the strips he's the default circle.
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
  // (Q's strip of 2026-11-04: the sword fully out on frame 5)
  abilityBlows: { warrior_slash: 5, warrior_shield: 5, warrior_ultimate: 7 },
  // Facing down and up the screen (drawn 2026-11-04): the sword's sweep comes later facing
  // down, sooner facing up; facing down, the leap's strike lands sooner
  facing: {
    south: { attackBlow: 7, abilityBlows: { warrior_ultimate: 4 } },
    north: { attackBlow: 5, abilityBlows: { warrior_slash: 4 } },
  },
}, ["south", "north"]);

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
