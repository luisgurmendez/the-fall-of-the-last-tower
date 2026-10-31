/**
 * Ambience: the river's water and the jungle's birds, faded in and out by
 * where the camera looks (Camera.step calls this every frame).
 */

import { MOBAConfig, inJungle } from "@siege/shared";
import { getAudio } from "./AudioManager";

/** The river is at full volume this close to its middle line, silent this far */
const RIVER_NEAR = 250;
const RIVER_FAR = 800;

/** Distance from a point to the river's middle line */
function distanceToRiver(x: number, y: number): number {
  const points = MOBAConfig.RIVER.points;
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)));
  }
  return best;
}

export function updateAmbience(x: number, y: number): void {
  const audio = getAudio();
  const river = Math.max(0, Math.min(1, 1 - (distanceToRiver(x, y) - RIVER_NEAR) / (RIVER_FAR - RIVER_NEAR)));
  // inJungle covers blue's half; red's mirrors it with x and y swapped
  const jungle = inJungle(x, y) || inJungle(y, x) ? 1 : 0;
  audio.setLoopLevel("amb_river", river);
  audio.setLoopLevel("amb_jungle", jungle * (1 - river * 0.6));
}
