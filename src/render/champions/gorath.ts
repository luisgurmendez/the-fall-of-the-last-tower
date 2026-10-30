/**
 * Gorath: default circle body and the icons for Fortify's buffs.
 */

import type { ChampionRendererEntry } from "./types";

/**
 * Gorath renderer entry.
 */
export const gorathRenderer: ChampionRendererEntry = {
  images: [],
  createBodyRenderer: null,
  projectiles: {},
  markVisuals: {
    gorath_fortify_buff: {
      icon: "S",
      bgColor: "rgba(139, 115, 85, 0.8)",
      borderColor: "#8b7355",
      iconColor: "#ffffff",
      showTimer: true,
      isBuff: true,
    },
    gorath_fortify_mr_buff: {
      icon: "S",
      bgColor: "rgba(139, 92, 246, 0.8)",
      borderColor: "#8b5cf6",
      iconColor: "#ffffff",
      showTimer: true,
      isBuff: true,
    },
  },
};
