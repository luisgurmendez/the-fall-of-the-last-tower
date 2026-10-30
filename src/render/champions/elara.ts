/**
 * Elara: no champion-specific drawing yet; drawn as the default circle.
 */

import type { ChampionRendererEntry } from "./types";

/**
 * Elara renderer entry.
 */
export const elaraRenderer: ChampionRendererEntry = {
  images: [],
  createBodyRenderer: null,
  projectiles: {},
  markVisuals: {},
};
