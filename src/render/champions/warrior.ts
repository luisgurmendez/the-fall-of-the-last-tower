/**
 * Warrior: no champion-specific drawing yet; drawn as the default circle.
 */

import type { ChampionRendererEntry } from "./types";

/**
 * Warrior renderer entry.
 */
export const warriorRenderer: ChampionRendererEntry = {
  images: [],
  createBodyRenderer: null,
  projectiles: {},
  markVisuals: {},
};
