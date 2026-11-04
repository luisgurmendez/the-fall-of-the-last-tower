/**
 * Nocthar: a hunched, rotting ghoul with huge dirt-caked claws, drawn from
 * generated sprite strips (scripts/generate-sprites.ts) in four directions,
 * on a 64px canvas with medium detail. Ordering his colossus (its Bone
 * Volley, Trample and orders) he plays his commanding point, Heed Me's strip;
 * the colossus plays its own (src/render/entities/summon.ts). His basic
 * attack, a flicked bone shard, is a GPU projectile (src/gpu/fx/projectiles.ts).
 * Without the strips he's the default circle.
 */

import type { ChampionRendererEntry } from "./types";
import { createStripBodyRenderer, generatedStrips, stripImages } from "./stripBody";

const NOCTHAR_STRIPS = generatedStrips("nocthar", {
  q: "nocthar_q",
  w: "nocthar_w",
  e: "nocthar_e",
  r: "nocthar_r",
}, {
  // The frames where the blow lands (of 9; frame 0 stands): the shard
  // flicked, the claws in the ground, the wail at its loudest, the point,
  // the arms sunk in (then held through his ultimate's cast)
  attackBlow: 3,
  abilityBlows: { nocthar_q: 6, nocthar_w: 4, nocthar_e: 3, nocthar_r: 1 },
}, ["south", "north"]);

// Commanding the colossus, he points
for (const abilityId of ["nocthar_colossus_w", "nocthar_colossus_e", "nocthar_colossus_r"]) {
  NOCTHAR_STRIPS.abilities[abilityId] = NOCTHAR_STRIPS.abilities.nocthar_e;
}

/** World units per sprite pixel: the 64px champions' size */
export const NOCTHAR_SCALE = 1.26;

export const noctharRenderer: ChampionRendererEntry = {
  images: stripImages(NOCTHAR_STRIPS),
  createBodyRenderer: (rc) => createStripBodyRenderer(NOCTHAR_STRIPS, NOCTHAR_SCALE, rc),
  projectiles: {},
  markVisuals: {},
};
